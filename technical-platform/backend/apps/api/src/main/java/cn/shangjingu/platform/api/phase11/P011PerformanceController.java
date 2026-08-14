package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.performance.PerformanceCycleService;
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
@RequestMapping("/api/v1/processes/P011")
public final class P011PerformanceController {
    private static final String MANAGE="p011.performance.manage",READ="p011.performance.read",MONITOR="p011.performance.monitor";
    private final PerformanceCycleService performance;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P011PerformanceController(PerformanceCycleService performance,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.performance=performance;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/performance-cycles") public PerformanceCycleService.Cycle create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody PerformanceCycleService.CreateCommand c){require(authorization.authorizeAction(p.context(),MANAGE));var target=new AuthorizationTarget(p.context().tenantId(),c.ownerEmployeeId(),p.context().orgId(),null,c.ownerEmployeeId());require(authorization.authorizeData(p.context(),MANAGE,target));audit.recordOperation(p.context(),"P011_CREATE_ATTEMPT","performance.performance_cycle",null);var r=performance.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P011_CREATED","performance.performance_cycle",r.id());return r;}
    @GetMapping("/performance-cycles/{id}") public PerformanceCycleService.Cycle get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=performance.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P011 performance cycle not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P011_READ","performance.performance_cycle",id);return view(p,v);}
    @GetMapping("/performance-cycles") public List<PerformanceCycleService.Cycle> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var r=performance.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P011_LIST","performance.performance_cycle",null);return r;}
    @PostMapping("/performance-cycles/{id}/actions/{actionCode}") public PerformanceCycleService.Cycle act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody PerformanceCycleService.ActionCommand c){var current=performance.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P011 performance cycle not found"));String action=safe(actionCode),permission=performance.permissionForAction(current,action);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));audit.recordOperation(p.context(),"P011_ACTION_ATTEMPT_"+action,"performance.performance_cycle",id);var r=performance.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P011_ACTION_"+action,"performance.performance_cycle",id);return view(p,r);}
    private PerformanceCycleService.Cycle view(SessionPrincipal p,PerformanceCycleService.Cycle v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}
    private static AuthorizationTarget target(PerformanceCycleService.Cycle v){return new AuthorizationTarget(v.tenantId(),v.ownerEmployeeId(),v.ownerCenterId(),null,v.ownerEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P011 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P011 request cannot be hashed",e);}}
}
