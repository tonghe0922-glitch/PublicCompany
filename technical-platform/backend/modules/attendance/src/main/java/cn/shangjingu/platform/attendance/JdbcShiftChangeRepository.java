package cn.shangjingu.platform.attendance;

import cn.shangjingu.platform.attendance.ShiftChangeService.ActionCommand;
import cn.shangjingu.platform.attendance.ShiftChangeService.FormRef;
import cn.shangjingu.platform.attendance.ShiftChangeService.Item;
import cn.shangjingu.platform.attendance.ShiftChangeService.Proposal;
import cn.shangjingu.platform.attendance.ShiftChangeService.ShiftChange;
import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcShiftChangeRepository implements ShiftChangeService.Repository {
    private final JdbcTemplate jdbc;private final ObjectMapper mapper;public JdbcShiftChangeRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    @Override public Optional<UUID> latestPublishedWorkflowVersion(UUID tenant,String code){return jdbc.query("""
            select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id
            where v.tenant_id=? and d.process_code=? and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted
              and (v.effective_at is null or v.effective_at<=now()) order by v.version_no desc,v.created_at desc limit 1
            """,(r,n)->r.getObject(1,UUID.class),tenant,code).stream().findFirst();}
    @Override public Optional<FormRef> latestPublishedForm(UUID tenant,String form,String process,String node){return jdbc.query("""
            select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code=? and process_code=? and node_code=?
            and enabled and not is_deleted order by version_no desc,created_at desc limit 1
            """,(r,n)->new FormRef(r.getObject(1,UUID.class),r.getInt(2)),tenant,form,process,node).stream().findFirst();}
    @Override public List<UUID> permissionCandidates(UUID tenant,String permission,UUID org){return jdbc.query("""
            select distinct ui.employee_id from iam.user_role ur join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted
            join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted
            join iam.permission p on p.tenant_id=rp.tenant_id and p.id=rp.permission_id and not p.is_deleted
            join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted and (ur.identity_id is null or ur.identity_id=ui.id)
            join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id and e.employment_status='ACTIVE' and not e.is_deleted
            where ur.tenant_id=? and p.permission_code=? and ui.org_id=? and not ur.is_deleted and ur.effective_start_at<=now()
              and (ur.effective_end_at is null or ur.effective_end_at>now()) and ui.effective_start_at<=now() and (ui.effective_end_at is null or ui.effective_end_at>now()) order by ui.employee_id
            """,(r,n)->r.getObject(1,UUID.class),tenant,permission,org);}
    @Override public Optional<UUID> activeEmployeeCenter(UUID tenant,UUID employee){return jdbc.query("select primary_org_id from org.employee where tenant_id=? and id=? and employment_status='ACTIVE' and not is_deleted",(r,n)->r.getObject(1,UUID.class),tenant,employee).stream().findFirst();}
    @Override public boolean hasQualification(UUID tenant,UUID employee,String version,Instant at){Boolean value=jdbc.queryForObject("""
            select exists(select 1 from learning.learning_assignment where tenant_id=? and owner_employee_id=? and content_version=?
              and practical_result in ('通过','合格','PASS') and qualification_effective_date<=cast(? as date)
              and (qualification_expire_date is null or qualification_expire_date>=cast(? as date)) and not is_deleted)
            """,Boolean.class,tenant,employee,version,ts(at),ts(at));return Boolean.TRUE.equals(value);}
    @Override public boolean hasEffectiveOverlap(UUID tenant,UUID employee,Instant start,Instant end,UUID excluded){Boolean value=jdbc.queryForObject("""
            select exists(select 1 from attendance.shift_change_request r join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
             where r.tenant_id=? and r.owner_employee_id=? and r.id<>? and not r.is_deleted and w.current_node_code in ('S05','S06','S07','S08','S09','END')
               and r.start_at < ? and r.end_at > ?)
            """,Boolean.class,tenant,employee,excluded,ts(end),ts(start));return Boolean.TRUE.equals(value);}
    @Override public void insert(ShiftChange v,UUID actor){int count=jdbc.update("""
            insert into attendance.shift_change_request(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,
            subject,reason,priority,owner_center_id,owner_employee_id,planned_start_at,planned_finish_at,attendance_type,change_action,change_reason,
            content_version,duration_hours,end_at,period_or_course_no,start_at)
            values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,v.id(),v.tenantId(),v.businessNo(),v.status(),0,actor,actor,"PORTAL",v.businessDate(),v.subject(),v.reason(),"NORMAL",v.ownerCenterId(),v.ownerEmployeeId(),ts(v.startAt()),ts(v.endAt()),v.attendanceType(),v.changeAction(),v.changeReason(),v.contentVersion(),v.durationHours(),ts(v.endAt()),v.periodOrCourseNo(),ts(v.startAt()));if(count!=1)throw rejected("insert failed");}
    @Override public int bindWorkflow(UUID tenant,UUID id,int version,UUID workflow,UUID actor){return jdbc.update("update attendance.shift_change_request set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",workflow,actor,tenant,id,version);}
    @Override public int move(UUID tenant,UUID id,int version,String status,String result,String attendance,Instant closed,UUID actor){return jdbc.update("""
            update attendance.shift_change_request set status=?,result_summary=coalesce(cast(? as text),result_summary),actual_attendance_summary=coalesce(cast(? as text),actual_attendance_summary),
            closed_at=coalesce(?,closed_at),actual_end_at=coalesce(?,actual_end_at),version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted
            """,status,result,attendance,ts(closed),ts(closed),actor,tenant,id,version);}
    @Override public void appendEvidence(UUID tenant,UUID id,String field,JsonNode evidence,UUID actor){int count=jdbc.update("""
            insert into attendance.shift_change_request_item(id,tenant_id,created_by,updated_by,master_id,field_code,item_seq,item_key,item_name,item_value_json,sort_no)
            select gen_random_uuid(),?,?,?,?,?,coalesce(max(item_seq),0)+1,gen_random_uuid()::text,?,cast(? as jsonb),coalesce(max(sort_no),0)+1
            from attendance.shift_change_request_item where tenant_id=? and master_id=? and field_code=? and not is_deleted
            """,tenant,actor,actor,id,field,field,json(evidence),tenant,id,field);if(count!=1)throw rejected("evidence append failed");}
    @Override public void appendChangeProposal(UUID tenant,UUID id,ShiftChange current,ActionCommand command,UUID actor){ObjectNode before=mapper.createObjectNode().put("ownerEmployeeId",current.ownerEmployeeId().toString()).put("startAt",current.startAt().toString()).put("endAt",current.endAt().toString());ObjectNode after=mapper.createObjectNode().put("startAt",command.proposedStartAt().toString()).put("endAt",command.proposedEndAt().toString());if(command.substituteEmployeeId()!=null)after.put("substituteEmployeeId",command.substituteEmployeeId().toString());appendEvidence(tenant,id,"before_snapshot",before,actor);appendEvidence(tenant,id,"after_snapshot",after,actor);appendEvidence(tenant,id,"handover_items",command.handoverItems(),actor);}
    @Override public Optional<Proposal> latestProposal(UUID tenant,UUID id){return jdbc.query("""
            select item_value_json from attendance.shift_change_request_item where tenant_id=? and master_id=? and field_code='after_snapshot' and not is_deleted order by item_seq desc,id desc limit 1
            """,(r,n)->{JsonNode v=read(r.getString(1));return new Proposal(Instant.parse(v.path("startAt").asText()),Instant.parse(v.path("endAt").asText()),v.hasNonNull("substituteEmployeeId")?UUID.fromString(v.path("substituteEmployeeId").asText()):null,latestHandover(tenant,id));},tenant,id).stream().findFirst();}
    private JsonNode latestHandover(UUID tenant,UUID id){return jdbc.query("select item_value_json from attendance.shift_change_request_item where tenant_id=? and master_id=? and field_code='handover_items' and not is_deleted order by item_seq desc,id desc limit 1",(r,n)->read(r.getString(1)),tenant,id).stream().findFirst().orElse(mapper.createArrayNode());}
    @Override public void applyProposal(UUID tenant,UUID id,Proposal p,UUID actor){BigDecimal duration=BigDecimal.valueOf(Duration.between(p.startAt(),p.endAt()).toMinutes()).divide(BigDecimal.valueOf(60),6,RoundingMode.HALF_UP);int count=jdbc.update("""
            update attendance.shift_change_request set owner_employee_id=coalesce(?,owner_employee_id),start_at=?,end_at=?,planned_start_at=?,planned_finish_at=?,duration_hours=?,updated_by=? where tenant_id=? and id=? and not is_deleted
            """,p.substituteEmployeeId(),ts(p.startAt()),ts(p.endAt()),ts(p.startAt()),ts(p.endAt()),duration,actor,tenant,id);if(count!=1)throw rejected("approved proposal update failed");}
    @Override public Optional<ShiftChange> find(UUID tenant,UUID id){return jdbc.query(select("where r.tenant_id=? and r.id=? and not r.is_deleted"),(rs,n)->map(rs),tenant,id).stream().findFirst();}
    @Override public List<ShiftChange> list(UUID tenant){return jdbc.query(select("where r.tenant_id=? and not r.is_deleted order by r.created_at desc,r.id desc"),(rs,n)->map(rs),tenant);}
    private String select(String suffix){return """
            select r.id,r.tenant_id,r.business_no,r.workflow_instance_id,w.instance_no workflow_instance_no,w.current_node_code,r.status,r.version_no,r.business_date,
            r.subject,r.reason,r.owner_center_id,r.owner_employee_id,r.attendance_type,r.change_action,r.change_reason,r.content_version,r.duration_hours,r.start_at,r.end_at,
            r.period_or_course_no,r.actual_attendance_summary,r.result_summary,r.updated_at from attendance.shift_change_request r
            left join workflow.wf_instance w on w.tenant_id=r.tenant_id and w.id=r.workflow_instance_id and not w.is_deleted
            """+suffix;}
    private ShiftChange map(ResultSet r)throws SQLException{UUID tenant=r.getObject("tenant_id",UUID.class),id=r.getObject("id",UUID.class);return new ShiftChange(id,tenant,r.getString("business_no"),r.getObject("workflow_instance_id",UUID.class),r.getString("workflow_instance_no"),r.getString("current_node_code"),r.getString("status"),r.getInt("version_no"),date(r,"business_date"),r.getString("subject"),r.getString("reason"),r.getObject("owner_center_id",UUID.class),r.getObject("owner_employee_id",UUID.class),r.getString("attendance_type"),r.getString("change_action"),r.getString("change_reason"),r.getString("content_version"),r.getBigDecimal("duration_hours"),instant(r,"start_at"),instant(r,"end_at"),r.getString("period_or_course_no"),r.getString("actual_attendance_summary"),r.getString("result_summary"),items(tenant,id),instant(r,"updated_at"));}
    private List<Item> items(UUID tenant,UUID id){return jdbc.query("select id,field_code,item_seq,item_name,item_value_json,created_at from attendance.shift_change_request_item where tenant_id=? and master_id=? and not is_deleted order by field_code,item_seq,id",(r,n)->new Item(r.getObject("id",UUID.class),r.getString("field_code"),r.getInt("item_seq"),r.getString("item_name"),read(r.getString("item_value_json")),instant(r,"created_at")),tenant,id);}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw rejected("JSON serialization failed");}}private JsonNode read(String n){try{return n==null?null:mapper.readTree(n);}catch(JsonProcessingException e){throw rejected("persisted JSON is invalid");}}
    private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static LocalDate date(ResultSet r,String f)throws SQLException{var v=r.getDate(f);return v==null?null:v.toLocalDate();}private static Instant instant(ResultSet r,String f)throws SQLException{Object v=r.getObject(f);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp t)return t.toInstant();throw new SQLException("unsupported timestamp "+f);}private static ProcessRejectedException rejected(String m){return new ProcessRejectedException("P007 "+m);}
}
