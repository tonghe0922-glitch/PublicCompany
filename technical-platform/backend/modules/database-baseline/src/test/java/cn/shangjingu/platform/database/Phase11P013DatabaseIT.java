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

class Phase11P013DatabaseIT {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000001013"),
      OTHER = id("00000000-0000-0000-0000-000000009013"),
      CENTER = id("11000000-0000-0000-0000-000000001013"),
      OTHER_CENTER = id("11000000-0000-0000-0000-000000009013"),
      OWNER = id("10000000-0000-0000-0000-000000001013"),
      ACTOR = id("10000000-0000-0000-0000-000000001014"),
      OTHER_ACTOR = id("10000000-0000-0000-0000-000000009013"),
      REWARD = id("20000000-0000-0000-0000-000000001013"),
      EVENT = id("21000000-0000-0000-0000-000000001013"),
      POINTS = id("22000000-0000-0000-0000-000000001013"),
      BONUS = id("22000000-0000-0000-0000-000000001014"),
      RECEIPT = id("23000000-0000-0000-0000-000000001013");

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
          .withDatabaseName("postgres")
          .withUsername("postgres")
          .withPassword("phase11-p013-bootstrap");

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
                    "PHASE11_P013",
                    "sjg_tenant_name",
                    "P013 database test"))
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
  void migrationPublishesExactWorkflowFormPermissionsAndGrants() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      assertEquals(
          1,
          scalar(s, "select count(*) from flyway_schema_history where version='122' and success"));
      assertEquals(
          6,
          scalar(
              s,
              "select count(*) from iam.permission where tenant_id='"
                  + TENANT
                  + "' and permission_code like 'p013.reward.%' and not is_deleted"));
      assertEquals(10, scalar(s, workflowCount("wf_node")));
      assertEquals(11, scalar(s, workflowCount("wf_transition")));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from workflow.wf_form_definition where tenant_id='"
                  + TENANT
                  + "' and form_code='CTR-P013-F01' and validation_schema->'guards' ?"
                  + " 'no-direct-p015-write' and not is_deleted"));
      assertEquals(
          3,
          scalar(
              s,
              "select count(distinct table_name) from information_schema.role_table_grants where"
                  + " grantee='sjg_api_runtime' and table_schema='reward' and table_name in"
                  + " ('reward_case_event','reward_impact_instruction','reward_impact_receipt') and"
                  + " privilege_type='INSERT'"));
      assertEquals(
          0,
          scalar(
              s,
              "select count(*) from information_schema.role_table_grants where grantee in"
                  + " ('sjg_api_runtime','sjg_worker_runtime') and table_schema='reward' and"
                  + " table_name in"
                  + " ('reward_case_event','reward_impact_instruction','reward_impact_receipt') and"
                  + " privilege_type in ('UPDATE','DELETE','TRUNCATE')"));
    }
  }

  @Test
  void sourceContributionIsUniqueAndFactsAreAppendOnly() {
    assertSqlState(
        "23505",
        "insert into"
            + " reward.reward_case(tenant_id,business_no,status,employee_event_type,fact_occurred_at,fact_summary,impact_level,source_fact_key)"
            + " values ('"
            + TENANT
            + "','P013-DUP','S01','REWARD',now(),'duplicate','HIGH','SOURCE-FACT-001')");
    assertSqlState(
        "55000",
        "update reward.reward_case_event set event_type='TAMPER' where id='" + EVENT + "'");
    assertSqlState(
        "55000", "delete from reward.reward_impact_instruction where id='" + BONUS + "'");
    assertSqlState("55000", "delete from reward.reward_impact_receipt where id='" + RECEIPT + "'");
  }

  @Test
  void impactShapeAndTenantReceiptLinkageFailClosed() {
    assertSqlState(
        "23514",
        "insert into"
            + " reward.reward_impact_instruction(tenant_id,reward_case_id,impact_type,requested_points,authority_reference,evidence,instructed_by)"
            + " values ('"
            + TENANT
            + "','"
            + REWARD
            + "','BONUS',10,'BAD-SHAPE','{}','"
            + ACTOR
            + "')");
    assertSqlState(
        "23514",
        "insert into"
            + " reward.reward_case_event(tenant_id,reward_case_id,event_seq,event_type,evidence,actor_employee_id)"
            + " values ('"
            + TENANT
            + "','"
            + REWARD
            + "',2,'CROSS_TENANT','{}','"
            + OTHER_ACTOR
            + "')");
    assertSqlState(
        "23514",
        "insert into"
            + " reward.reward_impact_receipt(tenant_id,reward_case_id,instruction_id,receipt_type,external_reference,external_occurred_at,evidence,received_by)"
            + " values ('"
            + TENANT
            + "','"
            + REWARD
            + "','"
            + BONUS
            + "','P015_POINT_LEDGER','WRONG-TYPE',now(),'{}','"
            + ACTOR
            + "')");
  }

  @Test
  void impactInstructionsDoNotWriteP015Ledger() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      assertEquals(
          2,
          scalar(
              s,
              "select count(*) from reward.reward_impact_instruction where tenant_id='"
                  + TENANT
                  + "' and reward_case_id='"
                  + REWARD
                  + "'"));
      assertEquals(
          0,
          scalar(
              s, "select count(*) from reward.point_transaction where tenant_id='" + TENANT + "'"));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from reward.reward_impact_receipt where tenant_id='"
                  + TENANT
                  + "' and receipt_type='P015_POINT_LEDGER'"));
    }
  }

  private static void seed() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      s.execute(
          "insert into core.tenant(id,tenant_code,tenant_name,status) values ('"
              + OTHER
              + "','P013_OTHER','P013 Other','ACTIVE')");
      s.execute(
          "insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values"
              + " ('"
              + CENTER
              + "','"
              + TENANT
              + "','P013_CENTER','P013 Center','CENTER','p013_center'::ltree,'ACTIVE'),('"
              + OTHER_CENTER
              + "','"
              + OTHER
              + "','P013_OTHER','P013 Other','CENTER','p013_other'::ltree,'ACTIVE')");
      s.execute(
          "insert into"
              + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id)"
              + " values ('"
              + OWNER
              + "','"
              + TENANT
              + "','P013-E01','P013 Owner','ACTIVE',current_date-90,'"
              + CENTER
              + "'),('"
              + ACTOR
              + "','"
              + TENANT
              + "','P013-E02','P013 Actor','ACTIVE',current_date-90,'"
              + CENTER
              + "'),('"
              + OTHER_ACTOR
              + "','"
              + OTHER
              + "','P013-X01','P013 Other','ACTIVE',current_date-90,'"
              + OTHER_CENTER
              + "')");
      s.execute(
          "insert into"
              + " reward.reward_case(id,tenant_id,business_no,status,created_by,updated_by,source_channel,business_date,subject,priority,risk_level,owner_center_id,owner_employee_id,employee_event_type,fact_occurred_at,fact_summary,impact_level,source_fact_key,recommended_reward_level,approved_reward_level)"
              + " values ('"
              + REWARD
              + "','"
              + TENANT
              + "','P013-DB-1','Impact instruction','"
              + ACTOR
              + "','"
              + ACTOR
              + "','PORTAL',current_date,'P013 reward case','NORMAL','HIGH','"
              + CENTER
              + "','"
              + OWNER
              + "','CONTRIBUTION',now(),'Verified"
              + " contribution','HIGH','SOURCE-FACT-001','GOLD','GOLD')");
      s.execute(
          "insert into"
              + " reward.reward_case_event(id,tenant_id,reward_case_id,event_seq,event_type,evidence,actor_employee_id)"
              + " values ('"
              + EVENT
              + "','"
              + TENANT
              + "','"
              + REWARD
              + "',1,'APPROVE','{}','"
              + ACTOR
              + "')");
      s.execute(
          "insert into"
              + " reward.reward_impact_instruction(id,tenant_id,reward_case_id,impact_type,requested_points,authority_reference,evidence,instructed_by)"
              + " values ('"
              + POINTS
              + "','"
              + TENANT
              + "','"
              + REWARD
              + "','HONOR_POINTS',100,'RULE-P013-POINTS-01','{}','"
              + ACTOR
              + "')");
      s.execute(
          "insert into"
              + " reward.reward_impact_instruction(id,tenant_id,reward_case_id,impact_type,approved_amount,authority_reference,evidence,instructed_by)"
              + " values ('"
              + BONUS
              + "','"
              + TENANT
              + "','"
              + REWARD
              + "','BONUS',500.00,'BONUS-AUTH-001','{}','"
              + ACTOR
              + "')");
      s.execute(
          "insert into"
              + " reward.reward_impact_receipt(id,tenant_id,reward_case_id,instruction_id,receipt_type,external_reference,external_occurred_at,evidence,received_by)"
              + " values ('"
              + RECEIPT
              + "','"
              + TENANT
              + "','"
              + REWARD
              + "','"
              + POINTS
              + "','P015_POINT_LEDGER','P015-LEDGER-001',now(),'{}','"
              + ACTOR
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
        + " d.process_code='P013' and v.status='PUBLISHED' and x.tenant_id='"
        + TENANT
        + "' and not x.is_deleted";
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

  private static UUID id(String value) {
    return UUID.fromString(value);
  }

  private static Path root() {
    Path p = Path.of("").toAbsolutePath();
    while (p != null) {
      if (Files.exists(p.resolve("AGENT.md"))) {
        return p;
      }
      p = p.getParent();
    }
    throw new IllegalStateException("repository root not found");
  }
}
