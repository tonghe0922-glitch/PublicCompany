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

class Phase10P009DatabaseIT {

  private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-000000001009");

  private static final UUID EMPLOYEE = UUID.fromString("10000000-0000-0000-0000-000000001019");

  private static final UUID CENTER = UUID.fromString("11000000-0000-0000-0000-000000001009");

  private static final UUID POSITION = UUID.fromString("12000000-0000-0000-0000-000000001009");

  private static final UUID REQUEST = UUID.fromString("20000000-0000-0000-0000-000000001009");

  private static final UUID ITEM = UUID.fromString("21000000-0000-0000-0000-000000001009");

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
          .withDatabaseName("postgres")
          .withUsername("postgres")
          .withPassword("phase10-p009-bootstrap");

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
    Flyway flyway =
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
                    "PHASE10_P009",
                    "sjg_tenant_name",
                    "P009 database test"))
            .cleanDisabled(true)
            .load();
    assertTrue(flyway.migrate().success);
    flyway.validate();
    assertEquals(0, flyway.migrate().migrationsExecuted);
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
                  + "' and rule_code='P009' and not is_deleted"));
      assertEquals(
          6,
          scalar(
              s,
              "select count(*) from iam.permission where tenant_id='"
                  + TENANT
                  + "' and permission_code like 'p009.overtime.%' and not is_deleted"));
      assertEquals(10, scalar(s, workflowCount("wf_node")));
      assertEquals(14, scalar(s, workflowCount("wf_transition")));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from workflow.wf_form_definition where tenant_id='"
                  + TENANT
                  + "' and form_code='EMP-P009-F01' and validation_schema->'guards' ?"
                  + " 'time-overlap' and not is_deleted"));
      assertEquals(
          0,
          scalar(
              s,
              "select count(*) from information_schema.role_table_grants where grantee in"
                  + " ('sjg_api_runtime','sjg_worker_runtime') and table_schema='attendance' and"
                  + " table_name='overtime_request_item' and privilege_type in"
                  + " ('UPDATE','DELETE','TRUNCATE')"));
    }
  }

  @Test
  void factualAndPayrollEvidenceIsAppendOnly() {
    assertSqlState(
        "55000",
        "update attendance.overtime_request_item set item_name='tampered' where tenant_id='"
            + TENANT
            + "' and id='"
            + ITEM
            + "'");
    assertSqlState(
        "55000",
        "delete from attendance.overtime_request_item where tenant_id='"
            + TENANT
            + "' and id='"
            + ITEM
            + "'");
  }

  private static void seed() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      s.execute(
          "insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values"
              + " ('"
              + CENTER
              + "','"
              + TENANT
              + "','P009_CENTER','P009 Center','CENTER','p009_center'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POSITION
              + "','"
              + TENANT
              + "','P009_POS','P009 Position','"
              + CENTER
              + "','ACTIVE')");
      s.execute(
          "insert into"
              + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
              + " values ('"
              + EMPLOYEE
              + "','"
              + TENANT
              + "','P009-E001','P009 Employee','ACTIVE',current_date-30,'"
              + CENTER
              + "','"
              + POSITION
              + "')");
      s.execute(
          "insert into"
              + " attendance.overtime_request(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,business_date,subject,reason,priority,owner_center_id,owner_employee_id,planned_start_at,planned_finish_at,attendance_type,duration_hours,start_at,end_at)"
              + " values ('"
              + REQUEST
              + "','"
              + TENANT
              + "','P009-DB-1','DRAFT',0,'"
              + EMPLOYEE
              + "','"
              + EMPLOYEE
              + "','TEST',current_date,'P009 append only evidence','P009 database immutable"
              + " evidence','NORMAL','"
              + CENTER
              + "','"
              + EMPLOYEE
              + "',now()+interval '1 day',now()+interval '3 hours 1"
              + " day','OVERTIME',2,now()+interval '1 day',now()+interval '3 hours 1 day')");
      s.execute(
          "insert into"
              + " attendance.overtime_request_item(id,tenant_id,master_id,item_seq,item_name,field_code,item_value_json,created_by)"
              + " values ('"
              + ITEM
              + "','"
              + TENANT
              + "','"
              + REQUEST
              + "',1,'external"
              + " receipt','external_compensation_receipt','{\"reference\":\"EXT-1\"}'::jsonb,'"
              + EMPLOYEE
              + "')");
    }
  }

  private static void assertSqlState(String expected, String sql) {
    SQLException e =
        assertThrows(
            SQLException.class,
            () -> {
              try (Connection c = connection();
                  Statement s = c.createStatement()) {
                s.execute(sql);
              }
            });
    assertEquals(expected, e.getSQLState());
  }

  private static String workflowCount(String table) {
    return "select count(*) from workflow."
        + table
        + " x join workflow.wf_version v on v.id=x.version_id and v.tenant_id=x.tenant_id join"
        + " workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id where"
        + " d.process_code='P009' and d.tenant_id='"
        + TENANT
        + "' and not d.is_deleted and v.status='PUBLISHED' and not v.is_deleted and x.tenant_id='"
        + TENANT
        + "' and not x.is_deleted and v.id=(select v2.id from workflow.wf_version v2 join"
        + " workflow.wf_definition d2 on d2.id=v2.definition_id and d2.tenant_id=v2.tenant_id where"
        + " d2.process_code='P009' and d2.tenant_id='"
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
}
