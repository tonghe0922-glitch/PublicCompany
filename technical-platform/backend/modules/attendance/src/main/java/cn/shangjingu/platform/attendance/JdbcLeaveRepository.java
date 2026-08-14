package cn.shangjingu.platform.attendance;

import static cn.shangjingu.platform.attendance.LeaveService.*;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcLeaveRepository implements LeaveService.Repository {
    private final JdbcTemplate jdbc;private final ObjectMapper mapper;public JdbcLeaveRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    @Override public Optional<UUID> latestPublishedWorkflowVersion(UUID t,String c){return jdbc.query("select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id where v.tenant_id=? and d.process_code=? and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted and (v.effective_at is null or v.effective_at<=now()) order by v.version_no desc limit 1",(r,n)->r.getObject(1,UUID.class),t,c).stream().findFirst();}
    @Override public Optional<FormRef> latestPublishedForm(UUID t,String f,String p,String n){return jdbc.query("select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code=? and process_code=? and node_code=? and enabled and not is_deleted order by version_no desc limit 1",(r,x)->new FormRef(r.getObject(1,UUID.class),r.getInt(2)),t,f,p,n).stream().findFirst();}
    @Override public List<UUID> permissionCandidates(UUID t,String p,UUID o){return jdbc.query("""
        select distinct ui.employee_id from iam.user_role ur join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted
        join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted join iam.permission pm on pm.tenant_id=rp.tenant_id and pm.id=rp.permission_id and not pm.is_deleted
        join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted and (ur.identity_id is null or ur.identity_id=ui.id)
        join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id and e.employment_status='ACTIVE' and not e.is_deleted
        where ur.tenant_id=? and pm.permission_code=? and ui.org_id=? and not ur.is_deleted and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now()) order by ui.employee_id
        """,(r,n)->r.getObject(1,UUID.class),t,p,o);}
    @Override public boolean hasEffectiveOverlap(UUID t,UUID e,Instant s,Instant end,UUID excluded){Boolean v=jdbc.queryForObject("""
        select exists(
          select 1 from attendance.leave_request r join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
           where r.tenant_id=? and r.owner_employee_id=? and r.id<>? and not r.is_deleted and w.current_node_code in ('S02','S03','S04','S05','S06','S07','S08','S09','S10','END') and r.start_at<? and r.end_at>?
          union all select 1 from attendance.shift_change_request r join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
           where r.tenant_id=? and r.owner_employee_id=? and r.id<>? and not r.is_deleted and w.current_node_code in ('S05','S06','S07','S08','S09','END') and r.start_at<? and r.end_at>?)
        """,Boolean.class,t,e,excluded,ts(end),ts(s),t,e,excluded,ts(end),ts(s));return Boolean.TRUE.equals(v);}
    @Override public void insert(Leave v,UUID a){int c=jdbc.update("""
        insert into attendance.leave_request(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,owner_center_id,owner_employee_id,planned_start_at,planned_finish_at,attendance_type,change_action,change_reason,duration_hours,end_at,handover_agent_id,quota_account_id,quota_amount,start_at)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,v.id(),v.tenantId(),v.businessNo(),v.status(),0,a,a,"PORTAL",v.businessDate(),v.subject(),v.reason(),"NORMAL",v.ownerCenterId(),v.ownerEmployeeId(),ts(v.startAt()),ts(v.endAt()),v.attendanceType(),v.changeAction(),v.changeReason(),v.durationHours(),ts(v.endAt()),v.handoverAgentId()==null?null:v.handoverAgentId().toString(),v.quotaAccountId(),v.quotaAmount(),ts(v.startAt()));if(c!=1)throw rejected("insert failed");}
    @Override public int bindWorkflow(UUID t,UUID id,int v,UUID wf,UUID a){return jdbc.update("update attendance.leave_request set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",wf,a,t,id,v);}
    @Override public int move(UUID t,UUID id,int v,String status,String result,String attendance,Instant closed,UUID a){return jdbc.update("update attendance.leave_request set status=?,result_summary=coalesce(cast(? as text),result_summary),actual_attendance_summary=coalesce(cast(? as text),actual_attendance_summary),closed_at=coalesce(?,closed_at),version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",status,result,attendance,ts(closed),a,t,id,v);}
    @Override public void appendEvidence(UUID t,UUID id,String field,JsonNode evidence,UUID a){int c=jdbc.update("""
        insert into attendance.leave_request_item(id,tenant_id,created_by,updated_by,master_id,field_code,item_seq,item_key,item_name,item_value_json,sort_no)
        select gen_random_uuid(),?,?,?,?,?,coalesce(max(item_seq),0)+1,gen_random_uuid()::text,?,cast(? as jsonb),coalesce(max(sort_no),0)+1 from attendance.leave_request_item where tenant_id=? and master_id=? and field_code=? and not is_deleted
        """,t,a,a,id,field,field,json(evidence),t,id,field);if(c!=1)throw rejected("evidence append failed");}
    @Override public Optional<String> latestDecision(UUID t,UUID id){return jdbc.query("select item_value_json->>'decision' from attendance.leave_request_item where tenant_id=? and master_id=? and field_code='approval_decision' and not is_deleted order by item_seq desc,id desc limit 1",(r,n)->r.getString(1),t,id).stream().findFirst();}
    @Override public void appendQuota(Leave v,String type,BigDecimal da,BigDecimal dr,BigDecimal dc,String key,String reason,UUID actor){jdbc.query("select pg_advisory_xact_lock(hashtextextended(?,0))",r->{r.next();return null;},v.tenantId()+"|"+v.ownerEmployeeId()+"|"+v.quotaAccountId());
        BigDecimal[] b=jdbc.query("select coalesce(sum(available_delta),0),coalesce(sum(reserved_delta),0),coalesce(sum(consumed_delta),0) from attendance.leave_quota_ledger where tenant_id=? and employee_id=? and quota_account_id=?",r->{r.next();return new BigDecimal[]{r.getBigDecimal(1),r.getBigDecimal(2),r.getBigDecimal(3)};},v.tenantId(),v.ownerEmployeeId(),v.quotaAccountId());BigDecimal available=b[0].add(da),reserved=b[1].add(dr),consumed=b[2].add(dc);if(available.signum()<0||reserved.signum()<0||consumed.signum()<0)throw rejected("quota ledger balance would become negative");if(da.add(dr).add(dc).compareTo(BigDecimal.ZERO)!=0)throw rejected("quota entry violates conservation");
        int c=jdbc.update("insert into attendance.leave_quota_ledger(id,tenant_id,employee_id,quota_account_id,leave_request_id,entry_type,available_delta,reserved_delta,consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,reason,created_by) values(gen_random_uuid(),?,?,?,?,?,?,?,?,?,?,?,?,?,?)",v.tenantId(),v.ownerEmployeeId(),v.quotaAccountId(),v.id(),type,da,dr,dc,available,reserved,consumed,key,reason,actor);if(c!=1)throw rejected("quota append failed");}
    @Override public void recordActualEnd(UUID t,UUID id,Instant end,String action,UUID a){int c=jdbc.update("update attendance.leave_request set actual_end_at=?,change_action=?,change_reason=?,updated_by=? where tenant_id=? and id=? and not is_deleted",ts(end),action,"P008 "+action,a,t,id);if(c!=1)throw rejected("actual leave update failed");}
    @Override public void setActualHours(UUID t,UUID id,BigDecimal h,UUID a){int c=jdbc.update("update attendance.leave_request set actual_amount=?,updated_by=? where tenant_id=? and id=? and not is_deleted",h,a,t,id);if(c!=1)throw rejected("actual hours update failed");}
    @Override public Optional<Leave> find(UUID t,UUID id){return jdbc.query(select("where r.tenant_id=? and r.id=? and not r.is_deleted"),(r,n)->map(r),t,id).stream().findFirst();}@Override public List<Leave> list(UUID t){return jdbc.query(select("where r.tenant_id=? and not r.is_deleted order by r.created_at desc,r.id desc"),(r,n)->map(r),t);}
    @Override public List<QuotaEntry> quotaLedger(UUID t){return jdbc.query("select q.id,q.employee_id,e.primary_org_id,q.quota_account_id,q.leave_request_id,q.entry_type,q.available_delta,q.reserved_delta,q.consumed_delta,q.available_after,q.reserved_after,q.consumed_after,q.reason,q.created_at from attendance.leave_quota_ledger q join org.employee e on e.tenant_id=q.tenant_id and e.id=q.employee_id where q.tenant_id=? order by q.created_at,q.id",(r,n)->new QuotaEntry(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getString(4),r.getObject(5,UUID.class),r.getString(6),r.getBigDecimal(7),r.getBigDecimal(8),r.getBigDecimal(9),r.getBigDecimal(10),r.getBigDecimal(11),r.getBigDecimal(12),r.getString(13),instant(r,"created_at")),t);}
    private String select(String suffix){return """
        select r.id,r.tenant_id,r.business_no,r.workflow_instance_id,w.instance_no workflow_instance_no,w.current_node_code,r.status,r.version_no,r.business_date,r.subject,r.reason,r.owner_center_id,r.owner_employee_id,r.attendance_type,r.change_action,r.change_reason,r.duration_hours,r.start_at,r.end_at,r.handover_agent_id,r.quota_account_id,r.quota_amount,r.actual_end_at,r.actual_attendance_summary,r.updated_at
        from attendance.leave_request r left join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
        """+suffix;}
    private Leave map(ResultSet r)throws SQLException{UUID t=r.getObject("tenant_id",UUID.class),id=r.getObject("id",UUID.class);String h=r.getString("handover_agent_id");return new Leave(id,t,r.getString("business_no"),r.getObject("workflow_instance_id",UUID.class),r.getString("workflow_instance_no"),r.getString("current_node_code"),r.getString("status"),r.getInt("version_no"),date(r,"business_date"),r.getString("subject"),r.getString("reason"),r.getObject("owner_center_id",UUID.class),r.getObject("owner_employee_id",UUID.class),r.getString("attendance_type"),r.getString("change_action"),r.getString("change_reason"),r.getBigDecimal("duration_hours"),instant(r,"start_at"),instant(r,"end_at"),h==null?null:UUID.fromString(h),r.getString("quota_account_id"),r.getBigDecimal("quota_amount"),instant(r,"actual_end_at"),r.getString("actual_attendance_summary"),items(t,id),instant(r,"updated_at"));}
    private List<Item> items(UUID t,UUID id){return jdbc.query("select id,field_code,item_seq,item_name,item_value_json,created_at from attendance.leave_request_item where tenant_id=? and master_id=? and not is_deleted order by field_code,item_seq,id",(r,n)->new Item(r.getObject(1,UUID.class),r.getString(2),r.getInt(3),r.getString(4),read(r.getString(5)),instant(r,"created_at")),t,id);}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw rejected("JSON serialization failed");}}private JsonNode read(String n){try{return n==null?null:mapper.readTree(n);}catch(JsonProcessingException e){throw rejected("persisted JSON invalid");}}private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static LocalDate date(ResultSet r,String f)throws SQLException{var v=r.getDate(f);return v==null?null:v.toLocalDate();}private static Instant instant(ResultSet r,String f)throws SQLException{Object v=r.getObject(f);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp x)return x.toInstant();throw new SQLException("unsupported timestamp "+f);}private static ProcessRejectedException rejected(String m){return new ProcessRejectedException("P008 "+m);}
}
