package cn.shangjingu.platform.api.phase11;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class P014DisciplineControllerContractTest {
    @Test
    void frozenPermissionsMapToServerActionsOnly() {
        assertEquals(
                P014DisciplineController.INVESTIGATE,
                P014DisciplineController.actionPermission("OPEN_INVESTIGATION"));
        assertEquals(
                P014DisciplineController.INVESTIGATE,
                P014DisciplineController.actionPermission("RECORD_STATEMENT"));
        assertEquals(
                P014DisciplineController.DECIDE,
                P014DisciplineController.actionPermission("HEARING_DECISION"));
        assertEquals(
                P014DisciplineController.DECIDE,
                P014DisciplineController.actionPermission("SERVE_DECISION"));
        assertEquals(
                P014DisciplineController.APPEAL,
                P014DisciplineController.actionPermission("OPEN_APPEAL"));
        assertEquals(
                P014DisciplineController.APPEAL,
                P014DisciplineController.actionPermission("ASSIGN_APPEAL_REVIEWER"));
        assertEquals(
                P014DisciplineController.APPEAL,
                P014DisciplineController.actionPermission("RESOLVE_APPEAL"));
        assertEquals(
                P014DisciplineController.REMEDIATE,
                P014DisciplineController.actionPermission("CLOSE_NO_APPEAL"));
        assertEquals(
                P014DisciplineController.REMEDIATE,
                P014DisciplineController.actionPermission("CLOSE_AFTER_APPEAL"));
        assertEquals(
                P014DisciplineController.REMEDIATE,
                P014DisciplineController.actionPermission("REOPEN_FOR_DEFECT"));
        assertEquals(
                P014DisciplineController.REMEDIATE,
                P014DisciplineController.actionPermission("ARCHIVE"));
        assertThrows(
                IllegalArgumentException.class,
                () -> P014DisciplineController.actionPermission("TARGET_STATUS"));
    }
}
