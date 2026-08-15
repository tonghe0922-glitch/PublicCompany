package cn.shangjingu.platform.performance;

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
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * P011 preserves employee, supervisor, calculated and calibrated scores as separate immutable
 * facts.
 */
@Service
public final class PerformanceCycleService {
  public static final String PROCESS_CODE = "P011", INITIAL_FORM_CODE = "CTR-P011-F01";
  private static final Duration TTL = Duration.ofHours(24);
  private static final Map<String, Set<String>> ACTIONS =
      Map.ofEntries(
          Map.entry("S01", Set.of("SET_TARGET")),
          Map.entry("S02", Set.of("CONFIRM_TARGET")),
          Map.entry("S03", Set.of("RECORD_COACHING")),
          Map.entry("S04", Set.of("COLLECT_AUTHORITY_DATA")),
          Map.entry("S05", Set.of("SUBMIT_SELF_EVALUATION", "SUBMIT_SUPERVISOR_EVALUATION")),
          Map.entry("S06", Set.of("CALCULATE_SCORE")),
          Map.entry("S07", Set.of("CALIBRATE")),
          Map.entry("S08", Set.of("CONFIRM_FEEDBACK")),
          Map.entry("S09", Set.of("RESOLVE_APPEAL", "NO_APPEAL")),
          Map.entry("S10", Set.of("EXECUTE_EFFECT")),
          Map.entry("S11", Set.of("ARCHIVE")));
  private final TenantTransactionRunner transactions;
  private final IdempotencyRegistry idempotency;
  private final BusinessNumberService numbers;
  private final TransactionalOutboxService outbox;
  private final WorkflowRuntimeService workflow;
  private final WorkflowTaskAssignmentService tasks;
  private final WorkflowFormService forms;
  private final Repository repository;
  private final ObjectMapper mapper;

  public PerformanceCycleService(
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

  public Cycle create(DatabaseSecurityContext actor, String key, String hash, CreateCommand c) {
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
                  "performance.performance_cycle",
                  UUID.randomUUID(),
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), claim.resourceId());
          }
          Target target =
              repository
                  .target(actor.tenantId(), c.ownerEmployeeId())
                  .orElseThrow(() -> rejected("active target employee is required"));
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
                      actor.tenantId(), "p011.performance.manage", target.centerId()),
              calibrators =
                  repository.permissionCandidates(
                      actor.tenantId(), "p011.performance.calibrate", target.centerId()),
              appealReviewers =
                  repository.permissionCandidates(
                      actor.tenantId(), "p011.performance.appeal", target.centerId()),
              executors =
                  repository.permissionCandidates(
                      actor.tenantId(), "p011.performance.execute", target.centerId());
          if (managers.isEmpty()
              || calibrators.isEmpty()
              || appealReviewers.isEmpty()
              || executors.isEmpty()) {
            throw rejected("manager, calibrator, appeal reviewer and effect executor are required");
          }
          Cycle draft =
              new Cycle(
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
                  trim(c.reason()),
                  target.centerId(),
                  c.ownerEmployeeId(),
                  c.contentVersion().trim(),
                  c.periodOrCourseNo().trim(),
                  null,
                  null,
                  List.of(),
                  List.of(),
                  List.of(),
                  Instant.now());
          repository.insert(draft, actor.employeeId());
          ObjectNode context = mapper.createObjectNode();
          context.put("ownerEmployeeId", c.ownerEmployeeId().toString());
          context.put("ownerCenterId", target.centerId().toString());
          context.set("employeeCandidateIds", uuids(List.of(c.ownerEmployeeId())));
          context.set("managerCandidateIds", uuids(managers));
          context.set(
              "evaluationCandidateIds", uuids(union(List.of(c.ownerEmployeeId()), managers)));
          context.set("calibratorCandidateIds", uuids(calibrators));
          context.set("appealCandidateIds", uuids(appealReviewers));
          context.set("executorCandidateIds", uuids(executors));
          WorkflowRuntimeService.Result started =
              workflow.start(
                  new WorkflowRuntimeService.StartCommand(
                      actor.tenantId(),
                      actor.employeeId(),
                      actor.identityId(),
                      version,
                      "performance.performance_cycle",
                      draft.id(),
                      draft.businessNo(),
                      draft.subject(),
                      "HIGH",
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
          repository.appendEvent(
              actor.tenantId(),
              draft.id(),
              "CYCLE_CREATED",
              evidence("created", c.evidence(), actor.employeeId()),
              actor.employeeId());
          Cycle result = required(actor.tenantId(), draft.id());
          emit(actor, result, "S01", "CREATED", "S01", List.of(actor.employeeId()));
          return result;
        });
  }

  public Cycle act(
      DatabaseSecurityContext actor,
      UUID id,
      String actionCode,
      String key,
      String hash,
      ActionCommand c) {
    requireActor(actor);
    Objects.requireNonNull(c, "P011 action command is required");
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
                  "performance.performance_cycle.action",
                  id,
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), id);
          }
          Cycle current = required(actor.tenantId(), id);
          if (current.versionNo() != c.expectedVersion()) {
            throw rejected("performance cycle version conflict");
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
          validateAction(actor, current, action, c);
          if (runtime.task() != null) {
            tasks.claim(
                new WorkflowTaskAssignmentService.ClaimCommand(
                    actor.tenantId(), runtime.task().id(), actor.employeeId()));
          }
          JsonNode immutable = requiredEvidence(c.evidence(), action.toLowerCase(Locale.ROOT));
          if ("SUBMIT_SELF_EVALUATION".equals(action)) {
            repository.appendScore(
                actor.tenantId(),
                id,
                "EMPLOYEE_SELF",
                c.score1000(),
                immutable,
                actor.employeeId());
          }
          if ("SUBMIT_SUPERVISOR_EVALUATION".equals(action)) {
            repository.appendScore(
                actor.tenantId(), id, "SUPERVISOR", c.score1000(), immutable, actor.employeeId());
          }
          if ("CALCULATE_SCORE".equals(action)) {
            long
                self =
                    repository
                        .score(actor.tenantId(), id, "EMPLOYEE_SELF")
                        .orElseThrow(() -> rejected("employee self evaluation is missing")),
                supervisor =
                    repository
                        .score(actor.tenantId(), id, "SUPERVISOR")
                        .orElseThrow(() -> rejected("supervisor evaluation is missing"));
            repository.appendScore(
                actor.tenantId(),
                id,
                "SYSTEM_CALCULATED",
                Math.round((self + supervisor) / 2.0d),
                immutable,
                actor.employeeId());
          }
          if ("CALIBRATE".equals(action)) {
            repository.appendScore(
                actor.tenantId(), id, "CALIBRATED", c.score1000(), immutable, actor.employeeId());
          }
          if ("CONFIRM_FEEDBACK".equals(action)) {
            repository.setAppeal(
                actor.tenantId(),
                id,
                Boolean.TRUE.equals(c.appealRaised()) ? "APPEALED" : "NONE",
                actor.employeeId());
          }
          if ("RESOLVE_APPEAL".equals(action)) {
            repository.setAppeal(actor.tenantId(), id, "RESOLVED", actor.employeeId());
          }
          if ("EXECUTE_EFFECT".equals(action)) {
            repository.appendEffect(
                actor.tenantId(),
                id,
                normalize(c.executionType()),
                c.externalReference().trim(),
                immutable,
                actor.employeeId());
          }
          repository.appendEvent(
              actor.tenantId(),
              id,
              eventType(action, c),
              evidence(action, immutable, actor.employeeId()),
              actor.employeeId());
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
                      trim(c.resultSummary()),
                      scoped(key, "workflow")));
          Instant closed =
              "END".equals(moved.instance().currentNodeCode())
                  ? moved.instance().finishedAt()
                  : null;
          if (repository.move(
                  actor.tenantId(),
                  id,
                  current.versionNo(),
                  status(moved.instance().currentNodeCode()),
                  trim(c.resultSummary()),
                  closed,
                  actor.employeeId())
              != 1) {
            throw rejected("concurrent performance transition conflict");
          }
          Cycle result = required(actor.tenantId(), id);
          emit(actor, result, node, action, moved.instance().currentNodeCode(), recipients(moved));
          return result;
        });
  }

  public Optional<Cycle> find(DatabaseSecurityContext a, UUID id) {
    requireActor(a);
    return transactions.required(a, () -> repository.find(a.tenantId(), id));
  }

  public List<Cycle> list(DatabaseSecurityContext a) {
    requireActor(a);
    return transactions.required(a, () -> repository.list(a.tenantId()));
  }

  public String permissionForAction(Cycle v, String action) {
    String a = normalize(action);
    return switch (a) {
      case "CONFIRM_TARGET", "CONFIRM_FEEDBACK" -> "p011.performance.read";
      case "SUBMIT_SELF_EVALUATION", "SUBMIT_SUPERVISOR_EVALUATION" -> "p011.performance.evaluate";
      case "CALIBRATE" -> "p011.performance.calibrate";
      case "RESOLVE_APPEAL", "NO_APPEAL" -> "p011.performance.appeal";
      case "EXECUTE_EFFECT" -> "p011.performance.execute";
      default -> "p011.performance.manage";
    };
  }

  public List<String> availableActionCodes(DatabaseSecurityContext actor, Cycle value) {
    requireActor(actor);
    return ACTIONS.getOrDefault(value.currentNodeCode(), Set.of()).stream()
        .filter(action -> actorAndStateViolation(actor, value, action).isEmpty())
        .sorted()
        .toList();
  }

  private void validateAction(DatabaseSecurityContext a, Cycle v, String action, ActionCommand c) {
    actorAndStateViolation(a, v, action)
        .ifPresent(
            message -> {
              throw rejected(message);
            });
    if (Set.of("SUBMIT_SELF_EVALUATION", "SUBMIT_SUPERVISOR_EVALUATION", "CALIBRATE")
            .contains(action)
        && (c.score1000() == null || c.score1000() < 0 || c.score1000() > 1000)) {
      throw rejected("score must be between 0 and 1000");
    }
    if ("EXECUTE_EFFECT".equals(action)
        && (trim(c.executionType()) == null
            || !Set.of("DEVELOPMENT_PLAN", "PERFORMANCE_IMPROVEMENT", "EXTERNAL_HR_REFERENCE")
                .contains(normalize(c.executionType()))
            || trim(c.externalReference()) == null)) {
      throw rejected("approved effect type and external reference are required");
    }
  }

  private Optional<String> actorAndStateViolation(
      DatabaseSecurityContext a, Cycle v, String action) {
    boolean owner = a.employeeId().equals(v.ownerEmployeeId());
    if (Set.of("CONFIRM_TARGET", "SUBMIT_SELF_EVALUATION", "CONFIRM_FEEDBACK").contains(action)
        && !owner) {
      return Optional.of("only the target employee may perform " + action);
    }
    if (Set.of(
                "SUBMIT_SUPERVISOR_EVALUATION",
                "CALCULATE_SCORE",
                "CALIBRATE",
                "RESOLVE_APPEAL",
                "NO_APPEAL",
                "EXECUTE_EFFECT",
                "ARCHIVE")
            .contains(action)
        && owner) {
      return Optional.of(
          "target employee cannot review, calibrate, execute or archive their own cycle");
    }
    if ("SUBMIT_SUPERVISOR_EVALUATION".equals(action)
        && repository.score(a.tenantId(), v.id(), "EMPLOYEE_SELF").isEmpty()) {
      return Optional.of("employee self evaluation must be recorded first");
    }
    if ("CALIBRATE".equals(action)) {
      Optional<UUID> supervisor =
          repository.eventActor(a.tenantId(), v.id(), "SUPERVISOR_EVALUATED");
      if (supervisor.isEmpty()) {
        return Optional.of("supervisor evaluation actor is missing");
      }
      if (supervisor.get().equals(a.employeeId())) {
        return Optional.of("calibrator must be independent from supervisor evaluator");
      }
      if (repository.score(a.tenantId(), v.id(), "SYSTEM_CALCULATED").isEmpty()) {
        return Optional.of("system calculated score is missing");
      }
    }
    if ("RESOLVE_APPEAL".equals(action)
        && !repository.eventExists(a.tenantId(), v.id(), "APPEAL_RAISED")) {
      return Optional.of("appeal evidence is missing");
    }
    if ("NO_APPEAL".equals(action)
        && repository.eventExists(a.tenantId(), v.id(), "APPEAL_RAISED")) {
      return Optional.of("raised appeal requires independent resolution");
    }
    return Optional.empty();
  }

  private String eventType(String action, ActionCommand c) {
    if ("SUBMIT_SELF_EVALUATION".equals(action)) {
      return "EMPLOYEE_SELF_EVALUATED";
    }
    if ("SUBMIT_SUPERVISOR_EVALUATION".equals(action)) {
      return "SUPERVISOR_EVALUATED";
    }
    if ("CONFIRM_FEEDBACK".equals(action) && Boolean.TRUE.equals(c.appealRaised())) {
      return "APPEAL_RAISED";
    }
    return action;
  }

  private List<WorkflowFormService.FieldValue> initial(WorkflowRuntimeService.Instance i, Cycle v) {
    return List.of(
        text("process_instance_no", i.instanceNo()),
        text("subject", v.subject()),
        text("owner_employee_id", v.ownerEmployeeId().toString()),
        text("content_version", v.contentVersion()),
        text("period_or_course_no", v.periodOrCourseNo()));
  }

  private static WorkflowFormService.FieldValue text(String c, String v) {
    return new WorkflowFormService.FieldValue(
        c, "TEXT", v, null, null, null, null, null, "P1", false);
  }

  private ObjectNode evidence(String event, JsonNode supplied, UUID actor) {
    ObjectNode n =
        mapper
            .createObjectNode()
            .put("event", event)
            .put("actorEmployeeId", actor.toString())
            .put("recordedAt", Instant.now().toString());
    n.set("sourceEvidence", requiredEvidence(supplied, event));
    return n;
  }

  private void emit(
      DatabaseSecurityContext a,
      Cycle v,
      String node,
      String action,
      String target,
      List<UUID> recipients) {
    ObjectNode p =
        mapper
            .createObjectNode()
            .put("cycleId", v.id().toString())
            .put("businessNo", v.businessNo())
            .put(
                "event",
                "CREATED".equals(action)
                    ? "P011.performance.created"
                    : "P011.stage." + node.substring(1) + ".completed")
            .put("actionCode", action)
            .put("nodeCode", target);
    p.set("recipientEmployeeIds", uuids(recipients));
    int version = Math.max(1, v.versionNo() + 1);
    outbox.enqueue(
        new TransactionalOutboxService.Command(
            a.tenantId(),
            a.employeeId(),
            "P011_PERFORMANCE",
            v.id(),
            "P011_PERFORMANCE_EVENT",
            version,
            json(p),
            "p011:"
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

  private static List<UUID> union(List<UUID> a, List<UUID> b) {
    LinkedHashSet<UUID> s = new LinkedHashSet<>(a);
    s.addAll(b);
    return List.copyOf(s);
  }

  private Cycle required(UUID t, UUID id) {
    return repository.find(t, id).orElseThrow(() -> rejected("performance cycle not found"));
  }

  private String json(JsonNode n) {
    try {
      return mapper.writeValueAsString(n);
    } catch (JsonProcessingException e) {
      throw rejected("event payload cannot be serialized");
    }
  }

  private static void validateCreate(CreateCommand c) {
    if (c == null || c.businessDate() == null || c.ownerEmployeeId() == null) {
      throw rejected("business date and target employee are required");
    }
    if (trim(c.subject()) == null || c.subject().trim().length() < 5) {
      throw rejected("subject requires at least 5 characters");
    }
    if (trim(c.contentVersion()) == null || trim(c.periodOrCourseNo()) == null) {
      throw rejected("content version and period are required");
    }
    requiredEvidence(c.evidence(), "target setting");
  }

  private static JsonNode requiredEvidence(JsonNode n, String p) {
    if (n == null || !n.isObject()) {
      throw rejected(p + " requires immutable evidence");
    }
    return n;
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
    return new ProcessRejectedException("P011 " + m);
  }

  public static String label(String n) {
    return switch (n) {
      case "S01" -> "Target setting";
      case "S02" -> "Employee confirmation";
      case "S03" -> "Progress record and coaching";
      case "S04" -> "Authoritative data collection";
      case "S05" -> "Employee and supervisor evaluation";
      case "S06" -> "1000-point calculation";
      case "S07" -> "Calibration";
      case "S08" -> "Result feedback confirmation";
      case "S09" -> "Appeal review";
      case "S10" -> "Performance effect execution";
      case "S11" -> "Archive";
      case "END" -> "Closed";
      default -> throw rejected("unknown source node " + n);
    };
  }

  private static String status(String n) {
    return switch (n) {
      case "S01" -> "Target setting";
      case "S02" -> "Employee confirmation";
      case "S03" -> "Coaching";
      case "S04" -> "Authority data collection";
      case "S05" -> "Evaluation";
      case "S06" -> "Score calculation";
      case "S07" -> "Calibration";
      case "S08" -> "Feedback confirmation";
      case "S09" -> "Appeal review";
      case "S10" -> "Effect execution";
      case "S11" -> "Archive";
      case "END" -> "Closed";
      default -> throw rejected("unknown source node " + n);
    };
  }

  public record CreateCommand(
      LocalDate businessDate,
      String subject,
      String reason,
      UUID ownerEmployeeId,
      String contentVersion,
      String periodOrCourseNo,
      JsonNode evidence) {}

  public record ActionCommand(
      int expectedVersion,
      Long score1000,
      Boolean appealRaised,
      String executionType,
      String externalReference,
      String resultSummary,
      JsonNode evidence) {}

  public record ScoreFact(
      UUID id,
      int scoreSeq,
      String scoreType,
      long score1000,
      JsonNode evidence,
      UUID actorEmployeeId,
      Instant createdAt) {}

  public record Event(
      UUID id,
      int eventSeq,
      String eventType,
      JsonNode evidence,
      UUID actorEmployeeId,
      Instant createdAt) {}

  public record Effect(
      UUID id,
      String executionType,
      String externalReference,
      String executionStatus,
      JsonNode evidence,
      UUID executedBy,
      Instant executedAt) {}

  public record Target(UUID employeeId, UUID centerId, UUID userId, UUID identityId) {}

  public record FormRef(UUID id, int versionNo) {}

  public record Cycle(
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
      String contentVersion,
      String periodOrCourseNo,
      Long score1000,
      String appealStatus,
      List<ScoreFact> scores,
      List<Event> events,
      List<Effect> effects,
      Instant updatedAt) {
    public Cycle metadataOnly() {
      return new Cycle(
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
          contentVersion,
          periodOrCourseNo,
          null,
          null,
          List.of(),
          List.of(),
          List.of(),
          updatedAt);
    }
  }

  public interface Repository {
    Optional<UUID> latestPublishedWorkflowVersion(UUID t, String c);

    Optional<FormRef> latestPublishedForm(UUID t, String f, String p, String n);

    Optional<Target> target(UUID t, UUID employee);

    List<UUID> permissionCandidates(UUID t, String p, UUID center);

    void insert(Cycle v, UUID actor);

    int bindWorkflow(UUID t, UUID id, int version, UUID wf, UUID actor);

    int move(
        UUID t, UUID id, int version, String status, String result, Instant closed, UUID actor);

    void appendEvent(UUID t, UUID id, String type, JsonNode evidence, UUID actor);

    void appendScore(UUID t, UUID id, String type, long score, JsonNode evidence, UUID actor);

    Optional<Long> score(UUID t, UUID id, String type);

    Optional<UUID> eventActor(UUID t, UUID id, String type);

    boolean eventExists(UUID t, UUID id, String type);

    void setAppeal(UUID t, UUID id, String status, UUID actor);

    void appendEffect(
        UUID t, UUID id, String type, String reference, JsonNode evidence, UUID actor);

    Optional<Cycle> find(UUID t, UUID id);

    List<Cycle> list(UUID t);
  }
}
