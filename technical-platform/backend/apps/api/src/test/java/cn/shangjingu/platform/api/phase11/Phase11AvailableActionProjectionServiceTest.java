package cn.shangjingu.platform.api.phase11;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class Phase11AvailableActionProjectionServiceTest {
    @Test
    void exposesTypedRootCompatibleRecordViewAndExactFourFieldActionDto() {
        UUID taskId = UUID.randomUUID();
        var action = new Phase11AvailableActionProjectionService.AvailableActionProjection(
                "APPROVE", "APPROVE", taskId, 7);
        var view = new Phase11AvailableActionProjectionService.RecordView<>("record", List.of(action));
        assertEquals(
                List.of("code", "labelCode", "taskId", "expectedVersion"),
                Arrays.stream(Phase11AvailableActionProjectionService.AvailableActionProjection.class
                                .getRecordComponents())
                        .map(component -> component.getName())
                        .toList());
        var record = Phase11AvailableActionProjectionService.RecordView.class
                .getRecordComponents()[0];
        assertTrue(record.getAccessor().isAnnotationPresent(JsonUnwrapped.class));
        assertEquals("record", view.record());
        assertEquals(List.of(action), view.availableActions());
        assertEquals(taskId, action.taskId());
    }
}
