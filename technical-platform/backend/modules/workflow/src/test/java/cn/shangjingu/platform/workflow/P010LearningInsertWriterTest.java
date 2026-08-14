package cn.shangjingu.platform.workflow;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

class P010LearningInsertWriterTest {
    @Test
    void insertHasNoEmptyValueAndAlignsEveryPlaceholder() {
        CapturingJdbcTemplate jdbc = new CapturingJdbcTemplate();
        P010LearningInsertWriter writer = new P010LearningInsertWriter(jdbc);
        LearningService.LearningRecord record = new LearningService.LearningRecord(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "P010-TEST-001",
                null,
                null,
                "S01",
                LearningService.label("S01"),
                0,
                "P010 test assignment",
                UUID.randomUUID(),
                UUID.randomUUID(),
                "V1",
                "COURSE-P010-TEST",
                "P010-TEST-PERIOD",
                BigDecimal.ZERO,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                Instant.now());

        writer.insert(
                record,
                "test reason",
                "test course team",
                "HIGH",
                "test learner profile",
                Instant.parse("2031-05-01T01:00:00Z"),
                Instant.parse("2031-05-31T09:00:00Z"),
                UUID.randomUUID());

        assertFalse(jdbc.sql.contains("?,?\n  ,'PORTAL'"));
        assertEquals(18, jdbc.sql.chars().filter(character -> character == '?').count());
        assertEquals(18, jdbc.arguments.length);
    }

    private static final class CapturingJdbcTemplate extends JdbcTemplate {
        private String sql;
        private Object[] arguments;

        @Override
        public int update(String sql, Object... arguments) {
            this.sql = sql;
            this.arguments = arguments;
            return 1;
        }
    }
}
