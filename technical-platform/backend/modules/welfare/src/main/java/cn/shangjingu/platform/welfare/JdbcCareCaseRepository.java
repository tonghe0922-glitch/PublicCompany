package cn.shangjingu.platform.welfare;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcCareCaseRepository implements CareCaseService.Repository {
    private final JdbcTemplate jdbc;

    public JdbcCareCaseRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void insert(CareCaseService.CareCase c, UUID actorId) {
        jdbc.update("""
                insert into welfare.care_case(
                    id,tenant_id,business_no,status,version_no,created_by,updated_by,
                    source_channel,business_date,subject,reason,priority,risk_level,
                    owner_center_id,owner_department_id,owner_employee_id,benefit_amount,budget_item_id,
                    cost_center_id,currency,employee_event_type,fact_occurred_at,fact_summary,
                    impact_effective_date,impact_level,points_delta)
                values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                c.id(), c.tenantId(), c.businessNo(), c.status(), c.versionNo(), actorId, actorId,
                c.sourceChannel(), c.businessDate(), c.subject(), c.reason(), valueOr(c.priority(), "NORMAL"), c.riskLevel(),
                c.ownerCenterId(), c.ownerDepartmentId(), c.ownerEmployeeId(), c.benefitAmount(), c.budgetItemId(),
                c.costCenterId(), c.currency(), c.employeeEventType(), c.factOccurredAt(), c.factSummary(),
                c.impactEffectiveDate(), c.impactLevel(), c.pointsDelta());
    }

    @Override
    public Optional<CareCaseService.CareCase> find(UUID tenantId, UUID id) {
        return jdbc.query("""
                select id,tenant_id,business_no,status,version_no,source_channel,business_date,subject,reason,
                       priority,risk_level,owner_center_id,owner_department_id,owner_employee_id,benefit_amount,
                       budget_item_id,cost_center_id,currency,employee_event_type,fact_occurred_at,fact_summary,
                       impact_effective_date,impact_level,points_delta,result_summary,actual_start_at,actual_end_at,closed_at
                from welfare.care_case
                where tenant_id=? and id=? and not is_deleted
                """, (rs, n) -> map(rs), tenantId, id).stream().findFirst();
    }

    @Override
    public int updateStatus(
            UUID tenantId,
            UUID id,
            int expectedVersion,
            String status,
            String resultSummary,
            Instant actualStartAt,
            Instant actualEndAt,
            Instant closedAt,
            UUID actorId) {
        return jdbc.update("""
                update welfare.care_case
                set status=?,version_no=version_no+1,result_summary=coalesce(?,result_summary),
                    actual_start_at=coalesce(?,actual_start_at),actual_end_at=coalesce(?,actual_end_at),
                    closed_at=coalesce(?,closed_at),updated_by=?,updated_at=now()
                where tenant_id=? and id=? and version_no=? and not is_deleted
                """, status, resultSummary, actualStartAt, actualEndAt, closedAt, actorId, tenantId, id, expectedVersion);
    }

    private static CareCaseService.CareCase map(ResultSet rs) throws SQLException {
        return new CareCaseService.CareCase(
                rs.getObject("id", UUID.class),
                rs.getObject("tenant_id", UUID.class),
                rs.getString("business_no"),
                rs.getString("status"),
                rs.getInt("version_no"),
                rs.getString("source_channel"),
                rs.getObject("business_date", java.time.LocalDate.class),
                rs.getString("subject"),
                rs.getString("reason"),
                rs.getString("priority"),
                rs.getString("risk_level"),
                rs.getObject("owner_center_id", UUID.class),
                rs.getObject("owner_department_id", UUID.class),
                rs.getObject("owner_employee_id", UUID.class),
                rs.getBigDecimal("benefit_amount"),
                rs.getString("budget_item_id"),
                rs.getString("cost_center_id"),
                rs.getString("currency"),
                rs.getString("employee_event_type"),
                rs.getObject("fact_occurred_at", java.time.OffsetDateTime.class) == null ? null : rs.getObject("fact_occurred_at", java.time.OffsetDateTime.class).toInstant(),
                rs.getString("fact_summary"),
                rs.getObject("impact_effective_date", java.time.LocalDate.class),
                rs.getString("impact_level"),
                rs.getObject("points_delta", Long.class),
                rs.getString("result_summary"),
                instant(rs, "actual_start_at"),
                instant(rs, "actual_end_at"),
                instant(rs, "closed_at"));
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        java.time.OffsetDateTime value = rs.getObject(column, java.time.OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
