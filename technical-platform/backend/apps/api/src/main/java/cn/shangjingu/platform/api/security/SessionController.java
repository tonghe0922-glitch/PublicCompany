package cn.shangjingu.platform.api.security;

import cn.shangjingu.platform.iam.application.IdentityDirectoryService;
import cn.shangjingu.platform.iam.domain.IdentityRecord;
import cn.shangjingu.platform.iam.session.SessionService;
import cn.shangjingu.platform.iam.session.SessionTokens;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/session")
public final class SessionController {
    private final SessionService sessions;
    private final IdentityDirectoryService identities;
    private final JdbcSecurityAuditService audit;

    public SessionController(
            SessionService sessions,
            IdentityDirectoryService identities,
            JdbcSecurityAuditService audit) {
        this.sessions = sessions;
        this.identities = identities;
        this.audit = audit;
    }

    @GetMapping
    public SessionView current(@AuthenticationPrincipal SessionPrincipal principal) {
        List<String> permissions = identities.authorization(principal.context()).permissions().stream()
                .sorted()
                .toList();
        List<AvailableIdentityView> availableIdentities = identities
                .activeIdentities(principal.context().tenantId(), principal.context().userId()).stream()
                .sorted(Comparator.comparing(IdentityRecord::primary).reversed()
                        .thenComparing(identity -> identity.id().toString()))
                .map(AvailableIdentityView::from)
                .toList();
        return new SessionView(
                principal.context().tenantId(),
                principal.context().userId(),
                principal.context().identityId(),
                principal.context().employeeId(),
                principal.context().appointmentId(),
                principal.context().orgId(),
                principal.context().positionId(),
                permissions,
                availableIdentities);
    }

    @PostMapping("/switch")
    public SessionTokenResponse switchIdentity(
            @AuthenticationPrincipal SessionPrincipal principal,
            @RequestBody SwitchRequest request) {
        SessionTokens switched = sessions.switchIdentity(principal.accessToken(), request.identityId());
        try {
            audit.recordOperation(switched.context(), "SESSION_SWITCH", "SESSION", null);
            return SessionTokenResponse.from(switched);
        } catch (RuntimeException ex) {
            compensate(switched.accessToken());
            throw ex;
        }
    }

    private void compensate(String accessToken) {
        try {
            sessions.logout(accessToken);
        } catch (RuntimeException ignored) {
            // The critical failure remains authoritative and the raw token is never logged.
        }
    }

    public record SwitchRequest(UUID identityId) {
    }

    public record AvailableIdentityView(
            UUID identityId,
            String identityType,
            String identityName,
            UUID orgId,
            UUID positionId,
            boolean primary,
            OffsetDateTime effectiveStartAt,
            OffsetDateTime effectiveEndAt) {
        static AvailableIdentityView from(IdentityRecord identity) {
            return new AvailableIdentityView(
                    identity.id(),
                    identity.identityType(),
                    identity.identityName(),
                    identity.orgId(),
                    identity.positionId(),
                    identity.primary(),
                    identity.effectiveStartAt(),
                    identity.effectiveEndAt());
        }
    }

    public record SessionView(
            UUID tenantId,
            UUID userId,
            UUID identityId,
            UUID employeeId,
            UUID appointmentId,
            UUID orgId,
            UUID positionId,
            List<String> permissions,
            List<AvailableIdentityView> availableIdentities) {
    }
}
