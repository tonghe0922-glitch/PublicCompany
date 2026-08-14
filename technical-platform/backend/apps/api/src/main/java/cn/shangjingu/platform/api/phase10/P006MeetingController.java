package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.collaboration.MeetingService;
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
@RequestMapping("/api/v1/processes/P006/meetings")
public final class P006MeetingController {
    private static final String CREATE="p006.meeting.create", READ="p006.meeting.read", MANAGE="p006.meeting.manage",
            ACTION="p006.meeting.action", ACCEPT="p006.meeting.accept";
    private final MeetingService meetings; private final AuthorizationService authorization;
    private final JdbcSecurityAuditService audit; private final ObjectMapper mapper;
    public P006MeetingController(MeetingService meetings,AuthorizationService authorization,JdbcSecurityAuditService audit,ObjectMapper mapper){
        this.meetings=meetings;this.authorization=authorization;this.audit=audit;this.mapper=mapper;}

    @PostMapping public MeetingService.Meeting create(@AuthenticationPrincipal SessionPrincipal principal,
            @RequestHeader("Idempotency-Key") String key,@RequestBody MeetingService.CreateCommand command){
        require(authorization.authorizeAction(principal.context(),CREATE));
        require(authorization.authorizeData(principal.context(),CREATE,new AuthorizationTarget(principal.context().tenantId(),principal.context().employeeId(),principal.context().orgId(),principal.context().positionId(),principal.context().employeeId())));
        audit.recordOperation(principal.context(),"P006_CREATE_ATTEMPT","collaboration.meeting",null);
        var result=meetings.create(context(principal),key,hash(command),command);
        audit.recordOperation(principal.context(),"P006_CREATED","collaboration.meeting",result.id());return view(principal,result);
    }
    @GetMapping("/{id}") public MeetingService.Meeting get(@AuthenticationPrincipal SessionPrincipal principal,@PathVariable UUID id){
        String permission=readPermission(principal);var meeting=meetings.find(context(principal),id).orElseThrow(()->new IllegalArgumentException("P006 meeting not found"));
        require(authorization.authorizeData(principal.context(),permission,target(meeting)));audit.recordOperation(principal.context(),"P006_READ","collaboration.meeting",id);return view(principal,meeting);}
    @GetMapping public List<MeetingService.Meeting> list(@AuthenticationPrincipal SessionPrincipal principal){
        String permission=readPermission(principal);var result=meetings.list(context(principal)).stream()
                .filter(m->authorization.authorizeData(principal.context(),permission,target(m)).allowed()).map(m->view(principal,m)).toList();
        audit.recordOperation(principal.context(),"P006_LIST","collaboration.meeting",null);return result;}
    @PostMapping("/{id}/actions/{actionCode}") public MeetingService.Meeting act(@AuthenticationPrincipal SessionPrincipal principal,
            @PathVariable UUID id,@PathVariable String actionCode,@RequestHeader("Idempotency-Key") String key,@RequestBody MeetingService.ActionCommand command){
        var current=meetings.find(context(principal),id).orElseThrow(()->new IllegalArgumentException("P006 meeting not found"));
        String normalized=safe(actionCode);String permission=meetings.ownerAction(current,normalized)?CREATE:("S09".equals(current.currentNodeCode())?ACCEPT:(SetHolder.EXECUTOR_NODES.contains(current.currentNodeCode())?ACTION:MANAGE));
        require(authorization.authorizeAction(principal.context(),permission));require(authorization.authorizeData(principal.context(),permission,target(current)));
        audit.recordOperation(principal.context(),"P006_ACTION_ATTEMPT_"+normalized,"collaboration.meeting",id);
        var result=meetings.act(context(principal),id,normalized,key,hash(Map.of("actionCode",normalized,"body",command)),command);
        audit.recordOperation(principal.context(),"P006_ACTION_"+normalized,"collaboration.meeting",id);return view(principal,result);}

    private MeetingService.Meeting view(SessionPrincipal principal,MeetingService.Meeting meeting){
        if(principal.context().employeeId().equals(meeting.ownerEmployeeId())||authorization.authorizeAction(principal.context(),MANAGE).allowed()
                ||authorization.authorizeAction(principal.context(),ACTION).allowed()||authorization.authorizeAction(principal.context(),ACCEPT).allowed())return meeting;
        return meeting.metadataOnly();}
    private static AuthorizationTarget target(MeetingService.Meeting m){return new AuthorizationTarget(m.tenantId(),m.ownerEmployeeId(),m.ownerCenterId(),null,m.ownerEmployeeId());}
    private static DatabaseSecurityContext context(SessionPrincipal p){var s=p.context();return new DatabaseSecurityContext(s.tenantId(),s.userId(),s.identityId(),s.employeeId(),s.appointmentId(),s.orgId(),s.positionId());}
    private static void require(AuthorizationDecision d){if(!d.allowed())throw new AccessDeniedException("P006 authorization denied: "+d.reason());}
    private String readPermission(SessionPrincipal principal){if(authorization.authorizeAction(principal.context(),READ).allowed())return READ;require(authorization.authorizeAction(principal.context(),"p006.meeting.monitor"));return "p006.meeting.monitor";}
    private static String safe(String v){if(v==null)return "INVALID";String n=v.trim().toUpperCase();return n.matches("[A-Z0-9_]{1,32}")?n:"INVALID";}
    private String hash(Object v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));}catch(Exception e){throw new IllegalArgumentException("P006 request cannot be hashed",e);}}
    private static final class SetHolder{private static final java.util.Set<String> EXECUTOR_NODES=java.util.Set.of("S04","S08");}
}
