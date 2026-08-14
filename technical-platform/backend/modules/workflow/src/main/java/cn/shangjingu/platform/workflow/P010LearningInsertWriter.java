package cn.shangjingu.platform.workflow;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Persists a P010 assignment with an executable, placeholder-aligned PostgreSQL statement. */
@Repository
public class P010LearningInsertWriter {
    static final String INSERT_SQL = """
            insert into learning.learning_assignment(
              id,tenant_id,business_no,status,version_no,created_by,updated_by,
              source_channel,business_date,subject,reason,priority,risk_level,
              owner_center_id,owner_employee_id,planned_start_at,planned_finish_at,
              completion_rate,content_version,course_team_name,course_version_id,
              learner_profile,period_or_course_no,phase_node_code)
            values(
              ?,?,?,?,0,?,?,
              'PORTAL',current_date,?,?,'NORMAL',?,
              ?,?,?,?,
              0,?,?,?,?,?,'S01')
            """;

    private final JdbcTemplate jdbc;

    public P010LearningInsertWriter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(
            LearningService.LearningRecord record,
            String reason,
            String courseTeamName,
            String riskLevel,
            String learnerProfile,
            Instant plannedStartAt,
            Instant plannedFinishAt,
            UUID actor) {
        jdbc.update(
                INSERT_SQL,
                record.id(),
                record.tenantId(),
                record.businessNo(),
                record.status(),
                actor,
                actor,
                record.subject(),
                reason,
                riskLevel,
                record.ownerCenterId(),
                record.ownerEmployeeId(),
                timestamp(plannedStartAt),
                timestamp(plannedFinishAt),
                record.contentVersion(),
                courseTeamName,
                record.courseVersionId(),
                learnerProfile,
                record.periodOrCourseNo());
    }

    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }
}
