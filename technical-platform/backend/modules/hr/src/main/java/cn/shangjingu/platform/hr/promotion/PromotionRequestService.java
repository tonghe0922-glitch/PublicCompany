package cn.shangjingu.platform.hr.promotion;

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

/** P012 keeps approval separate from an atomic, evidence-backed appointment effective action. */
@Service
public final class PromotionRequestService {
    public static final String PROCESS_CODE = "P012";
    public static final String INITIAL_FORM_CODE = "EMP-P012-F01";
    private static final Duration TTL = Duration.ofHours(24);
    private static final Map<String, Set<String>> ACTIONS = Map.ofEntries(
        Map.entry("S01", Set.of("SUBMIT")),
        Map.entry("S02", Set.of("CHECK_ELIGIBILITY")),
        Map.entry("S03", Set.of("RECORD_ASSESSMENT")),
        Map.entry("S04", Set.of("VERIFY_VACANCY_BUDGET")),
        Map.entry("S05", Set.of("COMPLETE_REVIEW")),
        Map.entry("S06", Set.of("APPROVE")),
        Map.entry("S07", Set.of("COMPLETE_NOTICE")),
        Map.entry("S08", Set.of("RECORD_APPOINTMENT", "CONFIRM_APPOINTMENT")),
        Map.entry("S09", Set.of("COMPLETE_PROBATION")),
        Map.entry("S10", Set.of("MAKE_EFFECTIVE", "ROLL_BACK"))
    );

    private final TenantTransactionRunner transactions;
    private final IdempotencyRegistry idempotency;
    private final BusinessNumberService numbers;
    private final TransactionalOutboxService outbox;
    private final WorkflowRuntimeService workflow;
    private final WorkflowTaskAssignmentService tasks;
    private final WorkflowFormService forms;
    private final Repository repository;
    private final ObjectMapper mapper;

    public PromotionRequestService(TenantTransactionRunner transactions, IdempotencyRegistry idempotency,
                                   BusinessNumberService numbers, TransactionalOutboxService outbox,
                                   WorkflowRuntimeService workflow, WorkflowTaskAssignmentService tasks,
                                   WorkflowFormService forms, Repository repository, ObjectMapper mapper) {
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

    public Request create(DatabaseSecurityContext actor, String key, String hash, CreateCommand command) {
        requireActor(actor);
        validateCreate(command);
        return transactions.required(actor, () -> {
            IdempotencyClaim claim = idempotency.claim(actor.tenantId(), actor.employeeId(), key, hash,
                "hr.promotion_request", UUID.randomUUID(), TTL);
            if (claim.existing()) return required(actor.tenantId(), claim.resourceId());
            Target target = repository.target(actor.tenantId(), command.ownerEmployeeId())
                .orElseThrow(() -> rejected("active target employee and current appointment are required"));
            Position targetPosition = repository.position(actor.tenantId(), command.targetPositionCode())
                .orElseThrow(() -> rejected("active target position is required"));
            UUID workflowVersion = repository.latestPublishedWorkflowVersion(actor.tenantId(), PROCESS_CODE)
                .orElseThrow(() -> rejected("published workflow is not configured"));
            FormRef form = repository.latestPublishedForm(actor.tenantId(), INITIAL_FORM_CODE, PROCESS_CODE, "S01")
                .orElseThrow(() -> rejected("published initial form is not configured"));
            List<UUID> managers = candidates(actor, "p012.promotion.manage", target.centerId());
            List<UUID> reviewers = candidates(actor, "p012.promotion.review", target.centerId());
            List<UUID> approvers = candidates(actor, "p012.promotion.approve", target.centerId());
            List<UUID> appointers = candidates(actor, "p012.promotion.appoint", target.centerId());
            Request draft = new Request(claim.resourceId(), actor.tenantId(), numbers.next(actor.tenantId(), actor.employeeId(), PROCESS_CODE),
                null, null, "S01", status("S01"), 0, command.businessDate(), command.subject().trim(), trim(command.reason()),
                target.centerId(), target.employeeId(), command.employmentType().trim(), trim(command.headcountNo()),
                command.periodOrCourseNo().trim(), target.personName(), target.personNo(), command.plannedEffectiveDate(),
                command.targetPositionCode().trim(), null, null, List.of(), List.of(), Instant.now());
            repository.insert(draft, actor.employeeId());
            ObjectNode context = mapper.createObjectNode();
            context.put("ownerEmployeeId", target.employeeId().toString());
            context.put("ownerCenterId", target.centerId().toString());
            context.put("targetPositionId", targetPosition.id().toString());
            context.set("managerCandidateIds", uuids(managers));
            context.set("reviewerCandidateIds", uuids(reviewers));
            context.set("approverCandidateIds", uuids(approvers));
            context.set("appointerCandidateIds", uuids(appointers));
            context.set("appointmentCandidateIds", uuids(union(List.of(target.employeeId()), appointers)));
            WorkflowRuntimeService.Result started = workflow.start(new WorkflowRuntimeService.StartCommand(
                actor.tenantId(), actor.employeeId(), actor.identityId(), workflowVersion, "hr.promotion_request", draft.id(),
                draft.businessNo(), draft.subject(), "CRITICAL", context, scoped(key, "start")));
            forms.submit(new WorkflowFormService.SubmitForm(actor.tenantId(), actor.employeeId(), actor.identityId(),
                started.instance().id(), null, form.id(), form.versionNo(), initial(started.instance(), draft), scoped(key, "form")));
            if (repository.bindWorkflow(actor.tenantId(), draft.id(), 0, started.instance().id(), actor.employeeId()) != 1)
                throw rejected("concurrent workflow binding conflict");
            repository.appendEvent(actor.tenantId(), draft.id(), "REQUEST_CREATED", evidence("created", command.evidence(), actor.employeeId()), actor.employeeId());
            Request result = required(actor.tenantId(), draft.id());
            emit(actor, result, "S01", "CREATED", "S01", List.of(actor.employeeId()));
            return result;
        });
    }

    public Request act(DatabaseSecurityContext actor, UUID id, String actionCode, String key, String hash, ActionCommand command) {
        requireActor(actor);
        Objects.requireNonNull(command, "P012 action command is required");
        String action = normalize(actionCode);
        return transactions.required(actor, () -> {
            IdempotencyClaim claim = idempotency.claim(actor.tenantId(), actor.employeeId(), key, hash,
                "hr.promotion_request.action", id, TTL);
            if (claim.existing()) return required(actor.tenantId(), id);
            Request current = required(actor.tenantId(), id);
            if (current.versionNo() != command.expectedVersion()) throw rejected("promotion request version conflict");
            WorkflowRuntimeService.Result runtime = workflow.get(actor.tenantId(), current.workflowInstanceId());
            String node = runtime.instance().currentNodeCode();
            if (!node.equals(current.currentNodeCode())) throw rejected("business projection is stale");
            if (!ACTIONS.getOrDefault(node, Set.of()).contains(action)) throw rejected("action is not allowed at " + node);
            validateAction(actor, current, action, command);
            if (runtime.task() != null)
                tasks.claim(new WorkflowTaskAssignmentService.ClaimCommand(actor.tenantId(), runtime.task().id(), actor.employeeId()));
            JsonNode immutableEvidence = requiredEvidence(command.evidence(), action.toLowerCase(Locale.ROOT));
            applyFacts(actor, current, action, command, immutableEvidence);
            repository.appendEvent(actor.tenantId(), id, eventType(action, command), evidence(action, immutableEvidence, actor.employeeId()), actor.employeeId());
            WorkflowRuntimeService.Result moved = workflow.act(new WorkflowRuntimeService.ActionCommand(
                actor.tenantId(), actor.employeeId(), actor.identityId(), current.workflowInstanceId(),
                runtime.task() == null ? null : runtime.task().id(), node, action, trim(command.resultSummary()), scoped(key, "workflow")));
            Instant closed = "END".equals(moved.instance().currentNodeCode()) ? moved.instance().finishedAt() : null;
            LocalDate effectiveDate = "MAKE_EFFECTIVE".equals(action) ? command.actualEffectiveDate() : null;
            if (repository.move(actor.tenantId(), id, current.versionNo(), status(moved.instance().currentNodeCode()),
                trim(command.resultSummary()), effectiveDate, closed, actor.employeeId()) != 1)
                throw rejected("concurrent promotion transition conflict");
            Request result = required(actor.tenantId(), id);
            emit(actor, result, node, action, moved.instance().currentNodeCode(), recipients(moved));
            return result;
        });
    }

    private void applyFacts(DatabaseSecurityContext actor, Request current, String action, ActionCommand command, JsonNode evidence) {
        if ("RECORD_ASSESSMENT".equals(action)) repository.setScore(actor.tenantId(), current.id(), command.score1000(), actor.employeeId());
        if ("RECORD_APPOINTMENT".equals(action)) repository.recordConfirmation(actor.tenantId(), current.id(),
            command.actualEffectiveDate(), command.salaryConfirmationReference().trim(), command.externalReference().trim(), evidence, actor.employeeId());
        if ("MAKE_EFFECTIVE".equals(action)) repository.makeEffective(actor.tenantId(), current.id(),
            command.actualEffectiveDate(), command.externalReference().trim(), evidence, actor.employeeId());
        if ("ROLL_BACK".equals(action)) repository.rollBack(actor.tenantId(), current.id(),
            command.actualEffectiveDate(), command.externalReference().trim(), evidence, actor.employeeId());
    }

    public Optional<Request> find(DatabaseSecurityContext actor, UUID id) {
        requireActor(actor);
        return transactions.required(actor, () -> repository.find(actor.tenantId(), id));
    }

    public List<Request> list(DatabaseSecurityContext actor) {
        requireActor(actor);
        return transactions.required(actor, () -> repository.list(actor.tenantId()));
    }

    public String permissionForAction(Request request, String actionCode) {
        String action = normalize(actionCode);
        return switch (action) {
            case "SUBMIT", "CONFIRM_APPOINTMENT" -> "p012.promotion.read";
            case "RECORD_ASSESSMENT", "COMPLETE_REVIEW", "COMPLETE_PROBATION" -> "p012.promotion.review";
            case "APPROVE" -> "p012.promotion.approve";
            case "RECORD_APPOINTMENT", "MAKE_EFFECTIVE", "ROLL_BACK" -> "p012.promotion.appoint";
            default -> "p012.promotion.manage";
        };
    }

    public List<String> availableActionCodes(DatabaseSecurityContext actor, Request request) {
        requireActor(actor);
        return ACTIONS.getOrDefault(request.currentNodeCode(), Set.of()).stream()
                .filter(action -> actorAndStateViolation(actor, request, action).isEmpty())
                .sorted()
                .toList();
    }

    private void validateAction(DatabaseSecurityContext actor, Request request, String action, ActionCommand command) {
        actorAndStateViolation(actor, request, action).ifPresent(message -> { throw rejected(message); });
        if ("CHECK_ELIGIBILITY".equals(action) && (!Boolean.TRUE.equals(command.eligibilityConfirmed()) || !Boolean.TRUE.equals(command.freezeClear())))
            throw rejected("eligibility and freeze status must both be confirmed");
        if ("RECORD_ASSESSMENT".equals(action) && (command.score1000() == null || command.score1000() < 0 || command.score1000() > 1000))
            throw rejected("assessment score must be between 0 and 1000");
        if ("VERIFY_VACANCY_BUDGET".equals(action) && (!Boolean.TRUE.equals(command.vacancyConfirmed()) || trim(command.budgetVerificationReference()) == null))
            throw rejected("confirmed vacancy and external budget verification reference are required");
        if ("COMPLETE_REVIEW".equals(action) && !Boolean.TRUE.equals(command.reviewPassed()))
            throw rejected("review must pass before approval");
        if ("APPROVE".equals(action) && !Boolean.TRUE.equals(command.approved()))
            throw rejected("approved decision is required to continue");
        if ("RECORD_APPOINTMENT".equals(action) && (command.actualEffectiveDate() == null
            || trim(command.salaryConfirmationReference()) == null || trim(command.externalReference()) == null))
            throw rejected("effective date and external appointment/salary confirmation references are required");
        if ("CONFIRM_APPOINTMENT".equals(action) && !repository.executionExists(actor.tenantId(), request.id(), "CONFIRMED"))
            throw rejected("appointment confirmation receipt is missing");
        if ("COMPLETE_PROBATION".equals(action) && !Set.of("PASS", "ROLLBACK").contains(normalize(command.probationResult())))
            throw rejected("probation result must be PASS or ROLLBACK");
        if ("MAKE_EFFECTIVE".equals(action)) {
            if (!repository.eventExists(actor.tenantId(), request.id(), "PROBATION_PASS")) throw rejected("passed probation evidence is required");
            validateExecution(command);
        }
        if ("ROLL_BACK".equals(action)) {
            if (!repository.eventExists(actor.tenantId(), request.id(), "PROBATION_ROLLBACK")) throw rejected("rollback probation evidence is required");
            validateExecution(command);
        }
    }

    private Optional<String> actorAndStateViolation(DatabaseSecurityContext actor, Request request, String action) {
        boolean owner = actor.employeeId().equals(request.ownerEmployeeId());
        if ("CONFIRM_APPOINTMENT".equals(action) && !owner)
            return Optional.of("only the target employee may confirm the appointment");
        if (Set.of("RECORD_ASSESSMENT", "COMPLETE_REVIEW", "APPROVE", "RECORD_APPOINTMENT", "COMPLETE_PROBATION", "MAKE_EFFECTIVE", "ROLL_BACK").contains(action) && owner)
            return Optional.of("target employee cannot review, approve or execute their own appointment");
        if ("RECORD_APPOINTMENT".equals(action)
                && repository.executionExists(actor.tenantId(), request.id(), "CONFIRMED"))
            return Optional.of("appointment confirmation is already recorded");
        if ("COMPLETE_REVIEW".equals(action)) {
            Optional<UUID> assessor = repository.eventActor(actor.tenantId(), request.id(), "ASSESSMENT_RECORDED");
            if (assessor.isEmpty()) return Optional.of("assessment actor is missing");
            if (assessor.get().equals(actor.employeeId()))
                return Optional.of("competition reviewer must be independent from assessor");
        }
        if ("APPROVE".equals(action)) {
            Optional<UUID> reviewer = repository.eventActor(actor.tenantId(), request.id(), "REVIEW_COMPLETED");
            if (reviewer.isEmpty()) return Optional.of("review actor is missing");
            if (reviewer.get().equals(actor.employeeId()))
                return Optional.of("approver must be independent from reviewer");
        }
        if ("MAKE_EFFECTIVE".equals(action) && !repository.eventExists(actor.tenantId(), request.id(), "PROBATION_PASS"))
            return Optional.of("passed probation evidence is required");
        if ("ROLL_BACK".equals(action) && !repository.eventExists(actor.tenantId(), request.id(), "PROBATION_ROLLBACK"))
            return Optional.of("rollback probation evidence is required");
        return Optional.empty();
    }

    private static void validateExecution(ActionCommand command) {
        if (command.actualEffectiveDate() == null || trim(command.externalReference()) == null)
            throw rejected("effective date and external execution reference are required");
    }

    private String eventType(String action, ActionCommand command) {
        if ("RECORD_ASSESSMENT".equals(action)) return "ASSESSMENT_RECORDED";
        if ("COMPLETE_REVIEW".equals(action)) return "REVIEW_COMPLETED";
        if ("COMPLETE_PROBATION".equals(action)) return "PASS".equals(normalize(command.probationResult())) ? "PROBATION_PASS" : "PROBATION_ROLLBACK";
        return action;
    }

    private List<UUID> candidates(DatabaseSecurityContext actor, String permission, UUID center) {
        List<UUID> values = repository.permissionCandidates(actor.tenantId(), permission, center);
        if (values.isEmpty()) throw rejected(permission + " candidate is required");
        return values;
    }

    private List<WorkflowFormService.FieldValue> initial(WorkflowRuntimeService.Instance instance, Request request) {
        return List.of(
            text("process_instance_no", instance.instanceNo()), text("subject", request.subject()),
            text("owner_employee_id", request.ownerEmployeeId().toString()),
            text("target_position_code", request.targetPositionCode()),
            text("planned_effective_date", request.plannedEffectiveDate().toString())
        );
    }

    private ObjectNode evidence(String event, JsonNode supplied, UUID actor) {
        ObjectNode node = mapper.createObjectNode().put("event", event).put("actorEmployeeId", actor.toString()).put("recordedAt", Instant.now().toString());
        node.set("sourceEvidence", requiredEvidence(supplied, event));
        return node;
    }

    private void emit(DatabaseSecurityContext actor, Request request, String node, String action, String target, List<UUID> recipientIds) {
        ObjectNode payload = mapper.createObjectNode().put("requestId", request.id().toString()).put("businessNo", request.businessNo())
            .put("event", "CREATED".equals(action) ? "P012.promotion.created" : "P012.stage." + node.substring(1) + ".completed")
            .put("actionCode", action).put("nodeCode", target);
        payload.set("recipientEmployeeIds", uuids(recipientIds));
        int version = Math.max(1, request.versionNo() + 1);
        outbox.enqueue(new TransactionalOutboxService.Command(actor.tenantId(), actor.employeeId(), "P012_PROMOTION", request.id(),
            "P012_PROMOTION_EVENT", version, json(payload), "p012:" + request.id() + ":v" + version + ":" + node.toLowerCase(Locale.ROOT) + ":" + action.toLowerCase(Locale.ROOT)));
    }

    private List<UUID> recipients(WorkflowRuntimeService.Result result) {
        if (result.task() == null || result.task().candidateRule() == null) return List.of();
        JsonNode field = result.task().candidateRule().get("field");
        JsonNode values = field == null || result.instance().contextSnapshot() == null ? null : result.instance().contextSnapshot().get(field.asText());
        List<UUID> ids = new ArrayList<>();
        if (values != null && values.isArray()) values.forEach(value -> {
            try { ids.add(UUID.fromString(value.asText())); }
            catch (IllegalArgumentException exception) { throw rejected("workflow candidate id is invalid"); }
        });
        return List.copyOf(ids);
    }

    private ArrayNode uuids(List<UUID> ids) { ArrayNode array = mapper.createArrayNode(); ids.stream().distinct().forEach(id -> array.add(id.toString())); return array; }
    private static List<UUID> union(List<UUID> first, List<UUID> second) { LinkedHashSet<UUID> values = new LinkedHashSet<>(first); values.addAll(second); return List.copyOf(values); }
    private Request required(UUID tenant, UUID id) { return repository.find(tenant, id).orElseThrow(() -> rejected("promotion request not found")); }
    private String json(JsonNode node) { try { return mapper.writeValueAsString(node); } catch (JsonProcessingException exception) { throw rejected("event payload cannot be serialized"); } }
    private static WorkflowFormService.FieldValue text(String code, String value) { return new WorkflowFormService.FieldValue(code, "TEXT", value, null, null, null, null, null, "P1", false); }
    private static void validateCreate(CreateCommand command) {
        if (command == null || command.businessDate() == null || command.ownerEmployeeId() == null || command.plannedEffectiveDate() == null)
            throw rejected("business date, employee and planned effective date are required");
        if (trim(command.subject()) == null || command.subject().trim().length() < 5) throw rejected("subject requires at least 5 characters");
        if (trim(command.targetPositionCode()) == null || command.targetPositionCode().trim().length() > 32) throw rejected("valid target position code is required");
        if (trim(command.employmentType()) == null || trim(command.periodOrCourseNo()) == null) throw rejected("employment type and period are required");
        requiredEvidence(command.evidence(), "application");
    }
    private static JsonNode requiredEvidence(JsonNode node, String purpose) { if (node == null || !node.isObject()) throw rejected(purpose + " requires immutable evidence"); return node; }
    private static void requireActor(DatabaseSecurityContext actor) { if (actor == null || actor.tenantId() == null || actor.employeeId() == null || actor.identityId() == null || actor.orgId() == null) throw rejected("authenticated tenant employee identity is required"); }
    private static String normalize(String value) { String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT); if (!normalized.matches("[A-Z0-9_]{1,32}")) throw rejected("invalid code"); return normalized; }
    private static String scoped(String key, String suffix) { if (key == null || key.isBlank() || key.length() > 160) throw rejected("valid idempotency key is required"); return key + ":" + suffix; }
    private static String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static ProcessRejectedException rejected(String message) { return new ProcessRejectedException("P012 " + message); }
    private static String status(String node) { return switch (node) { case "S01" -> "Application"; case "S02" -> "Eligibility review"; case "S03" -> "Assessment"; case "S04" -> "Vacancy budget check"; case "S05" -> "Competition review"; case "S06" -> "Approval"; case "S07" -> "Publication notice"; case "S08" -> "Appointment confirmation"; case "S09" -> "Validation period"; case "S10" -> "Effective or rollback"; case "END" -> "Closed"; default -> throw rejected("unknown source node " + node); }; }

    public record CreateCommand(LocalDate businessDate, String subject, String reason, UUID ownerEmployeeId,
                                String employmentType, String headcountNo, String periodOrCourseNo,
                                String targetPositionCode, LocalDate plannedEffectiveDate, JsonNode evidence) {}
    public record ActionCommand(int expectedVersion, Long score1000, Boolean eligibilityConfirmed, Boolean freezeClear,
                                Boolean vacancyConfirmed, String budgetVerificationReference, Boolean reviewPassed,
                                Boolean approved, String salaryConfirmationReference, String externalReference,
                                String probationResult, LocalDate actualEffectiveDate, String resultSummary, JsonNode evidence) {}
    public record Target(UUID employeeId, UUID centerId, UUID currentAppointmentId, UUID currentPositionId,
                         String personName, String personNo) {}
    public record Position(UUID id, UUID orgId, String code) {}
    public record FormRef(UUID id, int versionNo) {}
    public record Event(UUID id, int eventSeq, String eventType, JsonNode evidence, UUID actorEmployeeId, Instant createdAt) {}
    public record Execution(UUID id, String executionType, UUID targetPositionId, UUID previousAppointmentId,
                            UUID newAppointmentId, LocalDate effectiveDate, String salaryConfirmationReference,
                            String externalReference, JsonNode evidence, UUID executedBy, Instant executedAt) {}
    public record Request(UUID id, UUID tenantId, String businessNo, UUID workflowInstanceId, String workflowInstanceNo,
                          String currentNodeCode, String status, int versionNo, LocalDate businessDate, String subject,
                          String reason, UUID ownerCenterId, UUID ownerEmployeeId, String employmentType,
                          String headcountNo, String periodOrCourseNo, String personName, String personNo,
                          LocalDate plannedEffectiveDate, String targetPositionCode, Long score1000,
                          LocalDate actualEffectiveDate, List<Event> events, List<Execution> executions, Instant updatedAt) {
        public Request metadataOnly() { return new Request(id, tenantId, businessNo, workflowInstanceId, workflowInstanceNo,
            currentNodeCode, status, versionNo, businessDate, subject, null, ownerCenterId, ownerEmployeeId, employmentType,
            null, periodOrCourseNo, null, null, plannedEffectiveDate, targetPositionCode, null, actualEffectiveDate,
            List.of(), List.of(), updatedAt); }
    }

    public interface Repository {
        Optional<UUID> latestPublishedWorkflowVersion(UUID tenant, String processCode);
        Optional<FormRef> latestPublishedForm(UUID tenant, String formCode, String processCode, String nodeCode);
        Optional<Target> target(UUID tenant, UUID employee);
        Optional<Position> position(UUID tenant, String positionCode);
        List<UUID> permissionCandidates(UUID tenant, String permission, UUID center);
        void insert(Request request, UUID actor);
        int bindWorkflow(UUID tenant, UUID id, int version, UUID workflowId, UUID actor);
        int move(UUID tenant, UUID id, int version, String status, String result, LocalDate effectiveDate, Instant closed, UUID actor);
        void setScore(UUID tenant, UUID id, long score, UUID actor);
        void appendEvent(UUID tenant, UUID id, String type, JsonNode evidence, UUID actor);
        Optional<UUID> eventActor(UUID tenant, UUID id, String type);
        boolean eventExists(UUID tenant, UUID id, String type);
        boolean executionExists(UUID tenant, UUID id, String type);
        void recordConfirmation(UUID tenant, UUID id, LocalDate effectiveDate, String salaryReference, String externalReference, JsonNode evidence, UUID actor);
        void makeEffective(UUID tenant, UUID id, LocalDate effectiveDate, String externalReference, JsonNode evidence, UUID actor);
        void rollBack(UUID tenant, UUID id, LocalDate effectiveDate, String externalReference, JsonNode evidence, UUID actor);
        Optional<Request> find(UUID tenant, UUID id);
        List<Request> list(UUID tenant);
    }
}
