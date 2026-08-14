package cn.shangjingu.platform.hr.promotion;

import static cn.shangjingu.platform.hr.promotion.PromotionRequestService.*;

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
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcPromotionRequestRepository implements PromotionRequestService.Repository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcPromotionRequestRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public Optional<UUID> latestPublishedWorkflowVersion(UUID tenant, String processCode) {
        return jdbc.query("select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id where v.tenant_id=? and d.process_code=? and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted and (v.effective_at is null or v.effective_at<=now()) order by v.version_no desc limit 1",
            (result, row) -> result.getObject(1, UUID.class), tenant, processCode).stream().findFirst();
    }

    @Override
    public Optional<FormRef> latestPublishedForm(UUID tenant, String formCode, String processCode, String nodeCode) {
        return jdbc.query("select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code=? and process_code=? and node_code=? and enabled and not is_deleted order by version_no desc limit 1",
            (result, row) -> new FormRef(result.getObject(1, UUID.class), result.getInt(2)), tenant, formCode, processCode, nodeCode).stream().findFirst();
    }

    @Override
    public Optional<Target> target(UUID tenant, UUID employee) {
        return jdbc.query("""
            select e.id,ep.org_id,ep.id,ep.position_id,e.person_name,e.employee_no
              from org.employee e
              join org.employee_position ep on ep.tenant_id=e.tenant_id and ep.employee_id=e.id
               and ep.is_primary and ep.status='ACTIVE' and not ep.is_deleted
               and ep.effective_start_date<=current_date and (ep.effective_end_date is null or ep.effective_end_date>=current_date)
             where e.tenant_id=? and e.id=? and e.employment_status='ACTIVE' and not e.is_deleted
             order by ep.effective_start_date desc,ep.id limit 1
            """, (result, row) -> new Target(result.getObject(1, UUID.class), result.getObject(2, UUID.class),
                result.getObject(3, UUID.class), result.getObject(4, UUID.class), result.getString(5), result.getString(6)),
            tenant, employee).stream().findFirst();
    }

    @Override
    public Optional<Position> position(UUID tenant, String positionCode) {
        return jdbc.query("select id,org_id,position_code from org.position where tenant_id=? and position_code=? and status='ACTIVE' and not is_deleted",
            (result, row) -> new Position(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3)),
            tenant, positionCode.trim()).stream().findFirst();
    }

    @Override
    public List<UUID> permissionCandidates(UUID tenant, String permission, UUID center) {
        return jdbc.query("""
            select distinct ui.employee_id
              from iam.user_role ur
              join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted
              join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted
              join iam.permission pm on pm.tenant_id=rp.tenant_id and pm.id=rp.permission_id and not pm.is_deleted
              join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted
               and (ur.identity_id is null or ur.identity_id=ui.id)
              join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id and e.employment_status='ACTIVE' and not e.is_deleted
             where ur.tenant_id=? and pm.permission_code=? and ui.org_id=? and not ur.is_deleted
               and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now())
             order by ui.employee_id
            """, (result, row) -> result.getObject(1, UUID.class), tenant, permission, center);
    }

    @Override
    public void insert(Request request, UUID actor) {
        one(jdbc.update("""
            insert into hr.promotion_request(
              id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,
              subject,reason,priority,risk_level,owner_center_id,owner_employee_id,employment_type,headcount_no,
              period_or_course_no,person_name,person_no,planned_effective_date,target_job_id)
            values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, request.id(), request.tenantId(), request.businessNo(), request.status(), 0, actor, actor, "PORTAL",
            request.businessDate(), request.subject(), request.reason(), "NORMAL", "CRITICAL", request.ownerCenterId(),
            request.ownerEmployeeId(), request.employmentType(), request.headcountNo(), request.periodOrCourseNo(),
            request.personName(), request.personNo(), request.plannedEffectiveDate(), request.targetPositionCode()), "insert");
    }

    @Override
    public int bindWorkflow(UUID tenant, UUID id, int version, UUID workflowId, UUID actor) {
        return jdbc.update("update hr.promotion_request set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",
            workflowId, actor, tenant, id, version);
    }

    @Override
    public int move(UUID tenant, UUID id, int version, String status, String result, LocalDate effectiveDate, Instant closed, UUID actor) {
        return jdbc.update("update hr.promotion_request set status=?,result_summary=coalesce(cast(? as text),result_summary),actual_effective_date=coalesce(?,actual_effective_date),closed_at=coalesce(?,closed_at),version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",
            status, result, effectiveDate, timestamp(closed), actor, tenant, id, version);
    }

    @Override
    public void setScore(UUID tenant, UUID id, long score, UUID actor) {
        one(jdbc.update("update hr.promotion_request set score_1000=?,updated_by=? where tenant_id=? and id=? and not is_deleted",
            score, actor, tenant, id), "score projection");
    }

    @Override
    public void appendEvent(UUID tenant, UUID id, String type, JsonNode evidence, UUID actor) {
        lock(tenant, id, "event");
        one(jdbc.update("""
            insert into hr.promotion_request_event(id,tenant_id,request_id,event_seq,event_type,evidence,actor_employee_id)
            select gen_random_uuid(),?,?,coalesce(max(event_seq),0)+1,?,cast(? as jsonb),?
              from hr.promotion_request_event where tenant_id=? and request_id=?
            """, tenant, id, type, json(evidence), actor, tenant, id), "event append");
    }

    @Override
    public Optional<UUID> eventActor(UUID tenant, UUID id, String type) {
        return jdbc.query("select actor_employee_id from hr.promotion_request_event where tenant_id=? and request_id=? and event_type=? order by event_seq desc limit 1",
            (result, row) -> result.getObject(1, UUID.class), tenant, id, type).stream().findFirst();
    }

    @Override
    public boolean eventExists(UUID tenant, UUID id, String type) {
        Long count = jdbc.queryForObject("select count(*) from hr.promotion_request_event where tenant_id=? and request_id=? and event_type=?",
            Long.class, tenant, id, type);
        return count != null && count > 0;
    }

    @Override
    public boolean executionExists(UUID tenant, UUID id, String type) {
        Long count = jdbc.queryForObject("select count(*) from hr.promotion_appointment_execution where tenant_id=? and request_id=? and execution_type=?",
            Long.class, tenant, id, type);
        return count != null && count > 0;
    }

    @Override
    public void recordConfirmation(UUID tenant, UUID id, LocalDate effectiveDate, String salaryReference,
                                   String externalReference, JsonNode evidence, UUID actor) {
        Position target = requestPosition(tenant, id);
        one(jdbc.update("""
            insert into hr.promotion_appointment_execution(id,tenant_id,request_id,execution_type,target_position_id,
              effective_date,salary_confirmation_reference,external_reference,evidence,executed_by)
            values(gen_random_uuid(),?,?,'CONFIRMED',?,?,?,?,cast(? as jsonb),?)
            """, tenant, id, target.id(), effectiveDate, salaryReference, externalReference, json(evidence), actor), "appointment confirmation");
    }

    @Override
    public void makeEffective(UUID tenant, UUID id, LocalDate effectiveDate, String externalReference, JsonNode evidence, UUID actor) {
        lock(tenant, id, "appointment");
        Request request = find(tenant, id).orElseThrow(() -> rejected("promotion request not found"));
        Position target = requestPosition(tenant, id);
        CurrentAppointment previous = currentAppointment(tenant, request.ownerEmployeeId());
        if (!previous.startDate().isBefore(effectiveDate)) throw rejected("effective date must be after current appointment start");
        UUID newAppointment = UUID.randomUUID();
        one(jdbc.update("update org.employee_position set is_primary=false,status='INACTIVE',effective_end_date=?,updated_by=? where tenant_id=? and id=? and is_primary and status='ACTIVE' and not is_deleted",
            effectiveDate.minusDays(1), actor, tenant, previous.id()), "close previous appointment");
        one(jdbc.update("insert into org.employee_position(id,tenant_id,created_by,updated_by,employee_id,position_id,org_id,is_primary,effective_start_date,status) values(?,?,?,?,?,?,?,?,?,'ACTIVE')",
            newAppointment, tenant, actor, actor, request.ownerEmployeeId(), target.id(), target.orgId(), true, effectiveDate), "create effective appointment");
        one(jdbc.update("update org.employee set primary_position_id=?,primary_org_id=?,updated_by=? where tenant_id=? and id=? and not is_deleted",
            target.id(), target.orgId(), actor, tenant, request.ownerEmployeeId()), "sync employee primary appointment");
        one(jdbc.update("""
            insert into hr.promotion_appointment_execution(id,tenant_id,request_id,execution_type,target_position_id,
              previous_appointment_id,new_appointment_id,effective_date,external_reference,evidence,executed_by)
            values(gen_random_uuid(),?,?,'EFFECTIVE',?,?,?,?,?,cast(? as jsonb),?)
            """, tenant, id, target.id(), previous.id(), newAppointment, effectiveDate, externalReference, json(evidence), actor), "effective execution");
    }

    @Override
    public void rollBack(UUID tenant, UUID id, LocalDate effectiveDate, String externalReference, JsonNode evidence, UUID actor) {
        Request request = find(tenant, id).orElseThrow(() -> rejected("promotion request not found"));
        Position target = requestPosition(tenant, id);
        CurrentAppointment previous = currentAppointment(tenant, request.ownerEmployeeId());
        one(jdbc.update("""
            insert into hr.promotion_appointment_execution(id,tenant_id,request_id,execution_type,target_position_id,
              previous_appointment_id,effective_date,external_reference,evidence,executed_by)
            values(gen_random_uuid(),?,?,'ROLLED_BACK',?,?,?,?,cast(? as jsonb),?)
            """, tenant, id, target.id(), previous.id(), effectiveDate, externalReference, json(evidence), actor), "rollback execution");
    }

    @Override
    public Optional<Request> find(UUID tenant, UUID id) {
        return jdbc.query(select("where r.tenant_id=? and r.id=? and not r.is_deleted"), (result, row) -> map(result), tenant, id).stream().findFirst();
    }

    @Override
    public List<Request> list(UUID tenant) {
        return jdbc.query(select("where r.tenant_id=? and not r.is_deleted order by r.created_at desc,r.id desc"), (result, row) -> map(result), tenant);
    }

    private String select(String suffix) {
        return """
            select r.id,r.tenant_id,r.business_no,r.workflow_instance_id,w.instance_no workflow_instance_no,
              w.current_node_code,r.status,r.version_no,r.business_date,r.subject,r.reason,r.owner_center_id,
              r.owner_employee_id,r.employment_type,r.headcount_no,r.period_or_course_no,r.person_name,r.person_no,
              r.planned_effective_date,r.target_job_id,r.score_1000,r.actual_effective_date,r.updated_at
              from hr.promotion_request r
              left join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
            """ + suffix;
    }

    private Request map(ResultSet result) throws SQLException {
        UUID tenant = result.getObject("tenant_id", UUID.class);
        UUID id = result.getObject("id", UUID.class);
        return new Request(id, tenant, result.getString("business_no"), result.getObject("workflow_instance_id", UUID.class),
            result.getString("workflow_instance_no"), result.getString("current_node_code"), result.getString("status"),
            result.getInt("version_no"), date(result, "business_date"), result.getString("subject"), result.getString("reason"),
            result.getObject("owner_center_id", UUID.class), result.getObject("owner_employee_id", UUID.class),
            result.getString("employment_type"), result.getString("headcount_no"), result.getString("period_or_course_no"),
            result.getString("person_name"), result.getString("person_no"), date(result, "planned_effective_date"),
            result.getString("target_job_id"), (Long) result.getObject("score_1000"), date(result, "actual_effective_date"),
            events(tenant, id), executions(tenant, id), instant(result, "updated_at"));
    }

    private List<Event> events(UUID tenant, UUID id) {
        return jdbc.query("select id,event_seq,event_type,evidence,actor_employee_id,created_at from hr.promotion_request_event where tenant_id=? and request_id=? order by event_seq,id",
            (result, row) -> new Event(result.getObject(1, UUID.class), result.getInt(2), result.getString(3), read(result.getString(4)),
                result.getObject(5, UUID.class), instant(result, "created_at")), tenant, id);
    }

    private List<Execution> executions(UUID tenant, UUID id) {
        return jdbc.query("select id,execution_type,target_position_id,previous_appointment_id,new_appointment_id,effective_date,salary_confirmation_reference,external_reference,evidence,executed_by,executed_at from hr.promotion_appointment_execution where tenant_id=? and request_id=? order by executed_at,id",
            (result, row) -> new Execution(result.getObject(1, UUID.class), result.getString(2), result.getObject(3, UUID.class),
                result.getObject(4, UUID.class), result.getObject(5, UUID.class), date(result, "effective_date"), result.getString(7),
                result.getString(8), read(result.getString(9)), result.getObject(10, UUID.class), instant(result, "executed_at")), tenant, id);
    }

    private Position requestPosition(UUID tenant, UUID requestId) {
        return jdbc.query("select p.id,p.org_id,p.position_code from hr.promotion_request r join org.position p on p.tenant_id=r.tenant_id and p.position_code=r.target_job_id and p.status='ACTIVE' and not p.is_deleted where r.tenant_id=? and r.id=? and not r.is_deleted",
            (result, row) -> new Position(result.getObject(1, UUID.class), result.getObject(2, UUID.class), result.getString(3)), tenant, requestId)
            .stream().findFirst().orElseThrow(() -> rejected("target position is unavailable"));
    }

    private CurrentAppointment currentAppointment(UUID tenant, UUID employee) {
        return jdbc.query("select id,effective_start_date from org.employee_position where tenant_id=? and employee_id=? and is_primary and status='ACTIVE' and not is_deleted and effective_start_date<=current_date and (effective_end_date is null or effective_end_date>=current_date) order by effective_start_date desc,id limit 1 for update",
            (result, row) -> new CurrentAppointment(result.getObject(1, UUID.class), date(result, "effective_start_date")), tenant, employee)
            .stream().findFirst().orElseThrow(() -> rejected("current primary appointment is missing"));
    }

    private void lock(UUID tenant, UUID id, String domain) {
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?,0))", result -> { result.next(); return null; }, tenant + ":" + id + ":" + domain);
    }
    private String json(JsonNode node) { try { return mapper.writeValueAsString(node); } catch (JsonProcessingException exception) { throw rejected("JSON serialization failed"); } }
    private JsonNode read(String value) { try { return value == null ? null : mapper.readTree(value); } catch (JsonProcessingException exception) { throw rejected("persisted JSON invalid"); } }
    private static void one(int affected, String action) { if (affected != 1) throw rejected(action + " failed"); }
    private static Timestamp timestamp(Instant value) { return value == null ? null : Timestamp.from(value); }
    private static LocalDate date(ResultSet result, String field) throws SQLException { var value = result.getDate(field); return value == null ? null : value.toLocalDate(); }
    private static Instant instant(ResultSet result, String field) throws SQLException { Object value = result.getObject(field); if (value == null) return null; if (value instanceof OffsetDateTime offset) return offset.toInstant(); if (value instanceof Timestamp timestamp) return timestamp.toInstant(); throw new SQLException("unsupported timestamp " + field); }
    private static ProcessRejectedException rejected(String message) { return new ProcessRejectedException("P012 " + message); }
    private record CurrentAppointment(UUID id, LocalDate startDate) {}
}
