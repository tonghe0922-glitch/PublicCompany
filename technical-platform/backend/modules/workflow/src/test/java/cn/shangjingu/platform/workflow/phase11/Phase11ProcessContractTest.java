package cn.shangjingu.platform.workflow.phase11;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.shangjingu.platform.core.process.ProcessRejectedException;
import java.util.List;
import org.junit.jupiter.api.Test;

class Phase11ProcessContractTest {
    @Test
    void p011GraphMatchesFrozenContract() {
        Phase11Process process = Phase11Process.P011;
        assertEquals(
                List.of(
                        "S01", "S02", "S03", "S04", "S05", "S06",
                        "S07", "S08", "S09", "S10", "S11"),
                process.steps().stream().map(Phase11Process.Step::node).toList());
        assertEquals(
                List.of(
                        "SET_TARGETS", "CONFIRM_TARGETS", "RECORD_COACHING",
                        "COLLECT_FACTS", "SUBMIT_REVIEWS", "CALCULATE_SCORE",
                        "CALIBRATE", "SUBMIT_APPEAL_DECISION", "RESOLVE_APPEAL",
                        "EXECUTE_IMPACT", "ARCHIVE"),
                process.steps().stream().map(Phase11Process.Step::action).toList());
        assertTrue(process.ownerAction("CONFIRM_TARGETS"));
        assertTrue(process.ownerAction("SUBMIT_APPEAL_DECISION"));
        assertTrue(process.specialistAction("CALIBRATE"));
        assertTrue(process.specialistAction("RESOLVE_APPEAL"));
        assertFalse(process.ownerAction("CALCULATE_SCORE"));
        assertEquals("S02", process.requireTransition("S01", "SET_TARGETS").targetNode());
        assertThrows(
                ProcessRejectedException.class,
                () -> process.requireTransition("S03", "CALIBRATE"));
    }

    @Test
    void p011CheckpointDoesNotExposeLaterExecutableProcesses() {
        assertEquals(
                List.of("P011"),
                java.util.Arrays.stream(Phase11Process.values())
                        .map(Phase11Process::code)
                        .toList());
    }

    @Test
    void independentScoresCalculateWithoutOverwritingSources() {
        Phase11Repository.PerformanceScores scores =
                new Phase11Repository.PerformanceScores(800L, 900L, 700L, null);
        assertTrue(scores.readyForCalculation());
        assertEquals(800L, scores.calculated());
        assertEquals(800L, scores.employee());
        assertEquals(900L, scores.supervisor());
        assertEquals(700L, scores.authoritative());
    }
}
