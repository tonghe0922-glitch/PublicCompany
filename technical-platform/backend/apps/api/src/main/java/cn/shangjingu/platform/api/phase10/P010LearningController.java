package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.workflow.LearningService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
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
@RequestMapping("/api/v1/processes/P010")
public final class P010LearningController {
    public static final String READ="p010.learning.read",MANAGE="p010.learning.manage",COMPLETE="p010.learning.complete",EXAM="p010.learning.exam",CERTIFY="p010.learning.certify",MONITOR="p010.learning.monitor";
    private final LearningService learning;private final AuthorizationService auth;private final JdbcSecurityAuditService audit;private final ObjectMapper mapper;
    public P010LearningController(LearningService learning,AuthorizationService auth,JdbcSecurityAuditService audit,ObjectMapper mapper){this.learning=learning;this.auth=auth;this.audit=audit;this.mapper=mapper;}
    @GetMapping("/assignments") public List<LearningService.Aggregate> list(@AuthenticationPrincipal SessionPrincipal p){boolean read=allowed(p,READ),manage=allowed(p,MANAGE),cert=allowed(p,CERTIFY),monitor=allowed(p,MONITOR);if(!read&&!manage&&!cert&&!monitor)throw denied("no P010 read surface");return learning.list(ctx(p)).stream().map(a->project(p,a,read,manage,cert,monitor)).filter(java.util.Objects::nonNull).toList();}
    @GetMapping("/assignments/{id}") public LearningService.Aggregate get(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id){boolean read=allowed(p,READ),manage=allowed(p,MANAGE),cert=allowed(p,CERTIFY),monitor=allowed(p,MONITOR);if(!read&&!manage&&!cert&&!monitor)throw denied("no P010 read surface");var a=learning.find(ctx(p),id).orElseThrow(()->new IllegalArgumentException("P010 assignment not found"));var v=project(p,a,read,manage,cert,monitor);if(v==null)throw denied("P010 data scope denied");return v;}
    @PostMapping("/assignments/{id}/learning-progress") public LearningService.Aggregate progress(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@RequestHeader("Idempotency-Key")String key,@RequestBody LearningService.ProgressCommand c){require(auth.authorizeAction(p.context(),COMPLETE));owned(p,id,COMPLETE);audit.recordOperation(p.context(),"P010_PROGRESS_ATTEMPT","learning.learning_assignment",id);var r=learning.progress(ctx(p),id,key,hash(c),c);audit.recordOperation(p.context(),"P010_PROGRESS","learning.learning_assignment",id);return r;}
    @PostMapping("/assignments/{id}/exam") public LearningService.Aggregate exam(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@RequestHeader("Idempotency-Key")String key,@RequestBody LearningService.ExamCommand c){require(auth.authorizeAction(p.context(),EXAM));owned(p,id,EXAM);audit.recordOperation(p.context(),"P010_EXAM_ATTEMPT","learning.learning_assignment",id);var r=learning.exam(ctx(p),id,key,hash(c),c);audit.recordOperation(p.context(),"P010_EXAM","learning.learning_assignment",id);return r;}
    @PostMapping("/assignments/{id}/practical") public LearningService.Aggregate practical(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@RequestHeader("Idempotency-Key")String key,@RequestBody LearningService.PracticalCommand c){require(auth.authorizeAction(p.context(),COMPLETE));owned(p,id,COMPLETE);audit.recordOperation(p.context(),"P010_PRACTICAL_ATTEMPT","learning.learning_assignment",id);var r=learning.practical(ctx(p),id,key,hash(c),c);audit.recordOperation(p.context(),"P010_PRACTICAL","learning.learning_assignment",id);return r;}
    @PostMapping("/assignments/{id}/actions/{actionCode}") public LearningService.Aggregate action(@AuthenticationPrincipal SessionPrincipal p,@PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key")String key,@RequestBody LearningService.ActionCommand c){String action=safe(actionCode);String permission=(action.equals("CERTIFY")||action.equals("RETURN_FOR_TRAINING"))?CERTIFY:MANAGE;require(auth.authorizeAction(p.context(),permission));var a=learning.find(ctx(p),id).orElseThrow(()->new IllegalArgumentException("P010 assignment not found"));require(auth.authorizeData(p.context(),permission,target(p,a.record())));audit.recordOperation(p.context(),"P010_ACTION_ATTEMPT_"+action,"learning.learning_assignment",id);var r=learning.action(ctx(p),id,action,key,hash(c),c);audit.recordOperation(p.context(),"P010_ACTION_"+action,"learning.learning_assignment",id);return r;}
    private LearningService.Aggregate owned(SessionPrincipal p,UUID id,String permission){var a=learning.find(ctx(p),id).orElseThrow(()->new IllegalArgumentException("P010 assignment not found"));if(!p.context().employeeId().equals(a.record().ownerEmployeeId()))throw denied("employee operation is self-only");require(auth.authorizeData(p.context(),permission,target(p,a.record())));return a;}
    private LearningService.Aggregate project(SessionPrincipal p,LearningService.Aggregate a,boolean read,boolean manage,boolean cert,boolean monitor){var t=target(p,a.record());if(manage&&auth.authorizeData(p.context(),MANAGE,t).allowed())return a;if(cert&&auth.authorizeData(p.context(),CERTIFY,t).allowed())return a;if(read&&p.context().employeeId().equals(a.record().ownerEmployeeId())&&auth.authorizeData(p.context(),READ,t).allowed())return a;if(monitor&&auth.authorizeData(p.context(),MONITOR,t).allowed())return a.metadataOnly();return null;}
    private static AuthorizationTarget target(SessionPrincipal p,LearningService.LearningRecord r){return new AuthorizationTarget(r.tenantId(),r.ownerEmployeeId(),r.ownerCenterId(),p.context().positionId(),r.ownerEmployeeId());}private boolean allowed(SessionPrincipal p,String permission){return auth.authorizeAction(p.context(),permission).allowed();}private static DatabaseSecurityContext ctx(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}private static void require(AuthorizationDecision d){if(!d.allowed())throw denied(d.reason().toString());}private static AccessDeniedException denied(String r){return new AccessDeniedException("P010 authorization denied: "+r);}private static String safe(String a){if(a==null)return"INVALID";String x=a.trim().toUpperCase(Locale.ROOT);return x.matches("[A-Z0-9_]{1,40}")?x:"INVALID";}private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P010 request cannot be hashed",e);}}
}
