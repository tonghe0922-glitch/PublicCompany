package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.learning.LearningAssignmentService;
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
@RequestMapping("/api/v1/processes/P010")
public final class P010LearningController {

  private static final String MANAGE = "p010.learning.manage",
      READ = "p010.learning.read",
      MONITOR = "p010.learning.monitor";

  private final LearningAssignmentService learning;

  private final AuthorizationService authorization;

  private final JdbcSecurityAuditService audit;

  private final ObjectMapper mapper;

  public P010LearningController(
      LearningAssignmentService learning,
      AuthorizationService authorization,
      JdbcSecurityAuditService audit,
      ObjectMapper mapper) {
    this.learning = learning;
    this.authorization = authorization;
    this.audit = audit;
    this.mapper = mapper;
  }

  @PostMapping("/learning-assignments")
  public LearningAssignmentService.Assignment create(
      @AuthenticationPrincipal SessionPrincipal p,
      @RequestHeader("Idempotency-Key") String key,
      @RequestBody LearningAssignmentService.CreateCommand c) {
    require(authorization.authorizeAction(p.context(), MANAGE));
    var target =
        new AuthorizationTarget(
            p.context().tenantId(),
            c.ownerEmployeeId(),
            p.context().orgId(),
            null,
            c.ownerEmployeeId());
    require(authorization.authorizeData(p.context(), MANAGE, target));
    audit.recordOperation(p.context(), "P010_CREATE_ATTEMPT", "learning.learning_assignment", null);
    var r = learning.create(context(p), key, hash(c), c);
    audit.recordOperation(p.context(), "P010_CREATED", "learning.learning_assignment", r.id());
    return r;
  }

  @GetMapping("/learning-assignments/{id}")
  public LearningAssignmentService.Assignment get(
      @AuthenticationPrincipal SessionPrincipal p, @PathVariable UUID id) {
    String permission = readPermission(p);
    var v =
        learning
            .find(context(p), id)
            .orElseThrow(() -> new IllegalArgumentException("P010 learning assignment not found"));
    require(authorization.authorizeData(p.context(), permission, target(v)));
    audit.recordOperation(p.context(), "P010_READ", "learning.learning_assignment", id);
    return view(p, v);
  }

  @GetMapping("/learning-assignments")
  public List<LearningAssignmentService.Assignment> list(
      @AuthenticationPrincipal SessionPrincipal p) {
    String permission = readPermission(p);
    var r =
        learning.list(context(p)).stream()
            .filter(v -> authorization.authorizeData(p.context(), permission, target(v)).allowed())
            .map(v -> view(p, v))
            .toList();
    audit.recordOperation(p.context(), "P010_LIST", "learning.learning_assignment", null);
    return r;
  }

  @PostMapping("/learning-assignments/{id}/actions/{actionCode}")
  public LearningAssignmentService.Assignment act(
      @AuthenticationPrincipal SessionPrincipal p,
      @PathVariable UUID id,
      @PathVariable String actionCode,
      @RequestHeader("Idempotency-Key") String key,
      @RequestBody LearningAssignmentService.ActionCommand c) {
    var current =
        learning
            .find(context(p), id)
            .orElseThrow(() -> new IllegalArgumentException("P010 learning assignment not found"));
    String permission = learning.permissionForNode(current), action = safe(actionCode);
    require(authorization.authorizeAction(p.context(), permission));
    require(authorization.authorizeData(p.context(), permission, target(current)));
    audit.recordOperation(
        p.context(), "P010_ACTION_ATTEMPT_" + action, "learning.learning_assignment", id);
    var r =
        learning.act(context(p), id, action, key, hash(Map.of("actionCode", action, "body", c)), c);
    audit.recordOperation(p.context(), "P010_ACTION_" + action, "learning.learning_assignment", id);
    return view(p, r);
  }

  private LearningAssignmentService.Assignment view(
      SessionPrincipal p, LearningAssignmentService.Assignment v) {
    return authorization.authorizeAction(p.context(), MONITOR).allowed()
            && !authorization.authorizeAction(p.context(), READ).allowed()
        ? v.metadataOnly()
        : v;
  }

  private String readPermission(SessionPrincipal p) {
    if (authorization.authorizeAction(p.context(), READ).allowed()) {
      return READ;
    }
    require(authorization.authorizeAction(p.context(), MONITOR));
    return MONITOR;
  }

  private static AuthorizationTarget target(LearningAssignmentService.Assignment v) {
    return new AuthorizationTarget(
        v.tenantId(), v.ownerEmployeeId(), v.ownerCenterId(), null, v.ownerEmployeeId());
  }

  private static DatabaseSecurityContext context(SessionPrincipal p) {
    var s = p.context();
    return new DatabaseSecurityContext(
        s.tenantId(),
        s.userId(),
        s.identityId(),
        s.employeeId(),
        s.appointmentId(),
        s.orgId(),
        s.positionId());
  }

  private static void require(AuthorizationDecision d) {
    if (!d.allowed()) {
      throw new AccessDeniedException("P010 authorization denied: " + d.reason());
    }
  }

  private static String safe(String v) {
    if (v == null) {
      return "INVALID";
    }
    String n = v.trim().toUpperCase();
    return n.matches("[A-Z0-9_]{1,32}") ? n : "INVALID";
  }

  private String hash(Object v) {
    try {
      return HexFormat.of()
          .formatHex(MessageDigest.getInstance("SHA-256").digest(mapper.writeValueAsBytes(v)));
    } catch (Exception e) {
      throw new IllegalArgumentException("P010 request cannot be hashed", e);
    }
  }
}
