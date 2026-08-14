package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.attendance.OvertimeService;
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
@RequestMapping("/api/v1/processes/P009")
public final class P009OvertimeController {
    private static final String SUBMIT="p009.overtime.submit",READ="p009.overtime.read",MONITOR="p009.overtime.monitor";private final OvertimeService overtime;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P009OvertimeController(OvertimeService overtime,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.overtime=overtime;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/overtime-requests") public OvertimeService.Overtime create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody OvertimeService.CreateCommand c){require(authorization.authorizeAction(p.context(),SUBMIT));require(authorization.authorizeData(p.context(),SUBMIT,self(p)));audit.recordOperation(p.context(),"P009_CREATE_ATTEMPT","attendance.overtime_request",null);var r=overtime.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P009_CREATED","attendance.overtime_request",r.id());return r;}
    @GetMapping("/overtime-requests/{id}") public OvertimeService.Overtime get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=overtime.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P009 overtime request not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P009_READ","attendance.overtime_request",id);return view(p,v);}
    @GetMapping("/overtime-requests") public List<OvertimeService.Overtime> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var r=overtime.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P009_LIST","attendance.overtime_request",null);return r;}
    @PostMapping("/overtime-requests/{id}/actions/{actionCode}") public OvertimeService.Overtime act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody OvertimeService.ActionCommand c){var current=overtime.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P009 overtime request not found"));String permission=overtime.permissionForNode(current),action=safe(actionCode);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));audit.recordOperation(p.context(),"P009_ACTION_ATTEMPT_"+action,"attendance.overtime_request",id);var r=overtime.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P009_ACTION_"+action,"attendance.overtime_request",id);return view(p,r);}
    private OvertimeService.Overtime view(SessionPrincipal p,OvertimeService.Overtime v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}
    private static AuthorizationTarget self(SessionPrincipal p){return new AuthorizationTarget(p.context().tenantId(),p.context().employeeId(),p.context().orgId(),null,p.context().employeeId());}private static AuthorizationTarget target(OvertimeService.Overtime v){return new AuthorizationTarget(v.tenantId(),v.ownerEmployeeId(),v.ownerCenterId(),null,v.ownerEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P009 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P009 request cannot be hashed",e);}}
}
