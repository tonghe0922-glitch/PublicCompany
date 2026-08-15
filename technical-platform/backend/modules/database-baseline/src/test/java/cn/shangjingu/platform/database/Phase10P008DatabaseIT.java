package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

class Phase10P008DatabaseIT {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000001008"),
      EMPLOYEE = id("10000000-0000-0000-0000-000000001008"),
      OTHER = id("10000000-0000-0000-0000-000000001009"),
      ORG = id("11000000-0000-0000-0000-000000001008"),
      POSITION = id("12000000-0000-0000-0000-000000001008"),
      REQUEST = id("20000000-0000-0000-0000-000000001008");

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
          .withDatabaseName("postgres")
          .withUsername("postgres")
          .withPassword("phase10-p008-bootstrap");

  private static String omsUrl;

  @BeforeAll
  static void migrate() throws Exception {
    POSTGRES.start();
    Path root = root();
    Flyway.configure()
        .dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
        .locations("filesystem:" + root.resolve("technical-platform/database/flyway/cluster"))
        .cleanDisabled(true)
        .load()
        .migrate();
    try (Connection c =
            DriverManager.getConnection(
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        Statement s = c.createStatement()) {
      s.execute("create database sjg_oms");
    }
    omsUrl =
        "jdbc:postgresql://" + POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/sjg_oms";
    Flyway f =
        Flyway.configure()
            .dataSource(omsUrl, POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations(
                "filesystem:" + root.resolve("technical-platform/database/flyway/oms"),
                "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/oms"))
            .placeholders(
                Map.of(
                    "sjg_tenant_id",
                    TENANT.toString(),
                    "sjg_tenant_code",
                    "PHASE10_P008",
                    "sjg_tenant_name",
                    "P008 database test"))
            .cleanDisabled(true)
            .load();
    assertTrue(f.migrate().success);
    f.validate();
    assertEquals(0, f.migrate().migrationsExecuted);
    seed();
  }

  @AfterAll
  static void stop() {
    POSTGRES.stop();
  }

  @Test
  void migrationPublishesExactSourceWorkflowAndAccessControls() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from core.sequence_rule where tenant_id='"
                  + TENANT
                  + "' and rule_code='P008' and not is_deleted"));
      assertEquals(
          5,
          scalar(
              s,
              "select count(*) from iam.permission where tenant_id='"
                  + TENANT
                  + "' and permission_code like 'p008.leave.%' and not is_deleted"));
      assertEquals(11, scalar(s, workflowCount("wf_node")));
      assertEquals(17, scalar(s, workflowCount("wf_transition")));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from workflow.wf_form_definition where tenant_id='"
                  + TENANT
                  + "' and form_code='EMP-P008-F01' and validation_schema->'serverAuthoritative' ?"
                  + " 'quota_amount' and not is_deleted"));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from pg_policies where schemaname='attendance' and"
                  + " tablename='leave_quota_ledger' and policyname='p_tenant_p008_quota_ledger'"));
    }
  }

  @Test
  void ledgerRejectsTamperInvalidConservationAndCrossEmployeeBinding() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      s.execute(
          "insert into"
              + " attendance.leave_quota_ledger(id,tenant_id,employee_id,quota_account_id,entry_type,available_delta,reserved_delta,consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,created_by)"
              + " values(gen_random_uuid(),'"
              + TENANT
              + "','"
              + EMPLOYEE
              + "','ANNUAL','GRANT',16,0,0,16,0,0,'grant','"
              + EMPLOYEE
              + "')");
      s.execute(
          "insert into"
              + " attendance.leave_quota_ledger(id,tenant_id,employee_id,quota_account_id,leave_request_id,entry_type,available_delta,reserved_delta,consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,created_by)"
              + " values(gen_random_uuid(),'"
              + TENANT
              + "','"
              + EMPLOYEE
              + "','ANNUAL','"
              + REQUEST
              + "','RESERVE',-8,8,0,8,8,0,'reserve','"
              + EMPLOYEE
              + "')");
    }
    assertSqlState(
        "23514",
        "insert into"
            + " attendance.leave_quota_ledger(id,tenant_id,employee_id,quota_account_id,leave_request_id,entry_type,available_delta,reserved_delta,consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,created_by)"
            + " values(gen_random_uuid(),'"
            + TENANT
            + "','"
            + OTHER
            + "','ANNUAL','"
            + REQUEST
            + "','RESERVE',-1,1,0,0,1,0,'cross-owner','"
            + OTHER
            + "')");
    assertSqlState(
        "23514",
        "insert into"
            + " attendance.leave_quota_ledger(id,tenant_id,employee_id,quota_account_id,entry_type,available_delta,reserved_delta,consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,created_by)"
            + " values(gen_random_uuid(),'"
            + TENANT
            + "','"
            + EMPLOYEE
            + "','ANNUAL','DEDUCT',0,-2,1,8,6,1,'broken-conservation','"
            + EMPLOYEE
            + "')");
    assertSqlState(
        "55000",
        "update attendance.leave_quota_ledger set reason='tampered' where tenant_id='"
            + TENANT
            + "' and idempotency_key='reserve'");
    assertSqlState(
        "55000",
        "delete from attendance.leave_quota_ledger where tenant_id='"
            + TENANT
            + "' and idempotency_key='reserve'");
  }

  private static void seed() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      s.execute(
          "insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values"
              + " ('"
              + ORG
              + "','"
              + TENANT
              + "','P008_CENTER','P008 Center','CENTER','p008_center'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POSITION
              + "','"
              + TENANT
              + "','P008_POS','P008 Position','"
              + ORG
              + "','ACTIVE')");
      s.execute(
          "insert into"
              + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
              + " values ('"
              + EMPLOYEE
              + "','"
              + TENANT
              + "','P008-E001','P008 Employee','ACTIVE',current_date-30,'"
              + ORG
              + "','"
              + POSITION
              + "'),('"
              + OTHER
              + "','"
              + TENANT
              + "','P008-E002','P008 Other','ACTIVE',current_date-30,'"
              + ORG
              + "','"
              + POSITION
              + "')");
      s.execute(
          "insert into"
              + " attendance.leave_request(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,owner_center_id,owner_employee_id,planned_start_at,planned_finish_at,attendance_type,change_action,change_reason,duration_hours,end_at,quota_account_id,quota_amount,start_at)"
              + " values ('"
              + REQUEST
              + "','"
              + TENANT
              + "','P008-DB-1','请假申请',0,'"
              + EMPLOYEE
              + "','"
              + EMPLOYEE
              + "','TEST',current_date,'数据库额度守恒测试','数据库集成验证真实请假额度守恒','NORMAL','"
              + ORG
              + "','"
              + EMPLOYEE
              + "',now()+interval '1 day',now()+interval '9 hours 1"
              + " day','年假','APPLY','数据库测试',8,now()+interval '9 hours 1"
              + " day','ANNUAL',8,now()+interval '1 day')");
    }
  }

  private static void assertSqlState(String state, String sql) {
    SQLException e =
        assertThrows(
            SQLException.class,
            () -> {
              try (Connection c = connection();
                  Statement s = c.createStatement()) {
                s.execute(sql);
              }
            });
    assertEquals(state, e.getSQLState());
  }

  private static String workflowCount(String table) {
    return "select count(*) from workflow."
        + table
        + " x join workflow.wf_version v on v.id=x.version_id and v.tenant_id=x.tenant_id join"
        + " workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id where"
        + " d.process_code='P008' and d.tenant_id='"
        + TENANT
        + "' and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted and x.tenant_id='"
        + TENANT
        + "' and not x.is_deleted and v.id=(select v2.id from workflow.wf_version v2 join"
        + " workflow.wf_definition d2 on d2.id=v2.definition_id and d2.tenant_id=v2.tenant_id where"
        + " d2.process_code='P008' and d2.tenant_id='"
        + TENANT
        + "' and not d2.is_deleted and v2.status='PUBLISHED' and not v2.is_deleted order by"
        + " v2.version_no desc,v2.id limit 1)";
  }

  private static long scalar(Statement s, String sql) throws SQLException {
    try (var r = s.executeQuery(sql)) {
      r.next();
      return r.getLong(1);
    }
  }

  private static Connection connection() throws SQLException {
    return DriverManager.getConnection(omsUrl, POSTGRES.getUsername(), POSTGRES.getPassword());
  }

  private static Path root() {
    Path p = Path.of("").toAbsolutePath();
    while (p != null) {
      if (Files.exists(p.resolve("mvnw"))) {
        return p;
      }
      p = p.getParent();
    }
    throw new IllegalStateException("repository root not found");
  }

  private static UUID id(String v) {
    return UUID.fromString(v);
  }
}
