package cn.shangjingu.platform.collaboration;

import cn.shangjingu.platform.collaboration.MeetingService.ActionItemCommand;
import cn.shangjingu.platform.collaboration.MeetingService.FormRef;
import cn.shangjingu.platform.collaboration.MeetingService.Meeting;
import cn.shangjingu.platform.collaboration.MeetingService.MeetingItem;
import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
public class JdbcMeetingRepository implements MeetingService.Repository {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public JdbcMeetingRepository(JdbcTemplate jdbc, ObjectMapper mapper) { this.jdbc = jdbc; this.mapper = mapper; }

    @Override public Optional<UUID> latestPublishedWorkflowVersion(UUID tenantId, String processCode) {
        return jdbc.query("""
                select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id
                 where v.tenant_id=? and d.process_code=? and d.enabled and not d.is_deleted and v.status='PUBLISHED'
                   and not v.is_deleted and (v.effective_at is null or v.effective_at<=now())
                 order by v.version_no desc,v.created_at desc limit 1
                """, (rs,n)->rs.getObject(1,UUID.class), tenantId, processCode).stream().findFirst();
    }
    @Override public Optional<FormRef> latestPublishedForm(UUID tenantId, String formCode, String processCode, String nodeCode) {
        return jdbc.query("""
                select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code=? and process_code=?
                 and node_code=? and enabled and not is_deleted order by version_no desc,created_at desc limit 1
                """, (rs,n)->new FormRef(rs.getObject(1,UUID.class),rs.getInt(2)), tenantId,formCode,processCode,nodeCode).stream().findFirst();
    }
    @Override public List<UUID> permissionCandidates(UUID tenantId, String permissionCode, UUID orgId, UUID excluded) {
        return jdbc.query("""
                select distinct ui.employee_id from iam.user_role ur
                join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted
                join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted
                join iam.permission p on p.tenant_id=rp.tenant_id and p.id=rp.permission_id and not p.is_deleted
                join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted
                  and (ur.identity_id is null or ur.identity_id=ui.id)
                join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id and e.employment_status='ACTIVE' and not e.is_deleted
                where ur.tenant_id=? and p.permission_code=? and ui.org_id=? and not ur.is_deleted
                  and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now())
                  and ui.effective_start_at<=now() and (ui.effective_end_at is null or ui.effective_end_at>now())
                  and (cast(? as uuid) is null or ui.employee_id<>cast(? as uuid)) order by ui.employee_id
                """, (rs,n)->rs.getObject(1,UUID.class), tenantId,permissionCode,orgId,excluded,excluded);
    }
    @Override public void insert(Meeting m, UUID actor) {
        int count=jdbc.update("""
                insert into collaboration.meeting(id,tenant_id,business_no,status,version_no,created_by,updated_by,
                source_channel,business_date,subject,reason,priority,owner_center_id,owner_employee_id,planned_start_at,
                official_subject,official_content,official_type,start_at,venue_channel,visibility_level,attendance_type,employee_event_type)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,m.id(),m.tenantId(),m.businessNo(),m.status(),0,actor,actor,"PORTAL",m.businessDate(),m.subject(),m.reason(),
                m.priority(),m.ownerCenterId(),m.ownerEmployeeId(),ts(m.plannedStartAt()),m.officialSubject(),m.officialContent(),
                "MEETING",ts(m.startAt()),m.venueChannel(),m.visibilityLevel(),"MEETING","MEETING");
        if(count!=1) throw new ProcessRejectedException("P006 meeting insert failed");
    }
    @Override public int bindWorkflow(UUID tenantId, UUID id, int version, UUID workflowId, UUID actor) {
        return jdbc.update("update collaboration.meeting set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",
                workflowId,actor,tenantId,id,version);
    }
    @Override public int move(UUID tenantId, UUID id, int version, String status, String summary, Instant closedAt, UUID actor) {
        return jdbc.update("""
                update collaboration.meeting set status=?,result_summary=coalesce(cast(? as text),result_summary),
                closed_at=coalesce(?,closed_at),actual_end_at=coalesce(?,actual_end_at),version_no=version_no+1,updated_by=?
                where tenant_id=? and id=? and version_no=? and not is_deleted
                """,status,summary,ts(closedAt),ts(closedAt),actor,tenantId,id,version);
    }
    @Override public void insertActionItems(UUID tenantId, UUID id, List<ActionItemCommand> items, UUID actor) {
        Integer existing=jdbc.queryForObject("select count(*) from collaboration.meeting_item where tenant_id=? and master_id=? and field_code='action_items' and not is_deleted",Integer.class,tenantId,id);
        if(existing!=null&&existing>0) throw new ProcessRejectedException("P006 action items are append-only and already generated");
        int seq=0;
        for(ActionItemCommand item:items){
            ObjectNode value=mapper.createObjectNode(); value.put("ownerEmployeeId",item.ownerEmployeeId().toString());
            value.put("plannedStartAt",item.plannedStartAt().toString()); value.put("plannedFinishAt",item.plannedFinishAt().toString());
            if(item.acceptanceCriteria()!=null)value.put("acceptanceCriteria",item.acceptanceCriteria().trim());
            int inserted=jdbc.update("""
                    insert into collaboration.meeting_item(id,tenant_id,created_by,updated_by,master_id,field_code,item_seq,
                    item_key,item_name,item_value_json,related_object_type,related_object_id,sort_no)
                    values (gen_random_uuid(),?,?,?,?,?,?,?,?,cast(? as jsonb),'EMPLOYEE',?,?)
                    """,tenantId,actor,actor,id,"action_items",++seq,item.itemKey().trim(),item.itemName().trim(),json(value),item.ownerEmployeeId(),seq);
            if(inserted!=1) throw new ProcessRejectedException("P006 action item insert failed");
        }
    }
    @Override public void appendEvidence(UUID tenantId, UUID id, String fieldCode, JsonNode evidence, UUID actor) {
        int inserted=jdbc.update("""
                insert into collaboration.meeting_item(id,tenant_id,created_by,updated_by,master_id,field_code,item_seq,item_key,item_name,item_value_json,sort_no)
                select gen_random_uuid(),?,?,?,?,?,coalesce(max(item_seq),0)+1,gen_random_uuid()::text,?,cast(? as jsonb),coalesce(max(sort_no),0)+1
                  from collaboration.meeting_item where tenant_id=? and master_id=? and field_code=? and not is_deleted
                """,tenantId,actor,actor,id,fieldCode,fieldCode,json(evidence),tenantId,id,fieldCode);
        if(inserted!=1) throw new ProcessRejectedException("P006 evidence append failed");
    }
    @Override public List<UUID> actionItemOwners(UUID tenantId,UUID id){
        return jdbc.query("""
                select distinct related_object_id from collaboration.meeting_item
                 where tenant_id=? and master_id=? and field_code='action_items' and related_object_type='EMPLOYEE'
                   and related_object_id is not null and not is_deleted order by related_object_id
                """,(rs,n)->rs.getObject(1,UUID.class),tenantId,id);
    }
    @Override public Optional<UUID> lastActorAtNodeAction(UUID tenantId,UUID workflowId,String node,String action){
        return jdbc.query("select operator_id from workflow.wf_action_log where tenant_id=? and instance_id=? and from_status=? and action_code=? and not is_deleted order by occurred_at desc,id desc limit 1",
                (rs,n)->rs.getObject(1,UUID.class),tenantId,workflowId,node,action).stream().findFirst();
    }
    @Override public Optional<Meeting> find(UUID tenantId,UUID id){ return jdbc.query(select("where m.tenant_id=? and m.id=? and not m.is_deleted"),(rs,n)->map(rs),tenantId,id).stream().findFirst(); }
    @Override public List<Meeting> list(UUID tenantId){ return jdbc.query(select("where m.tenant_id=? and not m.is_deleted order by m.created_at desc,m.id desc"),(rs,n)->map(rs),tenantId); }

    private String select(String suffix){return """
            select m.id,m.tenant_id,m.business_no,m.workflow_instance_id,m.status,m.version_no,m.business_date,m.subject,m.reason,
            m.priority,m.owner_center_id,m.owner_employee_id,m.planned_start_at,m.start_at,m.result_summary,m.official_subject,
            m.official_content,m.venue_channel,m.visibility_level,m.updated_at,wi.instance_no workflow_instance_no,wi.current_node_code
            from collaboration.meeting m left join workflow.wf_instance wi on wi.tenant_id=m.tenant_id and wi.id=m.workflow_instance_id and not wi.is_deleted
            """+suffix;}
    private Meeting map(ResultSet rs)throws SQLException{
        UUID tenant=rs.getObject("tenant_id",UUID.class),id=rs.getObject("id",UUID.class);
        return new Meeting(id,tenant,rs.getString("business_no"),rs.getObject("workflow_instance_id",UUID.class),rs.getString("workflow_instance_no"),
                rs.getString("current_node_code"),rs.getString("status"),rs.getInt("version_no"),date(rs,"business_date"),rs.getString("subject"),
                rs.getString("reason"),rs.getString("priority"),rs.getObject("owner_center_id",UUID.class),rs.getObject("owner_employee_id",UUID.class),
                instant(rs,"planned_start_at"),instant(rs,"start_at"),rs.getString("result_summary"),rs.getString("official_subject"),
                rs.getString("official_content"),rs.getString("venue_channel"),rs.getString("visibility_level"),items(tenant,id),instant(rs,"updated_at"));
    }
    private List<MeetingItem> items(UUID tenant,UUID id){return jdbc.query("""
            select id,field_code,item_seq,item_key,item_name,item_value_json,created_at from collaboration.meeting_item
            where tenant_id=? and master_id=? and not is_deleted order by field_code,item_seq,id
            """,(rs,n)->new MeetingItem(rs.getObject("id",UUID.class),rs.getString("field_code"),rs.getInt("item_seq"),rs.getString("item_key"),
                    rs.getString("item_name"),read(rs.getString("item_value_json")),instant(rs,"created_at")),tenant,id);}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw new ProcessRejectedException("P006 JSON serialization failed",e);}}
    private JsonNode read(String s){try{return s==null?null:mapper.readTree(s);}catch(JsonProcessingException e){throw new ProcessRejectedException("P006 persisted evidence is invalid JSON",e);}}
    private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);} private static LocalDate date(ResultSet r,String f)throws SQLException{var v=r.getDate(f);return v==null?null:v.toLocalDate();}
    private static Instant instant(ResultSet r,String f)throws SQLException{Object v=r.getObject(f);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp t)return t.toInstant();throw new SQLException("unsupported timestamp "+f);}
}
