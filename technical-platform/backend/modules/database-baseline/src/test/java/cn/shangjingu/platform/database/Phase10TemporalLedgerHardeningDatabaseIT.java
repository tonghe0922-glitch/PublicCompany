package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

class Phase10TemporalLedgerHardeningDatabaseIT {
    private static final UUID TENANT = id("00000000-0000-0000-0000-000000001252");
    private static final UUID OTHER_TENANT = id("00000000-0000-0000-0000-000000001253");
    private static final UUID CENTER = id("11000000-0000-0000-0000-000000001252");
    private static final UUID OTHER_CENTER = id("11000000-0000-0000-0000-000000001253");
    private static final UUID ACTOR = id("10000000-0000-0000-0000-000000001252");
    private static final UUID QUOTA_EMPLOYEE = id("10000000-0000-0000-0000-000000001253");
    private static final UUID CHRONOLOGY_EMPLOYEE = id("10000000-0000-0000-0000-000000001254");
    private static final UUID CONFLICT_EMPLOYEE = id("10000000-0000-0000-0000-000000001255");
    private static final UUID CONCURRENT_EMPLOYEE = id("10000000-0000-0000-0000-000000001256");
    private static final UUID OTHER_EMPLOYEE = id("10000000-0000-0000-0000-000000001257");
    private static final UUID LEAVE = id("20000000-0000-0000-0000-000000001252");
    private static final UUID OVERTIME = id("20000000-0000-0000-0000-000000001253");
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
            .withDatabaseName("postgres").withUsername("postgres").withPassword("cxr04-temporal-ledger");

    private static Path repoRoot;
    private static String omsUrl;
    private static int hardeningMigrations;
    private static int repeatedMigrations;

    @BeforeAll
    static void migrateFromV125_1AndSeed() throws Exception {
        repoRoot = findRepoRoot();
        POSTGRES.start();
        migrateCluster();
        try (Connection connection = connection("postgres"); Statement statement = connection.createStatement()) {
            statement.execute("create database sjg_oms");
        }
        omsUrl = jdbcUrl("sjg_oms");
        Flyway baseline = omsFlyway("125.1");
        assertTrue(baseline.migrate().success);
        baseline.validate();
        Flyway latest = omsFlyway(null);
        hardeningMigrations = latest.migrate().migrationsExecuted;
        latest.validate();
        repeatedMigrations = latest.migrate().migrationsExecuted;
        seedIdentity();
        seedCanonicalParents();
    }

    @AfterAll
    static void stopDatabase() {
        POSTGRES.stop();
    }

    @Test
    void v125_2MustExistRunOnceValidateAndRemainNoOp() {
        Path migration = repoRoot.resolve(
                "technical-platform/database/flyway-overlays/oms/V125_2__phase10_temporal_ledger_hardening.sql");
        assertAll(
                () -> assertTrue(Files.isRegularFile(migration), "V125_2 successor migration must exist"),
                () -> assertEquals(1, hardeningMigrations, "only V125_2 must run after V125.1"),
                () -> assertEquals(0, repeatedMigrations, "same database migrate must be a no-op"));
    }

    @Test
    void p008ReservedLedgerCodeCannotBeForgedByOrdinaryItem() {
        assertConstraintFailure(() -> execute("""
                insert into attendance.leave_request_item(
                  id,tenant_id,created_by,master_id,field_code,item_seq,item_name,item_value_json)
                values(gen_random_uuid(),'%s','%s','%s','QUOTA_LEDGER',1,'forged ledger','{}')
                """.formatted(TENANT, ACTOR, LEAVE)));
    }

    @Test
    void p008OrdinaryItemCannotBeConvertedIntoQuotaLedger() throws Exception {
        UUID item = UUID.randomUUID();
        execute("""
                insert into attendance.leave_request_item(
                  id,tenant_id,created_by,master_id,field_code,item_seq,item_name,item_value_json)
                values('%s','%s','%s','%s','ordinary_note',2,'ordinary evidence','{}')
                """.formatted(item, TENANT, ACTOR, LEAVE));
        assertSqlState("55000", "update attendance.leave_request_item set field_code='QUOTA_LEDGER' where id='"
                + item + "'");
    }

    @Test
    void p008LedgerKeepsExistingAppendOnlyAndDeltaShapeRules() throws Exception {
        execute(quotaSql("CXR04-SHAPE", "GRANT", 8, 0, 0, 8, 0, 0));
        assertAll(
                () -> assertSqlState("55000", "update attendance.leave_quota_ledger set reason='tampered' "
                        + "where tenant_id='" + TENANT + "' and idempotency_key='CXR04-SHAPE'"),
                () -> assertSqlState("55000", "delete from attendance.leave_quota_ledger where tenant_id='"
                        + TENANT + "' and idempotency_key='CXR04-SHAPE'"),
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-ZERO-RESERVE", "RESERVE", 0, 0, 0, 8, 0, 0))),
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-ZERO-DEDUCT", "DEDUCT", 0, 0, 0, 8, 0, 0))),
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-ZERO-RELEASE", "RELEASE", 0, 0, 0, 8, 0, 0))),
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-ZERO-ADJUST", "ADJUST", 0, 0, 0, 8, 0, 0))));
    }

    @Test
    void p008LedgerRejectsContinuityMismatch() throws Exception {
        execute(quotaSql("CXR04-MISMATCH-GRANT", "GRANT", 10, 0, 0, 10, 0, 0, "MISMATCH"));
        assertConstraintFailure(() -> execute(quotaSql(
                "CXR04-MISMATCH-RESERVE", "RESERVE", -2, 2, 0, 99, 2, 0, "MISMATCH")));
    }

    @Test
    void p008LedgerAcceptsOneContinuousSequence() throws Exception {
        execute(quotaSql("CXR04-CONTINUOUS-GRANT", "GRANT", 8, 0, 0, 8, 0, 0, "CONTINUOUS"));
        execute(quotaSql("CXR04-CONTINUOUS-RESERVE", "RESERVE", -2, 2, 0, 6, 2, 0, "CONTINUOUS"));
        execute(quotaSql("CXR04-CONTINUOUS-DEDUCT", "DEDUCT", 0, -2, 2, 6, 0, 2, "CONTINUOUS"));
        assertEquals(3, scalar("select count(*) from attendance.leave_quota_ledger where tenant_id='" + TENANT
                + "' and employee_id='" + QUOTA_EMPLOYEE + "' and quota_account_id='CONTINUOUS'"));
    }

    @Test
    void p008LedgerRejectsEachNegativeAfterBalance() {
        assertAll(
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-NEGATIVE-AVAILABLE", "RESERVE", -1, 1, 0, -1, 1, 0,
                        "NEGATIVE-AVAILABLE"))),
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-NEGATIVE-RESERVED", "RESERVE", -1, 1, 0, 1, -1, 0,
                        "NEGATIVE-RESERVED"))),
                () -> assertConstraintFailure(() -> execute(quotaSql(
                        "CXR04-NEGATIVE-CONSUMED", "DEDUCT", 0, -1, 1, 0, 0, -1,
                        "NEGATIVE-CONSUMED"))));
    }

    @Test
    void p009ReservedLedgerCodeCannotBeForgedByOrdinaryItem() {
        assertConstraintFailure(() -> execute("""
                insert into attendance.overtime_request_item(
                  id,tenant_id,created_by,master_id,field_code,item_seq,item_name,item_value_json)
                values(gen_random_uuid(),'%s','%s','%s','TIME_OFF_LEDGER',1,'forged ledger','{}')
                """.formatted(TENANT, ACTOR, OVERTIME)));
    }

    @Test
    void p009OrdinaryItemCannotBeConvertedIntoTimeOffLedger() throws Exception {
        UUID item = UUID.randomUUID();
        execute("""
                insert into attendance.overtime_request_item(
                  id,tenant_id,created_by,master_id,field_code,item_seq,item_name,item_value_json)
                values('%s','%s','%s','%s','ordinary_note',2,'ordinary evidence','{}')
                """.formatted(item, TENANT, ACTOR, OVERTIME));
        assertSqlState("55000", "update attendance.overtime_request_item set field_code='TIME_OFF_LEDGER' where id='"
                + item + "'");
    }

    @Test
    void p009TimeOffLedgerAcceptsPositiveTypedEntry() throws Exception {
        execute(timeOffSql("CXR04-TIMEOFF-VALID", "ACCRUE", 2, 2,
                "2030-05-01T08:00:00Z", "2030-05-01T10:00:00Z", TENANT, CHRONOLOGY_EMPLOYEE));
    }

    @Test
    void p009TimeOffLedgerRejectsUnknownType() {
        assertConstraintFailure(() -> execute(timeOffSql("CXR04-TIMEOFF-TYPE", "MYSTERY", 1, 1,
                "2030-05-02T08:00:00Z", "2030-05-02T09:00:00Z", TENANT, CHRONOLOGY_EMPLOYEE)));
    }

    @Test
    void p009TimeOffLedgerRejectsZeroHours() {
        assertConstraintFailure(() -> execute(timeOffSql("CXR04-TIMEOFF-ZERO", "ACCRUE", 0, 0,
                "2030-05-03T08:00:00Z", "2030-05-03T09:00:00Z", TENANT, CHRONOLOGY_EMPLOYEE)));
    }

    @Test
    void p009TimeOffLedgerRejectsUpdate() throws Exception {
        execute(timeOffSql("CXR04-TIMEOFF-UPDATE", "ACCRUE", 2, 2,
                "2030-05-04T08:00:00Z", "2030-05-04T10:00:00Z", TENANT, CHRONOLOGY_EMPLOYEE));
        assertSqlState("55000", "update attendance.time_off_ledger set hours=3 where tenant_id='"
                + TENANT + "' and idempotency_key='CXR04-TIMEOFF-UPDATE'");
    }

    @Test
    void p009TimeOffLedgerRejectsDelete() throws Exception {
        execute(timeOffSql("CXR04-TIMEOFF-DELETE", "ACCRUE", 2, 2,
                "2030-05-05T08:00:00Z", "2030-05-05T10:00:00Z", TENANT, CHRONOLOGY_EMPLOYEE));
        assertSqlState("55000", "delete from attendance.time_off_ledger where tenant_id='"
                + TENANT + "' and idempotency_key='CXR04-TIMEOFF-DELETE'");
    }

    @Test
    void shiftChronologyRejectsReverseTime() {
        assertConstraintFailure(() -> execute(shiftSql(UUID.randomUUID(), "CXR04-BAD-SHIFT",
                CHRONOLOGY_EMPLOYEE, "2030-06-01T12:00:00Z", "2030-06-01T10:00:00Z")));
    }

    @Test
    void leaveChronologyRejectsReverseTime() {
        assertConstraintFailure(() -> execute(leaveSql(UUID.randomUUID(), "CXR04-BAD-LEAVE",
                CHRONOLOGY_EMPLOYEE, "2030-06-02T12:00:00Z", "2030-06-02T10:00:00Z")));
    }

    @Test
    void overtimeChronologyRejectsReverseTime() {
        assertConstraintFailure(() -> execute(overtimeSql(UUID.randomUUID(), "CXR04-BAD-OT",
                CHRONOLOGY_EMPLOYEE, "2030-06-03T12:00:00Z", "2030-06-03T10:00:00Z")));
    }

    @Test
    void returnChronologyRejectsReturnBeforeLeaveStart() {
        assertConstraintFailure(() -> execute(timeOffSql("CXR04-BAD-RETURN", "ACCRUE", 1, 1,
                "2030-06-04T12:00:00Z", "2030-06-04T10:00:00Z", TENANT, CHRONOLOGY_EMPLOYEE)));
    }

    @Test
    void crossCanonicalOverlapFails() throws Exception {
        execute(shiftSql(UUID.randomUUID(), "CXR04-CONFLICT-SHIFT", CONFLICT_EMPLOYEE,
                "2030-07-01T08:00:00Z", "2030-07-01T10:00:00Z"));
        assertConstraintFailure(() -> execute(leaveSql(UUID.randomUUID(), "CXR04-CONFLICT-LEAVE",
                CONFLICT_EMPLOYEE, "2030-07-01T09:00:00Z", "2030-07-01T11:00:00Z")));
    }

    @Test
    void crossCanonicalBoundaryTouchPasses() throws Exception {
        execute(leaveSql(UUID.randomUUID(), "CXR04-BOUNDARY-LEAVE", CONFLICT_EMPLOYEE,
                "2030-07-02T10:00:00Z", "2030-07-02T12:00:00Z"));
        execute(overtimeSql(UUID.randomUUID(), "CXR04-BOUNDARY-OT", CONFLICT_EMPLOYEE,
                "2030-07-02T12:00:00Z", "2030-07-02T13:00:00Z"));
    }

    @Test
    void crossCanonicalCurrentRecordUpdatePasses() throws Exception {
        UUID shift = UUID.randomUUID();
        execute(shiftSql(shift, "CXR04-CURRENT-SHIFT", CONFLICT_EMPLOYEE,
                "2030-07-03T08:00:00Z", "2030-07-03T10:00:00Z"));
        assertEquals(1, executeUpdate("update attendance.shift_change_request set subject='same record update' "
                + "where tenant_id='" + TENANT + "' and id='" + shift + "'"));
    }

    @Test
    void temporalConflictLookupIsExplicitlyTenantScoped() throws Exception {
        execute(shiftSql(UUID.randomUUID(), "CXR04-TENANT-SHIFT", CONFLICT_EMPLOYEE,
                "2030-07-10T08:00:00Z", "2030-07-10T10:00:00Z"));
        assertEquals(1, scalar("select attendance.p10_temporal_conflict_exists('" + TENANT + "','"
                + CONFLICT_EMPLOYEE + "','2030-07-10T09:00:00Z','2030-07-10T11:00:00Z',null,null)::int"));
        assertEquals(0, scalar("select attendance.p10_temporal_conflict_exists('" + OTHER_TENANT + "','"
                + CONFLICT_EMPLOYEE + "','2030-07-10T09:00:00Z','2030-07-10T11:00:00Z',null,null)::int"));
    }

    @Test
    void concurrentCrossCanonicalOverlapAllowsExactlyOneWinner() throws Exception {
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Future<Boolean> leave = pool.submit(() -> concurrentInsert(
                    leaveSql(UUID.randomUUID(), "CXR04-RACE-LEAVE", CONCURRENT_EMPLOYEE,
                            "2030-08-01T08:00:00Z", "2030-08-01T12:00:00Z"), ready, start));
            Future<Boolean> overtime = pool.submit(() -> concurrentInsert(
                    overtimeSql(UUID.randomUUID(), "CXR04-RACE-OT", CONCURRENT_EMPLOYEE,
                            "2030-08-01T09:00:00Z", "2030-08-01T11:00:00Z"), ready, start));
            ready.await();
            start.countDown();
            int successes = (leave.get() ? 1 : 0) + (overtime.get() ? 1 : 0);
            assertEquals(1, successes, "cross-table overlap race must have exactly one committed winner");
        }
    }

    @Test
    void leaveQuotaLedgerHidesAndRejectsCrossTenantRows() throws Exception {
        execute(quotaSql("CXR04-OTHER-QUOTA", "GRANT", 2, 0, 0, 2, 0, 0,
                "OTHER", OTHER_TENANT, OTHER_EMPLOYEE));
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            statement.execute("set role sjg_api_runtime");
            statement.execute("select set_config('app.tenant_id','" + TENANT + "',false)");
            assertAll(
                    () -> assertEquals(0, scalar(statement,
                            "select count(*) from attendance.leave_quota_ledger where tenant_id='" + OTHER_TENANT + "'")),
                    () -> assertConstraintFailure(() -> statement.execute(quotaSql(
                            "CXR04-CROSS-QUOTA", "GRANT", 1, 0, 0, 1, 0, 0,
                            "CROSS", OTHER_TENANT, OTHER_EMPLOYEE))));
        }
    }

    @Test
    void timeOffLedgerHidesAndRejectsCrossTenantRows() throws Exception {
        execute(timeOffSql("CXR04-OTHER-TIMEOFF", "ACCRUE", 2, 2,
                "2030-09-01T08:00:00Z", "2030-09-01T10:00:00Z", OTHER_TENANT, OTHER_EMPLOYEE));
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            statement.execute("set role sjg_api_runtime");
            statement.execute("select set_config('app.tenant_id','" + TENANT + "',false)");
            assertAll(
                    () -> assertEquals(0, scalar(statement,
                            "select count(*) from attendance.time_off_ledger where tenant_id='" + OTHER_TENANT + "'")),
                    () -> assertConstraintFailure(() -> statement.execute(timeOffSql(
                            "CXR04-CROSS-TIMEOFF", "ACCRUE", 1, 1,
                            "2030-09-02T08:00:00Z", "2030-09-02T09:00:00Z",
                            OTHER_TENANT, OTHER_EMPLOYEE))));
        }
    }

    private static boolean concurrentInsert(String sql, CountDownLatch ready, CountDownLatch start) throws Exception {
        ready.countDown();
        start.await();
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            statement.execute(sql);
            return true;
        } catch (SQLException expectedConflict) {
            return false;
        }
    }

    private static String quotaSql(String key, String type, int availableDelta, int reservedDelta,
                                   int consumedDelta, int availableAfter, int reservedAfter, int consumedAfter) {
        return quotaSql(key, type, availableDelta, reservedDelta, consumedDelta,
                availableAfter, reservedAfter, consumedAfter, "CXR04");
    }

    private static String quotaSql(String key, String type, int availableDelta, int reservedDelta,
                                   int consumedDelta, int availableAfter, int reservedAfter, int consumedAfter,
                                   String account) {
        return quotaSql(key, type, availableDelta, reservedDelta, consumedDelta,
                availableAfter, reservedAfter, consumedAfter, account, TENANT, QUOTA_EMPLOYEE);
    }

    private static String quotaSql(String key, String type, int availableDelta, int reservedDelta,
                                   int consumedDelta, int availableAfter, int reservedAfter, int consumedAfter,
                                   String account, UUID tenant, UUID employee) {
        return """
                insert into attendance.leave_quota_ledger(
                  id,tenant_id,employee_id,quota_account_id,entry_type,available_delta,reserved_delta,
                  consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,created_by)
                values(gen_random_uuid(),'%s','%s','%s','%s',%d,%d,%d,%d,%d,%d,'%s','%s')
                """.formatted(tenant, employee, account, type, availableDelta, reservedDelta, consumedDelta,
                availableAfter, reservedAfter, consumedAfter, key, employee);
    }

    private static String timeOffSql(String key, String type, int hours, int balanceAfter,
                                     String leaveStarted, String returned, UUID tenant, UUID employee) {
        return """
                insert into attendance.time_off_ledger(
                  id,tenant_id,employee_id,entry_type,hours,balance_after,leave_started_at,returned_at,
                  idempotency_key,created_by)
                values(gen_random_uuid(),'%s','%s','%s',%d,%d,'%s','%s','%s','%s')
                """.formatted(tenant, employee, type, hours, balanceAfter, leaveStarted, returned, key, employee);
    }

    private static String shiftSql(UUID request, String businessNo, UUID employee, String start, String end) {
        return shiftSql(request, businessNo, employee, start, end, TENANT, CENTER);
    }

    private static String shiftSql(UUID request, String businessNo, UUID employee, String start, String end,
                                   UUID tenant, UUID center) {
        return """
                insert into attendance.shift_change_request(
                  id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,
                  subject,reason,priority,owner_center_id,owner_employee_id,attendance_type,change_action,
                  change_reason,content_version,duration_hours,start_at,end_at,period_or_course_no,
                  actual_start_at,actual_end_at)
                values('%s','%s','%s','ACTIVE',0,'%s','%s','TEST',current_date,'CXR04 shift','CXR04 temporal test',
                  'NORMAL','%s','%s','SHIFT','CHANGE','CXR04','v1',2,'%s','%s','CXR04','%s','%s')
                """.formatted(request, tenant, businessNo, employee, employee, center, employee,
                start, end, start, end);
    }

    private static String leaveSql(UUID request, String businessNo, UUID employee, String start, String end) {
        return leaveSql(request, businessNo, employee, start, end, TENANT, CENTER);
    }

    private static String leaveSql(UUID request, String businessNo, UUID employee, String start, String end,
                                   UUID tenant, UUID center) {
        return """
                insert into attendance.leave_request(
                  id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,
                  subject,reason,priority,owner_center_id,owner_employee_id,attendance_type,change_action,
                  change_reason,duration_hours,start_at,end_at,actual_start_at,actual_end_at)
                values('%s','%s','%s','ACTIVE',0,'%s','%s','TEST',current_date,'CXR04 leave','CXR04 temporal test',
                  'NORMAL','%s','%s','LEAVE','APPLY','CXR04',2,'%s','%s','%s','%s')
                """.formatted(request, tenant, businessNo, employee, employee, center, employee,
                start, end, start, end);
    }

    private static String overtimeSql(UUID request, String businessNo, UUID employee, String start, String end) {
        return overtimeSql(request, businessNo, employee, start, end, TENANT, CENTER);
    }

    private static String overtimeSql(UUID request, String businessNo, UUID employee, String start, String end,
                                      UUID tenant, UUID center) {
        return """
                insert into attendance.overtime_request(
                  id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,
                  subject,reason,priority,owner_center_id,owner_employee_id,attendance_type,duration_hours,
                  start_at,end_at,actual_start_at,actual_end_at)
                values('%s','%s','%s','ACTIVE',0,'%s','%s','TEST',current_date,'CXR04 overtime','CXR04 temporal test',
                  'NORMAL','%s','%s','OVERTIME',2,'%s','%s','%s','%s')
                """.formatted(request, tenant, businessNo, employee, employee, center, employee,
                start, end, start, end);
    }

    private static void seedIdentity() throws SQLException {
        execute("insert into core.tenant(id,tenant_code,tenant_name,status) values ('" + OTHER_TENANT
                + "','CXR04_OTHER','CXR04 Other','ACTIVE')");
        execute("insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values ('"
                + CENTER + "','" + TENANT + "','CXR04_CENTER','CXR04 Center','CENTER','cxr04_center'::ltree,'ACTIVE'),('"
                + OTHER_CENTER + "','" + OTHER_TENANT
                + "','CXR04_OTHER','CXR04 Other','CENTER','cxr04_other'::ltree,'ACTIVE')");
        execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id) values "
                + employee(ACTOR, TENANT, "CXR04-ACTOR", CENTER) + ","
                + employee(QUOTA_EMPLOYEE, TENANT, "CXR04-QUOTA", CENTER) + ","
                + employee(CHRONOLOGY_EMPLOYEE, TENANT, "CXR04-CHRONO", CENTER) + ","
                + employee(CONFLICT_EMPLOYEE, TENANT, "CXR04-CONFLICT", CENTER) + ","
                + employee(CONCURRENT_EMPLOYEE, TENANT, "CXR04-CONCURRENT", CENTER) + ","
                + employee(OTHER_EMPLOYEE, OTHER_TENANT, "CXR04-OTHER", OTHER_CENTER));
    }

    private static String employee(UUID id, UUID tenant, String no, UUID center) {
        return "('" + id + "','" + tenant + "','" + no + "','" + no
                + "','ACTIVE',current_date-30,'" + center + "')";
    }

    private static void seedCanonicalParents() throws SQLException {
        execute(leaveSql(LEAVE, "CXR04-LEAVE-PARENT", QUOTA_EMPLOYEE,
                "2030-01-01T08:00:00Z", "2030-01-01T10:00:00Z"));
        execute(overtimeSql(OVERTIME, "CXR04-OT-PARENT", CHRONOLOGY_EMPLOYEE,
                "2030-02-01T08:00:00Z", "2030-02-01T10:00:00Z"));
    }

    private static void assertConstraintFailure(SqlRunnable operation) {
        SQLException failure = assertThrows(SQLException.class, operation::run);
        assertNotNull(failure.getSQLState());
        assertTrue(failure.getSQLState().startsWith("23") || failure.getSQLState().equals("55000")
                        || failure.getSQLState().equals("42501"),
                () -> "expected constraint/fail-closed SQLSTATE but got " + failure.getSQLState());
    }

    private static void assertSqlState(String expected, String sql) {
        SQLException failure = assertThrows(SQLException.class, () -> execute(sql));
        assertEquals(expected, failure.getSQLState());
    }

    private static int executeUpdate(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            return statement.executeUpdate(sql);
        }
    }

    private static void execute(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static long scalar(Statement statement, String sql) throws SQLException {
        try (ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getLong(1);
        }
    }

    private static long scalar(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            return scalar(statement, sql);
        }
    }

    private static void migrateCluster() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:" + repoRoot.resolve("technical-platform/database/flyway/cluster"))
                .cleanDisabled(true).load().migrate();
    }

    private static Flyway omsFlyway(String target) {
        var configuration = Flyway.configure().dataSource(omsUrl, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:" + repoRoot.resolve("technical-platform/database/flyway/oms"),
                        "filesystem:" + repoRoot.resolve("technical-platform/database/flyway-overlays/oms"))
                .placeholders(Map.of("sjg_tenant_id", TENANT.toString(), "sjg_tenant_code", "CXR04_TEMPORAL",
                        "sjg_tenant_name", "CXR-04 temporal ledger"))
                .cleanDisabled(true);
        if (target != null) configuration.target(target);
        return configuration.load();
    }

    private static Connection connection(String database) throws SQLException {
        return DriverManager.getConnection(jdbcUrl(database), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static String jdbcUrl(String database) {
        String url = POSTGRES.getJdbcUrl();
        int query = url.indexOf('?');
        String suffix = query >= 0 ? url.substring(query) : "";
        String base = query >= 0 ? url.substring(0, query) : url;
        return base.substring(0, base.lastIndexOf('/') + 1) + database + suffix;
    }

    private static Path findRepoRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("mvnw")) && Files.isDirectory(current.resolve("Knowledge Base"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("repository root not found");
    }

    private static UUID id(String value) {
        return UUID.fromString(value);
    }

    @FunctionalInterface
    private interface SqlRunnable {
        void run() throws SQLException;
    }
}
