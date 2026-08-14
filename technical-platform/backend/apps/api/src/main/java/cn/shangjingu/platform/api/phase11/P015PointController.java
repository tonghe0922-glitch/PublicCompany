package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.reward.PointLedgerService;
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
@RequestMapping("/api/v1/processes/P015")
public final class P015PointController {
    private static final String MANAGE="p015.points.manage",READ="p015.points.read",MONITOR="p015.points.monitor";private final PointLedgerService points;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P015PointController(PointLedgerService points,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.points=points;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/point-rules") public PointLedgerService.RuleConfiguration createRule(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody PointLedgerService.RuleDraftCommand c){require(authorization.authorizeAction(p.context(),MANAGE));audit.recordOperation(p.context(),"P015_RULE_CREATE_ATTEMPT","reward.point_rule_version",null);var r=points.createRule(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P015_RULE_CREATED","reward.point_rule_version",r.rule().id());return r;}
    @PostMapping("/point-rules/{id}/publish") public PointLedgerService.RuleConfiguration publishRule(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@RequestHeader("Idempotency-Key")String key){require(authorization.authorizeAction(p.context(),MANAGE));audit.recordOperation(p.context(),"P015_RULE_PUBLISH_ATTEMPT","reward.point_rule_version",id);var r=points.publishRule(context(p),id,key,hash(Map.of("ruleVersionId",id,"action","PUBLISH")));audit.recordOperation(p.context(),"P015_RULE_PUBLISHED","reward.point_rule_version",id);return r;}
    @GetMapping("/point-rules") public List<PointLedgerService.RuleConfiguration> rules(@AuthenticationPrincipal SessionPrincipal p){if(!authorization.authorizeAction(p.context(),MANAGE).allowed())require(authorization.authorizeAction(p.context(),MONITOR));var r=points.rules(context(p));audit.recordOperation(p.context(),"P015_RULE_LIST","reward.point_rule_version",null);return r;}
    @PostMapping("/point-transactions") public PointLedgerService.PointTransaction create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody PointLedgerService.CreateCommand c){requireBusinessActor(p);require(authorization.authorizeAction(p.context(),MANAGE));AuthorizationTarget target=new AuthorizationTarget(p.context().tenantId(),c.affectedEmployeeId(),p.context().orgId(),null,c.affectedEmployeeId());require(authorization.authorizeData(p.context(),MANAGE,target));audit.recordOperation(p.context(),"P015_CREATE_ATTEMPT","reward.point_transaction",null);var r=points.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P015_CREATED","reward.point_transaction",r.id());return view(p,r);}
    @GetMapping("/point-transactions/{id}") public PointLedgerService.PointTransaction get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=points.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P015 point transaction not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P015_READ","reward.point_transaction",id);return view(p,v);}
    @GetMapping("/point-transactions") public List<PointLedgerService.PointTransaction> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var values=points.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P015_LIST","reward.point_transaction",null);return values;}
    @PostMapping("/point-transactions/{id}/actions/{actionCode}") public PointLedgerService.PointTransaction act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody PointLedgerService.ActionCommand c){requireBusinessActor(p);var current=points.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P015 point transaction not found"));String action=safe(actionCode),permission=points.permissionForAction(action);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));audit.recordOperation(p.context(),"P015_ACTION_ATTEMPT_"+action,"reward.point_transaction",id);var r=points.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P015_ACTION_"+action,"reward.point_transaction",id);return view(p,r);}
    private PointLedgerService.PointTransaction view(SessionPrincipal p,PointLedgerService.PointTransaction v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}private void requireBusinessActor(SessionPrincipal p){if(authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed())throw new AccessDeniedException("P015 technical metadata identity cannot execute business actions");}private static AuthorizationTarget target(PointLedgerService.PointTransaction v){return new AuthorizationTarget(v.tenantId(),v.affectedEmployeeId(),v.ownerCenterId(),null,v.affectedEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P015 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P015 request cannot be hashed",e);}}
}
