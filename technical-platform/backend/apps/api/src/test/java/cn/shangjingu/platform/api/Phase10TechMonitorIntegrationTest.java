package cn.shangjingu.platform.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cn.shangjingu.platform.api.phase09.P004GenericRequestController;
import cn.shangjingu.platform.api.phase09.P005NoticeController;
import cn.shangjingu.platform.api.phase10.Phase10TechMonitorController;
import cn.shangjingu.platform.api.security.ApiSecurityExceptionHandler;
import cn.shangjingu.platform.api.security.JdbcSecurityAuditService;
import cn.shangjingu.platform.api.security.OpaqueAccessTokenFilter;
import cn.shangjingu.platform.api.security.SecurityConfiguration;
import cn.shangjingu.platform.api.security.SecurityProblemHandler;
import cn.shangjingu.platform.api.security.SessionPrincipal;
import cn.shangjingu.platform.iam.application.IdentityDirectoryService;
import cn.shangjingu.platform.iam.authorization.AuthorizationDecision;
import cn.shangjingu.platform.iam.authorization.AuthorizationService;
import cn.shangjingu.platform.iam.authorization.AuthorizationTarget;
import cn.shangjingu.platform.iam.domain.AuthorizationSnapshot;
import cn.shangjingu.platform.iam.session.SessionContext;
import cn.shangjingu.platform.iam.session.SessionService;
import cn.shangjingu.platform.workflow.GenericRequestService;
import cn.shangjingu.platform.workflow.NoticeReceiptService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = Phase10TechMonitorController.class)
@Import({
        SecurityConfiguration.class,
        OpaqueAccessTokenFilter.class,
        SecurityProblemHandler.class,
        ApiSecurityExceptionHandler.class
})
class Phase10TechMonitorIntegrationTest {
    private static final String TOKEN = "phase10-tech-monitor-token";
    private static final UUID TENANT = uuid("00000000-0000-0000-0000-000000006001");
    private static final UUID USER = uuid("10000000-0000-0000-0000-000000006001");
    private static final UUID IDENTITY = uuid("20000000-0000-0000-0000-000000006001");
    private static final UUID EMPLOYEE = uuid("30000000-0000-0000-0000-000000006001");
    private static final UUID APPOINTMENT = uuid("40000000-0000-0000-0000-000000006001");
    private static final UUID ORG = uuid("50000000-0000-0000-0000-000000006001");
    private static final UUID OTHER_ORG = uuid("50000000-0000-0000-0000-000000006002");
    private static final UUID POSITION = uuid("60000000-0000-0000-0000-000000006001");
    private static final Instant NOW = Instant.parse("2026-08-14T08:00:00Z");
    private static final SessionContext SUBJECT = new SessionContext(
            TENANT, USER, IDENTITY, EMPLOYEE, APPOINTMENT, ORG, POSITION, NOW);

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @MockitoBean GenericRequestService requests;
    @MockitoBean NoticeReceiptService notices;
    @MockitoBean AuthorizationService authorization;
    @MockitoBean JdbcSecurityAuditService audit;
    @MockitoBean SessionService sessions;
    @MockitoBean IdentityDirectoryService identities;

    private GenericRequestService.GenericRequest visibleRequest;
    private NoticeReceiptService.NoticeAggregate visibleNotice;
    private SessionPrincipal principal;

    @BeforeEach
    void setUp() {
        principal = new SessionPrincipal(TOKEN, SUBJECT);
        when(sessions.authenticateAccess(TOKEN)).thenReturn(Optional.of(SUBJECT));
        when(identities.authorization(SUBJECT)).thenReturn(new AuthorizationSnapshot(Set.of(), List.of()));
        visibleRequest = request(uuid("70000000-0000-0000-0000-000000006001"), ORG, "P004-001");
        GenericRequestService.GenericRequest hiddenRequest =
                request(uuid("70000000-0000-0000-0000-000000006002"), OTHER_ORG, "P004-002");
        visibleNotice = notice(uuid("80000000-0000-0000-0000-000000006001"), ORG, "P005-001");
        NoticeReceiptService.NoticeAggregate hiddenNotice =
                notice(uuid("80000000-0000-0000-0000-000000006002"), OTHER_ORG, "P005-002");
        when(requests.list(any())).thenReturn(List.of(visibleRequest, hiddenRequest));
        when(notices.list(any())).thenReturn(List.of(visibleNotice, hiddenNotice));
        allowAction("p004.request.read");
        allowAction("p005.notice.monitor");
        when(authorization.authorizeData(eq(SUBJECT), eq("p004.request.read"), any(AuthorizationTarget.class)))
                .thenAnswer(call -> scopeDecision("p004.request.read", call.getArgument(2)));
        when(authorization.authorizeData(eq(SUBJECT), eq("p005.notice.monitor"), any(AuthorizationTarget.class)))
                .thenAnswer(call -> scopeDecision("p005.notice.monitor", call.getArgument(2)));
    }

    @Test
    void authorizedMonitorEndpointsExposeOnlyScopedAllowlistedProjectionKeys() throws Exception {
        JsonNode p004 = response("/api/v1/processes/P004/monitor-projections");
        assertEquals(1, p004.size());
        assertEquals(Set.of(
                "recordId", "businessNo", "processCode", "currentNodeCode",
                "status", "versionNo", "updatedAt"), keys(p004.get(0)));
        assertEquals(visibleRequest.id().toString(), p004.get(0).path("recordId").asText());
        assertEquals("P004", p004.get(0).path("processCode").asText());

        JsonNode p005 = response("/api/v1/processes/P005/monitor-projections");
        assertEquals(1, p005.size());
        assertEquals(Set.of(
                "recordId", "businessNo", "processCode", "currentNodeCode",
                "status", "versionNo", "updatedAt", "approvedCount"), keys(p005.get(0)));
        assertEquals(visibleNotice.notice().id().toString(), p005.get(0).path("recordId").asText());
        assertEquals("P005", p005.get(0).path("processCode").asText());
        assertEquals(1, p005.get(0).path("approvedCount").asInt());
    }

    @Test
    void permissionDeniedMonitorEndpointFailsClosedBeforeServiceRead() throws Exception {
        when(authorization.authorizeAction(SUBJECT, "p005.notice.monitor"))
                .thenReturn(AuthorizationDecision.deny(
                        AuthorizationDecision.Reason.NO_PERMISSION, "p005.notice.monitor", null));

        mvc.perform(get("/api/v1/processes/P005/monitor-projections")
                        .header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));

        verify(notices, never()).list(any());
    }

    @Test
    void monitorOnlyIdentityCannotUseExistingP004OrP005MutationControllers() {
        when(requests.find(any(), eq(visibleRequest.id()))).thenReturn(Optional.of(visibleRequest));
        when(requests.isApplicantAction(visibleRequest, "APPROVE")).thenReturn(false);
        denyAction("p004.request.act");
        denyAction("p005.notice.manage");

        P004GenericRequestController p004 =
                new P004GenericRequestController(requests, authorization, audit, mapper);
        P005NoticeController p005 = new P005NoticeController(notices, authorization, audit, mapper);

        assertThrows(AccessDeniedException.class, () -> p004.act(
                principal, visibleRequest.id(), "APPROVE", "monitor-must-not-act",
                new GenericRequestService.ActionCommand(visibleRequest.versionNo(), "forbidden", null, null)));
        assertThrows(AccessDeniedException.class, () -> p005.manage(
                principal, visibleNotice.notice().id(), "ARCHIVE", "monitor-must-not-manage",
                new NoticeReceiptService.ManageCommand(visibleNotice.notice().versionNo(), "forbidden")));

        verify(requests, never()).act(any(), any(), any(), any(), any(), any());
        verify(notices, never()).manage(any(), any(), any(), any(), any(), any());
    }

    @Test
    void monitorControllerHasExactlyTwoGetMappingsAndNoMutationMapping() {
        Set<String> paths = new TreeSet<>();
        java.util.Arrays.stream(Phase10TechMonitorController.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(org.springframework.web.bind.annotation.GetMapping.class))
                .flatMap(method -> java.util.Arrays.stream(
                        method.getAnnotation(org.springframework.web.bind.annotation.GetMapping.class).value()))
                .forEach(paths::add);
        long mutationMappings = java.util.Arrays.stream(Phase10TechMonitorController.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(org.springframework.web.bind.annotation.PostMapping.class)
                        || method.isAnnotationPresent(org.springframework.web.bind.annotation.PutMapping.class)
                        || method.isAnnotationPresent(org.springframework.web.bind.annotation.PatchMapping.class)
                        || method.isAnnotationPresent(org.springframework.web.bind.annotation.DeleteMapping.class))
                .count();

        assertEquals(Set.of("/P004/monitor-projections", "/P005/monitor-projections"), paths);
        assertEquals(0, mutationMappings);
    }

    private JsonNode response(String path) throws Exception {
        return mapper.readTree(mvc.perform(get(path).header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray());
    }

    private void allowAction(String permission) {
        when(authorization.authorizeAction(SUBJECT, permission))
                .thenReturn(AuthorizationDecision.allow(permission, "CENTER"));
    }

    private void denyAction(String permission) {
        when(authorization.authorizeAction(SUBJECT, permission))
                .thenReturn(AuthorizationDecision.deny(
                        AuthorizationDecision.Reason.NO_PERMISSION, permission, null));
    }

    private static AuthorizationDecision scopeDecision(String permission, AuthorizationTarget target) {
        return ORG.equals(target.orgId())
                ? AuthorizationDecision.allow(permission, "CENTER")
                : AuthorizationDecision.deny(
                        AuthorizationDecision.Reason.DATA_SCOPE_DENIED, permission, "CENTER");
    }

    private static Set<String> keys(JsonNode node) {
        Set<String> result = new TreeSet<>();
        node.fieldNames().forEachRemaining(result::add);
        return result;
    }

    private static GenericRequestService.GenericRequest request(UUID id, UUID ownerCenter, String businessNo) {
        return new GenericRequestService.GenericRequest(
                id, TENANT, businessNo, uuid("71000000-0000-0000-0000-000000006001"), "WFI-P004",
                "S04", "IN_REVIEW", 3, "GENERAL", "forbidden subject", "forbidden reason",
                "forbidden requested result", LocalDate.parse("2026-08-14"), new BigDecimal("99.00"), null,
                ownerCenter, EMPLOYEE, "NORMAL", "P2", new BigDecimal("88.00"),
                uuid("72000000-0000-0000-0000-000000006001"), "FORM-P004", 1,
                "forbidden result summary", NOW);
    }

    private static NoticeReceiptService.NoticeAggregate notice(UUID id, UUID targetCenter, String businessNo) {
        NoticeReceiptService.Notice value = new NoticeReceiptService.Notice(
                id, TENANT, businessNo, uuid("81000000-0000-0000-0000-000000006001"), "WFI-P005",
                "S06", "EXECUTING", 5, "POLICY", 1, "forbidden official subject", "NOTICE",
                "forbidden official content", "COURSE-P005", "P2", "forbidden venue", ORG, EMPLOYEE,
                targetCenter, "POSITION", 80, NOW, LocalDate.parse("2026-08-14"), NOW, NOW.plusSeconds(3600),
                NOW.plusSeconds(7200), null, null, NOW);
        NoticeReceiptService.Recipient recipient = new NoticeReceiptService.Recipient(
                uuid("82000000-0000-0000-0000-000000006001"), id, EMPLOYEE, IDENTITY, targetCenter,
                POSITION, "POSITION", "DELIVERED", NOW, NOW, NOW, 100, NOW,
                "forbidden execution summary", NOW, NOW, EMPLOYEE, null, 0, 2, NOW);
        return new NoticeReceiptService.NoticeAggregate(value, List.of(recipient));
    }

    private static UUID uuid(String value) {
        return UUID.fromString(value);
    }
}
