from pathlib import Path


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.strip() + "\n", encoding="utf-8")


write(
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java",
    r'''
package cn.shangjingu.platform.workflow.phase11;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Frozen PHASE-11 process graphs exposed strictly in checkpoint order. */
public enum Phase11Process {
    P011(
            "绩效管理",
            "performance.performance_cycle",
            "EMP-P011-F01",
            "p011.performance.evaluate",
            "p011.performance.calibrate",
            List.of(
                    step("S01", "目标制定", "SET_TARGETS", "S02"),
                    step("S02", "员工确认", "CONFIRM_TARGETS", "S03"),
                    step("S03", "过程记录与辅导", "RECORD_COACHING", "S04"),
                    step("S04", "权威数据归集", "COLLECT_FACTS", "S05"),
                    step("S05", "员工自评/主管评价", "SUBMIT_REVIEWS", "S06"),
                    step("S06", "1000分计算", "CALCULATE_SCORE", "S07"),
                    step("S07", "校准", "CALIBRATE", "S08"),
                    step("S08", "结果反馈确认", "SUBMIT_APPEAL_DECISION", "S09"),
                    step("S09", "申诉复核", "RESOLVE_APPEAL", "S10"),
                    step("S10", "绩效影响执行", "EXECUTE_IMPACT", "S11"),
                    step("S11", "归档", "ARCHIVE", "END")),
            Set.of("CONFIRM_TARGETS", "SUBMIT_APPEAL_DECISION"),
            Set.of("CALIBRATE", "RESOLVE_APPEAL")),
    P012(
            "晋升与任职发展",
            "hr.promotion_request",
            "EMP-P012-F01",
            "p012.promotion.review",
            "p012.promotion.appoint",
            List.of(
                    step("S01", "提名提交", "SUBMIT_NOMINATION", "S02"),
                    step("S02", "资格校验", "PASS_ELIGIBILITY", "S03"),
                    step("S03", "评审资料与评价", "SUBMIT_ASSESSMENT", "S04"),
                    step("S04", "岗位编制与预算核验", "VERIFY_POSITION_BUDGET", "S05"),
                    step("S05", "评审会", "COMPLETE_REVIEW", "S06"),
                    step("S06", "审批", "APPROVE_PROMOTION", "S07"),
                    step("S07", "公示与沟通", "COMPLETE_NOTICE", "S08"),
                    step("S08", "员工确认", "CONFIRM_APPOINTMENT", "S09"),
                    step("S09", "任前校验", "COMPLETE_VALIDATION", "S10"),
                    step("S10", "正式生效", "ACTIVATE_APPOINTMENT", "END")),
            Set.of("CONFIRM_APPOINTMENT"),
            Set.of(
                    "APPROVE_PROMOTION",
                    "COMPLETE_NOTICE",
                    "COMPLETE_VALIDATION",
                    "ACTIVATE_APPOINTMENT")),
    P013(
            "奖励与认可",
            "reward.reward_case",
            "EMP-P013-F01",
            "p013.reward.review",
            "p013.reward.execute",
            List.of(
                    step("S01", "贡献事实登记", "REGISTER_CONTRIBUTION", "S02"),
                    step("S02", "证据核验", "VERIFY_EVIDENCE", "S03"),
                    step("S03", "奖励建议", "RECOMMEND_REWARD", "S04"),
                    step("S04", "奖励审批", "APPROVE_REWARD", "S05"),
                    step("S05", "重复影响校验", "CHECK_DUPLICATE_IMPACT", "S06"),
                    step("S06", "奖励执行", "EXECUTE_REWARD", "S07"),
                    step("S07", "员工告知", "NOTIFY_EMPLOYEE", "S08"),
                    step("S08", "回执登记", "RECORD_RECEIPTS", "S09"),
                    step("S09", "归档", "ARCHIVE", "END")),
            Set.of(),
            Set.of(
                    "APPROVE_REWARD",
                    "EXECUTE_REWARD",
                    "NOTIFY_EMPLOYEE",
                    "RECORD_RECEIPTS",
                    "ARCHIVE"));

    private final String label;
    private final String table;
    private final String initialFormCode;
    private final String managerPermission;
    private final String specialistPermission;
    private final List<Step> steps;
    private final Map<String, Step> byNode;
    private final Set<String> ownerActions;
    private final Set<String> specialistActions;

    Phase11Process(
            String label,
            String table,
            String initialFormCode,
            String managerPermission,
            String specialistPermission,
            List<Step> steps,
            Set<String> ownerActions,
            Set<String> specialistActions) {
        this.label = label;
        this.table = table;
        this.initialFormCode = initialFormCode;
        this.managerPermission = managerPermission;
        this.specialistPermission = specialistPermission;
        this.steps = List.copyOf(steps);
        this.ownerActions = Set.copyOf(ownerActions);
        this.specialistActions = Set.copyOf(specialistActions);
        Map<String, Step> index = new LinkedHashMap<>();
        for (Step step : steps) {
            index.put(step.node(), step);
        }
        this.byNode = Map.copyOf(index);
    }

    public String code() {
        return name();
    }

    public String label() {
        return label;
    }

    public String table() {
        return table;
    }

    public String initialFormCode() {
        return initialFormCode;
    }

    public String managerPermission() {
        return managerPermission;
    }

    public String specialistPermission() {
        return specialistPermission;
    }

    public String initialAction() {
        return steps.getFirst().action();
    }

    public String labelFor(String node) {
        if ("END".equals(node)) {
            return "已关闭";
        }
        Step step = byNode.get(node);
        if (step == null) {
            throw rejected("unknown workflow node: " + node);
        }
        return step.label();
    }

    public Step requireTransition(String node, String action) {
        Step step = byNode.get(node);
        if (step == null || !step.action().equals(action)) {
            throw rejected("action " + action + " is not allowed from " + node);
        }
        return step;
    }

    public boolean ownerAction(String action) {
        return ownerActions.contains(action);
    }

    public boolean specialistAction(String action) {
        return specialistActions.contains(action);
    }

    public List<Step> steps() {
        return steps;
    }

    private ProcessRejectedException rejected(String message) {
        return new ProcessRejectedException(code() + " " + message);
    }

    private static Step step(String node, String label, String action, String targetNode) {
        return new Step(node, label, action, targetNode);
    }

    public record Step(String node, String label, String action, String targetNode) {}
}
''',
)

write(
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/RewardRepository.java",
    r'''
package cn.shangjingu.platform.workflow.phase11;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RewardRepository {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public RewardRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public boolean sourceFactAvailable(UUID tenantId, String sourceFactKey) {
        Boolean exists = jdbc.queryForObject(
                """
                select exists(
                  select 1 from reward.reward_case
                  where tenant_id=:tenantId and source_fact_key=:sourceFactKey and not is_deleted)
                """,
                params("tenantId", tenantId, "sourceFactKey", sourceFactKey),
                Boolean.class);
        return !Boolean.TRUE.equals(exists);
    }

    public boolean paidFinanceReference(
            UUID tenantId, UUID referenceId, BigDecimal expectedAmount) {
        if (referenceId == null) {
            return false;
        }
        Boolean ready = jdbc.queryForObject(
                """
                select (
                  exists(
                    select 1 from finance.budget_request f
                    where f.tenant_id=:tenantId and f.id=:referenceId and not f.is_deleted
                      and lower(coalesce(f.payment_status,'')) in
                          ('paid','settled','completed','已支付','已结算')
                      and lower(coalesce(f.invoice_verification,'not_required')) in
                          ('verified','pass','not_required','已验真','无需票据')
                      and coalesce(f.actual_amount,f.approved_amount,f.requested_amount,0) >= :amount)
                  or exists(
                    select 1 from finance.expense_claim f
                    where f.tenant_id=:tenantId and f.id=:referenceId and not f.is_deleted
                      and lower(coalesce(f.payment_status,'')) in
                          ('paid','settled','completed','已支付','已结算')
                      and lower(coalesce(f.invoice_verification,'not_required')) in
                          ('verified','pass','not_required','已验真','无需票据')
                      and coalesce(f.actual_amount,f.approved_amount,f.requested_amount,0) >= :amount)
                )
                """,
                params(
                        "tenantId", tenantId,
                        "referenceId", referenceId,
                        "amount", expectedAmount == null ? BigDecimal.ZERO : expectedAmount),
                Boolean.class);
        return Boolean.TRUE.equals(ready);
    }

    public boolean executionEffectAbsent(UUID tenantId, UUID rewardId) {
        Boolean exists = jdbc.queryForObject(
                """
                select exists(
                  select 1 from reward.reward_case r
                  where r.tenant_id=:tenantId and r.id=:rewardId
                    and r.point_effect_id is not null and not r.is_deleted
                  union all
                  select 1 from reward.point_transaction p
                  where p.tenant_id=:tenantId and p.source_reward_case_id=:rewardId
                    and not p.is_deleted)
                """,
                params("tenantId", tenantId, "rewardId", rewardId),
                Boolean.class);
        return !Boolean.TRUE.equals(exists);
    }

    public void insert(
            Phase11Record record,
            RewardService.CreateCommand command,
            UUID actorId) {
        int rows = jdbc.update(
                """
                insert into reward.reward_case(
                  id,tenant_id,business_no,workflow_instance_id,status,current_node_code,version_no,
                  created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,
                  owner_center_id,owner_employee_id,benefit_amount,comp_grade_impact,
                  employee_event_type,fact_occurred_at,fact_summary,impact_effective_date,
                  impact_level,points_delta,source_fact_key,content_version,period_no)
                values(
                  :id,:tenantId,:businessNo,null,:status,'S01',0,
                  :actorId,:actorId,'PORTAL',:businessDate,:subject,:reason,:priority,:riskLevel,
                  :ownerCenterId,:ownerEmployeeId,:benefitAmount,:compGradeImpact,
                  :employeeEventType,:factOccurredAt,:factSummary,:impactEffectiveDate,
                  :impactLevel,:pointsDelta,:sourceFactKey,:contentVersion,:periodNo)
                """,
                params(
                        "id", record.id(),
                        "tenantId", record.tenantId(),
                        "businessNo", record.businessNo(),
                        "status", record.status(),
                        "actorId", actorId,
                        "businessDate", record.businessDate(),
                        "subject", record.subject(),
                        "reason", record.reason(),
                        "priority", record.priority(),
                        "riskLevel", record.riskLevel(),
                        "ownerCenterId", record.ownerCenterId(),
                        "ownerEmployeeId", record.ownerEmployeeId(),
                        "benefitAmount", amount(command.benefitAmount()),
                        "compGradeImpact", trimToNull(command.compGradeImpact()),
                        "employeeEventType", normalized(command.employeeEventType(), "P013_REWARD"),
                        "factOccurredAt", timestamp(record.factOccurredAt()),
                        "factSummary", record.factSummary(),
                        "impactEffectiveDate", command.impactEffectiveDate(),
                        "impactLevel", command.impactLevel().trim(),
                        "pointsDelta", command.pointsDelta(),
                        "sourceFactKey", command.sourceFactKey().trim(),
                        "contentVersion", command.contentVersion().trim(),
                        "periodNo", command.periodNo().trim()));
        requireSingle(rows, "canonical reward insert");
    }

    public int bindWorkflow(
            UUID tenantId,
            UUID rewardId,
            int expectedVersion,
            UUID workflowInstanceId,
            String nodeCode,
            String status,
            UUID actorId) {
        return jdbc.update(
                """
                update reward.reward_case
                   set workflow_instance_id=:workflowInstanceId,current_node_code=:nodeCode,
                       status=:status,version_no=version_no+1,updated_by=:actorId,updated_at=now()
                 where tenant_id=:tenantId and id=:rewardId
                   and version_no=:expectedVersion and not is_deleted
                """,
                params(
                        "workflowInstanceId", workflowInstanceId,
                        "nodeCode", nodeCode,
                        "status", status,
                        "actorId", actorId,
                        "tenantId", tenantId,
                        "rewardId", rewardId,
                        "expectedVersion", expectedVersion));
    }

    public UUID createPointEffect(
            Phase11Record current, String summary, UUID actorId) {
        long points = current.details().path("pointsDelta").asLong(0L);
        if (points == 0L) {
            return null;
        }
        UUID proposedId = UUID.randomUUID();
        MapSqlParameterSource parameters = params(
                "id", proposedId,
                "tenantId", current.tenantId(),
                "businessNo", current.businessNo(),
                "actorId", actorId,
                "businessDate", current.businessDate(),
                "subject", current.subject(),
                "reason", current.reason(),
                "priority", current.priority(),
                "riskLevel", current.riskLevel(),
                "ownerCenterId", current.ownerCenterId(),
                "ownerEmployeeId", current.ownerEmployeeId(),
                "summary", summary,
                "compGradeImpact", text(current.details(), "compGradeImpact"),
                "factOccurredAt", timestamp(current.factOccurredAt()),
                "factSummary", current.factSummary(),
                "impactEffectiveDate", date(current.details(), "impactEffectiveDate"),
                "impactLevel", text(current.details(), "impactLevel"),
                "pointsDelta", points,
                "rewardId", current.id(),
                "sourceFactKey", "P013:" + current.id(),
                "contentVersion", text(current.details(), "contentVersion"),
                "periodNo", text(current.details(), "periodNo"));
        jdbc.update(
                """
                insert into reward.point_transaction(
                  id,tenant_id,business_no,workflow_instance_id,status,current_node_code,version_no,
                  created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,
                  owner_center_id,owner_employee_id,actual_start_at,actual_end_at,result_summary,closed_at,
                  actual_amount,benefit_amount,change_action,change_reason,comp_grade_impact,
                  cost_center_id,currency,employee_event_type,fact_occurred_at,fact_summary,
                  impact_effective_date,impact_level,known_impact,points_delta,
                  source_fact_key,source_reward_case_id,content_version,period_no)
                values(
                  :id,:tenantId,left(:businessNo || '-PTS',64),null,'已入账','END',0,
                  :actorId,:actorId,'PHASE11_EFFECT',:businessDate,:subject,:reason,:priority,:riskLevel,
                  :ownerCenterId,:ownerEmployeeId,now(),now(),:summary,now(),
                  0,0,'REWARD_POST',:summary,:compGradeImpact,
                  'NON_FINANCIAL','POINT','P013_REWARD_EFFECT',:factOccurredAt,:factSummary,
                  :impactEffectiveDate,:impactLevel,'P013 exactly-once reward impact',:pointsDelta,
                  :sourceFactKey,:rewardId,:contentVersion,:periodNo)
                on conflict do nothing
                """,
                parameters);
        UUID effect = jdbc.queryForObject(
                """
                select id from reward.point_transaction
                where tenant_id=:tenantId and source_reward_case_id=:rewardId and not is_deleted
                """,
                parameters,
                UUID.class);
        if (effect == null) {
            throw rejected("reward point effect was not persisted");
        }
        return effect;
    }

    public int advance(
            Phase11Record current,
            String action,
            String targetNode,
            String status,
            RewardService.ActionCommand command,
            UUID pointEffectId,
            UUID actorId) {
        MapSqlParameterSource parameters = params(
                "tenantId", current.tenantId(),
                "rewardId", current.id(),
                "expectedVersion", command.expectedVersion(),
                "expectedNode", current.currentNodeCode(),
                "targetNode", targetNode,
                "status", status,
                "actorId", actorId,
                "summary", trimToNull(command.summary()),
                "decision", trimToNull(command.decision()),
                "financeReferenceId", command.financeReferenceId(),
                "pointEffectId", pointEffectId,
                "receiptReference", trimToNull(command.receiptReference()));
        String domainSet = switch (action) {
            case "VERIFY_EVIDENCE" ->
                    "evidence_verified_at=coalesce(evidence_verified_at,now()),";
            case "RECOMMEND_REWARD" -> "recommendation_summary=:summary,";
            case "APPROVE_REWARD" ->
                    "approval_decision=:decision,approved_at=coalesce(approved_at,now()),";
            case "CHECK_DUPLICATE_IMPACT" ->
                    "duplicate_checked_at=coalesce(duplicate_checked_at,now()),";
            case "EXECUTE_REWARD" ->
                    "finance_reference_id=coalesce(:financeReferenceId,finance_reference_id),"
                            + "point_effect_id=coalesce(:pointEffectId,point_effect_id),"
                            + "reward_executed_at=coalesce(reward_executed_at,now()),";
            case "NOTIFY_EMPLOYEE" ->
                    "employee_notified_at=coalesce(employee_notified_at,now()),";
            case "RECORD_RECEIPTS" ->
                    "receipt_reference=:receiptReference,"
                            + "receipts_recorded_at=coalesce(receipts_recorded_at,now()),";
            case "ARCHIVE" ->
                    "archived_at=coalesce(archived_at,now()),"
                            + "closed_at=coalesce(closed_at,now()),"
                            + "actual_end_at=coalesce(actual_end_at,now()),";
            default -> "";
        };
        return jdbc.update(
                "update reward.reward_case set "
                        + domainSet
                        + "current_node_code=:targetNode,status=:status,"
                        + "result_summary=coalesce(:summary,result_summary),"
                        + "version_no=version_no+1,updated_by=:actorId,updated_at=now() "
                        + "where tenant_id=:tenantId and id=:rewardId "
                        + "and version_no=:expectedVersion and current_node_code=:expectedNode "
                        + "and not is_deleted",
                parameters);
    }

    public Optional<Phase11Record> find(UUID tenantId, UUID rewardId) {
        return jdbc.query(
                        selectSql("and r.id=:rewardId"),
                        params("tenantId", tenantId, "rewardId", rewardId),
                        this::mapRecord)
                .stream()
                .findFirst();
    }

    public List<Phase11Record> list(UUID tenantId) {
        return jdbc.query(
                selectSql("order by r.created_at desc,r.id desc"),
                params("tenantId", tenantId),
                this::mapRecord);
    }

    private String selectSql(String suffix) {
        return """
                select r.id,r.tenant_id,r.business_no,r.workflow_instance_id,
                       wi.instance_no workflow_instance_no,r.current_node_code,r.status,r.version_no,
                       r.subject,r.reason,r.priority,r.risk_level,r.owner_center_id,r.owner_employee_id,
                       r.business_date,r.fact_occurred_at,r.fact_summary,r.result_summary,
                       r.created_at,r.updated_at,r.closed_at,
                       jsonb_build_object(
                         'sourceFactKey',r.source_fact_key,
                         'contentVersion',r.content_version,'periodNo',r.period_no,
                         'benefitAmount',r.benefit_amount,'pointsDelta',r.points_delta,
                         'compGradeImpact',r.comp_grade_impact,
                         'impactLevel',r.impact_level,'impactEffectiveDate',r.impact_effective_date,
                         'evidenceVerifiedAt',r.evidence_verified_at,
                         'recommendationSummary',r.recommendation_summary,
                         'approvalDecision',r.approval_decision,'approvedAt',r.approved_at,
                         'duplicateCheckedAt',r.duplicate_checked_at,
                         'financeReferenceId',r.finance_reference_id,
                         'pointEffectId',r.point_effect_id,
                         'rewardExecutedAt',r.reward_executed_at,
                         'employeeNotifiedAt',r.employee_notified_at,
                         'receiptReference',r.receipt_reference,
                         'receiptsRecordedAt',r.receipts_recorded_at,
                         'archivedAt',r.archived_at) details
                  from reward.reward_case r
                  left join workflow.wf_instance wi
                    on wi.tenant_id=r.tenant_id and wi.id=r.workflow_instance_id and not wi.is_deleted
                 where r.tenant_id=:tenantId and not r.is_deleted
                """ + suffix;
    }

    private Phase11Record mapRecord(ResultSet rs, int rowNum) throws SQLException {
        return new Phase11Record(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                Phase11Process.P013.code(),
                rs.getString("business_no"),
                rs.getObject("workflow_instance_id", UUID.class),
                rs.getString("workflow_instance_no"),
                rs.getString("current_node_code"),
                rs.getString("status"),
                rs.getInt("version_no"),
                rs.getString("subject"),
                rs.getString("reason"),
                rs.getString("priority"),
                rs.getString("risk_level"),
                rs.getObject("owner_center_id", UUID.class),
                rs.getObject("owner_employee_id", UUID.class),
                rs.getObject("business_date", LocalDate.class),
                instant(rs, "fact_occurred_at"),
                rs.getString("fact_summary"),
                rs.getString("result_summary"),
                instant(rs, "created_at"),
                instant(rs, "updated_at"),
                instant(rs, "closed_at"),
                json(rs, "details"));
    }

    private JsonNode json(ResultSet rs, String column) throws SQLException {
        String value = rs.getString(column);
        try {
            return value == null ? mapper.createObjectNode() : mapper.readTree(value);
        } catch (Exception exception) {
            throw new SQLException("P013 projection JSON cannot be parsed", exception);
        }
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Object value = rs.getObject(column);
        if (value instanceof OffsetDateTime offset) {
            return offset.toInstant();
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toInstant();
        }
        return null;
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static BigDecimal amount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String text(JsonNode details, String field) {
        String value = details.path(field).asText(null);
        return value == null || value.isBlank() ? null : value;
    }

    private static LocalDate date(JsonNode details, String field) {
        String value = text(details, field);
        return value == null ? null : LocalDate.parse(value);
    }

    private static MapSqlParameterSource params(Object... values) {
        MapSqlParameterSource source = new MapSqlParameterSource();
        for (int index = 0; index < values.length; index += 2) {
            source.addValue(String.valueOf(values[index]), values[index + 1]);
        }
        return source;
    }

    private static void requireSingle(int rows, String operation) {
        if (rows != 1) {
            throw rejected(operation + " affected " + rows + " rows");
        }
    }

    private static ProcessRejectedException rejected(String message) {
        return new ProcessRejectedException("P013 " + message);
    }
}
''',
)

write(
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/RewardService.java",
    r'''
package cn.shangjingu.platform.workflow.phase11;

import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.core.process.BusinessNumberService;
import cn.shangjingu.platform.core.process.IdempotencyClaim;
import cn.shangjingu.platform.core.process.IdempotencyRegistry;
import cn.shangjingu.platform.core.process.ProcessRejectedException;
import cn.shangjingu.platform.workflow.WorkflowRuntimeService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** P013 reward lifecycle with evidence uniqueness and exactly-once point effects. */
@Service
public final class RewardService {
    private static final Phase11Process PROCESS = Phase11Process.P013;
    private static final Duration IDEMPOTENCY_TTL = Duration.ofHours(24);

    private final TenantTransactionRunner transactions;
    private final IdempotencyRegistry idempotency;
    private final BusinessNumberService numbers;
    private final TransactionalOutboxService outbox;
    private final Phase11WorkflowCoordinator workflow;
    private final Phase11Repository phase11Repository;
    private final RewardRepository rewards;
    private final ObjectMapper mapper;

    public RewardService(
            TenantTransactionRunner transactions,
            IdempotencyRegistry idempotency,
            BusinessNumberService numbers,
            TransactionalOutboxService outbox,
            Phase11WorkflowCoordinator workflow,
            Phase11Repository phase11Repository,
            RewardRepository rewards,
            ObjectMapper mapper) {
        this.transactions = transactions;
        this.idempotency = idempotency;
        this.numbers = numbers;
        this.outbox = outbox;
        this.workflow = workflow;
        this.phase11Repository = phase11Repository;
        this.rewards = rewards;
        this.mapper = mapper;
    }

    public Phase11Record create(
            DatabaseSecurityContext actor,
            String idempotencyKey,
            String requestHash,
            CreateCommand command) {
        requireActor(actor);
        validateCreate(command);
        return transactions.required(actor, () -> {
            if (!phase11Repository.activeEmployeeInOrg(
                    actor.tenantId(), command.ownerCenterId(), command.ownerEmployeeId())) {
                throw rejected("reward recipient must be active in the owner center");
            }
            if (!rewards.sourceFactAvailable(actor.tenantId(), command.sourceFactKey().trim())) {
                throw rejected("source fact has already produced a reward case");
            }
            UUID proposedId = UUID.randomUUID();
            IdempotencyClaim claim = idempotency.claim(
                    actor.tenantId(),
                    actor.employeeId(),
                    idempotencyKey,
                    requestHash,
                    PROCESS.table(),
                    proposedId,
                    IDEMPOTENCY_TTL);
            if (claim.existing()) {
                return required(actor.tenantId(), claim.resourceId());
            }
            Phase11Record draft = draft(actor, claim.resourceId(), command);
            rewards.insert(draft, command, actor.employeeId());
            Phase11WorkflowCoordinator.Started started = workflow.start(
                    actor, PROCESS, draft, command.toCreateData(), idempotencyKey);
            if (rewards.bindWorkflow(
                            actor.tenantId(),
                            draft.id(),
                            0,
                            started.workflowInstanceId(),
                            started.currentNodeCode(),
                            PROCESS.labelFor(started.currentNodeCode()),
                            actor.employeeId())
                    != 1) {
                throw rejected("concurrent create transition conflict");
            }
            Phase11Record created = required(actor.tenantId(), draft.id());
            emit(actor, created, PROCESS.initialAction());
            return created;
        });
    }

    public Phase11Record act(
            DatabaseSecurityContext actor,
            UUID rewardId,
            String actionCode,
            String idempotencyKey,
            String requestHash,
            ActionCommand command) {
        requireActor(actor);
        Objects.requireNonNull(command, "P013 action command is required");
        String action = safeAction(actionCode);
        return transactions.required(actor, () -> {
            Phase11Record current = required(actor.tenantId(), rewardId);
            IdempotencyClaim claim = idempotency.claim(
                    actor.tenantId(),
                    actor.employeeId(),
                    idempotencyKey,
                    requestHash,
                    PROCESS.table() + ".action." + action.toLowerCase(Locale.ROOT),
                    rewardId,
                    IDEMPOTENCY_TTL);
            if (claim.existing()) {
                return current;
            }
            if (current.versionNo() != command.expectedVersion()) {
                throw rejected("version conflict");
            }
            Phase11Process.Step step = PROCESS.requireTransition(current.currentNodeCode(), action);
            validateActor(current, actor.employeeId());
            validateAction(current, action, command);
            WorkflowRuntimeService.Result moved = workflow.advance(
                    actor, PROCESS, current, action, command.reason(), idempotencyKey);
            if (!step.targetNode().equals(moved.instance().currentNodeCode())) {
                throw rejected("workflow target does not match frozen contract");
            }
            UUID pointEffectId = null;
            if ("EXECUTE_REWARD".equals(action)) {
                pointEffectId = rewards.createPointEffect(
                        current, command.summary().trim(), actor.employeeId());
            }
            if (rewards.advance(
                            current,
                            action,
                            step.targetNode(),
                            PROCESS.labelFor(step.targetNode()),
                            command,
                            pointEffectId,
                            actor.employeeId())
                    != 1) {
                throw rejected("concurrent aggregate transition conflict");
            }
            Phase11Record result = required(actor.tenantId(), rewardId);
            emit(actor, result, action);
            return result;
        });
    }

    public Optional<Phase11Record> find(DatabaseSecurityContext actor, UUID rewardId) {
        requireActor(actor);
        return transactions.required(actor, () -> rewards.find(actor.tenantId(), rewardId));
    }

    public List<Phase11Record> list(DatabaseSecurityContext actor) {
        requireActor(actor);
        return transactions.required(actor, () -> rewards.list(actor.tenantId()));
    }

    private void validateAction(
            Phase11Record current, String action, ActionCommand command) {
        requireText(command.summary(), "summary");
        if ("APPROVE_REWARD".equals(action)) {
            requireText(command.decision(), "decision");
        }
        if ("CHECK_DUPLICATE_IMPACT".equals(action)
                && !rewards.executionEffectAbsent(current.tenantId(), current.id())) {
            throw rejected("reward impact already exists");
        }
        if ("EXECUTE_REWARD".equals(action)) {
            BigDecimal benefit = decimal(current.details(), "benefitAmount");
            if (benefit.signum() > 0
                    && !rewards.paidFinanceReference(
                            current.tenantId(), command.financeReferenceId(), benefit)) {
                throw rejected("authoritative paid finance reference is required");
            }
            if (!rewards.executionEffectAbsent(current.tenantId(), current.id())) {
                throw rejected("reward impact already exists");
            }
        }
        if ("RECORD_RECEIPTS".equals(action)) {
            requireText(command.receiptReference(), "receiptReference");
        }
        if ("ARCHIVE".equals(action)) {
            requireDetail(current.details(), "rewardExecutedAt");
            requireDetail(current.details(), "receiptsRecordedAt");
        }
    }

    static void validateActor(Phase11Record current, UUID actorEmployeeId) {
        if (actorEmployeeId.equals(current.ownerEmployeeId())) {
            throw rejected("self review, approval and reward execution are forbidden");
        }
    }

    static void validateCreate(CreateCommand command) {
        Objects.requireNonNull(command, "P013 create command is required");
        requireText(command.subject(), "subject");
        requireText(command.reason(), "reason");
        requireText(command.factSummary(), "factSummary");
        requireText(command.sourceFactKey(), "sourceFactKey");
        requireText(command.contentVersion(), "contentVersion");
        requireText(command.periodNo(), "periodNo");
        requireText(command.impactLevel(), "impactLevel");
        if (command.ownerCenterId() == null || command.ownerEmployeeId() == null) {
            throw rejected("ownerCenterId and ownerEmployeeId are required");
        }
        if (command.factOccurredAt() == null) {
            throw rejected("factOccurredAt is required");
        }
        if (command.sourceFactKey().length() > 160) {
            throw rejected("sourceFactKey must not exceed 160 characters");
        }
        if (command.periodNo().length() > 32) {
            throw rejected("periodNo must not exceed 32 characters");
        }
        BigDecimal benefit = command.benefitAmount() == null
                ? BigDecimal.ZERO
                : command.benefitAmount();
        if (benefit.signum() < 0) {
            throw rejected("benefitAmount must not be negative");
        }
        long points = command.pointsDelta() == null ? 0L : command.pointsDelta();
        if (benefit.signum() == 0
                && points == 0L
                && (command.compGradeImpact() == null
                        || command.compGradeImpact().isBlank())) {
            throw rejected("at least one concrete reward impact is required");
        }
    }

    private Phase11Record draft(
            DatabaseSecurityContext actor, UUID id, CreateCommand command) {
        Instant now = Instant.now();
        ObjectNode details = mapper.createObjectNode();
        details.put("sourceFactKey", command.sourceFactKey().trim());
        details.put("contentVersion", command.contentVersion().trim());
        details.put("periodNo", command.periodNo().trim());
        details.put("benefitAmount", amount(command.benefitAmount()));
        details.put("pointsDelta", command.pointsDelta() == null ? 0L : command.pointsDelta());
        put(details, "compGradeImpact", command.compGradeImpact());
        details.put("impactLevel", command.impactLevel().trim());
        if (command.impactEffectiveDate() != null) {
            details.put("impactEffectiveDate", command.impactEffectiveDate().toString());
        }
        return new Phase11Record(
                id,
                actor.tenantId(),
                PROCESS.code(),
                numbers.next(actor.tenantId(), actor.employeeId(), PROCESS.code()),
                null,
                null,
                "S01",
                PROCESS.labelFor("S01"),
                0,
                command.subject().trim(),
                command.reason().trim(),
                normalized(command.priority(), "NORMAL"),
                normalized(command.riskLevel(), "NORMAL"),
                command.ownerCenterId(),
                command.ownerEmployeeId(),
                command.businessDate() == null ? LocalDate.now() : command.businessDate(),
                command.factOccurredAt(),
                command.factSummary().trim(),
                null,
                now,
                now,
                null,
                details);
    }

    private Phase11Record required(UUID tenantId, UUID rewardId) {
        return rewards.find(tenantId, rewardId)
                .orElseThrow(() -> rejected("reward case not found"));
    }

    private void emit(DatabaseSecurityContext actor, Phase11Record record, String action) {
        ObjectNode payload = mapper.createObjectNode();
        payload.put("processCode", PROCESS.code());
        payload.put("recordId", record.id().toString());
        payload.put("businessNo", record.businessNo());
        payload.put("action", action);
        payload.put("nodeCode", record.currentNodeCode());
        payload.put("ownerEmployeeId", record.ownerEmployeeId().toString());
        outbox.enqueue(new TransactionalOutboxService.Command(
                actor.tenantId(),
                actor.employeeId(),
                "P013_REWARD",
                record.id(),
                "P013_PROCESS_EVENT",
                1,
                json(payload),
                "p013:" + record.id() + ":" + record.versionNo()));
    }

    private String json(ObjectNode payload) {
        try {
            return mapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new ProcessRejectedException("P013 event serialization failed", exception);
        }
    }

    private static void requireActor(DatabaseSecurityContext actor) {
        if (actor == null
                || actor.tenantId() == null
                || actor.userId() == null
                || actor.identityId() == null
                || actor.employeeId() == null
                || actor.orgId() == null
                || actor.positionId() == null) {
            throw rejected("authenticated employee context is required");
        }
    }

    private static void requireDetail(JsonNode details, String field) {
        if (details.path(field).isMissingNode()
                || details.path(field).isNull()
                || details.path(field).asText("").isBlank()) {
            throw rejected("required server fact is missing: " + field);
        }
    }

    private static BigDecimal decimal(JsonNode details, String field) {
        JsonNode value = details.path(field);
        return value.isNumber() ? value.decimalValue() : BigDecimal.ZERO;
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw rejected("required field is missing: " + field);
        }
    }

    private static String safeAction(String value) {
        if (value == null) {
            return "INVALID";
        }
        String action = value.trim().toUpperCase(Locale.ROOT);
        return action.matches("[A-Z0-9_]{1,48}") ? action : "INVALID";
    }

    private static String normalized(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static BigDecimal amount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static void put(ObjectNode target, String field, String value) {
        if (value != null && !value.isBlank()) {
            target.put(field, value.trim());
        }
    }

    private static ProcessRejectedException rejected(String message) {
        return new ProcessRejectedException("P013 " + message);
    }

    public record CreateCommand(
            String subject,
            String reason,
            String priority,
            String riskLevel,
            UUID ownerCenterId,
            UUID ownerEmployeeId,
            LocalDate businessDate,
            Instant factOccurredAt,
            String factSummary,
            String contentVersion,
            String periodNo,
            String sourceFactKey,
            String employeeEventType,
            String impactLevel,
            LocalDate impactEffectiveDate,
            Long pointsDelta,
            BigDecimal benefitAmount,
            String compGradeImpact) {
        Phase11CreateData toCreateData() {
            return new Phase11CreateData(
                    subject,
                    reason,
                    priority,
                    riskLevel,
                    ownerCenterId,
                    ownerEmployeeId,
                    businessDate,
                    factOccurredAt,
                    factSummary,
                    contentVersion,
                    periodNo);
        }
    }

    public record ActionCommand(
            int expectedVersion,
            String summary,
            String reason,
            String decision,
            UUID financeReferenceId,
            String receiptReference) {}
}
''',
)

write(
    "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P013RewardController.java",
    r'''
package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.workflow.phase11.Phase11Record;
import cn.shangjingu.platform.workflow.phase11.RewardService;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/processes/P013/rewards")
public final class P013RewardController {
    public static final String CREATE = "p013.reward.create";
    public static final String READ = "p013.reward.read";
    public static final String REVIEW = "p013.reward.review";
    public static final String EXECUTE = "p013.reward.execute";
    public static final String MONITOR = "p013.reward.monitor";

    private final RewardService rewards;
    private final Phase11ApiSupport support;

    public P013RewardController(RewardService rewards, Phase11ApiSupport support) {
        this.rewards = rewards;
        this.support = support;
    }

    @PostMapping
    public Phase11Record create(
            @AuthenticationPrincipal SessionPrincipal principal,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody RewardService.CreateCommand command) {
        support.requireAction(principal, CREATE, "P013");
        support.requireData(
                principal,
                CREATE,
                support.target(principal, command.ownerCenterId(), command.ownerEmployeeId()),
                "P013");
        support.audit(principal, "P013_CREATE_ATTEMPT", "reward.reward_case", null);
        Phase11Record result = rewards.create(
                support.context(principal),
                idempotencyKey,
                support.hash(command, "P013"),
                command);
        support.audit(principal, "P013_CREATED", "reward.reward_case", result.id());
        return result;
    }

    @GetMapping
    public List<Phase11Record> list(
            @AuthenticationPrincipal SessionPrincipal principal) {
        boolean read = support.allowed(principal, READ);
        boolean manage = manageAllowed(principal);
        boolean monitor = support.allowed(principal, MONITOR);
        if (!read && !manage && !monitor) {
            throw denied("no P013 read surface is granted");
        }
        return rewards.list(support.context(principal)).stream()
                .map(record -> project(principal, record, read, manage, monitor))
                .filter(Objects::nonNull)
                .toList();
    }

    @GetMapping("/{id}")
    public Phase11Record get(
            @AuthenticationPrincipal SessionPrincipal principal,
            @PathVariable UUID id) {
        Phase11Record record = required(principal, id);
        Phase11Record projected = project(
                principal,
                record,
                support.allowed(principal, READ),
                manageAllowed(principal),
                support.allowed(principal, MONITOR));
        if (projected == null) {
            throw denied("P013 data scope denied");
        }
        support.audit(principal, "P013_READ", "reward.reward_case", id);
        return projected;
    }

    @PostMapping("/{id}/actions/{actionCode}")
    public Phase11Record action(
            @AuthenticationPrincipal SessionPrincipal principal,
            @PathVariable UUID id,
            @PathVariable String actionCode,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody RewardService.ActionCommand command) {
        String action = support.safeAction(actionCode);
        String permission = actionPermission(action);
        support.requireAction(principal, permission, "P013");
        Phase11Record current = required(principal, id);
        support.requireData(principal, permission, support.target(principal, current), "P013");
        support.audit(
                principal,
                "P013_ACTION_ATTEMPT_" + action,
                "reward.reward_case",
                id);
        Phase11Record result = rewards.act(
                support.context(principal),
                id,
                action,
                idempotencyKey,
                support.hash(Map.of("action", action, "body", command), "P013"),
                command);
        support.audit(
                principal,
                "P013_ACTION_" + action,
                "reward.reward_case",
                id);
        return result;
    }

    private Phase11Record project(
            SessionPrincipal principal,
            Phase11Record record,
            boolean read,
            boolean manage,
            boolean monitor) {
        AuthorizationTarget target = support.target(principal, record);
        if (manage && anyManageData(principal, target)) {
            return record;
        }
        if (read && support.allowedData(principal, READ, target)) {
            return record;
        }
        if (monitor && support.allowedData(principal, MONITOR, target)) {
            return record.metadataOnly();
        }
        return null;
    }

    private boolean manageAllowed(SessionPrincipal principal) {
        return support.allowed(principal, REVIEW) || support.allowed(principal, EXECUTE);
    }

    private boolean anyManageData(
            SessionPrincipal principal, AuthorizationTarget target) {
        return support.allowedData(principal, REVIEW, target)
                || support.allowedData(principal, EXECUTE, target);
    }

    private Phase11Record required(SessionPrincipal principal, UUID id) {
        return rewards.find(support.context(principal), id)
                .orElseThrow(() -> new IllegalArgumentException("P013 reward case not found"));
    }

    static String actionPermission(String action) {
        return switch (action) {
            case "VERIFY_EVIDENCE", "RECOMMEND_REWARD", "APPROVE_REWARD",
                    "CHECK_DUPLICATE_IMPACT" -> REVIEW;
            case "EXECUTE_REWARD", "NOTIFY_EMPLOYEE", "RECORD_RECEIPTS", "ARCHIVE" -> EXECUTE;
            default -> throw new IllegalArgumentException("P013 action is invalid");
        };
    }

    private static AccessDeniedException denied(String reason) {
        return new AccessDeniedException("P013 authorization denied: " + reason);
    }
}
''',
)

write(
    "technical-platform/backend/modules/workflow/src/test/java/cn/shangjingu/platform/workflow/phase11/RewardServiceTest.java",
    r'''
package cn.shangjingu.platform.workflow.phase11;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RewardServiceTest {
    private static final UUID CENTER = UUID.fromString("10000000-0000-0000-0000-000000001113");
    private static final UUID EMPLOYEE = UUID.fromString("20000000-0000-0000-0000-000000001113");

    @Test
    void p013GraphMatchesFrozenContract() {
        assertEquals(
                List.of(
                        "REGISTER_CONTRIBUTION",
                        "VERIFY_EVIDENCE",
                        "RECOMMEND_REWARD",
                        "APPROVE_REWARD",
                        "CHECK_DUPLICATE_IMPACT",
                        "EXECUTE_REWARD",
                        "NOTIFY_EMPLOYEE",
                        "RECORD_RECEIPTS",
                        "ARCHIVE"),
                Phase11Process.P013.steps().stream()
                        .map(Phase11Process.Step::action)
                        .toList());
        assertEquals("END", Phase11Process.P013.steps().getLast().targetNode());
    }

    @Test
    void rewardRequiresConcreteImpactAndUniqueSourceKey() {
        RewardService.CreateCommand invalid = new RewardService.CreateCommand(
                "reward",
                "reason",
                "NORMAL",
                "NORMAL",
                CENTER,
                EMPLOYEE,
                LocalDate.of(2026, 8, 16),
                Instant.parse("2026-08-16T00:00:00Z"),
                "fact",
                "P013-CONTENT-V1",
                "2026-Q3",
                "source-1",
                "P013_REWARD",
                "CENTER",
                LocalDate.of(2026, 8, 17),
                0L,
                BigDecimal.ZERO,
                null);
        assertThrows(ProcessRejectedException.class, () -> RewardService.validateCreate(invalid));
    }

    @Test
    void rewardRecipientCannotReviewOrExecuteOwnReward() {
        Phase11Record record = new Phase11Record(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "P013",
                "P013-TEST",
                UUID.randomUUID(),
                "WF-TEST",
                "S02",
                "证据核验",
                1,
                "reward",
                "reason",
                "NORMAL",
                "NORMAL",
                CENTER,
                EMPLOYEE,
                LocalDate.of(2026, 8, 16),
                Instant.parse("2026-08-16T00:00:00Z"),
                "fact",
                null,
                Instant.parse("2026-08-16T00:00:00Z"),
                Instant.parse("2026-08-16T00:00:00Z"),
                null,
                JsonNodeFactory.instance.objectNode());
        assertThrows(
                ProcessRejectedException.class,
                () -> RewardService.validateActor(record, EMPLOYEE));
    }
}
''',
)

write(
    "technical-platform/backend/apps/api/src/test/java/cn/shangjingu/platform/api/phase11/P013RewardControllerContractTest.java",
    r'''
package cn.shangjingu.platform.api.phase11;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class P013RewardControllerContractTest {
    @Test
    void frozenActionsMapOnlyToReviewOrExecutePermissions() {
        assertEquals(
                P013RewardController.REVIEW,
                P013RewardController.actionPermission("VERIFY_EVIDENCE"));
        assertEquals(
                P013RewardController.REVIEW,
                P013RewardController.actionPermission("CHECK_DUPLICATE_IMPACT"));
        assertEquals(
                P013RewardController.EXECUTE,
                P013RewardController.actionPermission("EXECUTE_REWARD"));
        assertEquals(
                P013RewardController.EXECUTE,
                P013RewardController.actionPermission("ARCHIVE"));
        assertThrows(
                IllegalArgumentException.class,
                () -> P013RewardController.actionPermission("CLIENT_TARGET_STATUS"));
    }
}
''',
)
