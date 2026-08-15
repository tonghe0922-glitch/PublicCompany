package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.attendance.LeaveService;
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
@RequestMapping("/api/v1/processes/P008")
public final class P008LeaveController {

  private static final String SUBMIT = "p008.leave.submit",
      READ = "p008.leave.read",
      REVIEW = "p008.leave.review",
      MANAGE = "p008.leave.manage",
      MONITOR = "p008.leave.monitor";

  private final LeaveService leaves;

  private final AuthorizationService authorization;

  private final JdbcSecurityAuditService audit;

  private final ObjectMapper mapper;

  public P008LeaveController(
      LeaveService leaves,
      AuthorizationService authorization,
      JdbcSecurityAuditService audit,
      ObjectMapper mapper) {
    this.leaves = leaves;
    this.authorization = authorization;
    this.audit = audit;
    this.mapper = mapper;
  }

  @PostMapping("/leaves")
  public LeaveService.Leave create(
      @AuthenticationPrincipal SessionPrincipal principal,
      @RequestHeader("Idempotency-Key") String key,
      @RequestBody LeaveService.CreateCommand command) {
    require(authorization.authorizeAction(principal.context(), SUBMIT));
    require(authorization.authorizeData(principal.context(), SUBMIT, selfTarget(principal)));
    audit.recordOperation(
        principal.context(), "P008_CREATE_ATTEMPT", "attendance.leave_request", null);
    var result = leaves.create(context(principal), key, hash(command), command);
    audit.recordOperation(
        principal.context(), "P008_CREATED", "attendance.leave_request", result.id());
    return result;
  }

  @GetMapping("/leaves/{id}")
  public LeaveService.Leave get(
      @AuthenticationPrincipal SessionPrincipal principal, @PathVariable UUID id) {
    String permission = readPermission(principal);
    var value =
        leaves
            .find(context(principal), id)
            .orElseThrow(() -> new IllegalArgumentException("P008 leave not found"));
    require(authorization.authorizeData(principal.context(), permission, target(value)));
    audit.recordOperation(principal.context(), "P008_READ", "attendance.leave_request", id);
    return view(principal, value);
  }

  @GetMapping("/leaves")
  public List<LeaveService.Leave> list(@AuthenticationPrincipal SessionPrincipal principal) {
    String permission = readPermission(principal);
    var result =
        leaves.list(context(principal)).stream()
            .filter(
                v ->
                    authorization
                        .authorizeData(principal.context(), permission, target(v))
                        .allowed())
            .map(v -> view(principal, v))
            .toList();
    audit.recordOperation(principal.context(), "P008_LIST", "attendance.leave_request", null);
    return result;
  }

  @GetMapping("/quota-ledger")
  public List<LeaveService.QuotaEntry> quotaLedger(
      @AuthenticationPrincipal SessionPrincipal principal) {
    String permission = readPermission(principal);
    boolean monitor = MONITOR.equals(permission);
    var result =
        leaves.quotaLedger(context(principal)).stream()
            .filter(
                v ->
                    authorization
                        .authorizeData(
                            principal.context(),
                            permission,
                            new AuthorizationTarget(
                                principal.context().tenantId(),
                                v.employeeId(),
                                v.ownerCenterId(),
                                null,
                                v.employeeId()))
                        .allowed())
            .map(v -> monitor ? v.metadataOnly() : v)
            .toList();
    audit.recordOperation(
        principal.context(), "P008_QUOTA_LEDGER_READ", "attendance.leave_quota_ledger", null);
    return result;
  }

  @PostMapping("/leaves/{id}/actions/{actionCode}")
  public LeaveService.Leave act(
      @AuthenticationPrincipal SessionPrincipal principal,
      @PathVariable UUID id,
      @PathVariable String actionCode,
      @RequestHeader("Idempotency-Key") String key,
      @RequestBody LeaveService.ActionCommand command) {
    var current =
        leaves
            .find(context(principal), id)
            .orElseThrow(() -> new IllegalArgumentException("P008 leave not found"));
    String action = safe(actionCode),
        permission =
            leaves.employeeNode(current) ? SUBMIT : (leaves.reviewNode(current) ? REVIEW : MANAGE);
    require(authorization.authorizeAction(principal.context(), permission));
    require(authorization.authorizeData(principal.context(), permission, target(current)));
    audit.recordOperation(
        principal.context(), "P008_ACTION_ATTEMPT_" + action, "attendance.leave_request", id);
    var result =
        leaves.act(
            context(principal),
            id,
            action,
            key,
            hash(Map.of("actionCode", action, "body", command)),
            command);
    audit.recordOperation(
        principal.context(), "P008_ACTION_" + action, "attendance.leave_request", id);
    return view(principal, result);
  }

  private LeaveService.Leave view(SessionPrincipal p, LeaveService.Leave v) {
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

  private static AuthorizationTarget selfTarget(SessionPrincipal p) {
    return new AuthorizationTarget(
        p.context().tenantId(),
        p.context().employeeId(),
        p.context().orgId(),
        null,
        p.context().employeeId());
  }

  private static AuthorizationTarget target(LeaveService.Leave v) {
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
      throw new AccessDeniedException("P008 authorization denied: " + d.reason());
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
      throw new IllegalArgumentException("P008 request cannot be hashed", e);
    }
  }
}
