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

/**
 * P009 overtime lifecycle. It records an external payroll receipt but never calculates or initiates
 * payment.
 */
@Service
public final class OvertimeService {

  public static final String PROCESS_CODE = "P009", INITIAL_FORM_CODE = "EMP-P009-F01";

  private static final Duration TTL = Duration.ofHours(24);

  private static final Map<String, Set<String>> ACTIONS =
      Map.ofEntries(
          Map.entry("S01", Set.of("SUBMIT", "WITHDRAW")),
          Map.entry("S02", Set.of("VALIDATE", "RETURN")),
          Map.entry("S03", Set.of("APPROVE", "REJECT")),
          Map.entry("S04", Set.of("RECORD_FACT")),
          Map.entry("S05", Set.of("ACCEPT_RESULT", "REWORK")),
          Map.entry("S06", Set.of("HR_CONFIRM", "HR_RETURN")),
          Map.entry("S07", Set.of("CONFIRM_SCHEME")),
          Map.entry("S08", Set.of("RECORD_RECEIPT")),
          Map.entry("S09", Set.of("ARCHIVE")));

  private final TenantTransactionRunner transactions;

  private final IdempotencyRegistry idempotency;

  private final BusinessNumberService numbers;

  private final TransactionalOutboxService outbox;

  private final WorkflowRuntimeService workflow;

  private final WorkflowTaskAssignmentService tasks;

  private final WorkflowFormService forms;

  private final Repository repository;

  private final ObjectMapper mapper;

  public OvertimeService(
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

  public Overtime create(DatabaseSecurityContext actor, String key, String hash, CreateCommand c) {
    requireActor(actor);
    validateCreate(c);
    return transactions.required(
        actor,
        () -> {
          IdempotencyClaim claim =
              idempotency.claim(
                  actor.tenantId(),
                  actor.employeeId(),
                  key,
                  hash,
                  "attendance.overtime_request",
                  UUID.randomUUID(),
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), claim.resourceId());
          }
          if (repository.hasEffectiveOverlap(
              actor.tenantId(), actor.employeeId(), c.startAt(), c.endAt(), claim.resourceId())) {
            throw rejected("overtime interval overlaps an effective attendance record");
          }
          UUID version =
              repository
                  .latestPublishedWorkflowVersion(actor.tenantId(), PROCESS_CODE)
                  .orElseThrow(() -> rejected("published workflow is not configured"));
          FormRef form =
              repository
                  .latestPublishedForm(actor.tenantId(), INITIAL_FORM_CODE, PROCESS_CODE, "S01")
                  .orElseThrow(() -> rejected("published initial form is not configured"));
          List<UUID>
              managers =
                  repository.permissionCandidates(
                      actor.tenantId(), "p009.overtime.manage", actor.orgId()),
              reviewers =
                  repository.permissionCandidates(
                      actor.tenantId(), "p009.overtime.review", actor.orgId()),
              hr =
                  repository.permissionCandidates(
                      actor.tenantId(), "p009.overtime.hr", actor.orgId());
          if (managers.isEmpty() || reviewers.isEmpty() || hr.isEmpty()) {
            throw rejected("eligible manager, reviewer and HR reviewer are required");
          }
          BigDecimal duration = hours(c.startAt(), c.endAt());
          Overtime draft =
              new Overtime(
                  claim.resourceId(),
                  actor.tenantId(),
                  numbers.next(actor.tenantId(), actor.employeeId(), PROCESS_CODE),
                  null,
                  null,
                  "S01",
                  label("S01"),
                  0,
                  c.businessDate(),
                  c.subject().trim(),
                  c.reason().trim(),
                  actor.orgId(),
                  actor.employeeId(),
                  c.attendanceType().trim(),
                  c.emergency(),
                  duration,
                  c.startAt(),
                  c.endAt(),
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  List.of(),
                  Instant.now());
          repository.insert(draft, actor.employeeId());
          if (c.emergency()) {
            repository.appendEvidence(
                actor.tenantId(),
                draft.id(),
                "emergency_registration",
                requiredEvidence(c.emergencyEvidence(), "emergency registration"),
                actor.employeeId());
          }
          ObjectNode context = mapper.createObjectNode();
          context.put("ownerEmployeeId", actor.employeeId().toString());
          context.put("ownerCenterId", actor.orgId().toString());
          context.set("targetEmployeeIds", uuids(List.of(actor.employeeId())));
          context.set("managerCandidateIds", uuids(managers));
          context.set("reviewerCandidateIds", uuids(reviewers));
          context.set("hrCandidateIds", uuids(hr));
          WorkflowRuntimeService.Result started =
              workflow.start(
                  new WorkflowRuntimeService.StartCommand(
                      actor.tenantId(),
                      actor.employeeId(),
                      actor.identityId(),
                      version,
                      "attendance.overtime_request",
                      draft.id(),
                      draft.businessNo(),
                      draft.subject(),
                      c.emergency() ? "HIGH" : "NORMAL",
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
                  initial(started.instance(), draft),
                  scoped(key, "form")));
          if (repository.bindWorkflow(
                  actor.tenantId(), draft.id(), 0, started.instance().id(), actor.employeeId())
              != 1) {
            throw rejected("concurrent workflow binding conflict");
          }
          emit(actor, draft, "S01", "CREATED", "S01", List.of(actor.employeeId()));
          return required(actor.tenantId(), draft.id());
        });
  }

  public Overtime act(
      DatabaseSecurityContext actor,
      UUID id,
      String actionCode,
      String key,
      String hash,
      ActionCommand c) {
    requireActor(actor);
    Objects.requireNonNull(c, "P009 action command is required");
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
                  "attendance.overtime_request.action",
                  id,
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), id);
          }
          Overtime current = required(actor.tenantId(), id);
          if (current.versionNo() != c.expectedVersion()) {
            throw rejected("overtime version conflict");
          }
          WorkflowRuntimeService.Result runtime =
              workflow.get(actor.tenantId(), current.workflowInstanceId());
          String node = runtime.instance().currentNodeCode();
          if (!node.equals(current.currentNodeCode())) {
            throw rejected("business projection is stale");
          }
          if (!ACTIONS.getOrDefault(node, Set.of()).contains(action)) {
            throw rejected("action is not allowed at " + node);
          }
          validateAction(actor, current, node, action, c);
          if ("S01".equals(node)) {
            if (!actor.employeeId().equals(current.ownerEmployeeId())) {
              throw rejected("only the employee may submit or withdraw");
            }
          } else {
            if (runtime.task() == null) {
              throw rejected("current workflow task is missing");
            }
            tasks.claim(
                new WorkflowTaskAssignmentService.ClaimCommand(
                    actor.tenantId(), runtime.task().id(), actor.employeeId()));
          }
          if ("VALIDATE".equals(action)
              && repository.hasEffectiveOverlap(
                  actor.tenantId(),
                  current.ownerEmployeeId(),
                  current.startAt(),
                  current.endAt(),
                  current.id())) {
            throw rejected("overtime interval overlaps an effective attendance record");
          }
          if (Set.of("APPROVE", "REJECT").contains(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "supervisor_decision",
                decision(action, c.reason(), actor.employeeId()),
                actor.employeeId());
          }
          if ("RECORD_FACT".equals(action)) {
            BigDecimal actual = hours(c.actualStartAt(), c.actualEndAt());
            repository.recordFacts(
                actor.tenantId(),
                id,
                c.actualStartAt(),
                c.actualEndAt(),
                actual,
                c.actualAttendanceSummary(),
                actor.employeeId());
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "labor_attendance_fact",
                requiredEvidence(c.evidence(), "actual labor fact"),
                actor.employeeId());
          }
          if (Set.of("ACCEPT_RESULT", "REWORK").contains(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "result_acceptance",
                result(action, c.resultSummary(), c.reason(), actor.employeeId()),
                actor.employeeId());
          }
          if (Set.of("HR_CONFIRM", "HR_RETURN").contains(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "hr_review",
                hr(action, c.schemeType(), c.reason(), c.evidence(), actor.employeeId()),
                actor.employeeId());
            if ("HR_CONFIRM".equals(action)) {
              repository.recordScheme(
                  actor.tenantId(), id, scheme(c.schemeType()), actor.employeeId());
            }
          }
          if ("CONFIRM_SCHEME".equals(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "employee_scheme_confirmation",
                requiredEvidence(c.evidence(), "employee scheme confirmation"),
                actor.employeeId());
          }
          if ("RECORD_RECEIPT".equals(action)) {
            String scheme = Objects.toString(current.schemeType(), "");
            if (c.externalReference() == null
                || c.externalReference().isBlank()
                || c.externalReference().length() > 32) {
              throw rejected("external receipt reference must contain 1 to 32 characters");
            }
            if ("PAYROLL".equals(scheme) && c.externallyDeterminedAmount() == null) {
              throw rejected("payroll receipt requires externally determined amount");
            }
            if (!"PAYROLL".equals(scheme) && c.externallyDeterminedAmount() != null) {
              throw rejected("time-off receipt cannot contain a payroll amount");
            }
            repository.recordReceipt(
                actor.tenantId(),
                id,
                c.externalReference(),
                c.externallyDeterminedAmount(),
                receipt(c, scheme),
                actor.employeeId());
          }
          if ("ARCHIVE".equals(action)) {
            repository.appendEvidence(
                actor.tenantId(),
                id,
                "archive_receipt",
                requiredEvidence(c.evidence(), "archive"),
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
                      trim(c.reason()),
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
                  trim(c.resultSummary()),
                  closed,
                  actor.employeeId())
              != 1) {
            throw rejected("concurrent overtime transition conflict");
          }
          Overtime result = required(actor.tenantId(), id);
          emit(actor, result, node, action, moved.instance().currentNodeCode(), recipients(moved));
          return result;
        });
  }

  public Optional<Overtime> find(DatabaseSecurityContext a, UUID id) {
    requireActor(a);
    return transactions.required(a, () -> repository.find(a.tenantId(), id));
  }

  public List<Overtime> list(DatabaseSecurityContext a) {
    requireActor(a);
    return transactions.required(a, () -> repository.list(a.tenantId()));
  }

  public String permissionForNode(Overtime v) {
    return switch (Objects.toString(v.currentNodeCode(), "")) {
      case "S01", "S07" -> "p009.overtime.submit";
      case "S03", "S05" -> "p009.overtime.review";
      case "S06", "S08" -> "p009.overtime.hr";
      default -> "p009.overtime.manage";
    };
  }

  private void validateAction(
      DatabaseSecurityContext a, Overtime v, String node, String action, ActionCommand c) {
    if (Set.of("RETURN", "REJECT", "REWORK", "HR_RETURN").contains(action)
        && trim(c.reason()) == null) {
      throw rejected("return or rejection requires a reason");
    }
    if (Set.of("S03", "S05", "S06", "S08").contains(node)
        && a.employeeId().equals(v.ownerEmployeeId())) {
      throw rejected("employee cannot review, settle or receipt their own overtime");
    }
    if ("S07".equals(node) && !a.employeeId().equals(v.ownerEmployeeId())) {
      throw rejected("only the employee may confirm the compensation scheme");
    }
    if ("RECORD_FACT".equals(action)
        && (trim(c.actualAttendanceSummary()) == null
            || c.actualStartAt() == null
            || c.actualEndAt() == null)) {
      throw rejected("actual labor fact requires interval and attendance summary");
    }
    if (Set.of("ACCEPT_RESULT", "REWORK").contains(action) && trim(c.resultSummary()) == null) {
      throw rejected("result acceptance requires a result summary");
    }
    if ("HR_CONFIRM".equals(action) && trim(c.schemeType()) == null) {
      throw rejected("HR confirmation requires a compensation scheme");
    }
    if ("RECORD_RECEIPT".equals(action)
        && (trim(c.externalReference()) == null
            || c.evidence() == null
            || !c.evidence().isObject())) {
      throw rejected("external payroll/time-off receipt is required");
    }
    if (c.externallyDeterminedAmount() != null && c.externallyDeterminedAmount().signum() < 0) {
      throw rejected("external receipt amount cannot be negative");
    }
  }

  private List<WorkflowFormService.FieldValue> initial(
      WorkflowRuntimeService.Instance i, Overtime v) {
    return List.of(
        text("process_instance_no", i.instanceNo()),
        text("subject", v.subject()),
        text("reason", v.reason()),
        text("owner_employee_id", v.ownerEmployeeId().toString()),
        text("attendance_type", v.attendanceType()),
        text("start_at", v.startAt().toString()),
        text("end_at", v.endAt().toString()),
        number("duration_hours", v.durationHours()),
        bool("emergency", v.emergency()));
  }

  private static WorkflowFormService.FieldValue text(String c, String v) {
    return new WorkflowFormService.FieldValue(
        c, "TEXT", v, null, null, null, null, null, "P1", false);
  }

  private static WorkflowFormService.FieldValue number(String c, BigDecimal v) {
    return new WorkflowFormService.FieldValue(
        c, "NUMBER", null, v, null, null, null, null, "P1", false);
  }

  private static WorkflowFormService.FieldValue bool(String c, boolean v) {
    return new WorkflowFormService.FieldValue(
        c, "BOOLEAN", null, null, null, v, null, null, "P1", false);
  }

  private ObjectNode decision(String action, String reason, UUID actor) {
    return mapper
        .createObjectNode()
        .put("decision", action)
        .put("reason", Objects.toString(trim(reason), ""))
        .put("reviewer", actor.toString())
        .put("recordedAt", Instant.now().toString());
  }

  private ObjectNode result(String action, String summary, String reason, UUID actor) {
    return mapper
        .createObjectNode()
        .put("decision", action)
        .put("resultSummary", summary)
        .put("reason", Objects.toString(trim(reason), ""))
        .put("reviewer", actor.toString())
        .put("recordedAt", Instant.now().toString());
  }

  private ObjectNode hr(
      String action, String scheme, String reason, JsonNode evidence, UUID actor) {
    if (evidence == null || !evidence.isObject()) {
      throw rejected("HR review requires immutable evidence");
    }
    return mapper
        .createObjectNode()
        .put("decision", action)
        .put("schemeType", "HR_CONFIRM".equals(action) ? scheme(scheme) : "")
        .put("reason", Objects.toString(trim(reason), ""))
        .put("reviewer", actor.toString())
        .put("recordedAt", Instant.now().toString())
        .set("evidence", evidence);
  }

  private ObjectNode receipt(ActionCommand c, String scheme) {
    return mapper
        .createObjectNode()
        .put("schemeType", scheme)
        .put("externalReference", c.externalReference().trim())
        .put("recordedAt", Instant.now().toString())
        .set("externalEvidence", c.evidence());
  }

  private void emit(
      DatabaseSecurityContext a,
      Overtime v,
      String node,
      String action,
      String target,
      List<UUID> recipients) {
    ObjectNode p =
        mapper
            .createObjectNode()
            .put("overtimeId", v.id().toString())
            .put("businessNo", v.businessNo())
            .put(
                "event",
                "CREATED".equals(action)
                    ? "P009.overtime.created"
                    : "P009.stage." + node.substring(1) + ".completed")
            .put("actionCode", action)
            .put("nodeCode", target);
    p.set("recipientEmployeeIds", uuids(recipients));
    int version = Math.max(1, v.versionNo() + 1);
    outbox.enqueue(
        new TransactionalOutboxService.Command(
            a.tenantId(),
            a.employeeId(),
            "P009_OVERTIME",
            v.id(),
            "P009_OVERTIME_EVENT",
            version,
            json(p),
            "p009:"
                + v.id()
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

  private ArrayNode uuids(List<UUID> ids) {
    ArrayNode a = mapper.createArrayNode();
    ids.stream().distinct().forEach(x -> a.add(x.toString()));
    return a;
  }

  private Overtime required(UUID t, UUID id) {
    return repository.find(t, id).orElseThrow(() -> rejected("overtime request not found"));
  }

  private String json(JsonNode n) {
    try {
      return mapper.writeValueAsString(n);
    } catch (JsonProcessingException e) {
      throw rejected("event payload cannot be serialized");
    }
  }

  private static void validateCreate(CreateCommand c) {
    if (c == null || c.businessDate() == null || c.startAt() == null || c.endAt() == null) {
      throw rejected("business date and interval are required");
    }
    if (trim(c.subject()) == null || c.subject().trim().length() < 5) {
      throw rejected("subject requires at least 5 characters");
    }
    if (trim(c.reason()) == null || c.reason().trim().length() < 10) {
      throw rejected("reason requires at least 10 characters");
    }
    if (trim(c.attendanceType()) == null) {
      throw rejected("attendance type is required");
    }
    hours(c.startAt(), c.endAt());
    if (c.emergency()) {
      requiredEvidence(c.emergencyEvidence(), "emergency registration");
    }
  }

  private static BigDecimal hours(Instant s, Instant e) {
    if (s == null || e == null || !e.isAfter(s)) {
      throw rejected("end time must be after start time");
    }
    return BigDecimal.valueOf(Duration.between(s, e).toMinutes())
        .divide(BigDecimal.valueOf(60), 6, RoundingMode.HALF_UP);
  }

  private static JsonNode requiredEvidence(JsonNode n, String p) {
    if (n == null || !n.isObject()) {
      throw rejected(p + " requires immutable evidence");
    }
    return n;
  }

  private static String scheme(String s) {
    String v = normalize(s);
    if (!Set.of("PAYROLL", "TIME_OFF").contains(v)) {
      throw rejected("compensation scheme must be PAYROLL or TIME_OFF");
    }
    return v;
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
      throw rejected("invalid code");
    }
    return n;
  }

  private static String scoped(String k, String s) {
    if (k == null || k.isBlank() || k.length() > 160) {
      throw rejected("valid idempotency key is required");
    }
    return k + ":" + s;
  }

  private static String trim(String v) {
    return v == null || v.isBlank() ? null : v.trim();
  }

  private static ProcessRejectedException rejected(String m) {
    return new ProcessRejectedException("P009 " + m);
  }

  public static String label(String n) {
    return switch (n) {
      case "S01" -> "事前申请/紧急事实登记";
      case "S02" -> "必要性与任务校验";
      case "S03" -> "主管审批";
      case "S04" -> "实际考勤与劳动事实";
      case "S05" -> "成果验收";
      case "S06" -> "人事复核";
      case "S07" -> "法定工资/调休方案";
      case "S08" -> "薪酬回执";
      case "S09" -> "归档";
      case "END" -> "已关闭";
      default -> throw rejected("unknown source node " + n);
    };
  }

  public record CreateCommand(
      LocalDate businessDate,
      String subject,
      String reason,
      String attendanceType,
      boolean emergency,
      Instant startAt,
      Instant endAt,
      JsonNode emergencyEvidence) {}

  public record ActionCommand(
      int expectedVersion,
      String reason,
      String resultSummary,
      String actualAttendanceSummary,
      Instant actualStartAt,
      Instant actualEndAt,
      String schemeType,
      String externalReference,
      BigDecimal externallyDeterminedAmount,
      JsonNode evidence) {}

  public record Item(
      UUID id, String fieldCode, int itemSeq, String itemName, JsonNode value, Instant createdAt) {}

  public record FormRef(UUID id, int versionNo) {}

  public record Overtime(
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
      boolean emergency,
      BigDecimal durationHours,
      Instant startAt,
      Instant endAt,
      Instant actualStartAt,
      Instant actualEndAt,
      String actualAttendanceSummary,
      String resultSummary,
      String schemeType,
      String receiptReference,
      BigDecimal actualAmount,
      List<Item> items,
      Instant updatedAt) {

    public Overtime(
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
        boolean emergency,
        BigDecimal durationHours,
        Instant startAt,
        Instant endAt,
        Instant actualStartAt,
        Instant actualEndAt,
        String actualAttendanceSummary,
        String resultSummary,
        String schemeType,
        String receiptReference,
        List<Item> items,
        Instant updatedAt) {
      this(
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
          reason,
          ownerCenterId,
          ownerEmployeeId,
          attendanceType,
          emergency,
          durationHours,
          startAt,
          endAt,
          actualStartAt,
          actualEndAt,
          actualAttendanceSummary,
          resultSummary,
          schemeType,
          receiptReference,
          null,
          items,
          updatedAt);
    }

    public Overtime metadataOnly() {
      return new Overtime(
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
          emergency,
          durationHours,
          startAt,
          endAt,
          null,
          null,
          null,
          null,
          null,
          null,
          null,
          List.of(),
          updatedAt);
    }
  }

  public interface Repository {

    Optional<UUID> latestPublishedWorkflowVersion(UUID t, String c);

    Optional<FormRef> latestPublishedForm(UUID t, String f, String p, String n);

    List<UUID> permissionCandidates(UUID t, String p, UUID o);

    boolean hasEffectiveOverlap(UUID t, UUID e, Instant s, Instant end, UUID excluded);

    void insert(Overtime v, UUID a);

    int bindWorkflow(UUID t, UUID id, int version, UUID wf, UUID a);

    int move(UUID t, UUID id, int version, String status, String result, Instant closed, UUID a);

    void appendEvidence(UUID t, UUID id, String field, JsonNode evidence, UUID a);

    void recordFacts(
        UUID t, UUID id, Instant start, Instant end, BigDecimal hours, String attendance, UUID a);

    void recordScheme(UUID t, UUID id, String scheme, UUID a);

    void recordReceipt(
        UUID t, UUID id, String reference, BigDecimal externalAmount, JsonNode evidence, UUID a);

    Optional<Overtime> find(UUID t, UUID id);

    List<Overtime> list(UUID t);
  }
}
