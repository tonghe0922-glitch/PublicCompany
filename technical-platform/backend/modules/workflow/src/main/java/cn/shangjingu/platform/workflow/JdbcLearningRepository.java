package cn.shangjingu.platform.workflow;

import cn.shangjingu.platform.workflow.LearningService.Evidence;
import cn.shangjingu.platform.workflow.LearningService.FormRef;
import cn.shangjingu.platform.workflow.LearningService.LearningRecord;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcLearningRepository implements LearningService.Repository {
    private final JdbcTemplate jdbc; private final ObjectMapper mapper;
    public JdbcLearningRepository(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    @Override public Optional<UUID> workflowVersion(UUID t){return jdbc.query("""
      select v.id from workflow.wf_version v join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id
      where v.tenant_id=? and d.process_code='P010' and d.enabled and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted
      order by v.version_no desc limit 1
      """,(rs,n)->rs.getObject(1,UUID.class),t).stream().findFirst();}
    @Override public Optional<FormRef> form(UUID t){return jdbc.query("select id,version_no from workflow.wf_form_definition where tenant_id=? and form_code='CTR-P010-F03' and process_code='P010' and node_code='S01' and enabled and not is_deleted order by version_no desc limit 1",(rs,n)->new FormRef(rs.getObject(1,UUID.class),rs.getInt(2)),t).stream().findFirst();}
    @Override public List<UUID> permissionCandidates(UUID t,String permission,UUID org){return jdbc.query("""
      select distinct ui.employee_id from iam.user_role ur join iam.role r on r.tenant_id=ur.tenant_id and r.id=ur.role_id and r.enabled and not r.is_deleted
      join iam.role_permission rp on rp.tenant_id=r.tenant_id and rp.role_id=r.id and not rp.is_deleted join iam.permission p on p.tenant_id=rp.tenant_id and p.id=rp.permission_id and not p.is_deleted
      join iam.user_identity ui on ui.tenant_id=ur.tenant_id and ui.user_id=ur.user_id and not ui.is_deleted and (ur.identity_id is null or ur.identity_id=ui.id)
      where ur.tenant_id=? and p.permission_code=? and ui.org_id=? and not ur.is_deleted and ur.effective_start_at<=now() and (ur.effective_end_at is null or ur.effective_end_at>now())
      """,(rs,n)->rs.getObject(1,UUID.class),t,permission,org);}
    @Override public Optional<LearningRecord> find(UUID t,UUID id){return jdbc.query(select("where a.tenant_id=? and a.id=? and not a.is_deleted"),(rs,n)->map(rs),t,id).stream().findFirst();}
    @Override public List<LearningRecord> list(UUID t){return jdbc.query(select("where a.tenant_id=? and not a.is_deleted order by a.updated_at desc,a.id desc"),(rs,n)->map(rs),t);}
    @Override public List<Evidence> evidence(UUID t,UUID id){return jdbc.query("select id,evidence_type,actor_employee_id,score_1000,completion_rate,practical_result,evidence_text,evidence_json,created_at from learning.learning_assignment_evidence where tenant_id=? and assignment_id=? order by created_at,id",(rs,n)->new Evidence(rs.getObject(1,UUID.class),rs.getString(2),rs.getObject(3,UUID.class),rs.getObject(4)==null?null:rs.getLong(4),rs.getBigDecimal(5),rs.getString(6),rs.getString(7),json(rs.getString(8)),instant(rs,"created_at")),t,id);}
    @Override public int bindWorkflow(UUID t,UUID id,int v,UUID wf,String node,String status,UUID actor){return jdbc.update("update learning.learning_assignment set workflow_instance_id=?,phase_node_code=?,status=?,version_no=version_no+1,updated_by=?,updated_at=now() where tenant_id=? and id=? and version_no=? and not is_deleted",wf,node,status,actor,t,id,v);}
    @Override public int moveNode(UUID t,UUID id,int v,String node,String status,Instant closed,UUID actor){return jdbc.update("update learning.learning_assignment set phase_node_code=?,status=?,closed_at=coalesce(?,closed_at),version_no=version_no+1,updated_by=?,updated_at=now() where tenant_id=? and id=? and version_no=? and not is_deleted",node,status,ts(closed),actor,t,id,v);}
    @Override public void appendEvidence(UUID t,UUID id,String type,UUID actor,Long score,BigDecimal progress,String practical,String text,JsonNode json){jdbc.update("insert into learning.learning_assignment_evidence(id,tenant_id,assignment_id,evidence_type,actor_employee_id,score_1000,completion_rate,practical_result,evidence_text,evidence_json) values(gen_random_uuid(),?,?,?,?,?,?,?,?,cast(? as jsonb))",t,id,type,actor,score,progress,practical,text,json==null?null:json.toString());}
    @Override public int updateProgress(UUID t,UUID id,BigDecimal p,UUID actor){return jdbc.update("update learning.learning_assignment set completion_rate=?,updated_by=?,updated_at=now() where tenant_id=? and id=? and phase_node_code='S03' and not is_deleted",p,actor,t,id);}
    @Override public int markLearningCompleted(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set learning_completed_at=coalesce(learning_completed_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and completion_rate=100 and not is_deleted",actor,t,id);}
    @Override public int updateExam(UUID t,UUID id,long score,UUID actor){return jdbc.update("update learning.learning_assignment set score_1000=?,exam_completed_at=coalesce(exam_completed_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and phase_node_code='S04' and not is_deleted",score,actor,t,id);}
    @Override public int updatePractical(UUID t,UUID id,String result,UUID actor){return jdbc.update("update learning.learning_assignment set practical_result=?,practical_completed_at=coalesce(practical_completed_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and phase_node_code='S05' and not is_deleted",result,actor,t,id);}
    @Override public int markContentPublished(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set content_published_at=coalesce(content_published_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and not is_deleted",actor,t,id);}
    @Override public int markRiskAssigned(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set risk_assigned_at=coalesce(risk_assigned_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and not is_deleted",actor,t,id);}
    @Override public int markCertified(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set certified_at=coalesce(certified_at,now()),certified_by=?,updated_by=?,updated_at=now() where tenant_id=? and id=? and phase_node_code='S06' and not is_deleted",actor,actor,t,id);}
    @Override public int activateQualification(UUID t,UUID id,LocalDate effective,LocalDate expire,UUID actor){return jdbc.update("update learning.learning_assignment set qualification_effective_date=?,qualification_expire_date=?,qualification_activated_at=coalesce(qualification_activated_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and certified_at is not null and not is_deleted",effective,expire,actor,t,id);}
    @Override public List<UUID> linkPermissions(UUID t,UUID id,UUID actor){LearningRecord a=find(t,id).orElseThrow();var identities=jdbc.query("select id,user_id,position_id from iam.user_identity where tenant_id=? and employee_id=? and org_id=? and not is_deleted and effective_start_at<=now() and (effective_end_at is null or effective_end_at>now()) order by is_primary desc,effective_start_at desc limit 1",(rs,n)->new Identity(rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getObject(3,UUID.class)),t,a.ownerEmployeeId(),a.ownerCenterId());if(identities.isEmpty())return List.of();Identity identity=identities.getFirst();List<UUID> roles=jdbc.query("select role_id from learning.qualification_permission_binding where tenant_id=? and course_version_id=? and enabled and not is_deleted and (position_id is null or position_id=?) order by role_id",(rs,n)->rs.getObject(1,UUID.class),t,a.courseVersionId(),identity.positionId());List<UUID> linked=new ArrayList<>();for(UUID role:roles){jdbc.update("""
          insert into iam.user_role(id,tenant_id,created_by,updated_by,user_id,identity_id,role_id,effective_start_at,effective_end_at,grant_source,created_at,updated_at,is_deleted)
          select gen_random_uuid(),?,?,?,?,?,?,(?::date::timestamp at time zone 'Asia/Shanghai'),case when ?::date is null then null else ((?::date+1)::timestamp at time zone 'Asia/Shanghai') end,'QUALIFICATION',now(),now(),false
          where not exists(select 1 from iam.user_role ur where ur.tenant_id=? and ur.user_id=? and ur.identity_id=? and ur.role_id=? and not ur.is_deleted and ur.effective_start_at<coalesce(case when ?::date is null then null else ((?::date+1)::timestamp at time zone 'Asia/Shanghai') end,'infinity'::timestamptz) and coalesce(ur.effective_end_at,'infinity'::timestamptz)>(?::date::timestamp at time zone 'Asia/Shanghai'))
          """,t,actor,actor,identity.userId(),identity.id(),role,a.qualificationEffectiveDate(),a.qualificationExpireDate(),a.qualificationExpireDate(),t,identity.userId(),identity.id(),role,a.qualificationExpireDate(),a.qualificationExpireDate(),a.qualificationEffectiveDate());linked.add(role);}return linked;}
    @Override public int markPermissionLinked(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set permission_linked_at=coalesce(permission_linked_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and qualification_activated_at is not null and not is_deleted",actor,t,id);}
    @Override public int markRetrainingChecked(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set retraining_checked_at=coalesce(retraining_checked_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and permission_linked_at is not null and not is_deleted",actor,t,id);}
    @Override public int markArchived(UUID t,UUID id,UUID actor){return jdbc.update("update learning.learning_assignment set archived_at=coalesce(archived_at,now()),updated_by=?,updated_at=now() where tenant_id=? and id=? and retraining_checked_at is not null and not is_deleted",actor,t,id);}
    private String select(String suffix){return """
      select a.id,a.tenant_id,a.business_no,a.workflow_instance_id,wi.instance_no workflow_instance_no,coalesce(wi.current_node_code,a.phase_node_code) current_node_code,a.status,a.version_no,a.subject,a.owner_center_id,a.owner_employee_id,a.content_version,a.course_version_id,a.period_or_course_no,a.completion_rate,a.score_1000,a.practical_result,a.qualification_effective_date,a.qualification_expire_date,a.certified_at,a.certified_by,a.permission_linked_at,a.archived_at,a.updated_at
      from learning.learning_assignment a left join workflow.wf_instance wi on wi.tenant_id=a.tenant_id and wi.id=a.workflow_instance_id and not wi.is_deleted
      """+suffix;}
    private LearningRecord map(ResultSet rs)throws SQLException{return new LearningRecord(rs.getObject("id",UUID.class),rs.getObject("tenant_id",UUID.class),rs.getString("business_no"),rs.getObject("workflow_instance_id",UUID.class),rs.getString("workflow_instance_no"),rs.getString("current_node_code"),rs.getString("status"),rs.getInt("version_no"),rs.getString("subject"),rs.getObject("owner_center_id",UUID.class),rs.getObject("owner_employee_id",UUID.class),rs.getString("content_version"),rs.getString("course_version_id"),rs.getString("period_or_course_no"),rs.getBigDecimal("completion_rate"),rs.getObject("score_1000")==null?null:rs.getLong("score_1000"),rs.getString("practical_result"),rs.getObject("qualification_effective_date",LocalDate.class),rs.getObject("qualification_expire_date",LocalDate.class),instant(rs,"certified_at"),rs.getObject("certified_by",UUID.class),instant(rs,"permission_linked_at"),instant(rs,"archived_at"),instant(rs,"updated_at"));}
    private JsonNode json(String v){try{return v==null?null:mapper.readTree(v);}catch(Exception e){throw new IllegalArgumentException("invalid P010 evidence JSON",e);}}private static Timestamp ts(Instant v){return v==null?null:Timestamp.from(v);}private static Instant instant(ResultSet rs,String c)throws SQLException{Object v=rs.getObject(c);if(v==null)return null;if(v instanceof OffsetDateTime o)return o.toInstant();if(v instanceof Timestamp t)return t.toInstant();return ((java.time.ZonedDateTime)v).toInstant();}private record Identity(UUID id,UUID userId,UUID positionId){}
}
