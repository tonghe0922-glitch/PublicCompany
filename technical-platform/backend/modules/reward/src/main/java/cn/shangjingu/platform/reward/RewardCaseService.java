package cn.shangjingu.platform.reward;

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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * P013 keeps contribution, approval, impact instructions and downstream receipts as separate facts.
 */
@Service
public final class RewardCaseService {

  public static final String PROCESS_CODE = "P013", INITIAL_FORM_CODE = "CTR-P013-F01";

  private static final Duration TTL = Duration.ofHours(24);

  private static final Map<String, Set<String>> ACTIONS =
      Map.ofEntries(
          Map.entry("S01", Set.of("RECORD_CONTRIBUTION")),
          Map.entry("S02", Set.of("VERIFY_EVIDENCE")),
          Map.entry("S03", Set.of("RECOMMEND_LEVEL")),
          Map.entry("S04", Set.of("APPROVE")),
          Map.entry("S05", Set.of("CHECK_DUPLICATE")),
          Map.entry("S06", Set.of("RECORD_IMPACT", "COMPLETE_IMPACTS")),
          Map.entry("S07", Set.of("CONFIRM_NOTICE")),
          Map.entry("S08", Set.of("RECORD_RECEIPT", "COMPLETE_RECEIPTS")),
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

  public RewardCaseService(
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

  public RewardCase create(
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
                  "reward.reward_case",
                  UUID.randomUUID(),
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), claim.resourceId());
          }
          Target target =
              repository
                  .target(actor.tenantId(), c.ownerEmployeeId())
                  .orElseThrow(() -> rejected("active affected employee is required"));
          UUID version =
              repository
                  .latestPublishedWorkflowVersion(actor.tenantId(), PROCESS_CODE)
                  .orElseThrow(() -> rejected("published workflow is not configured"));
          FormRef form =
              repository
                  .latestPublishedForm(actor.tenantId(), INITIAL_FORM_CODE, PROCESS_CODE, "S01")
                  .orElseThrow(() -> rejected("published initial form is not configured"));
          List<UUID> managers = candidates(actor, "p013.reward.manage", target.centerId()),
              reviewers = candidates(actor, "p013.reward.review", target.centerId()),
              approvers = candidates(actor, "p013.reward.approve", target.centerId()),
              executors = candidates(actor, "p013.reward.execute", target.centerId());
          RewardCase draft =
              new RewardCase(
                  claim.resourceId(),
                  actor.tenantId(),
                  numbers.next(actor.tenantId(), actor.employeeId(), PROCESS_CODE),
                  null,
                  null,
                  "S01",
                  status("S01"),
                  0,
                  c.businessDate(),
                  c.subject().trim(),
                  trim(c.reason()),
                  target.centerId(),
                  target.employeeId(),
                  c.sourceFactKey().trim(),
                  c.employeeEventType().trim(),
                  c.factOccurredAt(),
                  c.factSummary().trim(),
                  c.impactLevel().trim(),
                  null,
                  null,
                  null,
                  null,
                  null,
                  List.of(),
                  List.of(),
                  List.of(),
                  Instant.now());
          try {
            repository.insert(draft, actor.employeeId());
          } catch (DataIntegrityViolationException conflict) {
            throw new ProcessRejectedException(
                "P013 reward source fact already exists or is invalid", conflict);
          }
          ObjectNode context = mapper.createObjectNode();
          context.put("ownerEmployeeId", target.employeeId().toString());
          context.put("ownerCenterId", target.centerId().toString());
          context.set("ownerCandidateIds", uuids(List.of(target.employeeId())));
          context.set("managerCandidateIds", uuids(managers));
          context.set("reviewerCandidateIds", uuids(reviewers));
          context.set("approverCandidateIds", uuids(approvers));
          context.set("executorCandidateIds", uuids(executors));
          WorkflowRuntimeService.Result started =
              workflow.start(
                  new WorkflowRuntimeService.StartCommand(
                      actor.tenantId(),
                      actor.employeeId(),
                      actor.identityId(),
                      version,
                      "reward.reward_case",
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
              "CASE_CREATED",
              evidence("created", c.evidence(), actor.employeeId()),
              actor.employeeId());
          RewardCase result = required(actor.tenantId(), draft.id());
          emit(actor, result, "S01", "CREATED", "S01", List.of(actor.employeeId()));
          return result;
        });
  }

  public RewardCase act(
      DatabaseSecurityContext actor,
      UUID id,
      String actionCode,
      String key,
      String hash,
      ActionCommand c) {
    requireActor(actor);
    Objects.requireNonNull(c, "P013 action command is required");
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
                  "reward.reward_case.action",
                  id,
                  TTL);
          if (claim.existing()) {
            return required(actor.tenantId(), id);
          }
          RewardCase current = required(actor.tenantId(), id);
          if (current.versionNo() != c.expectedVersion()) {
            throw rejected("reward case version conflict");
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
          try {
            if ("RECOMMEND_LEVEL".equals(action)) {
              repository.setRecommendedLevel(
                  actor.tenantId(), id, c.rewardLevel().trim(), actor.employeeId());
            }
            if ("APPROVE".equals(action)) {
              repository.setApprovedLevel(
                  actor.tenantId(), id, c.rewardLevel().trim(), actor.employeeId());
            }
            if ("CHECK_DUPLICATE".equals(action)) {
              repository.verifySourceUnique(actor.tenantId(), id, current.sourceFactKey());
            }
            if ("RECORD_IMPACT".equals(action)) {
              repository.appendImpact(
                  actor.tenantId(),
                  id,
                  normalize(c.impactType()),
                  c.requestedPoints(),
                  c.approvedAmount(),
                  c.authorityReference().trim(),
                  immutable,
                  actor.employeeId());
            }
            if ("RECORD_RECEIPT".equals(action)) {
              repository.appendReceipt(
                  actor.tenantId(),
                  id,
                  c.instructionId(),
                  normalize(c.receiptType()),
                  c.externalReference().trim(),
                  c.externalOccurredAt(),
                  immutable,
                  actor.employeeId());
            }
          } catch (DataIntegrityViolationException conflict) {
            throw new ProcessRejectedException(
                "P013 reward fact conflicts with the persisted lifecycle", conflict);
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
                  status(moved.instance().currentNodeCode()),
                  trim(c.resultSummary()),
                  closed,
                  actor.employeeId())
              != 1) {
            throw rejected("concurrent reward transition conflict");
          }
          RewardCase result = required(actor.tenantId(), id);
          emit(actor, result, node, action, moved.instance().currentNodeCode(), recipients(moved));
          return result;
        });
  }

  public Optional<RewardCase> find(DatabaseSecurityContext actor, UUID id) {
    requireActor(actor);
    return transactions.required(actor, () -> repository.find(actor.tenantId(), id));
  }

  public List<RewardCase> list(DatabaseSecurityContext actor) {
    requireActor(actor);
    return transactions.required(actor, () -> repository.list(actor.tenantId()));
  }

  public String permissionForAction(RewardCase value, String actionCode) {
    String action = normalize(actionCode);
    return switch (action) {
      case "CONFIRM_NOTICE" -> "p013.reward.read";
      case "RECOMMEND_LEVEL", "CHECK_DUPLICATE" -> "p013.reward.review";
      case "APPROVE" -> "p013.reward.approve";
      case "RECORD_IMPACT", "COMPLETE_IMPACTS", "RECORD_RECEIPT", "COMPLETE_RECEIPTS" ->
          "p013.reward.execute";
      default -> "p013.reward.manage";
    };
  }

  public List<String> availableActionCodes(DatabaseSecurityContext actor, RewardCase value) {
    requireActor(actor);
    return ACTIONS.getOrDefault(value.currentNodeCode(), Set.of()).stream()
        .filter(action -> actorAndStateViolation(actor, value, action).isEmpty())
        .sorted()
        .toList();
  }

  private void validateAction(
      DatabaseSecurityContext actor, RewardCase value, String action, ActionCommand c) {
    actorAndStateViolation(actor, value, action)
        .ifPresent(
            message -> {
              throw rejected(message);
            });
    if ("RECOMMEND_LEVEL".equals(action) && trim(c.rewardLevel()) == null) {
      throw rejected("reward level recommendation is required");
    }
    if ("APPROVE".equals(action) && trim(c.rewardLevel()) == null) {
      throw rejected("approved reward level is required");
    }
    if ("RECORD_IMPACT".equals(action)) {
      validateImpact(c);
    }
    if ("RECORD_RECEIPT".equals(action)) {
      if (c.instructionId() == null
          || trim(c.receiptType()) == null
          || trim(c.externalReference()) == null
          || c.externalOccurredAt() == null) {
        throw rejected(
            "instruction, receipt type, external reference and occurrence time are required");
      }
    }
  }

  private Optional<String> actorAndStateViolation(
      DatabaseSecurityContext actor, RewardCase value, String action) {
    boolean owner = actor.employeeId().equals(value.ownerEmployeeId());
    if ("CONFIRM_NOTICE".equals(action) && !owner) {
      return Optional.of("only the affected employee may confirm notice");
    }
    if (!"CONFIRM_NOTICE".equals(action) && owner) {
      return Optional.of(
          "affected employee cannot manage, review, approve, execute or archive their own reward");
    }
    if ("APPROVE".equals(action)) {
      Optional<UUID> recommender =
          repository.eventActor(actor.tenantId(), value.id(), "RECOMMEND_LEVEL");
      if (recommender.isEmpty()) {
        return Optional.of("recommendation actor is missing");
      }
      if (recommender.get().equals(actor.employeeId())) {
        return Optional.of("approver must be independent from recommender");
      }
    }
    if ("CHECK_DUPLICATE".equals(action)) {
      Optional<UUID> approver = repository.eventActor(actor.tenantId(), value.id(), "APPROVE");
      if (approver.isEmpty()) {
        return Optional.of("approval actor is missing");
      }
      if (approver.get().equals(actor.employeeId())) {
        return Optional.of("duplicate checker must be independent from approver");
      }
    }
    if ("COMPLETE_IMPACTS".equals(action)
        && repository.impactCount(actor.tenantId(), value.id()) < 1) {
      return Optional.of("at least one approved impact instruction is required");
    }
    if (Set.of("COMPLETE_RECEIPTS", "ARCHIVE").contains(action)
        && !repository.allInstructionsReceipted(actor.tenantId(), value.id())) {
      return Optional.of("every impact instruction requires its authoritative receipt");
    }
    return Optional.empty();
  }

  private static void validateImpact(ActionCommand c) {
    String type = normalize(c.impactType());
    if (trim(c.authorityReference()) == null) {
      throw rejected("impact authority reference is required");
    }
    if ("HONOR_POINTS".equals(type)) {
      if (c.requestedPoints() == null || c.requestedPoints() <= 0 || c.approvedAmount() != null) {
        throw rejected("honor points require a positive requested points value only");
      }
    } else if ("BONUS".equals(type)) {
      if (c.approvedAmount() == null
          || c.approvedAmount().signum() <= 0
          || c.requestedPoints() != null) {
        throw rejected("bonus requires a positive externally approved amount only");
      }
    } else if ("DEVELOPMENT".equals(type)) {
      if (c.requestedPoints() != null || c.approvedAmount() != null) {
        throw rejected("development impact accepts an authority reference only");
      }
    } else {
      throw rejected("unsupported impact type");
    }
  }

  private List<UUID> candidates(DatabaseSecurityContext actor, String permission, UUID center) {
    List<UUID> values = repository.permissionCandidates(actor.tenantId(), permission, center);
    if (values.isEmpty()) {
      throw rejected("eligible candidate is required for " + permission);
    }
    return values;
  }

  private List<WorkflowFormService.FieldValue> initial(
      WorkflowRuntimeService.Instance i, RewardCase v) {
    return List.of(
        text("process_instance_no", i.instanceNo()),
        text("subject", v.subject()),
        text("owner_employee_id", v.ownerEmployeeId().toString()),
        text("source_fact_key", v.sourceFactKey()),
        text("fact_summary", v.factSummary()));
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
      DatabaseSecurityContext actor,
      RewardCase value,
      String node,
      String action,
      String target,
      List<UUID> recipientIds) {
    ObjectNode payload =
        mapper
            .createObjectNode()
            .put("rewardCaseId", value.id().toString())
            .put("businessNo", value.businessNo())
            .put(
                "event",
                "CREATED".equals(action)
                    ? "P013.reward.created"
                    : "P013.stage." + node.substring(1) + ".completed")
            .put("actionCode", action)
            .put("nodeCode", target);
    payload.set("recipientEmployeeIds", uuids(recipientIds));
    int version = Math.max(1, value.versionNo() + 1);
    outbox.enqueue(
        new TransactionalOutboxService.Command(
            actor.tenantId(),
            actor.employeeId(),
            "P013_REWARD",
            value.id(),
            "P013_REWARD_EVENT",
            version,
            json(payload),
            "p013:"
                + value.id()
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
    ArrayNode result = mapper.createArrayNode();
    new LinkedHashSet<>(ids).forEach(x -> result.add(x.toString()));
    return result;
  }

  private RewardCase required(UUID tenant, UUID id) {
    return repository.find(tenant, id).orElseThrow(() -> rejected("reward case not found"));
  }

  private String json(JsonNode n) {
    try {
      return mapper.writeValueAsString(n);
    } catch (JsonProcessingException e) {
      throw rejected("event payload cannot be serialized");
    }
  }

  private static void validateCreate(CreateCommand c) {
    if (c == null
        || c.businessDate() == null
        || c.ownerEmployeeId() == null
        || c.factOccurredAt() == null) {
      throw rejected("business date, affected employee and fact time are required");
    }
    if (trim(c.subject()) == null || c.subject().trim().length() < 5) {
      throw rejected("subject requires at least 5 characters");
    }
    if (trim(c.sourceFactKey()) == null
        || trim(c.employeeEventType()) == null
        || trim(c.factSummary()) == null
        || trim(c.impactLevel()) == null) {
      throw rejected("source fact key, event type, fact summary and impact level are required");
    }
    requiredEvidence(c.evidence(), "contribution fact");
  }

  private static JsonNode requiredEvidence(JsonNode n, String purpose) {
    if (n == null || !n.isObject()) {
      throw rejected(purpose + " requires immutable evidence");
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

  private static String scoped(String k, String suffix) {
    if (k == null || k.isBlank() || k.length() > 160) {
      throw rejected("valid idempotency key is required");
    }
    return k + ":" + suffix;
  }

  private static String trim(String v) {
    return v == null || v.isBlank() ? null : v.trim();
  }

  private static ProcessRejectedException rejected(String m) {
    return new ProcessRejectedException("P013 " + m);
  }

  public static String label(String n) {
    return switch (n) {
      case "S01" -> "Contribution fact";
      case "S02" -> "Evidence verification";
      case "S03" -> "Reward level recommendation";
      case "S04" -> "Approval";
      case "S05" -> "Duplicate impact verification";
      case "S06" -> "Impact instruction execution";
      case "S07" -> "Employee notification";
      case "S08" -> "Finance and HR receipts";
      case "S09" -> "Archive";
      case "END" -> "Closed";
      default -> throw rejected("unknown source node " + n);
    };
  }

  private static String status(String n) {
    return label(n);
  }

  public record CreateCommand(
      LocalDate businessDate,
      String subject,
      String reason,
      UUID ownerEmployeeId,
      String sourceFactKey,
      String employeeEventType,
      Instant factOccurredAt,
      String factSummary,
      String impactLevel,
      JsonNode evidence) {}

  public record ActionCommand(
      int expectedVersion,
      String rewardLevel,
      String impactType,
      Long requestedPoints,
      BigDecimal approvedAmount,
      String authorityReference,
      UUID instructionId,
      String receiptType,
      String externalReference,
      Instant externalOccurredAt,
      String resultSummary,
      JsonNode evidence) {}

  public record Event(
      UUID id,
      int eventSeq,
      String eventType,
      JsonNode evidence,
      UUID actorEmployeeId,
      Instant createdAt) {}

  public record ImpactInstruction(
      UUID id,
      String impactType,
      Long requestedPoints,
      BigDecimal approvedAmount,
      String authorityReference,
      JsonNode evidence,
      UUID instructedBy,
      Instant instructedAt) {}

  public record ImpactReceipt(
      UUID id,
      UUID instructionId,
      String receiptType,
      String externalReference,
      Instant externalOccurredAt,
      JsonNode evidence,
      UUID receivedBy,
      Instant receivedAt) {}

  public record Target(UUID employeeId, UUID centerId, UUID userId, UUID identityId) {}

  public record FormRef(UUID id, int versionNo) {}

  public record RewardCase(
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
      String sourceFactKey,
      String employeeEventType,
      Instant factOccurredAt,
      String factSummary,
      String impactLevel,
      String recommendedRewardLevel,
      String approvedRewardLevel,
      Long pointsDelta,
      BigDecimal benefitAmount,
      String compGradeImpact,
      List<Event> events,
      List<ImpactInstruction> impacts,
      List<ImpactReceipt> receipts,
      Instant updatedAt) {

    public RewardCase metadataOnly() {
      return new RewardCase(
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
          sourceFactKey,
          employeeEventType,
          factOccurredAt,
          null,
          impactLevel,
          null,
          null,
          null,
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

    void insert(RewardCase v, UUID actor);

    int bindWorkflow(UUID t, UUID id, int version, UUID wf, UUID actor);

    int move(
        UUID t, UUID id, int version, String status, String result, Instant closed, UUID actor);

    void appendEvent(UUID t, UUID id, String type, JsonNode evidence, UUID actor);

    Optional<UUID> eventActor(UUID t, UUID id, String type);

    void setRecommendedLevel(UUID t, UUID id, String level, UUID actor);

    void setApprovedLevel(UUID t, UUID id, String level, UUID actor);

    void verifySourceUnique(UUID t, UUID id, String sourceFactKey);

    void appendImpact(
        UUID t,
        UUID id,
        String type,
        Long points,
        BigDecimal amount,
        String reference,
        JsonNode evidence,
        UUID actor);

    long impactCount(UUID t, UUID id);

    void appendReceipt(
        UUID t,
        UUID id,
        UUID instruction,
        String type,
        String reference,
        Instant occurredAt,
        JsonNode evidence,
        UUID actor);

    boolean allInstructionsReceipted(UUID t, UUID id);

    Optional<RewardCase> find(UUID t, UUID id);

    List<RewardCase> list(UUID t);
  }
}
