package cn.shangjingu.platform.workflow;

import cn.shangjingu.platform.workflow.ShiftChangeService.FormRef;
import cn.shangjingu.platform.workflow.ShiftChangeService.ShiftRecord;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcShiftChangeRepository implements ShiftChangeService.Repository {
    private final JdbcTemplate jdbc;
    public JdbcShiftChangeRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @Override public Optional<UUID> workflowVersion(UUID tenantId){return jdbc.query("""
        select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id
        where v.tenant_id=? and d.process_code='P007' and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted
        order by v.version_no desc limit 1""",(rs,n)->rs.getObject(1,UUID.class),tenantId).stream().findFirst();}
    @Override public Optional<FormRef> form(UUID tenantId){return jdbc.query("select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code='CTR-P007-F01' and process_code='P007' and node_code='S01' and enabled and not is_deleted order by version_no desc limit 1",(rs,n)->new FormRef(rs.getObject(1,UUID.class),rs.getInt(2)),tenantId).stream().findFirst();}
    @Override public List<UUID> permissionCandidates(UUID tenantId,String permission,UUID orgId){return jdbc.query("""
        select distinct ui.employee_id from iam.user_role ur join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted
        join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted
        join iam.permission p on p.tenant_id=rp.tenant_id and p.id=rp.permission_id and not p.is_deleted
        join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted and (ur.identity_id is null or ur.identity_id=ui.id)
        where ur.tenant_id=? and p.permission_code=? and ui.org_id=? and not ur.is_deleted and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now())""",(rs,n)->rs.getObject(1,UUID.class),tenantId,permission,orgId);}
    @Override public boolean isActiveEmployeeInOrg(UUID tenantId,UUID orgId,UUID employeeId){Boolean ok=jdbc.queryForObject("""
        select exists(select 1 from iam.user_identity ui join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id
         where ui.tenant_id=? and ui.org_id=? and ui.employee_id=? and not ui.is_deleted and e.employment_status='ACTIVE' and not e.is_deleted
           and ui.effective_start_at<=now() and (ui.effective_end_at is null or ui.effective_end_at>now()))""",Boolean.class,tenantId,orgId,employeeId);return Boolean.TRUE.equals(ok);}
    @Override public boolean hasOverlappingShift(UUID tenantId,UUID employeeId,Instant start,Instant end,UUID excludeId){Boolean hit=jdbc.queryForObject("""
        select exists(select 1 from attendance.shift_change_request r where r.tenant_id=? and r.id<>? and not r.is_deleted
          and (r.target_employee_id=? or r.replacement_employee_id=?) and r.status not in ('已关闭','已驳回') and tstzrange(r.start_at,r.end_at,'[)') && tstzrange(?,?,'[)'))""",Boolean.class,tenantId,excludeId,employeeId,employeeId,ts(start),ts(end));return Boolean.TRUE.equals(hit);}
    @Override public void insert(ShiftRecord r,UUID actor){jdbc.update("""
        insert into attendance.shift_change_request(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,
          owner_center_id,owner_employee_id,attendance_type,change_action,change_reason,content_version,duration_hours,end_at,period_or_course_no,start_at,
          template_code,target_employee_id,replacement_employee_id)
        values(?,?,?, ?,0,?,?,'PC',current_date,?,?, 'NORMAL',?,?, '排班',?,?,?,?,?,?, ?,?,?,?)""",
        r.id(),r.tenantId(),r.businessNo(),r.status(),actor,actor,r.subject(),r.reason(),r.ownerCenterId(),r.ownerEmployeeId(),r.changeAction(),r.changeReason(),
        r.templateCode()==null?"CURRENT":r.templateCode(),r.durationHours(),ts(r.endAt()),r.periodOrCourseNo(),ts(r.startAt()),r.templateCode(),r.targetEmployeeId(),r.replacementEmployeeId());}
    @Override public int bindAndMove(UUID t,UUID id,int v,UUID wf,String s,UUID a){return jdbc.update("update attendance.shift_change_request set workflow_instance_id=?,status=?,version_no=version_no+1,updated_by=?,updated_at=now() where tenant_id=? and id=? and version_no=? and not is_deleted",wf,s,a,t,id,v);}
    @Override public int moveStatus(UUID t,UUID id,int v,String s,Instant closed,UUID a){return jdbc.update("update attendance.shift_change_request set status=?,closed_at=coalesce(?,closed_at),actual_end_at=coalesce(?,actual_end_at),version_no=version_no+1,updated_by=?,updated_at=now() where tenant_id=? and id=? and version_no=? and not is_deleted",s,ts(closed),ts(closed),a,t,id,v);}
    @Override public int markValidated(UUID t,UUID id,BigDecimal hours,UUID a){return jdbc.update("update attendance.shift_change_request set qualification_checked_at=now(),continuous_work_hours=?,conflict_checked_at=now(),updated_by=?,updated_at=now() where tenant_id=? and id=? and not is_deleted",hours,a,t,id);}
    @Override public int markPublished(UUID t,UUID id,UUID a){return jdbc.update("update attendance.shift_change_request set published_at=coalesce(published_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and not is_deleted",a,t,id);}
    @Override public int markConfirmed(UUID t,UUID id,UUID a){return jdbc.update("update attendance.shift_change_request set employee_confirmed_at=coalesce(employee_confirmed_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and target_employee_id=? and not is_deleted",a,t,id,a);}
    @Override public int setReplacement(UUID t,UUID id,UUID r,UUID a){return jdbc.update("update attendance.shift_change_request set replacement_employee_id=?,updated_by=?,updated_at=now() where tenant_id=? and id=? and target_employee_id=? and not is_deleted",r,a,t,id,a);}
    @Override public int markApproved(UUID t,UUID id,UUID a){return jdbc.update("update attendance.shift_change_request set approved_at=coalesce(approved_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and not is_deleted",a,t,id);}
    @Override public int markDependencies(UUID t,UUID id,UUID a){return jdbc.update("update attendance.shift_change_request set attendance_linked_at=coalesce(attendance_linked_at,now()),catering_linked_at=coalesce(catering_linked_at,now()),shuttle_linked_at=coalesce(shuttle_linked_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and approved_at is not null and not is_deleted",a,t,id);}
    @Override public int markDayClosed(UUID t,UUID id,UUID a){return jdbc.update("update attendance.shift_change_request set day_closed_at=coalesce(day_closed_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and attendance_linked_at is not null and catering_linked_at is not null and shuttle_linked_at is not null and not is_deleted",a,t,id);}
    @Override public Optional<ShiftRecord> find(UUID t,UUID id){return jdbc.query(select("where r.tenant_id=? and r.id=? and not r.is_deleted"),(rs,n)->map(rs),t,id).stream().findFirst();}
    @Override public List<ShiftRecord> list(UUID t){return jdbc.query(select("where r.tenant_id=? and not r.is_deleted order by r.created_at desc,r.id desc"),(rs,n)->map(rs),t);}
    private String select(String suffix){return """
        select r.id,r.tenant_id,r.business_no,r.workflow_instance_id,r.status,r.version_no,r.subject,r.reason,r.owner_center_id,r.owner_employee_id,
          r.target_employee_id,r.replacement_employee_id,r.change_action,r.change_reason,r.template_code,r.period_or_course_no,r.start_at,r.end_at,r.duration_hours,
          r.qualification_checked_at,r.continuous_work_hours,r.conflict_checked_at,r.published_at,r.employee_confirmed_at,r.approved_at,r.attendance_linked_at,
          r.catering_linked_at,r.shuttle_linked_at,r.day_closed_at,r.updated_at,wi.instance_no workflow_instance_no,wi.current_node_code
          from attendance.shift_change_request r left join workflow.wf_instance wi on wi.tenant_id=r.tenant_id and wi.id=r.workflow_instance_id and not wi.is_deleted
        """+suffix;}
    private ShiftRecord map(ResultSet rs)throws SQLException{return new ShiftRecord(rs.getObject("id",UUID.class),rs.getObject("tenant_id",UUID.class),rs.getString("business_no"),rs.getObject("workflow_instance_id",UUID.class),rs.getString("workflow_instance_no"),rs.getString("current_node_code"),rs.getString("status"),rs.getInt("version_no"),rs.getString("subject"),rs.getString("reason"),rs.getObject("owner_center_id",UUID.class),rs.getObject("owner_employee_id",UUID.class),rs.getObject("target_employee_id",UUID.class),rs.getObject("replacement_employee_id",UUID.class),rs.getString("change_action"),rs.getString("change_reason"),rs.getString("template_code"),rs.getString("period_or_course_no"),instant(rs,"start_at"),instant(rs,"end_at"),rs.getBigDecimal("duration_hours"),instant(rs,"qualification_checked_at"),rs.getBigDecimal("continuous_work_hours"),instant(rs,"conflict_checked_at"),instant(rs,"published_at"),instant(rs,"employee_confirmed_at"),instant(rs,"approved_at"),instant(rs,"attendance_linked_at"),instant(rs,"catering_linked_at"),instant(rs,"shuttle_linked_at"),instant(rs,"day_closed_at"),instant(rs,"updated_at"));}
    private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static Instant instant(ResultSet rs,String c)throws SQLException{Object v=rs.getObject(c);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp t)return t.toInstant();return ((java.time.ZonedDateTime)v).toInstant();}
}
