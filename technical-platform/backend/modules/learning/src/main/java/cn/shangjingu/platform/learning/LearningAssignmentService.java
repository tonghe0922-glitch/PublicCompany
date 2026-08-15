package cn.shangjingu.platform.learning;

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
 * P010 keeps publication, learning, exam, practical, certification and permission linkage as
 * distinct facts.
 */
@Service
public final class LearningAssignmentService {

  public static final String PROCESS_CODE = "P010", INITIAL_FORM_CODE = "CTR-P010-F01";

  private static final Duration TTL = Duration.ofHours(24);

  private static final Map<String, Set<String>> ACTIONS =
      Map.ofEntries(
          Map.entry("S01", Set.of("PUBLISH")),
          Map.entry("S02", Set.of("ASSIGN")),
          Map.entry("S03", Set.of("COMPLETE_LEARNING")),
          Map.entry("S04", Set.of("SUBMIT_EXAM")),
          Map.entry("S05", Set.of("RECORD_PRACTICAL")),
          Map.entry("S06", Set.of("CERTIFY")),
          Map.entry("S07", Set.of("ACTIVATE")),
          Map.entry("S08", Set.of("LINK_PERMISSION")),
          Map.entry("S09", Set.of("SCHEDULE_RECERTIFICATION")),
          Map.entry("S10", Set.of("ARCHIVE")));

  private final TenantTransactionRunner transactions;

  private final IdempotencyRegistry idempotency;

  private final BusinessNumberService numbers;

  private final TransactionalOutboxService outbox;

  private final WorkflowRuntimeService workflow;

  private final WorkflowTaskAssignmentService tasks;

  private final WorkflowFormService forms;

  private final Repository repository;

  private final ObjectMapper mapper;

  public LearningAssignmentService(
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

  public Assignment create(
      DatabaseSecurityContext actor, String key, String hash, CreateCommand c) {
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
                  "learning.learning_assignment",
                  UUID.randomUUID(),
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), claim.resourceId());
          }
          Target target =
              repository
                  .target(actor.tenantId(), c.ownerEmployeeId())
                  .orElseThrow(() -> rejected("active target learner is required"));
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
                      actor.tenantId(), "p010.learning.manage", target.centerId()),
              certifiers =
                  repository.permissionCandidates(
                      actor.tenantId(), "p010.learning.certify", target.centerId()),
              linkers =
                  repository.permissionCandidates(
                      actor.tenantId(), "p010.learning.link", target.centerId());
          if (managers.isEmpty() || certifiers.size() < 2 || linkers.isEmpty()) {
            throw rejected(
                "manager, two independent certifiers and permission linker are required");
          }
          Assignment draft =
              new Assignment(
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
                  c.courseVersionId().trim(),
                  c.contentVersion().trim(),
                  c.courseTeamName().trim(),
                  c.periodOrCourseNo().trim(),
                  trim(c.learnerProfile()),
                  BigDecimal.ZERO,
                  null,
                  null,
                  null,
                  null,
                  List.of(),
                  Instant.now());
          repository.insert(draft, actor.employeeId());
          ObjectNode context = mapper.createObjectNode();
          context.put("ownerEmployeeId", c.ownerEmployeeId().toString());
          context.put("ownerCenterId", target.centerId().toString());
          context.set("learnerIds", uuids(List.of(c.ownerEmployeeId())));
          context.set("managerCandidateIds", uuids(managers));
          context.set("certifierCandidateIds", uuids(certifiers));
          context.set("linkerCandidateIds", uuids(linkers));
          WorkflowRuntimeService.Result started =
              workflow.start(
                  new WorkflowRuntimeService.StartCommand(
                      actor.tenantId(),
                      actor.employeeId(),
                      actor.identityId(),
                      version,
                      "learning.learning_assignment",
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
              "ASSIGNMENT_CREATED",
              evidence("created", c.evidence(), actor.employeeId()),
              actor.employeeId());
          Assignment result = required(actor.tenantId(), draft.id());
          emit(actor, result, "S01", "CREATED", "S01", List.of(actor.employeeId()));
          return result;
        });
  }

  public Assignment act(
      DatabaseSecurityContext actor,
      UUID id,
      String actionCode,
      String key,
      String hash,
      ActionCommand c) {
    requireActor(actor);
    Objects.requireNonNull(c, "P010 action command is required");
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
                  "learning.learning_assignment.action",
                  id,
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), id);
          }
          Assignment current = required(actor.tenantId(), id);
          if (current.versionNo() != c.expectedVersion()) {
            throw rejected("learning assignment version conflict");
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
          if (runtime.task() != null) {
            tasks.claim(
                new WorkflowTaskAssignmentService.ClaimCommand(
                    actor.tenantId(), runtime.task().id(), actor.employeeId()));
          }
          JsonNode immutable = requiredEvidence(c.evidence(), action.toLowerCase(Locale.ROOT));
          if ("COMPLETE_LEARNING".equals(action)) {
            repository.recordCompletion(actor.tenantId(), id, actor.employeeId());
          }
          if ("SUBMIT_EXAM".equals(action)) {
            repository.recordExam(actor.tenantId(), id, c.score1000(), actor.employeeId());
          }
          if ("RECORD_PRACTICAL".equals(action)) {
            repository.recordPractical(
                actor.tenantId(), id, c.practicalResult().trim(), actor.employeeId());
          }
          if ("ACTIVATE".equals(action)) {
            repository.activate(
                actor.tenantId(), id, c.effectiveDate(), c.expireDate(), actor.employeeId());
          }
          if ("LINK_PERMISSION".equals(action)
              && repository.executeApprovedPolicies(actor.tenantId(), id, actor.employeeId()) < 1) {
            throw rejected(
                "no enabled, approved permission linkage policy exists for the course version");
          }
          repository.appendEvent(
              actor.tenantId(),
              id,
              action,
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
                  label(moved.instance().currentNodeCode()),
                  trim(c.resultSummary()),
                  closed,
                  actor.employeeId())
              != 1) {
            throw rejected("concurrent learning transition conflict");
          }
          Assignment result = required(actor.tenantId(), id);
          emit(actor, result, node, action, moved.instance().currentNodeCode(), recipients(moved));
          return result;
        });
  }

  public Optional<Assignment> find(DatabaseSecurityContext a, UUID id) {
    requireActor(a);
    return transactions.required(a, () -> repository.find(a.tenantId(), id));
  }

  public List<Assignment> list(DatabaseSecurityContext a) {
    requireActor(a);
    return transactions.required(a, () -> repository.list(a.tenantId()));
  }

  public String permissionForNode(Assignment v) {
    return switch (Objects.toString(v.currentNodeCode(), "")) {
      case "S03" -> "p010.learning.complete";
      case "S04" -> "p010.learning.exam";
      case "S05", "S06" -> "p010.learning.certify";
      case "S08" -> "p010.learning.link";
      default -> "p010.learning.manage";
    };
  }

  private void validateAction(
      DatabaseSecurityContext a, Assignment v, String node, String action, ActionCommand c) {
    if (Set.of("S03", "S04").contains(node) && !a.employeeId().equals(v.ownerEmployeeId())) {
      throw rejected("only the assigned employee may learn or take the examination");
    }
    if (Set.of("S05", "S06", "S07", "S08", "S09", "S10").contains(node)
        && a.employeeId().equals(v.ownerEmployeeId())) {
      throw rejected(
          "learner cannot assess, certify, activate, link or archive their own qualification");
    }
    if ("SUBMIT_EXAM".equals(action)
        && (c.score1000() == null || c.score1000() < 0 || c.score1000() > 1000)) {
      throw rejected("examination score must be between 0 and 1000");
    }
    if ("RECORD_PRACTICAL".equals(action) && trim(c.practicalResult()) == null) {
      throw rejected("offline practical result is required");
    }
    if ("CERTIFY".equals(action)
        && repository
            .eventActor(a.tenantId(), v.id(), "RECORD_PRACTICAL")
            .filter(a.employeeId()::equals)
            .isPresent()) {
      throw rejected("professional certifier must be independent from practical assessor");
    }
    if ("ACTIVATE".equals(action)
        && (c.effectiveDate() == null
            || c.expireDate() == null
            || c.expireDate().isBefore(c.effectiveDate())
            || c.expireDate().isBefore(LocalDate.now()))) {
      throw rejected("qualification dates are invalid or already expired");
    }
    if ("SCHEDULE_RECERTIFICATION".equals(action)
        && (c.recertificationDate() == null
            || c.recertificationDate().isBefore(LocalDate.now())
            || v.qualificationExpireDate() == null
            || c.recertificationDate().isAfter(v.qualificationExpireDate()))) {
      throw rejected("recertification must be scheduled no later than qualification expiry");
    }
  }

  private List<WorkflowFormService.FieldValue> initial(
      WorkflowRuntimeService.Instance i, Assignment v) {
    return List.of(
        text("process_instance_no", i.instanceNo()),
        text("subject", v.subject()),
        text("owner_employee_id", v.ownerEmployeeId().toString()),
        text("course_version_id", v.courseVersionId()),
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
      Assignment v,
      String node,
      String action,
      String target,
      List<UUID> recipients) {
    ObjectNode p =
        mapper
            .createObjectNode()
            .put("assignmentId", v.id().toString())
            .put("businessNo", v.businessNo())
            .put(
                "event",
                "CREATED".equals(action)
                    ? "P010.learning.created"
                    : "P010.stage." + node.substring(1) + ".completed")
            .put("actionCode", action)
            .put("nodeCode", target);
    p.set("recipientEmployeeIds", uuids(recipients));
    int version = Math.max(1, v.versionNo() + 1);
    outbox.enqueue(
        new TransactionalOutboxService.Command(
            a.tenantId(),
            a.employeeId(),
            "P010_LEARNING",
            v.id(),
            "P010_LEARNING_EVENT",
            version,
            json(p),
            "p010:"
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

  private Assignment required(UUID t, UUID id) {
    return repository.find(t, id).orElseThrow(() -> rejected("learning assignment not found"));
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
      throw rejected("business date and target learner are required");
    }
    if (trim(c.subject()) == null || c.subject().trim().length() < 5) {
      throw rejected("subject requires at least 5 characters");
    }
    if (trim(c.courseVersionId()) == null
        || trim(c.contentVersion()) == null
        || trim(c.courseTeamName()) == null
        || trim(c.periodOrCourseNo()) == null) {
      throw rejected("course and content version fields are required");
    }
    requiredEvidence(c.evidence(), "publication");
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
    return new ProcessRejectedException("P010 " + m);
  }

  public static String label(String n) {
    return switch (n) {
      case "S01" -> "Version publication";
      case "S02" -> "Risk-based assignment";
      case "S03" -> "Employee learning";
      case "S04" -> "1000-point exam";
      case "S05" -> "Offline practical";
      case "S06" -> "Professional certification";
      case "S07" -> "Qualification effective";
      case "S08" -> "Permission linkage";
      case "S09" -> "Retraining/recertification";
      case "S10" -> "Archive";
      case "END" -> "Closed";
      default -> throw rejected("unknown source node " + n);
    };
  }

  public record CreateCommand(
      LocalDate businessDate,
      String subject,
      String reason,
      UUID ownerEmployeeId,
      String courseVersionId,
      String contentVersion,
      String courseTeamName,
      String periodOrCourseNo,
      String learnerProfile,
      JsonNode evidence) {}

  public record ActionCommand(
      int expectedVersion,
      Long score1000,
      String practicalResult,
      LocalDate effectiveDate,
      LocalDate expireDate,
      LocalDate recertificationDate,
      String resultSummary,
      JsonNode evidence) {}

  public record Event(
      UUID id,
      int eventSeq,
      String eventType,
      JsonNode evidence,
      UUID actorEmployeeId,
      Instant createdAt) {}

  public record Target(UUID employeeId, UUID centerId, UUID userId, UUID identityId) {}

  public record FormRef(UUID id, int versionNo) {}

  public record Assignment(
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
      String courseVersionId,
      String contentVersion,
      String courseTeamName,
      String periodOrCourseNo,
      String learnerProfile,
      BigDecimal completionRate,
      Long score1000,
      String practicalResult,
      LocalDate qualificationEffectiveDate,
      LocalDate qualificationExpireDate,
      List<Event> events,
      Instant updatedAt) {

    public Assignment metadataOnly() {
      return new Assignment(
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
          courseVersionId,
          contentVersion,
          courseTeamName,
          periodOrCourseNo,
          null,
          completionRate,
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

    Optional<Target> target(UUID t, UUID employee);

    List<UUID> permissionCandidates(UUID t, String p, UUID center);

    void insert(Assignment v, UUID actor);

    int bindWorkflow(UUID t, UUID id, int version, UUID wf, UUID actor);

    int move(
        UUID t, UUID id, int version, String status, String result, Instant closed, UUID actor);

    void appendEvent(UUID t, UUID id, String type, JsonNode evidence, UUID actor);

    Optional<UUID> eventActor(UUID t, UUID id, String type);

    void recordCompletion(UUID t, UUID id, UUID actor);

    void recordExam(UUID t, UUID id, long score, UUID actor);

    void recordPractical(UUID t, UUID id, String result, UUID actor);

    void activate(UUID t, UUID id, LocalDate effective, LocalDate expire, UUID actor);

    int executeApprovedPolicies(UUID t, UUID id, UUID actor);

    Optional<Assignment> find(UUID t, UUID id);

    List<Assignment> list(UUID t);
  }
}
