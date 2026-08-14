package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.reward.DisciplineCaseService;
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
@RequestMapping("/api/v1/processes/P014")
public final class P014DisciplineController {
    private static final String MANAGE="p014.discipline.manage",APPEAL="p014.discipline.appeal",READ="p014.discipline.read",MONITOR="p014.discipline.monitor";
    private final DisciplineCaseService discipline;private final AuthorizationService authorization;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P014DisciplineController(DisciplineCaseService discipline,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){this.discipline=discipline;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}
    @PostMapping("/discipline-cases") public DisciplineCaseService.DisciplineCase create(@AuthenticationPrincipal SessionPrincipal p,@RequestHeader("Idempotency-Key")String key,@RequestBody DisciplineCaseService.CreateCommand c){String permission=createPermission(p);AuthorizationTarget target=new AuthorizationTarget(p.context().tenantId(),c.affectedEmployeeId(),p.context().orgId(),null,c.affectedEmployeeId());require(authorization.authorizeData(p.context(),permission,target));audit.recordOperation(p.context(),"P014_CREATE_ATTEMPT","reward.discipline_case",null);var r=discipline.create(context(p),key,hash(c),c);audit.recordOperation(p.context(),"P014_CREATED","reward.discipline_case",r.id());return view(p,r);}
    @GetMapping("/discipline-cases/{id}") public DisciplineCaseService.DisciplineCase get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){String permission=readPermission(p);var v=discipline.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P014 discipline case not found"));require(authorization.authorizeData(p.context(),permission,target(v)));audit.recordOperation(p.context(),"P014_READ","reward.discipline_case",id);return view(p,v);}
    @GetMapping("/discipline-cases") public List<DisciplineCaseService.DisciplineCase> list(@AuthenticationPrincipal SessionPrincipal p){String permission=readPermission(p);var values=discipline.list(context(p)).stream().filter(v->authorization.authorizeData(p.context(),permission,target(v)).allowed()).map(v->view(p,v)).toList();audit.recordOperation(p.context(),"P014_LIST","reward.discipline_case",null);return values;}
    @PostMapping("/discipline-cases/{id}/actions/{actionCode}") public DisciplineCaseService.DisciplineCase act(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody DisciplineCaseService.ActionCommand c){var current=discipline.find(context(p),id).orElseThrow(()->new IllegalArgumentException("P014 discipline case not found"));String action=safe(actionCode),permission=discipline.permissionForAction(current,action);require(authorization.authorizeAction(p.context(),permission));require(authorization.authorizeData(p.context(),permission,target(current)));audit.recordOperation(p.context(),"P014_ACTION_ATTEMPT_"+action,"reward.discipline_case",id);var r=discipline.act(context(p),id,action,key,hash(Map.of("actionCode",action,"body",c)),c);audit.recordOperation(p.context(),"P014_ACTION_"+action,"reward.discipline_case",id);return view(p,r);}
    private String createPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),MANAGE).allowed())return MANAGE;require(authorization.authorizeAction(p.context(),APPEAL));return APPEAL;}private DisciplineCaseService.DisciplineCase view(SessionPrincipal p,DisciplineCaseService.DisciplineCase v){return authorization.authorizeAction(p.context(),MONITOR).allowed()&&!authorization.authorizeAction(p.context(),READ).allowed()?v.metadataOnly():v;}private String readPermission(SessionPrincipal p){if(authorization.authorizeAction(p.context(),READ).allowed())return READ;require(authorization.authorizeAction(p.context(),MONITOR));return MONITOR;}
    private static AuthorizationTarget target(DisciplineCaseService.DisciplineCase v){return new AuthorizationTarget(v.tenantId(),v.affectedEmployeeId(),v.ownerCenterId(),null,v.affectedEmployeeId());}private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P014 authorization denied: "+d.reason());}private static String safe(String v){if(v==null)return"INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P014 request cannot be hashed",e);}}
}
