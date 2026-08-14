package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.attendance.ShiftChangeService;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/processes/P007")
public final class P007ShiftChangeController {
    private static final String READ="p007.schedule.read",MANAGE="p007.schedule.manage",CHANGE="p007.schedule.change",REVIEW="p007.schedule.review",MONITOR="p007.schedule.monitor";
    private final ShiftChangeService shifts;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P007ShiftChangeController(ShiftChangeService shifts,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.shifts=shifts;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/shift-changes") public ShiftChangeService.ShiftChange create(@AuthenticationPrincipal SessionPrincipal principal,@RequestHeader("Idempotency-Key")String key,@RequestBody ShiftChangeService.CreateCommand command){
        require(authorization.authorizeAction(principal.context(),MANAGE));require(authorization.authorizeData(principal.context(),MANAGE,new AuthorizationTarget(principal.context().tenantId(),command.ownerEmployeeId(),principal.context().orgId(),null,command.ownerEmployeeId())));
        audit.recordOperation(principal.context(),"P007_CREATE_ATTEMPT","attendance.shift_change_request",null);var result=shifts.create(context(principal),key,hash(command),command);audit.recordOperation(principal.context(),"P007_CREATED","attendance.shift_change_request",result.id());return view(principal,result);}
    @GetMapping("/shift-changes/{id}") public ShiftChangeService.ShiftChange get(@AuthenticationPrincipal SessionPrincipal principal,@PathVariable UUID id){String permission=readPermission(principal);var value=shifts.find(context(principal),id).orElseThrow(()->new IllegalArgumentException("P007 shift change not found"));require(authorization.authorizeData(principal.context(),permission,target(value)));audit.recordOperation(principal.context(),"P007_READ","attendance.shift_change_request",id);return view(principal,value);}
    @GetMapping("/shift-changes") public List<ShiftChangeService.ShiftChange> list(@AuthenticationPrincipal SessionPrincipal principal){return scoped(principal,false);}
    @GetMapping("/schedules") public List<ShiftChangeService.ShiftChange> schedules(@AuthenticationPrincipal SessionPrincipal principal){return scoped(principal,true);}
    @PostMapping("/shift-changes/{id}/actions/{actionCode}") public ShiftChangeService.ShiftChange act(@AuthenticationPrincipal SessionPrincipal principal,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody ShiftChangeService.ActionCommand command){
        var current=shifts.find(context(principal),id).orElseThrow(()->new IllegalArgumentException("P007 shift change not found"));String action=safe(actionCode),permission=shifts.employeeNode(current)?CHANGE:(shifts.reviewNode(current)?REVIEW:MANAGE);require(authorization.authorizeAction(principal.context(),permission));require(authorization.authorizeData(principal.context(),permission,target(current)));
        audit.recordOperation(principal.context(),"P007_ACTION_ATTEMPT_"+action,"attendance.shift_change_request",id);var result=shifts.act(context(principal),id,action,key,hash(Map.of("actionCode",action,"body",command)),command);audit.recordOperation(principal.context(),"P007_ACTION_"+action,"attendance.shift_change_request",id);return view(principal,result);}
    private List<ShiftChangeService.ShiftChange> scoped(SessionPrincipal p,boolean schedules){String permission=readPermission(p);List<ShiftChangeService.ShiftChange> source=schedules?shifts.schedules(context(p)):shifts.list(context(p));var result=source.stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),schedules?"P007_SCHEDULE_LIST":"P007_LIST","attendance.shift_change_request",null);return result;}
    private ShiftChangeService.ShiftChange view(SessionPrincipal p,ShiftChangeService.ShiftChange v){if(p.context().employeeId().equals(v.ownerEmployeeId())||authorization.authorizeAction(p.context(),MANAGE).allowed()||authorization.authorizeAction(p.context(),CHANGE).allowed()||authorization.authorizeAction(p.context(),REVIEW).allowed())return v;return v.metadataOnly();}
    private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}
    private static AuthorizationTarget target(ShiftChangeService.ShiftChange v){return new AuthorizationTarget(v.tenantId(),v.ownerEmployeeId(),v.ownerCenterId(),null,v.ownerEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}
    private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P007 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P007 request cannot be hashed",e);}}
}
