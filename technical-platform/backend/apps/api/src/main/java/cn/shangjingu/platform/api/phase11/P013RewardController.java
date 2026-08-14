package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.reward.RewardCaseService;
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
@RequestMapping("/api/v1/processes/P013")
public final class P013RewardController {
    private static final String MANAGE="p013.reward.manage",READ="p013.reward.read",MONITOR="p013.reward.monitor";
    private final RewardCaseService rewards;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P013RewardController(RewardCaseService rewards,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.rewards=rewards;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/reward-cases") public RewardCaseService.RewardCase create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody RewardCaseService.CreateCommand c){require(authorization.authorizeAction(p.context(),MANAGE));AuthorizationTarget target=new AuthorizationTarget(p.context().tenantId(),c.ownerEmployeeId(),p.context().orgId(),null,c.ownerEmployeeId());require(authorization.authorizeData(p.context(),MANAGE,target));audit.recordOperation(p.context(),"P013_CREATE_ATTEMPT","reward.reward_case",null);var r=rewards.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P013_CREATED","reward.reward_case",r.id());return view(p,r);}
    @GetMapping("/reward-cases/{id}") public RewardCaseService.RewardCase get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=rewards.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P013 reward case not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P013_READ","reward.reward_case",id);return view(p,v);}
    @GetMapping("/reward-cases") public List<RewardCaseService.RewardCase> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var values=rewards.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P013_LIST","reward.reward_case",null);return values;}
    @PostMapping("/reward-cases/{id}/actions/{actionCode}") public RewardCaseService.RewardCase act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody RewardCaseService.ActionCommand c){var current=rewards.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P013 reward case not found"));String action=safe(actionCode),permission=rewards.permissionForAction(current,action);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));audit.recordOperation(p.context(),"P013_ACTION_ATTEMPT_"+action,"reward.reward_case",id);var r=rewards.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P013_ACTION_"+action,"reward.reward_case",id);return view(p,r);}
    private RewardCaseService.RewardCase view(SessionPrincipal p,RewardCaseService.RewardCase v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}
    private static AuthorizationTarget target(RewardCaseService.RewardCase v){return new AuthorizationTarget(v.tenantId(),v.ownerEmployeeId(),v.ownerCenterId(),null,v.ownerEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P013 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P013 request cannot be hashed",e);}}
}
