package cn.shangjingu.platform.collaboration;

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
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** P006 meeting/minutes/action-item aggregate bound to the published workflow runtime. */
@Service
public final class MeetingService {
    public static final String PROCESS_CODE = "P006";
    public static final String INITIAL_FORM_CODE = "EMP-P006-F01";
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);
    private static final Map<String, Set<String>> ACTIONS = Map.ofEntries(
            Map.entry("S01", Set.of("SUBMIT", "WITHDRAW")),
            Map.entry("S02", Set.of("ACCEPT", "RETURN", "REJECT")),
            Map.entry("S03", Set.of("PUBLISH", "RETURN", "REJECT")),
            Map.entry("S04", Set.of("RECORD_ATTENDANCE")),
            Map.entry("S05", Set.of("CONVENE")),
            Map.entry("S06", Set.of("CONFIRM_MINUTES", "RETURN")),
            Map.entry("S07", Set.of("GENERATE_ACTIONS")),
            Map.entry("S08", Set.of("SUBMIT_EXECUTION")),
            Map.entry("S09", Set.of("ACCEPT_RESULT", "REWORK")),
            Map.entry("S10", Set.of("ACKNOWLEDGE_OVERDUE")),
            Map.entry("S11", Set.of("ARCHIVE")));

    private final TenantTransactionRunner transactions;
    private final IdempotencyRegistry idempotency;
    private final BusinessNumberService numbers;
    private final TransactionalOutboxService outbox;
    private final WorkflowRuntimeService workflow;
    private final WorkflowTaskAssignmentService taskAssignment;
    private final WorkflowFormService forms;
    private final Repository repository;
    private final ObjectMapper mapper;

    public MeetingService(TenantTransactionRunner transactions, IdempotencyRegistry idempotency,
            BusinessNumberService numbers, TransactionalOutboxService outbox, WorkflowRuntimeService workflow,
            WorkflowTaskAssignmentService taskAssignment, WorkflowFormService forms,
            Repository repository, ObjectMapper mapper) {
        this.transactions = transactions; this.idempotency = idempotency; this.numbers = numbers;
        this.outbox = outbox; this.workflow = workflow; this.taskAssignment = taskAssignment;
        this.forms = forms; this.repository = repository; this.mapper = mapper;
    }

    public Meeting create(DatabaseSecurityContext actor, String key, String requestHash, CreateCommand command) {
        requireActor(actor); validateCreate(command);
        return transactions.required(actor, () -> {
            IdempotencyClaim claim = idempotency.claim(actor.tenantId(), actor.employeeId(), key, requestHash,
                    "collaboration.meeting", UUID.randomUUID(), IDEMPOTENCY_TTL);
            if (claim.existing()) return required(actor.tenantId(), claim.resourceId());
            UUID versionId = repository.latestPublishedWorkflowVersion(actor.tenantId(), PROCESS_CODE)
                    .orElseThrow(() -> rejected("published workflow is not configured"));
            FormRef form = repository.latestPublishedForm(actor.tenantId(), INITIAL_FORM_CODE, PROCESS_CODE, "S01")
                    .orElseThrow(() -> rejected("published EMP-P006-F01 form is not configured"));
            List<UUID> managers = repository.permissionCandidates(actor.tenantId(), "p006.meeting.manage", actor.orgId(), actor.employeeId());
            List<UUID> executors = repository.permissionCandidates(actor.tenantId(), "p006.meeting.action", actor.orgId(), null);
            List<UUID> acceptors = repository.permissionCandidates(actor.tenantId(), "p006.meeting.accept", actor.orgId(), actor.employeeId());
            if (managers.isEmpty() || executors.isEmpty() || acceptors.isEmpty())
                throw rejected("eligible manager, executor and independent acceptor are required");

            String businessNo = numbers.next(actor.tenantId(), actor.employeeId(), PROCESS_CODE);
            Meeting draft = new Meeting(claim.resourceId(), actor.tenantId(), businessNo, null, null,
                    "S01", label("S01"), 0, command.businessDate(), command.subject().trim(), command.reason().trim(),
                    command.priority().trim(), actor.orgId(), actor.employeeId(), command.startAt(), command.startAt(),
                    null, command.officialSubject().trim(), command.officialContent().trim(),
                    trim(command.venueChannel()), command.visibilityLevel().trim(), List.of(), Instant.now());
            repository.insert(draft, actor.employeeId());

            ObjectNode context = mapper.createObjectNode();
            context.put("ownerEmployeeId", actor.employeeId().toString());
            context.put("ownerCenterId", actor.orgId().toString());
            context.set("managerCandidateIds", uuidArray(managers));
            context.set("executorCandidateIds", uuidArray(executors));
            context.set("acceptorCandidateIds", uuidArray(acceptors));
            WorkflowRuntimeService.Result started = workflow.start(new WorkflowRuntimeService.StartCommand(
                    actor.tenantId(), actor.employeeId(), actor.identityId(), versionId, "collaboration.meeting",
                    draft.id(), businessNo, draft.subject(), draft.priority(), context, scoped(key, "start")));
            forms.submit(new WorkflowFormService.SubmitForm(actor.tenantId(), actor.employeeId(), actor.identityId(),
                    started.instance().id(), null, form.id(), form.versionNo(), initialValues(started.instance(), command), scoped(key, "form")));
            if (repository.bindWorkflow(actor.tenantId(), draft.id(), 0, started.instance().id(), actor.employeeId()) != 1)
                throw rejected("concurrent workflow binding conflict");
            emit(actor, draft, "S01", "CREATED", "S01", List.of(actor.employeeId()));
            return required(actor.tenantId(), draft.id());
        });
    }

    public Meeting act(DatabaseSecurityContext actor, UUID id, String actionCode, String key,
            String requestHash, ActionCommand command) {
        requireActor(actor); Objects.requireNonNull(command, "P006 action command is required");
        String action = normalizeAction(actionCode);
        return transactions.required(actor, () -> {
            IdempotencyClaim claim = idempotency.claim(actor.tenantId(), actor.employeeId(), key, requestHash,
                    "collaboration.meeting.action", id, IDEMPOTENCY_TTL);
            if (claim.existing()) return required(actor.tenantId(), id);
            Meeting current = required(actor.tenantId(), id);
            if (current.versionNo() != command.expectedVersion()) throw rejected("meeting version conflict");
            WorkflowRuntimeService.Result runtime = workflow.get(actor.tenantId(), current.workflowInstanceId());
            String node = runtime.instance().currentNodeCode();
            if (!node.equals(current.currentNodeCode())) throw rejected("business projection is stale relative to workflow runtime");
            if (!ACTIONS.getOrDefault(node, Set.of()).contains(action)) throw rejected("action is not allowed at " + node);
            validateAction(actor, current, node, action, command);
            if ("S01".equals(node)) {
                if (!actor.employeeId().equals(current.ownerEmployeeId())) throw rejected("only the issue owner may submit or withdraw");
            } else {
                if (runtime.task() == null) throw rejected("current workflow task is missing");
                taskAssignment.claim(new WorkflowTaskAssignmentService.ClaimCommand(actor.tenantId(), runtime.task().id(), actor.employeeId()));
            }
            if ("S07".equals(node)) repository.insertActionItems(actor.tenantId(), id, command.actionItems(), actor.employeeId());
            if ("S08".equals(node)) repository.appendEvidence(actor.tenantId(), id, "execution_evidence", command.evidence(), actor.employeeId());
            if ("S09".equals(node)) repository.appendEvidence(actor.tenantId(), id, "acceptance_evidence", command.evidence(), actor.employeeId());
            if ("S10".equals(node)) repository.appendEvidence(actor.tenantId(), id, "overdue_escalation", command.evidence(), actor.employeeId());
            if ("S11".equals(node)) repository.appendEvidence(actor.tenantId(), id, "archive_review", command.evidence(), actor.employeeId());

            WorkflowRuntimeService.Result moved = workflow.act(new WorkflowRuntimeService.ActionCommand(
                    actor.tenantId(), actor.employeeId(), actor.identityId(), current.workflowInstanceId(),
                    runtime.task() == null ? null : runtime.task().id(), node, action, trim(command.reason()), scoped(key, "workflow")));
            Instant closedAt = "END".equals(moved.instance().currentNodeCode()) ? moved.instance().finishedAt() : null;
            if (repository.move(actor.tenantId(), id, current.versionNo(), label(moved.instance().currentNodeCode()),
                    trim(command.resultSummary()), closedAt, actor.employeeId()) != 1) throw rejected("concurrent meeting transition conflict");
            emit(actor, current, node, action, moved.instance().currentNodeCode(), recipients(moved));
            return required(actor.tenantId(), id);
        });
    }

    public Optional<Meeting> find(DatabaseSecurityContext actor, UUID id) {
        requireActor(actor); return transactions.required(actor, () -> repository.find(actor.tenantId(), id));
    }
    public List<Meeting> list(DatabaseSecurityContext actor) {
        requireActor(actor); return transactions.required(actor, () -> repository.list(actor.tenantId()));
    }
    public boolean ownerAction(Meeting meeting, String action) {
        return meeting != null && "S01".equals(meeting.currentNodeCode()) && Set.of("SUBMIT", "WITHDRAW").contains(normalizeAction(action));
    }

    private void validateAction(DatabaseSecurityContext actor, Meeting current, String node, String action, ActionCommand command) {
        if (Set.of("RETURN", "REJECT", "REWORK").contains(action) && trim(command.reason()) == null)
            throw rejected("return, reject and rework actions require a reason");
        if ("S06".equals(node) && "CONFIRM_MINUTES".equals(action) && trim(command.resultSummary()) == null)
            throw rejected("confirmed minutes require a result summary");
        if ("S07".equals(node)) validateActionItems(command.actionItems());
        if ("S08".equals(node) && !repository.actionItemOwners(actor.tenantId(), current.id()).contains(actor.employeeId()))
            throw rejected("only an owner bound by the confirmed action-item ledger may submit execution evidence");
        if (Set.of("S08", "S09", "S10", "S11").contains(node) && (command.evidence() == null || command.evidence().isNull()))
            throw rejected(node + " requires immutable evidence");
        if ("S09".equals(node)) repository.lastActorAtNodeAction(actor.tenantId(), current.workflowInstanceId(), "S08", "SUBMIT_EXECUTION")
                .filter(actor.employeeId()::equals).ifPresent(ignored -> { throw rejected("acceptance must be independent from the executor"); });
    }

    private static void validateActionItems(List<ActionItemCommand> items) {
        if (items == null || items.isEmpty()) throw rejected("confirmed minutes must generate at least one action item");
        Set<String> keys = new java.util.HashSet<>();
        for (ActionItemCommand item : items) {
            if (item == null || item.itemKey() == null || item.itemKey().isBlank() || !keys.add(item.itemKey().trim())
                    || item.itemName() == null || item.itemName().isBlank() || item.ownerEmployeeId() == null
                    || item.plannedStartAt() == null || item.plannedFinishAt() == null
                    || item.plannedFinishAt().isBefore(item.plannedStartAt()))
                throw rejected("action items require unique key, name, owner and a valid planned time range");
        }
    }

    private List<WorkflowFormService.FieldValue> initialValues(WorkflowRuntimeService.Instance instance, CreateCommand c) {
        List<WorkflowFormService.FieldValue> values = new ArrayList<>();
        values.add(text("process_instance_no", instance.instanceNo())); values.add(text("process_code", PROCESS_CODE));
        values.add(text("form_code", INITIAL_FORM_CODE)); values.add(text("official_subject", c.officialSubject()));
        values.add(text("official_content", c.officialContent())); values.add(text("subject", c.subject()));
        values.add(text("reason", c.reason())); values.add(text("business_date", c.businessDate().toString()));
        values.add(text("priority", c.priority())); values.add(text("visibility_level", c.visibilityLevel()));
        if (trim(c.venueChannel()) != null) values.add(text("venue_channel", c.venueChannel()));
        return List.copyOf(values);
    }
    private static WorkflowFormService.FieldValue text(String code, String value) {
        return new WorkflowFormService.FieldValue(code, "TEXT", value, null, null, null, null, null, "P1", false);
    }

    private void emit(DatabaseSecurityContext actor, Meeting meeting, String node, String action, String target, List<UUID> recipients) {
        ObjectNode payload = mapper.createObjectNode(); payload.put("meetingId", meeting.id().toString());
        payload.put("businessNo", meeting.businessNo()); payload.put("event", "CREATED".equals(action)
                ? "P006.meeting.created" : "P006.stage." + node.substring(1) + ".completed");
        payload.put("actionCode", action); payload.put("nodeCode", target); payload.set("recipientEmployeeIds", uuidArray(recipients));
        outbox.enqueue(new TransactionalOutboxService.Command(actor.tenantId(), actor.employeeId(), "P006_MEETING",
                meeting.id(), "P006_MEETING_EVENT", Math.max(1, meeting.versionNo() + 1), json(payload),
                "p006:" + meeting.id() + ":v" + Math.max(1, meeting.versionNo() + 1) + ":"
                        + node.toLowerCase(Locale.ROOT) + ":" + action.toLowerCase(Locale.ROOT)));
    }
    private List<UUID> recipients(WorkflowRuntimeService.Result result) {
        if (result.task() == null || result.task().candidateRule() == null) return List.of();
        JsonNode field = result.task().candidateRule().get("field");
        JsonNode values = field == null || result.instance().contextSnapshot() == null ? null : result.instance().contextSnapshot().get(field.asText());
        List<UUID> ids = new ArrayList<>(); if (values != null && values.isArray()) values.forEach(v -> { try { ids.add(UUID.fromString(v.asText())); } catch (IllegalArgumentException e) { throw rejected("workflow candidate id is invalid"); } });
        return List.copyOf(ids);
    }
    private ArrayNode uuidArray(List<UUID> ids) { ArrayNode a = mapper.createArrayNode(); ids.stream().distinct().forEach(id -> a.add(id.toString())); return a; }
    private String json(JsonNode node) { try { return mapper.writeValueAsString(node); } catch (JsonProcessingException e) { throw rejected("event payload cannot be serialized"); } }
    private Meeting required(UUID tenantId, UUID id) { return repository.find(tenantId, id).orElseThrow(() -> rejected("meeting not found")); }

    private static void validateCreate(CreateCommand c) {
        Objects.requireNonNull(c, "P006 create command is required");
        if (c.businessDate() == null || c.startAt() == null || trim(c.subject()) == null || c.subject().trim().length() < 5 || c.subject().trim().length() > 120
                || trim(c.officialSubject()) == null || c.officialSubject().trim().length() > 200 || trim(c.officialContent()) == null || c.officialContent().trim().length() > 20000
                || trim(c.reason()) == null || c.reason().trim().length() < 10 || trim(c.priority()) == null || trim(c.visibilityLevel()) == null)
            throw rejected("required meeting fields or source length constraints are invalid");
        if (!Set.of("公开", "内部", "秘密", "机密").contains(c.visibilityLevel().trim())) throw rejected("visibility level is outside the source enum");
        if (!Set.of("普通", "加急", "紧急").contains(c.priority().trim())) throw rejected("priority is outside the source enum");
        if (c.startAt().isBefore(Instant.now())) throw rejected("meeting start time cannot be in the past");
        if (trim(c.venueChannel()) != null && c.venueChannel().trim().length() > 500) throw rejected("venue/channel exceeds 500 characters");
    }
    private static void requireActor(DatabaseSecurityContext a) { if (a == null || a.tenantId() == null || a.userId() == null || a.identityId() == null || a.employeeId() == null || a.orgId() == null || a.positionId() == null) throw rejected("authenticated employee context is required"); }
    private static String scoped(String key, String suffix) { if (key == null || key.isBlank() || key.length() + suffix.length() + 1 > 128) throw rejected("valid idempotency key is required"); return key + ":" + suffix; }
    private static String normalizeAction(String value) { return value == null ? "" : value.trim().toUpperCase(Locale.ROOT); }
    private static String trim(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private static ProcessRejectedException rejected(String message) { return new ProcessRejectedException("P006 " + message); }
    public static String label(String node) { return switch (node) {
        case "S01" -> "议题征集"; case "S02" -> "材料完整性检查"; case "S03" -> "会议发布";
        case "S04" -> "签到与请假"; case "S05" -> "会议召开"; case "S06" -> "主持人确认纪要";
        case "S07" -> "行动项生成"; case "S08" -> "责任人执行"; case "S09" -> "验收与返工";
        case "S10" -> "逾期升级"; case "S11" -> "归档复盘"; case "END" -> "已归档";
        default -> throw rejected("unknown source node " + node); }; }

    public interface Repository {
        Optional<UUID> latestPublishedWorkflowVersion(UUID tenantId, String processCode);
        Optional<FormRef> latestPublishedForm(UUID tenantId, String formCode, String processCode, String nodeCode);
        List<UUID> permissionCandidates(UUID tenantId, String permissionCode, UUID orgId, UUID excludedEmployeeId);
        void insert(Meeting meeting, UUID actorId); int bindWorkflow(UUID tenantId, UUID id, int version, UUID workflowId, UUID actorId);
        int move(UUID tenantId, UUID id, int version, String status, String resultSummary, Instant closedAt, UUID actorId);
        void insertActionItems(UUID tenantId, UUID id, List<ActionItemCommand> items, UUID actorId);
        void appendEvidence(UUID tenantId, UUID id, String fieldCode, JsonNode evidence, UUID actorId);
        List<UUID> actionItemOwners(UUID tenantId, UUID id);
        Optional<UUID> lastActorAtNodeAction(UUID tenantId, UUID workflowId, String node, String action);
        Optional<Meeting> find(UUID tenantId, UUID id); List<Meeting> list(UUID tenantId);
    }
    public record FormRef(UUID id, int versionNo) { }
    public record CreateCommand(LocalDate businessDate, String subject, String reason, String priority, Instant startAt,
            String officialSubject, String officialContent, String venueChannel, String visibilityLevel) { }
    public record ActionItemCommand(String itemKey, String itemName, UUID ownerEmployeeId, Instant plannedStartAt,
            Instant plannedFinishAt, String acceptanceCriteria) { }
    public record ActionCommand(int expectedVersion, String reason, String resultSummary,
            List<ActionItemCommand> actionItems, JsonNode evidence) { }
    public record Meeting(UUID id, UUID tenantId, String businessNo, UUID workflowInstanceId, String workflowInstanceNo,
            String currentNodeCode, String status, int versionNo, LocalDate businessDate, String subject, String reason,
            String priority, UUID ownerCenterId, UUID ownerEmployeeId, Instant plannedStartAt, Instant startAt,
            String resultSummary, String officialSubject, String officialContent, String venueChannel,
            String visibilityLevel, List<MeetingItem> items, Instant updatedAt) {
        public Meeting metadataOnly() { return new Meeting(id, tenantId, businessNo, workflowInstanceId, workflowInstanceNo,
                currentNodeCode, status, versionNo, businessDate, subject, null, priority, ownerCenterId, ownerEmployeeId,
                plannedStartAt, startAt, null, officialSubject, null, venueChannel, visibilityLevel, List.of(), updatedAt); }
    }
    public record MeetingItem(UUID id, String fieldCode, int itemSeq, String itemKey, String itemName, JsonNode value, Instant createdAt) { }
}
