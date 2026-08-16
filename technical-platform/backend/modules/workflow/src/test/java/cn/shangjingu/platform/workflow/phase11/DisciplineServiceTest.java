package cn.shangjingu.platform.workflow.phase11;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DisciplineServiceTest {
    private static final UUID CENTER = UUID.fromString("10000000-0000-0000-0000-000000001114");
    private static final UUID SUBJECT = UUID.fromString("20000000-0000-0000-0000-000000001114");
    private static final UUID DECISION_MAKER = UUID.fromString("30000000-0000-0000-0000-000000001114");

    @Test
    void p014GraphMatchesFrozenContractIncludingBothBranches() {
        Phase11Process process = Phase11Process.P014;
        assertEquals(
                List.of(
                        "REGISTER_LEAD",
                        "OPEN_INVESTIGATION",
                        "RECORD_STATEMENT",
                        "HEARING_DECISION",
                        "SERVE_DECISION",
                        "OPEN_APPEAL",
                        "ASSIGN_APPEAL_REVIEWER",
                        "RESOLVE_APPEAL",
                        "CLOSE_NO_APPEAL",
                        "CLOSE_AFTER_APPEAL",
                        "REOPEN_FOR_DEFECT",
                        "ARCHIVE"),
                process.steps().stream().map(Phase11Process.Step::action).toList());
        assertEquals("S07", process.requireTransition("S06", "OPEN_APPEAL").targetNode());
        assertEquals("S10", process.requireTransition("S06", "CLOSE_NO_APPEAL").targetNode());
        assertEquals("S03", process.requireTransition("S10", "REOPEN_FOR_DEFECT").targetNode());
        assertEquals("END", process.requireTransition("S10", "ARCHIVE").targetNode());
        assertEquals("ARCHIVED", process.labelFor("END"));
    }

    @Test
    void ordinaryInternalDisciplineDoesNotRequireCrmLink() {
        DisciplineService.CreateCommand command = command("INTERNAL", null, null);
        assertDoesNotThrow(() -> DisciplineService.validateCreate(command));
    }

    @Test
    void crmLinkIsAllowedOnlyForCustomerOriginatedCase() {
        DisciplineService.CreateCommand invalid = command("INTERNAL", "CRM-1", "Customer");
        assertThrows(ProcessRejectedException.class, () -> DisciplineService.validateCreate(invalid));
        DisciplineService.CreateCommand valid = command("CUSTOMER", "CRM-1", "Customer");
        assertDoesNotThrow(() -> DisciplineService.validateCreate(valid));
    }

    @Test
    void subjectCannotInvestigateOwnCaseAndDecisionMakerCannotReviewAppeal() {
        assertThrows(
                ProcessRejectedException.class,
                () -> DisciplineService.validateInvestigator(SUBJECT, SUBJECT));
        assertDoesNotThrow(() -> DisciplineService.validateInvestigator(SUBJECT, DECISION_MAKER));
        assertThrows(
                ProcessRejectedException.class,
                () -> DisciplineService.validateAppealReviewer(DECISION_MAKER, DECISION_MAKER));
        assertDoesNotThrow(() -> DisciplineService.validateAppealReviewer(DECISION_MAKER, SUBJECT));
    }

    private static DisciplineService.CreateCommand command(
            String sourceType, String customerId, String customerName) {
        return new DisciplineService.CreateCommand(
                "discipline case",
                "reason",
                "NORMAL",
                "HIGH",
                CENTER,
                SUBJECT,
                LocalDate.of(2026, 8, 16),
                Instant.parse("2026-08-16T00:00:00Z"),
                "fact",
                "P014-SOURCE-1",
                sourceType,
                customerId,
                customerName,
                "EMPLOYEE",
                null,
                "P014-CONTENT-V1",
                "2026-Q3");
    }
}
