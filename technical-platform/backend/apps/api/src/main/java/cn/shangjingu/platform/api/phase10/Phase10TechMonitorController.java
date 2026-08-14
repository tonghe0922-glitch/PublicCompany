package cn.shangjingu.platform.api.phase10;

import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.workflow.GenericRequestService;
import cn.shangjingu.platform.workflow.NoticeReceiptService;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/processes")
public final class Phase10TechMonitorController {
    private static final String P004_READ = "p004.request.read";
    private static final String P005_MONITOR = "p005.notice.monitor";

    private final GenericRequestService requests;
    private final NoticeReceiptService notices;
    private final AuthorizationService authorization;

    public Phase10TechMonitorController(
            GenericRequestService requests,
            NoticeReceiptService notices,
            AuthorizationService authorization) {
        this.requests = requests;
        this.notices = notices;
        this.authorization = authorization;
    }

    @GetMapping("/P004/monitor-projections")
    public List<MonitorProjection> p004(@AuthenticationPrincipal SessionPrincipal principal) {
        require(authorization.authorizeAction(principal.context(), P004_READ), "P004");
        return requests.list(context(principal)).stream()
                .filter(request -> authorization.authorizeData(
                        principal.context(), P004_READ, target(request)).allowed())
                .map(Phase10TechMonitorController::projection)
                .toList();
    }

    @GetMapping("/P005/monitor-projections")
    public List<MonitorProjection> p005(@AuthenticationPrincipal SessionPrincipal principal) {
        require(authorization.authorizeAction(principal.context(), P005_MONITOR), "P005");
        return notices.list(context(principal)).stream()
                .filter(aggregate -> authorization.authorizeData(
                        principal.context(), P005_MONITOR, target(aggregate)).allowed())
                .map(Phase10TechMonitorController::projection)
                .toList();
    }

    private static MonitorProjection projection(GenericRequestService.GenericRequest request) {
        return new MonitorProjection(
                request.id(), request.businessNo(), "P004", request.currentNodeCode(), request.status(),
                request.versionNo(), request.updatedAt(), null);
    }

    private static MonitorProjection projection(NoticeReceiptService.NoticeAggregate aggregate) {
        NoticeReceiptService.Notice notice = aggregate.notice();
        return new MonitorProjection(
                notice.id(), notice.businessNo(), "P005", notice.currentNodeCode(), notice.status(),
                notice.versionNo(), notice.updatedAt(), aggregate.acceptedCount());
    }

    private static AuthorizationTarget target(GenericRequestService.GenericRequest request) {
        return new AuthorizationTarget(
                request.tenantId(), request.ownerEmployeeId(), request.ownerCenterId(), null,
                request.ownerEmployeeId());
    }

    private static AuthorizationTarget target(NoticeReceiptService.NoticeAggregate aggregate) {
        NoticeReceiptService.Notice notice = aggregate.notice();
        return new AuthorizationTarget(
                notice.tenantId(), notice.ownerEmployeeId(), notice.targetCenterId(), null,
                notice.ownerEmployeeId());
    }

    private static DatabaseSecurityContext context(SessionPrincipal principal) {
        var subject = principal.context();
        return new DatabaseSecurityContext(
                subject.tenantId(), subject.userId(), subject.identityId(), subject.employeeId(),
                subject.appointmentId(), subject.orgId(), subject.positionId());
    }

    private static void require(AuthorizationDecision decision, String processCode) {
        if (!decision.allowed()) {
            throw new AccessDeniedException(
                    processCode + " monitor authorization denied: " + decision.reason());
        }
    }
}
