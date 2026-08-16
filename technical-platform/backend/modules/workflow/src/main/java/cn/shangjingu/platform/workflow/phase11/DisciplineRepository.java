package cn.shangjingu.platform.workflow.phase11;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DisciplineRepository {
    private static final String EVENT_TYPE = "P014_DISCIPLINE";

    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public DisciplineRepository(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public boolean sourceFactAvailable(UUID tenantId, String sourceFactKey) {
        Boolean exists = jdbc.queryForObject(
                """
                select exists(
                  select 1 from reward.discipline_case
                  where tenant_id=:tenantId and employee_event_type='P014_DISCIPLINE'
                    and source_fact_key=:sourceFactKey and not is_deleted)
                """,
                params("tenantId", tenantId, "sourceFactKey", sourceFactKey),
                Boolean.class);
        return !Boolean.TRUE.equals(exists);
    }

    public void insert(
            Phase11Record record,
            DisciplineService.CreateCommand command,
            UUID actorId) {
        int rows = jdbc.update(
                """
                insert into reward.discipline_case(
                  id,tenant_id,business_no,workflow_instance_id,status,current_node_code,version_no,
                  created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,
                  owner_center_id,owner_employee_id,customer_id,customer_name,employee_event_type,
                  fact_occurred_at,fact_summary,impact_effective_date,impact_level,
                  source_fact_key,source_type,content_version,period_no)
                values(
                  :id,:tenantId,:businessNo,null,:status,'S01',0,
                  :actorId,:actorId,'PORTAL',:businessDate,:subject,:reason,:priority,:riskLevel,
                  :ownerCenterId,:ownerEmployeeId,:customerId,:customerName,:eventType,
                  :factOccurredAt,:factSummary,:impactEffectiveDate,:impactLevel,
                  :sourceFactKey,:sourceType,:contentVersion,:periodNo)
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
                        "customerId", trimToNull(command.customerId()),
                        "customerName", trimToNull(command.customerName()),
                        "eventType", EVENT_TYPE,
                        "factOccurredAt", timestamp(record.factOccurredAt()),
                        "factSummary", record.factSummary(),
                        "impactEffectiveDate", command.impactEffectiveDate(),
                        "impactLevel", command.impactLevel().trim(),
                        "sourceFactKey", command.sourceFactKey().trim(),
                        "sourceType", command.sourceType().trim().toUpperCase(Locale.ROOT),
                        "contentVersion", trimToNull(command.contentVersion()),
                        "periodNo", trimToNull(command.periodNo())));
        requireSingle(rows, "canonical discipline insert");
    }

    public int bindWorkflow(
            UUID tenantId,
            UUID caseId,
            int expectedVersion,
            UUID workflowInstanceId,
            String nodeCode,
            String status,
            UUID actorId) {
        return jdbc.update(
                """
                update reward.discipline_case
                   set workflow_instance_id=:workflowInstanceId,current_node_code=:nodeCode,
                       status=:status,version_no=version_no+1,updated_by=:actorId,updated_at=now()
                 where tenant_id=:tenantId and id=:caseId
                   and version_no=:expectedVersion and employee_event_type='P014_DISCIPLINE'
                   and not is_deleted
                """,
                params(
                        "workflowInstanceId", workflowInstanceId,
                        "nodeCode", nodeCode,
                        "status", status,
                        "actorId", actorId,
                        "tenantId", tenantId,
                        "caseId", caseId,
                        "expectedVersion", expectedVersion));
    }

    public int advance(
            Phase11Record current,
            String action,
            String targetNode,
            String status,
            DisciplineService.ActionCommand command,
            UUID actorId) {
        MapSqlParameterSource parameters = params(
                "tenantId", current.tenantId(),
                "caseId", current.id(),
                "expectedVersion", command.expectedVersion(),
                "expectedNode", current.currentNodeCode(),
                "targetNode", targetNode,
                "status", status,
                "actorId", actorId,
                "summary", trimToNull(command.summary()),
                "interviewNotes", trimToNull(command.interviewNotes()),
                "employeeStatement", trimToNull(command.employeeStatement()),
                "decision", trimToNull(command.decision()),
                "serviceProof", json(command.serviceProof()),
                "appealWindowEndsAt", timestamp(command.appealWindowEndsAt()),
                "appealGrounds", trimToNull(command.appealGrounds()),
                "appealEvidence", json(command.appealEvidence()),
                "appealResult", upperToNull(command.appealResult()),
                "appealDecision", trimToNull(command.appealDecision()),
                "appealDecisionEvidence", json(command.appealDecisionEvidence()),
                "appealWaived", command.appealWaived(),
                "waiverEvidence", json(command.waiverEvidence()),
                "defectReason", trimToNull(command.defectReason()));
        String domainSet = switch (action) {
            case "OPEN_INVESTIGATION" ->
                    "investigator_employee_id=:actorId,investigation_opened_at=coalesce(investigation_opened_at,now()),";
            case "RECORD_STATEMENT" ->
                    "interview_notes=:interviewNotes,employee_statement=:employeeStatement,"
                            + "statement_recorded_at=coalesce(statement_recorded_at,now()),";
            case "HEARING_DECISION" ->
                    "decision_employee_id=:actorId,decision_summary=:decision,"
                            + "decision_at=coalesce(decision_at,now()),";
            case "SERVE_DECISION" ->
                    "service_proof=cast(:serviceProof as jsonb),"
                            + "decision_served_at=coalesce(decision_served_at,now()),"
                            + "appeal_window_ends_at=:appealWindowEndsAt,";
            case "OPEN_APPEAL" ->
                    "appeal_summary=:appealGrounds,appeal_evidence=cast(:appealEvidence as jsonb),"
                            + "appeal_opened_at=coalesce(appeal_opened_at,now()),";
            case "ASSIGN_APPEAL_REVIEWER" ->
                    "appeal_reviewer_employee_id=:actorId,"
                            + "appeal_review_assigned_at=coalesce(appeal_review_assigned_at,now()),";
            case "RESOLVE_APPEAL" ->
                    "appeal_result=:appealResult,appeal_decision=:appealDecision,"
                            + "appeal_decision_evidence=cast(:appealDecisionEvidence as jsonb),"
                            + "appeal_resolved_at=coalesce(appeal_resolved_at,now()),";
            case "CLOSE_NO_APPEAL" ->
                    "appeal_waived=:appealWaived,"
                            + "waiver_evidence=case when :appealWaived then cast(:waiverEvidence as jsonb) else waiver_evidence end,"
                            + "closed_at=coalesce(closed_at,now()),actual_end_at=coalesce(actual_end_at,now()),";
            case "CLOSE_AFTER_APPEAL" ->
                    "closed_at=coalesce(closed_at,now()),actual_end_at=coalesce(actual_end_at,now()),";
            case "REOPEN_FOR_DEFECT" ->
                    "defect_reopen_reason=:defectReason,reopened_at=now(),closed_at=null,actual_end_at=null,";
            case "ARCHIVE" ->
                    "archived_at=coalesce(archived_at,now()),actual_end_at=coalesce(actual_end_at,now()),";
            default -> "";
        };
        return jdbc.update(
                "update reward.discipline_case set "
                        + domainSet
                        + "current_node_code=:targetNode,status=:status,"
                        + "result_summary=coalesce(:summary,result_summary),"
                        + "version_no=version_no+1,updated_by=:actorId,updated_at=now() "
                        + "where tenant_id=:tenantId and id=:caseId "
                        + "and employee_event_type='P014_DISCIPLINE' "
                        + "and version_no=:expectedVersion and current_node_code=:expectedNode "
                        + "and not is_deleted",
                parameters);
    }

    public Optional<Phase11Record> find(UUID tenantId, UUID caseId) {
        return jdbc.query(
                        selectSql("and d.id=:caseId"),
                        params("tenantId", tenantId, "caseId", caseId),
                        this::mapRecord)
                .stream()
                .findFirst();
    }

    public List<Phase11Record> list(UUID tenantId) {
        return jdbc.query(
                selectSql("order by d.created_at desc,d.id desc"),
                params("tenantId", tenantId),
                this::mapRecord);
    }

    private String selectSql(String suffix) {
        return """
                select d.id,d.tenant_id,d.business_no,d.workflow_instance_id,
                       wi.instance_no workflow_instance_no,d.current_node_code,d.status,d.version_no,
                       d.subject,d.reason,d.priority,d.risk_level,d.owner_center_id,d.owner_employee_id,
                       d.business_date,d.fact_occurred_at,d.fact_summary,d.result_summary,
                       d.created_at,d.updated_at,d.closed_at,
                       jsonb_build_object(
                         'sourceFactKey',d.source_fact_key,'sourceType',d.source_type,
                         'customerId',d.customer_id,'customerName',d.customer_name,
                         'contentVersion',d.content_version,'periodNo',d.period_no,
                         'impactLevel',d.impact_level,'impactEffectiveDate',d.impact_effective_date,
                         'investigatorEmployeeId',d.investigator_employee_id,
                         'investigationOpenedAt',d.investigation_opened_at,
                         'interviewNotes',d.interview_notes,'employeeStatement',d.employee_statement,
                         'statementRecordedAt',d.statement_recorded_at,
                         'decisionEmployeeId',d.decision_employee_id,'decisionSummary',d.decision_summary,
                         'decisionAt',d.decision_at,'serviceProof',d.service_proof,
                         'decisionServedAt',d.decision_served_at,'appealWindowEndsAt',d.appeal_window_ends_at,
                         'appealOpenedAt',d.appeal_opened_at,'appealSummary',d.appeal_summary,
                         'appealEvidence',d.appeal_evidence,
                         'appealReviewerEmployeeId',d.appeal_reviewer_employee_id,
                         'appealReviewAssignedAt',d.appeal_review_assigned_at,
                         'appealResult',d.appeal_result,'appealDecision',d.appeal_decision,
                         'appealDecisionEvidence',d.appeal_decision_evidence,
                         'appealResolvedAt',d.appeal_resolved_at,'appealWaived',d.appeal_waived,
                         'waiverEvidence',d.waiver_evidence,'defectReopenReason',d.defect_reopen_reason,
                         'reopenedAt',d.reopened_at,'archivedAt',d.archived_at) details
                  from reward.discipline_case d
                  left join workflow.wf_instance wi
                    on wi.tenant_id=d.tenant_id and wi.id=d.workflow_instance_id and not wi.is_deleted
                 where d.tenant_id=:tenantId and d.employee_event_type='P014_DISCIPLINE'
                   and not d.is_deleted
                """ + suffix;
    }

    private Phase11Record mapRecord(ResultSet rs, int rowNum) throws SQLException {
        return new Phase11Record(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                Phase11Process.P014.code(),
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
        } catch (JsonProcessingException exception) {
            throw new SQLException("P014 projection JSON cannot be parsed", exception);
        }
    }

    private String json(JsonNode value) {
        if (value == null || value.isNull() || value.isMissingNode()) {
            return null;
        }
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw rejected("evidence JSON cannot be serialized");
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

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String upperToNull(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private static MapSqlParameterSource params(Object... values) {
        MapSqlParameterSource parameters = new MapSqlParameterSource();
        for (int index = 0; index < values.length; index += 2) {
            parameters.addValue((String) values[index], values[index + 1]);
        }
        return parameters;
    }

    private static void requireSingle(int rows, String operation) {
        if (rows != 1) {
            throw rejected(operation + " expected one row but affected " + rows);
        }
    }

    private static ProcessRejectedException rejected(String message) {
        return new ProcessRejectedException("P014 " + message);
    }
}
