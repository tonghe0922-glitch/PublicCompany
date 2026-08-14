package cn.shangjingu.platform.performance;

import static cn.shangjingu.platform.performance.PerformanceCycleService.*;

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
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcPerformanceCycleRepository implements PerformanceCycleService.Repository {
    private final JdbcTemplate jdbc;private final ObjectMapper mapper;public JdbcPerformanceCycleRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    @Override public Optional<UUID> latestPublishedWorkflowVersion(UUID t,String c){return jdbc.query("select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id where v.tenant_id=? and d.process_code=? and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted and (v.effective_at is null or v.effective_at<=now()) order by v.version_no desc limit 1",(r,n)->r.getObject(1,UUID.class),t,c).stream().findFirst();}
    @Override public Optional<FormRef> latestPublishedForm(UUID t,String f,String p,String n){return jdbc.query("select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code=? and process_code=? and node_code=? and enabled and not is_deleted order by version_no desc limit 1",(r,x)->new FormRef(r.getObject(1,UUID.class),r.getInt(2)),t,f,p,n).stream().findFirst();}
    @Override public Optional<Target> target(UUID t,UUID employee){return jdbc.query("""
        select e.id,ui.org_id,ui.user_id,ui.id identity_id from org.employee e join iam.user_identity ui on ui.tenant_id=e.tenant_id and ui.employee_id=e.id and ui.is_primary and not ui.is_deleted and ui.effective_start_at<=now() and (ui.effective_end_at is null or ui.effective_end_at>now()) where e.tenant_id=? and e.id=? and e.employment_status='ACTIVE' and not e.is_deleted order by ui.effective_start_at desc limit 1
        """,(r,n)->new Target(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getObject(4,UUID.class)),t,employee).stream().findFirst();}
    @Override public List<UUID> permissionCandidates(UUID t,String p,UUID o){return jdbc.query("""
        select distinct ui.employee_id from iam.user_role ur join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted join iam.permission pm on pm.tenant_id=rp.tenant_id and pm.id=rp.permission_id and not pm.is_deleted join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted and (ur.identity_id is null or ur.identity_id=ui.id) join org.employee e on e.tenant_id=ui.tenant_id and e.id=ui.employee_id and e.employment_status='ACTIVE' and not e.is_deleted where ur.tenant_id=? and pm.permission_code=? and ui.org_id=? and not ur.is_deleted and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now()) order by ui.employee_id
        """,(r,n)->r.getObject(1,UUID.class),t,p,o);}
    @Override public void insert(Cycle v,UUID a){one(jdbc.update("""
        insert into performance.performance_cycle(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,owner_center_id,owner_employee_id,content_version,employee_event_type,fact_occurred_at,period_or_course_no)
        values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,v.id(),v.tenantId(),v.businessNo(),v.status(),0,a,a,"PORTAL",v.businessDate(),v.subject(),v.reason(),"NORMAL","HIGH",v.ownerCenterId(),v.ownerEmployeeId(),v.contentVersion(),"PERFORMANCE_CYCLE",Timestamp.from(Instant.now()),v.periodOrCourseNo()),"insert");}
    @Override public int bindWorkflow(UUID t,UUID id,int v,UUID wf,UUID a){return jdbc.update("update performance.performance_cycle set workflow_instance_id=?,version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",wf,a,t,id,v);}
    @Override public int move(UUID t,UUID id,int v,String status,String result,Instant closed,UUID a){return jdbc.update("update performance.performance_cycle set status=?,result_summary=coalesce(cast(? as text),result_summary),closed_at=coalesce(?,closed_at),version_no=version_no+1,updated_by=? where tenant_id=? and id=? and version_no=? and not is_deleted",status,result,ts(closed),a,t,id,v);}
    @Override public void appendEvent(UUID t,UUID id,String type,JsonNode evidence,UUID actor){lock(t,id,"event");one(jdbc.update("""
        insert into performance.performance_cycle_event(id,tenant_id,cycle_id,event_seq,event_type,evidence,actor_employee_id)
        select gen_random_uuid(),?,?,coalesce(max(event_seq),0)+1,?,cast(? as jsonb),? from performance.performance_cycle_event where tenant_id=? and cycle_id=?
        """,t,id,type,json(evidence),actor,t,id),"event append");}
    @Override public void appendScore(UUID t,UUID id,String type,long score,JsonNode evidence,UUID actor){lock(t,id,"score");one(jdbc.update("""
        insert into performance.performance_score_fact(id,tenant_id,cycle_id,score_seq,score_type,score_1000,evidence,actor_employee_id)
        select gen_random_uuid(),?,?,coalesce(max(score_seq),0)+1,?,?,cast(? as jsonb),? from performance.performance_score_fact where tenant_id=? and cycle_id=?
        """,t,id,type,score,json(evidence),actor,t,id),"score append");if(Set.of("SYSTEM_CALCULATED","CALIBRATED").contains(type))one(jdbc.update("update performance.performance_cycle set score_1000=?,updated_by=? where tenant_id=? and id=? and not is_deleted",score,actor,t,id),"score projection");}
    @Override public Optional<Long> score(UUID t,UUID id,String type){return jdbc.query("select score_1000 from performance.performance_score_fact where tenant_id=? and cycle_id=? and score_type=?",(r,n)->r.getLong(1),t,id,type).stream().findFirst();}
    @Override public Optional<UUID> eventActor(UUID t,UUID id,String type){return jdbc.query("select actor_employee_id from performance.performance_cycle_event where tenant_id=? and cycle_id=? and event_type=? order by event_seq desc limit 1",(r,n)->r.getObject(1,UUID.class),t,id,type).stream().findFirst();}
    @Override public boolean eventExists(UUID t,UUID id,String type){Long n=jdbc.queryForObject("select count(*) from performance.performance_cycle_event where tenant_id=? and cycle_id=? and event_type=?",Long.class,t,id,type);return n!=null&&n>0;}
    @Override public void setAppeal(UUID t,UUID id,String status,UUID actor){one(jdbc.update("update performance.performance_cycle set appeal_status=?,updated_by=? where tenant_id=? and id=? and not is_deleted",status,actor,t,id),"appeal projection");}
    @Override public void appendEffect(UUID t,UUID id,String type,String reference,JsonNode evidence,UUID actor){one(jdbc.update("insert into performance.performance_effect_execution(id,tenant_id,cycle_id,execution_type,external_reference,evidence,executed_by) values(gen_random_uuid(),?,?,?,?,cast(? as jsonb),?)",t,id,type,reference,json(evidence),actor),"effect append");}
    @Override public Optional<Cycle> find(UUID t,UUID id){return jdbc.query(select("where c.tenant_id=? and c.id=? and not c.is_deleted"),(r,n)->map(r),t,id).stream().findFirst();}@Override public List<Cycle> list(UUID t){return jdbc.query(select("where c.tenant_id=? and not c.is_deleted order by c.created_at desc,c.id desc"),(r,n)->map(r),t);}
    private String select(String suffix){return """
        select c.id,c.tenant_id,c.business_no,c.workflow_instance_id,w.instance_no workflow_instance_no,w.current_node_code,c.status,c.version_no,c.business_date,c.subject,c.reason,c.owner_center_id,c.owner_employee_id,c.content_version,c.period_or_course_no,c.score_1000,c.appeal_status,c.updated_at from performance.performance_cycle c left join workflow.wf_instance w on w.tenant_id=c.tenant_id and w.id=c.workflow_instance_id and not w.is_deleted
        """+suffix;}
    private Cycle map(ResultSet r)throws SQLException{UUID t=r.getObject("tenant_id",UUID.class),id=r.getObject("id",UUID.class);return new Cycle(id,t,r.getString("business_no"),r.getObject("workflow_instance_id",UUID.class),r.getString("workflow_instance_no"),r.getString("current_node_code"),r.getString("status"),r.getInt("version_no"),date(r,"business_date"),r.getString("subject"),r.getString("reason"),r.getObject("owner_center_id",UUID.class),r.getObject("owner_employee_id",UUID.class),r.getString("content_version"),r.getString("period_or_course_no"),(Long)r.getObject("score_1000"),r.getString("appeal_status"),scores(t,id),events(t,id),effects(t,id),instant(r,"updated_at"));}
    private List<ScoreFact> scores(UUID t,UUID id){return jdbc.query("select id,score_seq,score_type,score_1000,evidence,actor_employee_id,created_at from performance.performance_score_fact where tenant_id=? and cycle_id=? order by score_seq,id",(r,n)->new ScoreFact(r.getObject(1,UUID.class),r.getInt(2),r.getString(3),r.getLong(4),read(r.getString(5)),r.getObject(6,UUID.class),instant(r,"created_at")),t,id);}
    private List<Event> events(UUID t,UUID id){return jdbc.query("select id,event_seq,event_type,evidence,actor_employee_id,created_at from performance.performance_cycle_event where tenant_id=? and cycle_id=? order by event_seq,id",(r,n)->new Event(r.getObject(1,UUID.class),r.getInt(2),r.getString(3),read(r.getString(4)),r.getObject(5,UUID.class),instant(r,"created_at")),t,id);}
    private List<Effect> effects(UUID t,UUID id){return jdbc.query("select id,execution_type,external_reference,execution_status,evidence,executed_by,executed_at from performance.performance_effect_execution where tenant_id=? and cycle_id=? order by executed_at,id",(r,n)->new Effect(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),read(r.getString(5)),r.getObject(6,UUID.class),instant(r,"executed_at")),t,id);}
    private void lock(UUID t,UUID id,String domain){jdbc.query("select pg_advisory_xact_lock(hashtextextended(?,0))",r->{r.next();return null;},t+":"+id+":"+domain);}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw rejected("JSON serialization failed");}}private JsonNode read(String n){try{return n==null?null:mapper.readTree(n);}catch(JsonProcessingException e){throw rejected("persisted JSON invalid");}}private static void one(int n,String action){if(n!=1)throw rejected(action+" failed");}private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static LocalDate date(ResultSet r,String f)throws SQLException{var v=r.getDate(f);return v==null?null:v.toLocalDate();}private static Instant instant(ResultSet r,String f)throws SQLException{Object v=r.getObject(f);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp x)return x.toInstant();throw new SQLException("unsupported timestamp "+f);}private static ProcessRejectedException rejected(String m){return new ProcessRejectedException("P011 "+m);}
}
