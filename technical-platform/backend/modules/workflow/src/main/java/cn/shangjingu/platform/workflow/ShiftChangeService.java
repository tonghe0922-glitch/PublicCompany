package cn.shangjingu.platform.workflow;

import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.core.process.BusinessNumberService;
import cn.shangjingu.platform.core.process.IdempotencyClaim;
import cn.shangjingu.platform.core.process.IdempotencyRegistry;
import cn.shangjingu.platform.core.process.ProcessRejectedException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public final class ShiftChangeService {
    public static final String PROCESS_CODE="P007";
    public static final String FORM_CODE="CTR-P007-F01";
    public static final String MANAGE_PERMISSION="p007.schedule.manage";
    private static final Duration IDEMPOTENCY_TTL=Duration.ofHours(24);
    private final TenantTransactionRunner tx;
    private final IdempotencyRegistry idempotency;
    private final BusinessNumberService numbers;
    private final TransactionalOutboxService outbox;
    private final WorkflowRuntimeService workflow;
    private final WorkflowTaskAssignmentService tasks;
    private final WorkflowFormService forms;
    private final Repository repository;
    private final ObjectMapper mapper;

    public ShiftChangeService(TenantTransactionRunner tx,IdempotencyRegistry idempotency,BusinessNumberService numbers,
            TransactionalOutboxService outbox,WorkflowRuntimeService workflow,WorkflowTaskAssignmentService tasks,
            WorkflowFormService forms,Repository repository,ObjectMapper mapper){this.tx=tx;this.idempotency=idempotency;this.numbers=numbers;this.outbox=outbox;this.workflow=workflow;this.tasks=tasks;this.forms=forms;this.repository=repository;this.mapper=mapper;}

    public Aggregate create(DatabaseSecurityContext actor,String key,String hash,CreateCommand c){
        requireActor(actor);validateCreate(c);
        if(!actor.orgId().equals(c.ownerCenterId()))throw new ProcessRejectedException("P007 owner center must equal authenticated center");
        return tx.required(actor,()->{
            IdempotencyClaim claim=idempotency.claim(actor.tenantId(),actor.employeeId(),key,hash,"attendance.shift_change_request",UUID.randomUUID(),IDEMPOTENCY_TTL);
            if(claim.existing())return aggregate(actor.tenantId(),claim.resourceId());
            if(!repository.isActiveEmployeeInOrg(actor.tenantId(),actor.orgId(),c.targetEmployeeId()))throw new ProcessRejectedException("P007 target employee must be active in authenticated center");
            UUID version=repository.workflowVersion(actor.tenantId()).orElseThrow(()->new ProcessRejectedException("P007 workflow is not published"));
            FormRef form=repository.form(actor.tenantId()).orElseThrow(()->new ProcessRejectedException("P007 form is not published"));
            List<UUID> managers=repository.permissionCandidates(actor.tenantId(),MANAGE_PERMISSION,actor.orgId());
            if(!managers.contains(actor.employeeId()))throw new ProcessRejectedException("P007 creator must remain a manager candidate");
            BigDecimal hours=hours(c.startAt(),c.endAt());
            ShiftRecord record=new ShiftRecord(claim.resourceId(),actor.tenantId(),numbers.next(actor.tenantId(),actor.employeeId(),PROCESS_CODE),null,null,"S01",label("S01"),0,
                    c.subject().trim(),c.reason()==null?null:c.reason().trim(),actor.orgId(),actor.employeeId(),c.targetEmployeeId(),null,
                    c.changeAction().trim(),c.changeReason().trim(),c.templateCode(),c.periodOrCourseNo().trim(),c.startAt(),c.endAt(),hours,null,null,null,null,null,null,null,null,null,null,Instant.now());
            repository.insert(record,actor.employeeId());
            ObjectNode context=mapper.createObjectNode();context.put("ownerEmployeeId",actor.employeeId().toString());context.put("ownerCenterId",actor.orgId().toString());
            context.set("managerCandidateIds",uuidArray(managers));context.set("targetEmployeeIds",uuidArray(List.of(c.targetEmployeeId())));
            WorkflowRuntimeService.Result started=workflow.start(new WorkflowRuntimeService.StartCommand(actor.tenantId(),actor.employeeId(),actor.identityId(),version,"attendance.shift_change_request",record.id(),record.businessNo(),record.subject(),"NORMAL",context,scope(key,"start")));
            forms.submit(new WorkflowFormService.SubmitForm(actor.tenantId(),actor.employeeId(),actor.identityId(),started.instance().id(),null,form.id(),form.versionNo(),List.of(
                    text("subject",record.subject()),text("target_employee_id",record.targetEmployeeId().toString()),text("start_at",record.startAt().toString()),text("end_at",record.endAt().toString()),text("change_action",record.changeAction())),scope(key,"form")));
            WorkflowRuntimeService.Result moved=workflow.act(new WorkflowRuntimeService.ActionCommand(actor.tenantId(),actor.employeeId(),actor.identityId(),started.instance().id(),null,"S01","SUBMIT_DEMAND",null,scope(key,"s01")));
            if(repository.bindAndMove(actor.tenantId(),record.id(),0,moved.instance().id(),label("S02"),actor.employeeId())!=1)throw new ProcessRejectedException("P007 concurrent create conflict");
            emit(actor,record,"SUBMIT_DEMAND","S02",List.of(c.targetEmployeeId()));
            return aggregate(actor.tenantId(),record.id());
        });
    }

    public Aggregate act(DatabaseSecurityContext actor,UUID id,String actionCode,String key,String hash,ActionCommand c){
        requireActor(actor);Objects.requireNonNull(c,"P007 action command is required");String action=safe(actionCode);
        return tx.required(actor,()->{
            Aggregate current=aggregate(actor.tenantId(),id);
            IdempotencyClaim claim=idempotency.claim(actor.tenantId(),actor.employeeId(),key,hash,"attendance.shift_change_request.action."+action.toLowerCase(Locale.ROOT),id,IDEMPOTENCY_TTL);
            if(claim.existing())return current;
            if(current.record().versionNo()!=c.expectedVersion())throw new ProcessRejectedException("P007 version conflict");
            String node=current.record().currentNodeCode();
            switch(node){
                case "S02"->require(action,"MATCH_TEMPLATE");
                case "S03"->{require(action,"VALIDATE_SHIFT");validateServerFacts(actor,current.record());repository.markValidated(actor.tenantId(),id,hours(current.record().startAt(),current.record().endAt()),actor.employeeId());current=aggregate(actor.tenantId(),id);}
                case "S04"->require(action,"PUBLISH_SCHEDULE");
                case "S05"->{require(action,"CONFIRM_SCHEDULE");if(!actor.employeeId().equals(current.record().targetEmployeeId()))throw new ProcessRejectedException("P007 only target employee may confirm schedule");repository.markConfirmed(actor.tenantId(),id,actor.employeeId());}
                case "S06"->{require(action,"SUBMIT_SHIFT_CHANGE");if(!actor.employeeId().equals(current.record().targetEmployeeId()))throw new ProcessRejectedException("P007 only target employee may submit shift change");if(c.replacementEmployeeId()!=null&&!repository.isActiveEmployeeInOrg(actor.tenantId(),actor.orgId(),c.replacementEmployeeId()))throw new ProcessRejectedException("P007 replacement employee is not active in center");repository.setReplacement(actor.tenantId(),id,c.replacementEmployeeId(),actor.employeeId());}
                case "S07"->{if(!"APPROVE_CHANGE".equals(action)&&!"RETURN_CHANGE".equals(action))throw new ProcessRejectedException("P007 review action invalid");if("APPROVE_CHANGE".equals(action)){ShiftRecord refreshed=repository.find(actor.tenantId(),id).orElseThrow();validateServerFacts(actor,refreshed);repository.markApproved(actor.tenantId(),id,actor.employeeId());}}
                case "S08"->{require(action,"LINK_DEPENDENCIES");repository.markDependencies(actor.tenantId(),id,actor.employeeId());}
                case "S09"->{require(action,"CLOSE_DAY");repository.markDayClosed(actor.tenantId(),id,actor.employeeId());}
                default->throw new ProcessRejectedException("P007 action is not allowed from current source node");
            }
            current=aggregate(actor.tenantId(),id);
            ShiftRecord moved=advance(actor,current.record(),node,action,scope(key,"workflow"),c.reason());
            if("S04".equals(node))repository.markPublished(actor.tenantId(),id,actor.employeeId());
            return aggregate(actor.tenantId(),moved.id());
        });
    }

    private void validateServerFacts(DatabaseSecurityContext actor,ShiftRecord r){
        if(!repository.isActiveEmployeeInOrg(actor.tenantId(),r.ownerCenterId(),r.targetEmployeeId()))throw new ProcessRejectedException("P007 qualification validation failed: inactive/out-of-scope employee");
        if(repository.hasOverlappingShift(actor.tenantId(),r.targetEmployeeId(),r.startAt(),r.endAt(),r.id()))throw new ProcessRejectedException("P007 schedule time conflict");
        if(r.replacementEmployeeId()!=null&&repository.hasOverlappingShift(actor.tenantId(),r.replacementEmployeeId(),r.startAt(),r.endAt(),r.id()))throw new ProcessRejectedException("P007 replacement schedule time conflict");
    }
    private ShiftRecord advance(DatabaseSecurityContext actor,ShiftRecord r,String node,String action,String key,String reason){
        WorkflowRuntimeService.Result runtime=workflow.get(actor.tenantId(),r.workflowInstanceId());
        if(!node.equals(runtime.instance().currentNodeCode())||!node.equals(r.currentNodeCode()))throw new ProcessRejectedException("P007 stale workflow projection");
        if(runtime.task()==null)throw new ProcessRejectedException("P007 workflow task missing");
        tasks.claim(new WorkflowTaskAssignmentService.ClaimCommand(actor.tenantId(),runtime.task().id(),actor.employeeId()));
        WorkflowRuntimeService.Result moved=workflow.act(new WorkflowRuntimeService.ActionCommand(actor.tenantId(),actor.employeeId(),actor.identityId(),r.workflowInstanceId(),runtime.task().id(),node,action,reason,key));
        Instant closed="END".equals(moved.instance().currentNodeCode())?moved.instance().finishedAt():null;
        if(repository.moveStatus(actor.tenantId(),r.id(),r.versionNo(),label(moved.instance().currentNodeCode()),closed,actor.employeeId())!=1)throw new ProcessRejectedException("P007 concurrent status transition conflict");
        ShiftRecord result=repository.find(actor.tenantId(),r.id()).orElseThrow();emit(actor,result,action,moved.instance().currentNodeCode(),List.of(r.targetEmployeeId()));return result;
    }
    public Optional<Aggregate> find(DatabaseSecurityContext actor,UUID id){requireActor(actor);return tx.required(actor,()->repository.find(actor.tenantId(),id).map(Aggregate::new));}
    public List<Aggregate> list(DatabaseSecurityContext actor){requireActor(actor);return tx.required(actor,()->repository.list(actor.tenantId()).stream().map(Aggregate::new).toList());}
    private Aggregate aggregate(UUID tenant,UUID id){return new Aggregate(repository.find(tenant,id).orElseThrow(()->new ProcessRejectedException("P007 shift record not found")));}
    private void emit(DatabaseSecurityContext actor,ShiftRecord r,String event,String node,List<UUID> recipients){ObjectNode p=mapper.createObjectNode();p.put("shiftRequestId",r.id().toString());p.put("businessNo",r.businessNo());p.put("event",event);p.put("nodeCode",node);p.set("recipientEmployeeIds",uuidArray(recipients));outbox.enqueue(new TransactionalOutboxService.Command(actor.tenantId(),actor.employeeId(),"P007_SHIFT",r.id(),"P007_SHIFT_EVENT",1,json(p),"p007:"+r.id()+":"+r.versionNo()));}
    private static BigDecimal hours(Instant s,Instant e){if(s==null||e==null||!e.isAfter(s))throw new ProcessRejectedException("P007 endAt must be after startAt");return BigDecimal.valueOf(Duration.between(s,e).toMinutes()).divide(BigDecimal.valueOf(60),6,RoundingMode.HALF_UP);}
    private static void validateCreate(CreateCommand c){Objects.requireNonNull(c);req(c.subject(),"subject");req(c.changeAction(),"changeAction");req(c.changeReason(),"changeReason");req(c.periodOrCourseNo(),"periodOrCourseNo");if(c.targetEmployeeId()==null||c.ownerCenterId()==null)throw new ProcessRejectedException("P007 employee and center are required");hours(c.startAt(),c.endAt());}
    private static void requireActor(DatabaseSecurityContext a){if(a==null||a.tenantId()==null||a.employeeId()==null||a.identityId()==null||a.orgId()==null||a.userId()==null||a.positionId()==null)throw new ProcessRejectedException("P007 authenticated employee context required");}
    private static void require(String a,String e){if(!e.equals(a))throw new ProcessRejectedException("P007 action not allowed from current source node");}
    private static void req(String v,String f){if(v==null||v.isBlank())throw new ProcessRejectedException("P007 required field missing: "+f);}
    private static String safe(String v){if(v==null)return "";String x=v.trim().toUpperCase(Locale.ROOT);return x.matches("[A-Z0-9_]{1,32}")?x:"";}
    private static String scope(String k,String s){if(k==null||k.isBlank())throw new ProcessRejectedException("P007 idempotency key required");String x=k+":"+s;if(x.length()>128)throw new ProcessRejectedException("P007 idempotency key too long");return x;}
    private static WorkflowFormService.FieldValue text(String c,String v){return new WorkflowFormService.FieldValue(c,"TEXT",v,null,null,null,null,null,"P1",false);}
    private ArrayNode uuidArray(List<UUID> ids){ArrayNode a=mapper.createArrayNode();ids.stream().filter(Objects::nonNull).distinct().forEach(x->a.add(x.toString()));return a;}
    private String json(JsonNode n){try{return mapper.writeValueAsString(n);}catch(JsonProcessingException e){throw new ProcessRejectedException("P007 JSON serialization failed",e);}}
    public static String label(String n){return switch(n){case"S01"->"业务量与活动需求输入";case"S02"->"班次模板匹配";case"S03"->"资格与连续工时校验";case"S04"->"主管发布排班";case"S05"->"员工确认";case"S06"->"换班替班申请";case"S07"->"变更审批";case"S08"->"考勤与餐饮班车联动";case"S09"->"日结";case"END"->"已关闭";default->throw new ProcessRejectedException("P007 unknown workflow node: "+n);};}

    public interface Repository{
        Optional<UUID> workflowVersion(UUID tenantId);Optional<FormRef> form(UUID tenantId);List<UUID> permissionCandidates(UUID tenantId,String permission,UUID orgId);boolean isActiveEmployeeInOrg(UUID tenantId,UUID orgId,UUID employeeId);boolean hasOverlappingShift(UUID tenantId,UUID employeeId,Instant start,Instant end,UUID excludeId);void insert(ShiftRecord record,UUID actor);int bindAndMove(UUID tenantId,UUID id,int version,UUID workflowId,String status,UUID actor);int moveStatus(UUID tenantId,UUID id,int version,String status,Instant closedAt,UUID actor);int markValidated(UUID tenantId,UUID id,BigDecimal continuousHours,UUID actor);int markPublished(UUID tenantId,UUID id,UUID actor);int markConfirmed(UUID tenantId,UUID id,UUID actor);int setReplacement(UUID tenantId,UUID id,UUID replacement,UUID actor);int markApproved(UUID tenantId,UUID id,UUID actor);int markDependencies(UUID tenantId,UUID id,UUID actor);int markDayClosed(UUID tenantId,UUID id,UUID actor);Optional<ShiftRecord> find(UUID tenantId,UUID id);List<ShiftRecord> list(UUID tenantId);
    }
    public record FormRef(UUID id,int versionNo){}
    public record CreateCommand(String subject,String reason,UUID ownerCenterId,UUID targetEmployeeId,String changeAction,String changeReason,String templateCode,String periodOrCourseNo,Instant startAt,Instant endAt){}
    public record ActionCommand(int expectedVersion,UUID replacementEmployeeId,String reason){}
    public record ShiftRecord(UUID id,UUID tenantId,String businessNo,UUID workflowInstanceId,String workflowInstanceNo,String currentNodeCode,String status,int versionNo,String subject,String reason,UUID ownerCenterId,UUID ownerEmployeeId,UUID targetEmployeeId,UUID replacementEmployeeId,String changeAction,String changeReason,String templateCode,String periodOrCourseNo,Instant startAt,Instant endAt,BigDecimal durationHours,Instant qualificationCheckedAt,BigDecimal continuousWorkHours,Instant conflictCheckedAt,Instant publishedAt,Instant employeeConfirmedAt,Instant approvedAt,Instant attendanceLinkedAt,Instant cateringLinkedAt,Instant shuttleLinkedAt,Instant dayClosedAt,Instant updatedAt){}
    public record Aggregate(ShiftRecord record){public Aggregate metadataOnly(){ShiftRecord r=new ShiftRecord(record.id(),record.tenantId(),record.businessNo(),record.workflowInstanceId(),record.workflowInstanceNo(),record.currentNodeCode(),record.status(),record.versionNo(),null,null,record.ownerCenterId(),null,null,null,record.changeAction(),null,null,record.periodOrCourseNo(),record.startAt(),record.endAt(),record.durationHours(),record.qualificationCheckedAt(),record.continuousWorkHours(),record.conflictCheckedAt(),record.publishedAt(),record.employeeConfirmedAt(),record.approvedAt(),record.attendanceLinkedAt(),record.cateringLinkedAt(),record.shuttleLinkedAt(),record.dayClosedAt(),record.updatedAt());return new Aggregate(r);}}
}
