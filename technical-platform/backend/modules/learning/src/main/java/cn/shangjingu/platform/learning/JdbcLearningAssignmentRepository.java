package cn.shangjingu.platform.learning;

import static cn.shangjingu.platform.learning.LearningAssignmentService.*;

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
public class JdbcLearningAssignmentRepository implements LearningAssignmentService.Repository {
    private final JdbcTemplate jdbc;private final ObjectMapper mapper;public JdbcLearningAssignmentRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    @Override public Optional<UUID> latestPublishedWorkflowVersion(UUID t,String c){return jdbc.query("select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id where v.tenant_id=? and d.process_code=? and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted and (v.effective_at is null or v.effective_at<=now()) order by v.version_no desc limit 1",(r,n)->r.getObject(1,UUID.class),t,c).stream().findFirst();}
    @Override public Optional<FormRef> latestPublishedForm(UUID t,String f,String p,String n){return jdbc.query("select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code=? and process_code=? and node_code=? and enabled and not is_deleted order by version_no desc limit 1",(r,x)->new FormRef(r.getObject(1,UUID.class),r.getInt(2)),t,f,p,n).stream().findFirst();}
    @Override public Optional<Target> target(UUID t,UUID employee){return jdbc.query("""
        select e.id,ui.org_id,ui.user_id,ui.id identity_id from org.employee e join iam.user_identity ui on ui.tenant_id=e.tenant_id and ui.employee_id=e.id and ui.is_primary and not ui.is_deleted and ui.effective_start_at<=now() and (ui.effective_end_at is null or ui.effective_end_at>now()) where e.tenant_id=? and e.id=? and e.employment_status='ACTIVE' and not e.is_deleted order by ui.effective_start_at desc limit 1
        """,(r,n)->new Target(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getObject(4,UUID.class)),t,employee).stream().findFirst();}
    @Override public List<UUID> permissionCandidates(UUID t,String p,UUID o){return jdbc.query("""
        select distinct ui.employee_id from iam.user_role ur join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted join iam.permission pm on pm.tenant_id=rp.tenant_id and pm.id=rp.permission_id and not pm.is_deleted join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted and (ur.identity_id is null or ur.identity_id=ui.id) join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id and e.employment_status='ACTIVE' and not e.is_deleted where ur.tenant_id=? and pm.permission_code=? and ui.org_id=? and not ur.is_deleted and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now()) order by ui.employee_id
        """,(r,n)->r.getObject(1,UUID.class),t,p,o);}
    @Override public void insert(Assignment v,UUID a){int c=jdbc.update("""
        insert into learning.learning_assignment(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,owner_center_id,owner_employee_id,completion_rate,content_version,course_team_name,course_version_id,learner_profile,period_or_course_no)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,v.id(),v.tenantId(),v.businessNo(),v.status(),0,a,a,"PORTAL",v.businessDate(),v.subject(),v.reason(),"NORMAL","HIGH",v.ownerCenterId(),v.ownerEmployeeId(),v.completionRate(),v.contentVersion(),v.courseTeamName(),v.courseVersionId(),v.learnerProfile(),v.periodOrCourseNo());if(c!=1)throw rejected("insert failed");}
    @Override public int bindWorkflow(UUID t,UUID id,int v,UUID wf,UUID a){return jdbc.update("update learning.learning_assignment set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",wf,a,t,id,v);}
    @Override public int move(UUID t,UUID id,int v,String status,String result,Instant closed,UUID a){return jdbc.update("update learning.learning_assignment set status=?,result_summary=coalesce(cast(? as text),result_summary),closed_at=coalesce(?,closed_at),version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",status,result,ts(closed),a,t,id,v);}
    @Override public void appendEvent(UUID t,UUID id,String type,JsonNode evidence,UUID actor){int c=jdbc.update("""
        insert into learning.learning_assignment_event(id,tenant_id,assignment_id,event_seq,event_type,evidence,actor_employee_id)
        select gen_random_uuid(),?,?,coalesce(max(event_seq),0)+1,?,cast(? as jsonb),? from learning.learning_assignment_event where tenant_id=? and assignment_id=?
        """,t,id,type,json(evidence),actor,t,id);if(c!=1)throw rejected("event append failed");}
    @Override public Optional<UUID> eventActor(UUID t,UUID id,String type){return jdbc.query("select actor_employee_id from learning.learning_assignment_event where tenant_id=? and assignment_id=? and event_type=? order by event_seq desc limit 1",(r,n)->r.getObject(1,UUID.class),t,id,type).stream().findFirst();}
    @Override public void recordCompletion(UUID t,UUID id,UUID actor){one(jdbc.update("update learning.learning_assignment set completion_rate=100,actual_start_at=coalesce(actual_start_at,now()),updated_by=? where tenant_id=? and id=? and not is_deleted",actor,t,id),"completion");}
    @Override public void recordExam(UUID t,UUID id,long score,UUID actor){one(jdbc.update("update learning.learning_assignment set score_1000=?,updated_by=? where tenant_id=? and id=? and not is_deleted",score,actor,t,id),"exam");}
    @Override public void recordPractical(UUID t,UUID id,String result,UUID actor){one(jdbc.update("update learning.learning_assignment set practical_result=?,updated_by=? where tenant_id=? and id=? and not is_deleted",result,actor,t,id),"practical");}
    @Override public void activate(UUID t,UUID id,LocalDate effective,LocalDate expire,UUID actor){one(jdbc.update("update learning.learning_assignment set qualification_effective_date=?,qualification_expire_date=?,actual_end_at=now(),updated_by=? where tenant_id=? and id=? and not is_deleted",effective,expire,actor,t,id),"qualification activation");}
    @Override public int executeApprovedPolicies(UUID t,UUID id,UUID actor){return jdbc.update("""
        insert into learning.qualification_permission_grant(id,tenant_id,assignment_id,policy_id,employee_id,user_id,identity_id,permission_id,data_scope_code,effective_start_date,effective_end_date,execution_status,executed_by)
        select gen_random_uuid(),a.tenant_id,a.id,p.id,a.owner_employee_id,ui.user_id,ui.id,p.permission_id,p.data_scope_code,a.qualification_effective_date,a.qualification_expire_date,'ACTIVE',?
        from learning.learning_assignment a join learning.qualification_permission_policy p on p.tenant_id=a.tenant_id and p.course_version_id=a.course_version_id and p.enabled
        join iam.user_identity ui on ui.tenant_id=a.tenant_id and ui.employee_id=a.owner_employee_id and ui.is_primary and not ui.is_deleted and ui.effective_start_at<=now() and (ui.effective_end_at is null or ui.effective_end_at>now())
        where a.tenant_id=? and a.id=? and not a.is_deleted and a.qualification_effective_date is not null and a.qualification_expire_date>=current_date
        on conflict(tenant_id,assignment_id,policy_id) do nothing
        """,actor,t,id);}
    @Override public Optional<Assignment> find(UUID t,UUID id){return jdbc.query(select("where a.tenant_id=? and a.id=? and not a.is_deleted"),(r,n)->map(r),t,id).stream().findFirst();}@Override public List<Assignment> list(UUID t){return jdbc.query(select("where a.tenant_id=? and not a.is_deleted order by a.created_at desc,a.id desc"),(r,n)->map(r),t);}
    private String select(String suffix){return """
        select a.id,a.tenant_id,a.business_no,a.workflow_instance_id,w.instance_no workflow_instance_no,w.current_node_code,a.status,a.version_no,a.business_date,a.subject,a.reason,a.owner_center_id,a.owner_employee_id,a.course_version_id,a.content_version,a.course_team_name,a.period_or_course_no,a.learner_profile,a.completion_rate,a.score_1000,a.practical_result,a.qualification_effective_date,a.qualification_expire_date,a.updated_at from learning.learning_assignment a left join workflow.wf_instance w on w.tenant_id=a.tenant_id and w.id=a.workflow_instance_id and not w.is_deleted
        """+suffix;}
    private Assignment map(ResultSet r)throws SQLException{UUID t=r.getObject("tenant_id",UUID.class),id=r.getObject("id",UUID.class);return new Assignment(id,t,r.getString("business_no"),r.getObject("workflow_instance_id",UUID.class),r.getString("workflow_instance_no"),r.getString("current_node_code"),r.getString("status"),r.getInt("version_no"),date(r,"business_date"),r.getString("subject"),r.getString("reason"),r.getObject("owner_center_id",UUID.class),r.getObject("owner_employee_id",UUID.class),r.getString("course_version_id"),r.getString("content_version"),r.getString("course_team_name"),r.getString("period_or_course_no"),r.getString("learner_profile"),r.getBigDecimal("completion_rate"),(Long)r.getObject("score_1000"),r.getString("practical_result"),date(r,"qualification_effective_date"),date(r,"qualification_expire_date"),events(t,id),instant(r,"updated_at"));}
    private List<Event> events(UUID t,UUID id){return jdbc.query("select id,event_seq,event_type,evidence,actor_employee_id,created_at from learning.learning_assignment_event where tenant_id=? and assignment_id=? order by event_seq,id",(r,n)->new Event(r.getObject(1,UUID.class),r.getInt(2),r.getString(3),read(r.getString(4)),r.getObject(5,UUID.class),instant(r,"created_at")),t,id);}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw rejected("JSON serialization failed");}}private JsonNode read(String n){try{return n==null?null:mapper.readTree(n);}catch(JsonProcessingException e){throw rejected("persisted JSON invalid");}}private static void one(int n,String action){if(n!=1)throw rejected(action+" projection failed");}private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static LocalDate date(ResultSet r,String f)throws SQLException{var v=r.getDate(f);return v==null?null:v.toLocalDate();}private static Instant instant(ResultSet r,String f)throws SQLException{Object v=r.getObject(f);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp x)return x.toInstant();throw new SQLException("unsupported timestamp "+f);}private static ProcessRejectedException rejected(String m){return new ProcessRejectedException("P010 "+m);}
}
