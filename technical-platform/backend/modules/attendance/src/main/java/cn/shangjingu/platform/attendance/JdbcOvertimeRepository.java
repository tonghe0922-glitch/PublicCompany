package cn.shangjingu.platform.attendance;

import static cn.shangjingu.platform.attendance.OvertimeService.*;

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
public class JdbcOvertimeRepository implements OvertimeService.Repository {
    private final JdbcTemplate jdbc;private final ObjectMapper mapper;public JdbcOvertimeRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
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
          select 1 from attendance.leave_request r join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted where r.tenant_id=? and r.owner_employee_id=? and r.id<>? and not r.is_deleted and w.current_node_code in ('S02','S03','S04','S05','S06','S07','S08','S09','S10','END') and r.start_at<? and r.end_at>?
          union all select 1 from attendance.shift_change_request r join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted where r.tenant_id=? and r.owner_employee_id=? and r.id<>? and not r.is_deleted and w.current_node_code in ('S05','S06','S07','S08','S09','END') and r.start_at<? and r.end_at>?
          union all select 1 from attendance.overtime_request r join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted where r.tenant_id=? and r.owner_employee_id=? and r.id<>? and not r.is_deleted and w.current_node_code in ('S02','S03','S04','S05','S06','S07','S08','S09','END') and r.start_at<? and r.end_at>?)
        """,Boolean.class,t,e,excluded,ts(end),ts(s),t,e,excluded,ts(end),ts(s),t,e,excluded,ts(end),ts(s));return Boolean.TRUE.equals(v);}
    @Override public void insert(Overtime v,UUID a){int c=jdbc.update("""
        insert into attendance.overtime_request(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,owner_center_id,owner_employee_id,planned_start_at,planned_finish_at,attendance_type,duration_hours,end_at,start_at)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,v.id(),v.tenantId(),v.businessNo(),v.status(),0,a,a,"PORTAL",v.businessDate(),v.subject(),v.reason(),"NORMAL",v.emergency()?"EMERGENCY":"NORMAL",v.ownerCenterId(),v.ownerEmployeeId(),ts(v.startAt()),ts(v.endAt()),v.attendanceType(),v.durationHours(),ts(v.endAt()),ts(v.startAt()));if(c!=1)throw rejected("insert failed");}
    @Override public int bindWorkflow(UUID t,UUID id,int v,UUID wf,UUID a){return jdbc.update("update attendance.overtime_request set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",wf,a,t,id,v);}
    @Override public int move(UUID t,UUID id,int v,String status,String result,Instant closed,UUID a){return jdbc.update("update attendance.overtime_request set status=?,result_summary=coalesce(cast(? as text),result_summary),closed_at=coalesce(?,closed_at),version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",status,result,ts(closed),a,t,id,v);}
    @Override public void appendEvidence(UUID t,UUID id,String field,JsonNode evidence,UUID a){int c=jdbc.update("""
        insert into attendance.overtime_request_item(id,tenant_id,created_by,updated_by,master_id,field_code,item_seq,item_key,item_name,item_value_json,sort_no)
        select gen_random_uuid(),?,?,?,?,?,coalesce(max(item_seq),0)+1,gen_random_uuid()::text,?,cast(? as jsonb),coalesce(max(sort_no),0)+1 from attendance.overtime_request_item where tenant_id=? and master_id=? and field_code=? and not is_deleted
        """,t,a,a,id,field,field,json(evidence),t,id,field);if(c!=1)throw rejected("evidence append failed");}
    @Override public void recordFacts(UUID t,UUID id,Instant start,Instant end,BigDecimal hours,String attendance,UUID a){int c=jdbc.update("update attendance.overtime_request set actual_start_at=?,actual_end_at=?,duration_hours=?,actual_attendance_summary=?,updated_by=? where tenant_id=? and id=? and not is_deleted",ts(start),ts(end),hours,attendance,a,t,id);if(c!=1)throw rejected("actual labor fact update failed");}
    @Override public void recordScheme(UUID t,UUID id,String scheme,UUID a){int c=jdbc.update("update attendance.overtime_request set quota_account_id=?,quota_amount=case when ?='TIME_OFF' then duration_hours else null end,updated_by=? where tenant_id=? and id=? and not is_deleted",scheme,scheme,a,t,id);if(c!=1)throw rejected("compensation scheme projection failed");}
    @Override public void recordReceipt(UUID t,UUID id,String reference,BigDecimal amount,JsonNode evidence,UUID a){appendEvidence(t,id,"external_compensation_receipt",evidence,a);int c=jdbc.update("update attendance.overtime_request set actual_amount=?,handover_agent_id=?,updated_by=? where tenant_id=? and id=? and not is_deleted",amount,reference,a,t,id);if(c!=1)throw rejected("external receipt projection failed");}
    @Override public Optional<Overtime> find(UUID t,UUID id){return jdbc.query(select("where r.tenant_id=? and r.id=? and not r.is_deleted"),(r,n)->map(r),t,id).stream().findFirst();}@Override public List<Overtime> list(UUID t){return jdbc.query(select("where r.tenant_id=? and not r.is_deleted order by r.created_at desc,r.id desc"),(r,n)->map(r),t);}
    private String select(String suffix){return """
        select r.id,r.tenant_id,r.business_no,r.workflow_instance_id,w.instance_no workflow_instance_no,w.current_node_code,r.status,r.version_no,r.business_date,r.subject,r.reason,r.owner_center_id,r.owner_employee_id,r.attendance_type,r.risk_level,r.duration_hours,r.start_at,r.end_at,r.actual_start_at,r.actual_end_at,r.actual_attendance_summary,r.result_summary,r.quota_account_id,r.handover_agent_id,r.actual_amount,r.updated_at
        from attendance.overtime_request r left join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
        """+suffix;}
    private Overtime map(ResultSet r)throws SQLException{UUID t=r.getObject("tenant_id",UUID.class),id=r.getObject("id",UUID.class);return new Overtime(id,t,r.getString("business_no"),r.getObject("workflow_instance_id",UUID.class),r.getString("workflow_instance_no"),r.getString("current_node_code"),r.getString("status"),r.getInt("version_no"),date(r,"business_date"),r.getString("subject"),r.getString("reason"),r.getObject("owner_center_id",UUID.class),r.getObject("owner_employee_id",UUID.class),r.getString("attendance_type"),"EMERGENCY".equals(r.getString("risk_level")),r.getBigDecimal("duration_hours"),instant(r,"start_at"),instant(r,"end_at"),instant(r,"actual_start_at"),instant(r,"actual_end_at"),r.getString("actual_attendance_summary"),r.getString("result_summary"),r.getString("quota_account_id"),r.getString("handover_agent_id"),r.getBigDecimal("actual_amount"),items(t,id),instant(r,"updated_at"));}
    private List<Item> items(UUID t,UUID id){return jdbc.query("select id,field_code,item_seq,item_name,item_value_json,created_at from attendance.overtime_request_item where tenant_id=? and master_id=? and not is_deleted order by field_code,item_seq,id",(r,n)->new Item(r.getObject(1,UUID.class),r.getString(2),r.getInt(3),r.getString(4),read(r.getString(5)),instant(r,"created_at")),t,id);}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw rejected("JSON serialization failed");}}private JsonNode read(String n){try{return n==null?null:mapper.readTree(n);}catch(JsonProcessingException e){throw rejected("persisted JSON invalid");}}private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static LocalDate date(ResultSet r,String f)throws SQLException{var v=r.getDate(f);return v==null?null:v.toLocalDate();}private static Instant instant(ResultSet r,String f)throws SQLException{Object v=r.getObject(f);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp x)return x.toInstant();throw new SQLException("unsupported timestamp "+f);}private static ProcessRejectedException rejected(String m){return new ProcessRejectedException("P009 "+m);}
}
