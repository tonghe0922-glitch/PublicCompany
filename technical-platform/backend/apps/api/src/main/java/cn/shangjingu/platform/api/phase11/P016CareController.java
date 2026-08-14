package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.welfare.P016CareService;
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
@RequestMapping("/api/v1/processes/P016/care-cases")
public final class P016CareController {
    private static final String READ="p016.welfare.read",MANAGE="p016.welfare.manage",MONITOR="p016.welfare.monitor";
    private final P016CareService care;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P016CareController(P016CareService care,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.care=care;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping public P016CareService.CareCase create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody P016CareService.CreateCommand c){String permission=createPermission(p);require(authorization.authorizeData(p.context(),permission,new AuthorizationTarget(p.context().tenantId(),c.affectedEmployeeId(),p.context().orgId(),null,c.affectedEmployeeId())));requireBusinessActor(p);audit.recordOperation(p.context(),"P016_CREATE_ATTEMPT","welfare.care_case",null);var r=care.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P016_CREATED","welfare.care_case",r.id());return view(p,r);}
    @GetMapping("/{id}") public P016CareService.CareCase get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=care.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P016 care case not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P016_READ","welfare.care_case",id);return view(p,v);}
    @GetMapping public List<P016CareService.CareCase> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var values=care.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P016_LIST","welfare.care_case",null);return values;}
    @PostMapping("/{id}/actions/{actionCode}") public P016CareService.CareCase act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody P016CareService.ActionCommand c){var current=care.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P016 care case not found"));String action=safe(actionCode),permission=care.permissionForAction(action);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));requireBusinessActor(p);audit.recordOperation(p.context(),"P016_ACTION_ATTEMPT_"+action,"welfare.care_case",id);var r=care.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P016_ACTION_"+action,"welfare.care_case",id);return view(p,r);}
    private String createPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),MANAGE).allowed())return MANAGE;require(authorization.authorizeAction(p.context(),READ));return READ;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}private P016CareService.CareCase view(SessionPrincipal p,P016CareService.CareCase v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private void requireBusinessActor(SessionPrincipal p){if(authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed())throw new AccessDeniedException("P016 technical monitor cannot perform business actions");}
    private static AuthorizationTarget target(P016CareService.CareCase v){return new AuthorizationTarget(v.tenantId(),v.affectedEmployeeId(),v.ownerCenterId(),null,v.affectedEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P016 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P016 request cannot be hashed",e);}}
}
