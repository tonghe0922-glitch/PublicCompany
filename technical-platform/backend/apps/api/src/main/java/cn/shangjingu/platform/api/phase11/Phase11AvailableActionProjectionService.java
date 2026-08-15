package cn.shangjingu.platform.api.phase11;

import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.workflow.WorkflowCandidateResolver;
import cn.shangjingu.platform.workflow.WorkflowRuntimeService;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

@Service
public final class Phase11AvailableActionProjectionService {
    private final WorkflowRuntimeService workflow;
    private final WorkflowCandidateResolver candidates;
    private final AuthorizationService authorization;
    private final TenantTransactionRunner transactions;

    public Phase11AvailableActionProjectionService(
            WorkflowRuntimeService workflow,
            WorkflowCandidateResolver candidates,
            AuthorizationService authorization,
            TenantTransactionRunner transactions) {
        this.workflow = workflow;
        this.candidates = candidates;
        this.authorization = authorization;
        this.transactions = transactions;
    }

    public <T> RecordView<T> project(
            SessionPrincipal principal,
            T record,
            UUID workflowInstanceId,
            int expectedVersion,
            Supplier<List<String>> domainCandidateCodes,
            Predicate<String> taskIndependentAction,
            Function<String, String> permissionForAction,
            AuthorizationTarget target,
            boolean monitorOnly) {
        Objects.requireNonNull(principal, "principal");
        Objects.requireNonNull(record, "record");
        if (monitorOnly) return new RecordView<>(record, List.of());
        return transactions.required(databaseContext(principal), () -> projectWithinTenant(
                principal, record, workflowInstanceId, expectedVersion, domainCandidateCodes,
                taskIndependentAction, permissionForAction, target));
    }

    private <T> RecordView<T> projectWithinTenant(
            SessionPrincipal principal,
            T record,
            UUID workflowInstanceId,
            int expectedVersion,
            Supplier<List<String>> domainCandidateCodes,
            Predicate<String> taskIndependentAction,
            Function<String, String> permissionForAction,
            AuthorizationTarget target) {
        var runtime = workflow.get(principal.context().tenantId(), workflowInstanceId);
        boolean taskEligible = eligibleActor(principal, runtime);
        List<String> matched = workflow.matchingActionCodes(
                principal.context().tenantId(), workflowInstanceId, domainCandidateCodes.get());
        UUID taskId = runtime.task() == null ? null : runtime.task().id();
        List<AvailableActionProjection> actions = matched.stream()
                .filter(code -> taskEligible || taskIndependentAction.test(code))
                .filter(code -> permitted(principal, permissionForAction.apply(code), target))
                .map(code -> new AvailableActionProjection(
                        code, code, taskIndependentAction.test(code) ? null : taskId, expectedVersion))
                .toList();
        return new RecordView<>(record, actions);
    }

    private static DatabaseSecurityContext databaseContext(SessionPrincipal principal) {
        var context = principal.context();
        return new DatabaseSecurityContext(
                context.tenantId(), context.userId(), context.identityId(), context.employeeId(),
                context.appointmentId(), context.orgId(), context.positionId());
    }

    private boolean eligibleActor(SessionPrincipal principal, WorkflowRuntimeService.Result runtime) {
        UUID employeeId = principal.context().employeeId();
        if (runtime.task() == null) return employeeId.equals(runtime.instance().initiatorId());
        if (!"PENDING".equals(runtime.task().status())) return false;
        if (runtime.task().assigneeId() != null) return employeeId.equals(runtime.task().assigneeId());
        return candidates.resolve(
                        principal.context().tenantId(),
                        runtime.instance().initiatorId(),
                        runtime.task().candidateRule(),
                        runtime.instance().contextSnapshot())
                .candidateIds()
                .contains(employeeId);
    }

    private boolean permitted(SessionPrincipal principal, String permissionCode, AuthorizationTarget target) {
        return authorization.authorizeAction(principal.context(), permissionCode).allowed()
                && authorization.authorizeData(principal.context(), permissionCode, target).allowed();
    }

    public record AvailableActionProjection(
            String code, String labelCode, UUID taskId, int expectedVersion) {}

    public record RecordView<T>(@JsonUnwrapped T record, List<AvailableActionProjection> availableActions) {}
}
