package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.hr.promotion.PromotionRequestService;
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
@RequestMapping("/api/v1/processes/P012")
public final class P012PromotionController {
    private static final String READ="p012.promotion.read",MANAGE="p012.promotion.manage",MONITOR="p012.promotion.monitor";
    private final PromotionRequestService promotion;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P012PromotionController(PromotionRequestService promotion,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.promotion=promotion;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/promotion-requests") public PromotionRequestService.Request create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody PromotionRequestService.CreateCommand c){String permission=p.context().employeeId().equals(c.ownerEmployeeId())?READ:MANAGE;require(authorization.authorizeAction(p.context(),permission));var target=new AuthorizationTarget(p.context().tenantId(),c.ownerEmployeeId(),p.context().orgId(),null,c.ownerEmployeeId());require(authorization.authorizeData(p.context(),permission,target));audit.recordOperation(p.context(),"P012_CREATE_ATTEMPT","hr.promotion_request",null);var r=promotion.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P012_CREATED","hr.promotion_request",r.id());return view(p,r);}
    @GetMapping("/promotion-requests/{id}") public PromotionRequestService.Request get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=promotion.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P012 promotion request not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P012_READ","hr.promotion_request",id);return view(p,v);}
    @GetMapping("/promotion-requests") public List<PromotionRequestService.Request> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var values=promotion.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P012_LIST","hr.promotion_request",null);return values;}
    @PostMapping("/promotion-requests/{id}/actions/{actionCode}") public PromotionRequestService.Request act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody PromotionRequestService.ActionCommand c){var current=promotion.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P012 promotion request not found"));String action=safe(actionCode);String permission="SUBMIT".equals(action)&&!p.context().employeeId().equals(current.ownerEmployeeId())?MANAGE:promotion.permissionForAction(current,action);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));audit.recordOperation(p.context(),"P012_ACTION_ATTEMPT_"+action,"hr.promotion_request",id);var r=promotion.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P012_ACTION_"+action,"hr.promotion_request",id);return view(p,r);}
    private PromotionRequestService.Request view(SessionPrincipal p,PromotionRequestService.Request v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}
    private static AuthorizationTarget target(PromotionRequestService.Request v){return new AuthorizationTarget(v.tenantId(),v.ownerEmployeeId(),v.ownerCenterId(),null,v.ownerEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P012 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P012 request cannot be hashed",e);}}
}
