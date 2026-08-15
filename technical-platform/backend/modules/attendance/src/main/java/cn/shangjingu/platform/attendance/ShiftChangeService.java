package cn.shangjingu.platform.attendance;

import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.core.process.BusinessNumberService;
import cn.shangjingu.platform.core.process.IdempotencyClaim;
import cn.shangjingu.platform.core.process.IdempotencyRegistry;
import cn.shangjingu.platform.core.process.ProcessRejectedException;
import cn.shangjingu.platform.workflow.WorkflowFormService;
import cn.shangjingu.platform.workflow.WorkflowRuntimeService;
import cn.shangjingu.platform.workflow.WorkflowTaskAssignmentService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** Source-backed P007 schedule publication and controlled shift/substitution aggregate. */
@Service
public final class ShiftChangeService {

  public static final String PROCESS_CODE = "P007", INITIAL_FORM_CODE = "CTR-P007-F01";
  private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24),
      MAX_CONTINUOUS = Duration.ofHours(12);

  private static final Map<String, Set<String>> ACTIONS =
      Map.of(
          "S01",
          Set.of("SUBMIT_DEMAND", "WITHDRAW"),
          "S02",
          Set.of("MATCH_TEMPLATE", "RETURN"),
          "S03",
          Set.of("VALIDATE", "RETURN"),
          "S04",
          Set.of("PUBLISH", "RETURN"),
          "S05",
          Set.of("CONFIRM"),
          "S06",
          Set.of("REQUEST_CHANGE", "NO_CHANGE"),
          "S07",
          Set.of("APPROVE", "REJECT"),
          "S08",
          Set.of("LINK"),
          "S09",
          Set.of("CLOSE_DAY"));

  private final TenantTransactionRunner transactions;

  private final IdempotencyRegistry idempotency;

  private final BusinessNumberService numbers;

  private final TransactionalOutboxService outbox;

  private final WorkflowRuntimeService workflow;

  private final WorkflowTaskAssignmentService tasks;

  private final WorkflowFormService forms;

  private final Repository repository;

  private final ObjectMapper mapper;

  public ShiftChangeService(
      TenantTransactionRunner transactions,
      IdempotencyRegistry idempotency,
      BusinessNumberService numbers,
      TransactionalOutboxService outbox,
      WorkflowRuntimeService workflow,
      WorkflowTaskAssignmentService tasks,
      WorkflowFormService forms,
      Repository repository,
      ObjectMapper mapper) {
    this.transactions = transactions;
    this.idempotency = idempotency;
    this.numbers = numbers;
    this.outbox = outbox;
    this.workflow = workflow;
    this.tasks = tasks;
    this.forms = forms;
    this.repository = repository;
    this.mapper = mapper;
  }

  public ShiftChange create(
      DatabaseSecurityContext actor, String key, String hash, CreateCommand command) {
    requireActor(actor);
    validateCreate(command);
    return transactions.required(
        actor,
        () -> {
          IdempotencyClaim claim =
              idempotency.claim(
                  actor.tenantId(),
                  actor.employeeId(),
                  key,
                  hash,
                  "attendance.shift_change_request",
                  UUID.randomUUID(),
                  IDEMPOTENCY_TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), claim.resourceId());
          }
          UUID targetCenter =
              repository
                  .activeEmployeeCenter(actor.tenantId(), command.ownerEmployeeId())
                  .orElseThrow(() -> rejected("target employee must be active"));
          if (!actor.orgId().equals(targetCenter)) {
            throw rejected("target employee is outside the authorized center");
          }
          UUID version =
              repository
                  .latestPublishedWorkflowVersion(actor.tenantId(), PROCESS_CODE)
                  .orElseThrow(() -> rejected("published workflow is not configured"));
          FormRef form =
              repository
                  .latestPublishedForm(actor.tenantId(), INITIAL_FORM_CODE, PROCESS_CODE, "S01")
                  .orElseThrow(() -> rejected("published P007 initial form is not configured"));
          List<UUID> managers =
              repository.permissionCandidates(
                  actor.tenantId(), "p007.schedule.manage", actor.orgId());
          List<UUID> reviewers =
              repository.permissionCandidates(
                  actor.tenantId(), "p007.schedule.review", actor.orgId());
          if (managers.isEmpty() || reviewers.isEmpty()) {
            throw rejected("eligible schedule manager and reviewer are required");
          }
          BigDecimal hours = hours(command.startAt(), command.endAt());
          String no = numbers.next(actor.tenantId(), actor.employeeId(), PROCESS_CODE);
          ShiftChange draft =
              new ShiftChange(
                  claim.resourceId(),
                  actor.tenantId(),
                  no,
                  null,
                  null,
                  "S01",
                  label("S01"),
                  0,
                  command.businessDate(),
                  command.subject().trim(),
                  command.reason().trim(),
                  actor.orgId(),
                  command.ownerEmployeeId(),
                  command.attendanceType().trim(),
                  command.changeAction().trim(),
                  command.changeReason().trim(),
                  command.contentVersion().trim(),
                  hours,
                  command.startAt(),
                  command.endAt(),
                  command.periodOrCourseNo().trim(),
                  null,
                  null,
                  List.of(),
                  Instant.now());
          repository.insert(draft, actor.employeeId());
          ObjectNode context = mapper.createObjectNode();
          context.put("ownerEmployeeId", command.ownerEmployeeId().toString());
          context.put("ownerCenterId", actor.orgId().toString());
          context.set("targetEmployeeIds", uuidArray(List.of(command.ownerEmployeeId())));
          context.set("managerCandidateIds", uuidArray(managers));
          context.set("reviewerCandidateIds", uuidArray(reviewers));
          WorkflowRuntimeService.Result started =
              workflow.start(
                  new WorkflowRuntimeService.StartCommand(
                      actor.tenantId(),
                      actor.employeeId(),
                      actor.identityId(),
                      version,
                      "attendance.shift_change_request",
                      draft.id(),
                      no,
                      draft.subject(),
                      "NORMAL",
                      context,
                      scoped(key, "start")));
          forms.submit(
              new WorkflowFormService.SubmitForm(
                  actor.tenantId(),
                  actor.employeeId(),
                  actor.identityId(),
                  started.instance().id(),
                  null,
                  form.id(),
                  form.versionNo(),
                  initialValues(started.instance(), draft),
                  scoped(key, "form")));
          if (repository.bindWorkflow(
                  actor.tenantId(), draft.id(), 0, started.instance().id(), actor.employeeId())
              != 1) {
            throw rejected("concurrent workflow binding conflict");
          }
          emit(actor, draft, "S01", "CREATED", "S01", List.of(command.ownerEmployeeId()));
          return required(actor.tenantId(), draft.id());
        });
  }

  public ShiftChange act(
      DatabaseSecurityContext actor,
      UUID id,
      String actionCode,
      String key,
      String hash,
      ActionCommand command) {
    requireActor(actor);
    Objects.requireNonNull(command, "P007 action command is required");
    String action = normalize(actionCode);
    return transactions.required(
        actor,
        () -> {
          IdempotencyClaim claim =
              idempotency.claim(
                  actor.tenantId(),
                  actor.employeeId(),
                  key,
                  hash,
                  "attendance.shift_change_request.action",
                  id,
                  IDEMPOTENCY_TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), id);
          }
          ShiftChange current = required(actor.tenantId(), id);
          if (current.versionNo() != command.expectedVersion()) {
            throw rejected("shift-change version conflict");
          }
          WorkflowRuntimeService.Result runtime =
              workflow.get(actor.tenantId(), current.workflowInstanceId());
          String node = runtime.instance().currentNodeCode();
          if (!node.equals(current.currentNodeCode())) {
            throw rejected("business projection is stale relative to workflow runtime");
          }
          if (!ACTIONS.getOrDefault(node, Set.of()).contains(action)) {
            throw rejected("action is not allowed at " + node);
          }
          validateAction(actor, current, node, action, command);
          if ("S01".equals(node)) {
            if (runtime.instance().initiatorId() != null
                && !actor.employeeId().equals(runtime.instance().initiatorId())) {
              throw rejected("only the demand owner may submit or withdraw");
            }
          } else {
            if (runtime.task() == null) {
              throw rejected("current workflow task is missing");
            }
            tasks.claim(
                new WorkflowTaskAssignmentService.ClaimCommand(
                    actor.tenantId(), runtime.task().id(), actor.employeeId()));
          }
          if ("S03".equals(node) && "VALIDATE".equals(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "qualification_check",
                qualificationEvidence(current),
                actor.employeeId());
          }
          if ("S05".equals(node)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "employee_confirmation",
                requiredEvidence(command.evidence(), "employee confirmation"),
                actor.employeeId());
          }
          if ("S06".equals(node) && "REQUEST_CHANGE".equals(action)) {
            repository.appendChangeProposal(
                actor.tenantId(), id, current, command, actor.employeeId());
          }
          if ("S07".equals(node) && "APPROVE".equals(action)) {
            Proposal p =
                repository
                    .latestProposal(actor.tenantId(), id)
                    .orElseThrow(() -> rejected("approved change requires an immutable proposal"));
            validateProposed(current, p);
            repository.applyProposal(actor.tenantId(), id, p, actor.employeeId());
          }
          if ("S07".equals(node) && "REJECT".equals(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "review_rejection",
                requiredEvidence(command.evidence(), "review rejection"),
                actor.employeeId());
          }
          if ("S08".equals(node)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "integration_receipt",
                requiredEvidence(command.evidence(), "attendance/catering/shuttle linkage"),
                actor.employeeId());
          }
          if ("S09".equals(node)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "day_close",
                requiredEvidence(command.evidence(), "day close"),
                actor.employeeId());
          }
          WorkflowRuntimeService.Result moved =
              workflow.act(
                  new WorkflowRuntimeService.ActionCommand(
                      actor.tenantId(),
                      actor.employeeId(),
                      actor.identityId(),
                      current.workflowInstanceId(),
                      runtime.task() == null ? null : runtime.task().id(),
                      node,
                      action,
                      trim(command.reason()),
                      scoped(key, "workflow")));
          Instant closed =
              "END".equals(moved.instance().currentNodeCode())
                  ? moved.instance().finishedAt()
                  : null;
          if (repository.move(
                  actor.tenantId(),
                  id,
                  current.versionNo(),
                  label(moved.instance().currentNodeCode()),
                  trim(command.resultSummary()),
                  trim(command.actualAttendanceSummary()),
                  closed,
                  actor.employeeId())
              != 1) {
            throw rejected("concurrent shift-change transition conflict");
          }
          ShiftChange result = required(actor.tenantId(), id);
          emit(actor, result, node, action, moved.instance().currentNodeCode(), recipients(moved));
          return result;
        });
  }

  public Optional<ShiftChange> find(DatabaseSecurityContext actor, UUID id) {
    requireActor(actor);
    return transactions.required(actor, () -> repository.find(actor.tenantId(), id));
  }

  public List<ShiftChange> list(DatabaseSecurityContext actor) {
    requireActor(actor);
    return transactions.required(actor, () -> repository.list(actor.tenantId()));
  }

  public List<ShiftChange> schedules(DatabaseSecurityContext actor) {
    return list(actor).stream()
        .filter(v -> Set.of("S05", "S06", "S07", "S08", "S09", "END").contains(v.currentNodeCode()))
        .toList();
  }

  public boolean employeeNode(ShiftChange value) {
    return value != null && Set.of("S05", "S06").contains(value.currentNodeCode());
  }

  public boolean reviewNode(ShiftChange value) {
    return value != null && "S07".equals(value.currentNodeCode());
  }

  private void validateAction(
      DatabaseSecurityContext actor,
      ShiftChange current,
      String node,
      String action,
      ActionCommand c) {
    if (Set.of("RETURN", "REJECT").contains(action) && trim(c.reason()) == null) {
      throw rejected("return and rejection require a reason");
    }
    if ("S03".equals(node) && "VALIDATE".equals(action)) {
      if (!repository.hasQualification(
          actor.tenantId(),
          current.ownerEmployeeId(),
          current.contentVersion(),
          current.startAt())) {
        throw rejected(
            "employee lacks an effective qualification for the schedule content version");
      }
      if (repository.hasEffectiveOverlap(
          actor.tenantId(),
          current.ownerEmployeeId(),
          current.startAt(),
          current.endAt(),
          current.id())) {
        throw rejected("schedule interval overlaps an effective attendance record");
      }
    }
    if ("S05".equals(node) && !actor.employeeId().equals(current.ownerEmployeeId())) {
      throw rejected("only the scheduled employee may confirm");
    }
    if ("S06".equals(node) && !actor.employeeId().equals(current.ownerEmployeeId())) {
      throw rejected("only the scheduled employee may request a shift change");
    }
    if ("REQUEST_CHANGE".equals(action)) {
      if (c.proposedStartAt() == null
          || c.proposedEndAt() == null
          || !c.proposedEndAt().isAfter(c.proposedStartAt())) {
        throw rejected("shift change requires a valid proposed interval");
      }
      hours(c.proposedStartAt(), c.proposedEndAt());
      if (trim(c.reason()) == null) {
        throw rejected("shift change requires a reason");
      }
      if (c.handoverItems() == null
          || !c.handoverItems().isArray()
          || c.handoverItems().isEmpty()) {
        throw rejected("shift change requires handover items");
      }
    }
    if ("S07".equals(node)
        && "APPROVE".equals(action)
        && actor.employeeId().equals(current.ownerEmployeeId())) {
      throw rejected("employee cannot approve their own shift change");
    }
    if ("S09".equals(node)
        && "CLOSE_DAY".equals(action)
        && trim(c.actualAttendanceSummary()) == null) {
      throw rejected("day close requires actual attendance summary");
    }
  }

  private void validateProposed(ShiftChange current, Proposal p) {
    UUID employee =
        p.substituteEmployeeId() == null ? current.ownerEmployeeId() : p.substituteEmployeeId();
    UUID center =
        repository
            .activeEmployeeCenter(current.tenantId(), employee)
            .orElseThrow(() -> rejected("substitute employee must be active"));
    if (!current.ownerCenterId().equals(center)) {
      throw rejected("substitute employee is outside the schedule center");
    }
    if (!repository.hasQualification(
        current.tenantId(), employee, current.contentVersion(), p.startAt())) {
      throw rejected("substitute employee lacks an effective qualification");
    }
    if (repository.hasEffectiveOverlap(
        current.tenantId(), employee, p.startAt(), p.endAt(), current.id())) {
      throw rejected("proposed shift overlaps an effective attendance record");
    }
    hours(p.startAt(), p.endAt());
  }

  private JsonNode qualificationEvidence(ShiftChange c) {
    return mapper
        .createObjectNode()
        .put("employeeId", c.ownerEmployeeId().toString())
        .put("contentVersion", c.contentVersion())
        .put("checkedAt", Instant.now().toString())
        .put("qualified", true)
        .put("continuousHours", c.durationHours());
  }

  private static JsonNode requiredEvidence(JsonNode n, String purpose) {
    if (n == null || n.isNull() || !n.isObject()) {
      throw rejected(purpose + " requires immutable evidence");
    }
    return n;
  }

  private List<WorkflowFormService.FieldValue> initialValues(
      WorkflowRuntimeService.Instance instance, ShiftChange c) {
    List<WorkflowFormService.FieldValue> v = new ArrayList<>();
    v.add(text("process_instance_no", instance.instanceNo()));
    v.add(text("subject", c.subject()));
    v.add(text("reason", c.reason()));
    v.add(text("owner_employee_id", c.ownerEmployeeId().toString()));
    v.add(text("attendance_type", c.attendanceType()));
    v.add(text("change_action", c.changeAction()));
    v.add(text("content_version", c.contentVersion()));
    v.add(text("period_or_course_no", c.periodOrCourseNo()));
    v.add(text("start_at", c.startAt().toString()));
    v.add(text("end_at", c.endAt().toString()));
    v.add(number("duration_hours", c.durationHours()));
    return List.copyOf(v);
  }

  private static WorkflowFormService.FieldValue text(String c, String v) {
    return new WorkflowFormService.FieldValue(
        c, "TEXT", v, null, null, null, null, null, "P1", false);
  }

  private static WorkflowFormService.FieldValue number(String c, BigDecimal v) {
    return new WorkflowFormService.FieldValue(
        c, "NUMBER", null, v, null, null, null, null, "P1", false);
  }

  private void emit(
      DatabaseSecurityContext actor,
      ShiftChange c,
      String node,
      String action,
      String target,
      List<UUID> recipients) {
    ObjectNode p = mapper.createObjectNode();
    p.put("shiftChangeId", c.id().toString());
    p.put("businessNo", c.businessNo());
    p.put(
        "event",
        "CREATED".equals(action)
            ? "P007.shift.created"
            : "P007.stage." + node.substring(1) + ".completed");
    p.put("actionCode", action);
    p.put("nodeCode", target);
    p.set("recipientEmployeeIds", uuidArray(recipients));
    int version = Math.max(1, c.versionNo() + 1);
    outbox.enqueue(
        new TransactionalOutboxService.Command(
            actor.tenantId(),
            actor.employeeId(),
            "P007_SHIFT_CHANGE",
            c.id(),
            "P007_SHIFT_EVENT",
            version,
            json(p),
            "p007:"
                + c.id()
                + ":v"
                + version
                + ":"
                + node.toLowerCase(Locale.ROOT)
                + ":"
                + action.toLowerCase(Locale.ROOT)));
  }

  private List<UUID> recipients(WorkflowRuntimeService.Result r) {
    if (r.task() == null || r.task().candidateRule() == null) {
      return List.of();
    }
    JsonNode f = r.task().candidateRule().get("field"),
        v =
            f == null || r.instance().contextSnapshot() == null
                ? null
                : r.instance().contextSnapshot().get(f.asText());
    List<UUID> ids = new ArrayList<>();
    if (v != null && v.isArray()) {
      v.forEach(
          n -> {
            try {
              ids.add(UUID.fromString(n.asText()));
            } catch (IllegalArgumentException e) {
              throw rejected("workflow candidate id is invalid");
            }
          });
    }
    return List.copyOf(ids);
  }

  private ArrayNode uuidArray(List<UUID> ids) {
    ArrayNode a = mapper.createArrayNode();
    ids.stream().distinct().forEach(v -> a.add(v.toString()));
    return a;
  }

  private String json(JsonNode n) {
    try {
      return mapper.writeValueAsString(n);
    } catch (JsonProcessingException e) {
      throw rejected("event payload cannot be serialized");
    }
  }

  private ShiftChange required(UUID tenant, UUID id) {
    return repository.find(tenant, id).orElseThrow(() -> rejected("shift change not found"));
  }

  private static void validateCreate(CreateCommand c) {
    if (c == null
        || c.businessDate() == null
        || c.ownerEmployeeId() == null
        || c.startAt() == null
        || c.endAt() == null) {
      throw rejected("business date, employee and interval are required");
    }
    if (c.subject() == null
        || c.subject().trim().length() < 5
        || c.subject().trim().length() > 120) {
      throw rejected("subject length must be 5..120");
    }
    if (c.reason() == null || c.reason().trim().length() < 10) {
      throw rejected("reason must contain at least 10 characters");
    }
    if (!Set.of("排班", "换班", "替班").contains(trim(c.attendanceType()))
        || !Set.of("制定", "换班", "替班").contains(trim(c.changeAction()))) {
      throw rejected("attendance type or change action is not source-backed");
    }
    if (trim(c.changeReason()) == null
        || trim(c.contentVersion()) == null
        || trim(c.periodOrCourseNo()) == null) {
      throw rejected("change reason, qualification version and period are required");
    }
    hours(c.startAt(), c.endAt());
  }

  private static BigDecimal hours(Instant start, Instant end) {
    if (start == null || end == null || !end.isAfter(start)) {
      throw rejected("end time must be after start time");
    }
    Duration d = Duration.between(start, end);
    if (d.compareTo(MAX_CONTINUOUS) > 0) {
      throw rejected("continuous work may not exceed 12 hours");
    }
    return BigDecimal.valueOf(d.toMinutes())
        .divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP);
  }

  private static void requireActor(DatabaseSecurityContext a) {
    if (a == null
        || a.tenantId() == null
        || a.employeeId() == null
        || a.identityId() == null
        || a.orgId() == null) {
      throw rejected("authenticated tenant employee identity is required");
    }
  }

  private static String normalize(String v) {
    String n = v == null ? "" : v.trim().toUpperCase(Locale.ROOT);
    if (!n.matches("[A-Z0-9_]{1,32}")) {
      throw rejected("invalid action code");
    }
    return n;
  }

  private static String scoped(String key, String suffix) {
    if (key == null || key.isBlank() || key.length() > 160) {
      throw rejected("valid idempotency key is required");
    }
    return key + ":" + suffix;
  }

  private static String trim(String v) {
    return v == null || v.isBlank() ? null : v.trim();
  }

  private static ProcessRejectedException rejected(String m) {
    return new ProcessRejectedException("P007 " + m);
  }

  public static String label(String n) {
    return switch (n) {
      case "S01" -> "业务量与活动需求输入";
      case "S02" -> "班次模板匹配";
      case "S03" -> "资格与连续工时校验";
      case "S04" -> "主管发布排班";
      case "S05" -> "员工确认";
      case "S06" -> "换班/替班申请";
      case "S07" -> "变更审批";
      case "S08" -> "考勤与餐饮/班车联动";
      case "S09" -> "日结";
      case "END" -> "已日结";
      default -> throw rejected("unknown source node " + n);
    };
  }

  public record CreateCommand(
      LocalDate businessDate,
      String subject,
      String reason,
      UUID ownerEmployeeId,
      String attendanceType,
      String changeAction,
      String changeReason,
      String contentVersion,
      String periodOrCourseNo,
      Instant startAt,
      Instant endAt) {}

  public record ActionCommand(
      int expectedVersion,
      String reason,
      String resultSummary,
      String actualAttendanceSummary,
      Instant proposedStartAt,
      Instant proposedEndAt,
      UUID substituteEmployeeId,
      JsonNode handoverItems,
      JsonNode evidence) {}

  public record Item(
      UUID id, String fieldCode, int itemSeq, String itemName, JsonNode value, Instant createdAt) {}

  public record Proposal(
      Instant startAt, Instant endAt, UUID substituteEmployeeId, JsonNode handoverItems) {}

  public record ShiftChange(
      UUID id,
      UUID tenantId,
      String businessNo,
      UUID workflowInstanceId,
      String workflowInstanceNo,
      String currentNodeCode,
      String status,
      int versionNo,
      LocalDate businessDate,
      String subject,
      String reason,
      UUID ownerCenterId,
      UUID ownerEmployeeId,
      String attendanceType,
      String changeAction,
      String changeReason,
      String contentVersion,
      BigDecimal durationHours,
      Instant startAt,
      Instant endAt,
      String periodOrCourseNo,
      String actualAttendanceSummary,
      String resultSummary,
      List<Item> items,
      Instant updatedAt) {

    public ShiftChange metadataOnly() {
      return new ShiftChange(
          id,
          tenantId,
          businessNo,
          workflowInstanceId,
          workflowInstanceNo,
          currentNodeCode,
          status,
          versionNo,
          businessDate,
          subject,
          null,
          ownerCenterId,
          ownerEmployeeId,
          attendanceType,
          changeAction,
          null,
          contentVersion,
          durationHours,
          startAt,
          endAt,
          periodOrCourseNo,
          null,
          null,
          List.of(),
          updatedAt);
    }
  }

  public record FormRef(UUID id, int versionNo) {}

  public interface Repository {

    Optional<UUID> latestPublishedWorkflowVersion(UUID tenant, String code);

    Optional<FormRef> latestPublishedForm(UUID tenant, String form, String process, String node);

    List<UUID> permissionCandidates(UUID tenant, String permission, UUID org);

    Optional<UUID> activeEmployeeCenter(UUID tenant, UUID employee);

    boolean hasQualification(UUID tenant, UUID employee, String contentVersion, Instant at);

    boolean hasEffectiveOverlap(
        UUID tenant, UUID employee, Instant start, Instant end, UUID excluded);

    void insert(ShiftChange value, UUID actor);

    int bindWorkflow(UUID tenant, UUID id, int version, UUID workflow, UUID actor);

    int move(
        UUID tenant,
        UUID id,
        int version,
        String status,
        String result,
        String attendance,
        Instant closed,
        UUID actor);

    void appendEvidence(UUID tenant, UUID id, String field, JsonNode evidence, UUID actor);

    void appendChangeProposal(
        UUID tenant, UUID id, ShiftChange current, ActionCommand command, UUID actor);

    Optional<Proposal> latestProposal(UUID tenant, UUID id);

    void applyProposal(UUID tenant, UUID id, Proposal p, UUID actor);

    Optional<ShiftChange> find(UUID tenant, UUID id);

    List<ShiftChange> list(UUID tenant);
  }
}
