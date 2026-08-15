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

class Phase11P014DatabaseIT {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000001014"),
      OTHER = id("00000000-0000-0000-0000-000000009014"),
      CENTER = id("11000000-0000-0000-0000-000000001014"),
      OTHER_CENTER = id("11000000-0000-0000-0000-000000009014"),
      AFFECTED = id("10000000-0000-0000-0000-000000001014"),
      ACTOR = id("10000000-0000-0000-0000-000000001015"),
      OTHER_ACTOR = id("10000000-0000-0000-0000-000000009014"),
      CASE = id("20000000-0000-0000-0000-000000001014"),
      EVENT = id("21000000-0000-0000-0000-000000001014"),
      DECISION = id("22000000-0000-0000-0000-000000001014"),
      IMPACT = id("23000000-0000-0000-0000-000000001014"),
      RECEIPT = id("24000000-0000-0000-0000-000000001014");

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
          .withDatabaseName("postgres")
          .withUsername("postgres")
          .withPassword("phase11-p014-bootstrap");

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
                    "PHASE11_P014",
                    "sjg_tenant_name",
                    "P014 database test"))
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
          scalar(s, "select count(*) from flyway_schema_history where version='123' and success"));
      assertEquals(
          64,
          scalar(
              s,
              "select character_maximum_length from information_schema.columns where"
                  + " table_schema='reward' and table_name='discipline_case' and"
                  + " column_name='status'"));
      assertEquals(
          6,
          scalar(
              s,
              "select count(*) from iam.permission where tenant_id='"
                  + TENANT
                  + "' and permission_code like 'p014.discipline.%' and not is_deleted"));
      assertEquals(13, scalar(s, workflowCount("wf_node")));
      assertEquals(15, scalar(s, workflowCount("wf_transition")));
      assertEquals(
          5,
          scalar(
              s,
              "select count(*) from workflow.wf_node n join workflow.wf_version v on"
                  + " v.id=n.version_id and v.tenant_id=n.tenant_id join workflow.wf_definition d"
                  + " on d.id=v.definition_id and d.tenant_id=v.tenant_id where n.tenant_id='"
                  + TENANT
                  + "' and d.process_code='P014' and v.status='PUBLISHED' and"
                  + " n.actor_rule->>'allowInitiator'='true' and not n.is_deleted"));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from workflow.wf_form_definition where tenant_id='"
                  + TENANT
                  + "' and form_code='CTR-P014-F01' and validation_schema->'guards' ?"
                  + " 'no-automated-liability-or-sanction' and not is_deleted"));
      assertEquals(
          4,
          scalar(
              s,
              "select count(distinct table_name) from information_schema.role_table_grants where"
                  + " grantee='sjg_api_runtime' and table_schema='reward' and table_name in"
                  + " ('discipline_case_event','discipline_decision_fact','discipline_impact_instruction','discipline_impact_receipt')"
                  + " and privilege_type='INSERT'"));
      assertEquals(
          0,
          scalar(
              s,
              "select count(*) from information_schema.role_table_grants where grantee in"
                  + " ('sjg_api_runtime','sjg_worker_runtime') and table_schema='reward' and"
                  + " table_name in"
                  + " ('discipline_case_event','discipline_decision_fact','discipline_impact_instruction','discipline_impact_receipt')"
                  + " and privilege_type in ('UPDATE','DELETE','TRUNCATE')"));
    }
  }

  @Test
  void sourceAndOriginalDecisionAreAppendOnly() {
    assertSqlState(
        "23505",
        "insert into"
            + " reward.discipline_case(tenant_id,business_no,status,customer_id,customer_name,employee_event_type,fact_occurred_at,fact_summary,impact_level,source_fact_key)"
            + " values ('"
            + TENANT
            + "','P014-DUP','S01','OBJ-2','Object','DISCIPLINE',now(),'duplicate"
            + " fact','L2','DISCIPLINE-SOURCE-001')");
    assertSqlState(
        "55000",
        "update reward.discipline_case_event set event_type='TAMPER' where id='" + EVENT + "'");
    assertSqlState(
        "55000", "delete from reward.discipline_decision_fact where id='" + DECISION + "'");
    assertSqlState(
        "55000", "delete from reward.discipline_impact_receipt where id='" + RECEIPT + "'");
  }

  @Test
  void tenantAndReceiptTypeLinkageFailClosed() {
    assertSqlState(
        "23514",
        "insert into"
            + " reward.discipline_case_event(tenant_id,discipline_case_id,event_seq,event_type,evidence,actor_employee_id)"
            + " values ('"
            + TENANT
            + "','"
            + CASE
            + "',2,'CROSS_TENANT','{}','"
            + OTHER_ACTOR
            + "')");
    assertSqlState(
        "23514",
        "insert into"
            + " reward.discipline_impact_receipt(tenant_id,discipline_case_id,instruction_id,receipt_type,external_reference,external_occurred_at,evidence,received_by)"
            + " values ('"
            + TENANT
            + "','"
            + CASE
            + "','"
            + IMPACT
            + "','HR_CASE_RECEIPT','WRONG-TYPE',now(),'{}','"
            + ACTOR
            + "')");
  }

  @Test
  void instructionAndReceiptDoNotMutateP015OrHrFacts() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from reward.discipline_impact_instruction where tenant_id='"
                  + TENANT
                  + "' and discipline_case_id='"
                  + CASE
                  + "'"));
      assertEquals(
          0,
          scalar(
              s, "select count(*) from reward.point_transaction where tenant_id='" + TENANT + "'"));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from reward.discipline_impact_receipt where tenant_id='"
                  + TENANT
                  + "' and receipt_type='P015_POINT_LEDGER'"));
      assertEquals(
          0,
          scalar(s, "select count(*) from org.employee_position where tenant_id='" + TENANT + "'"));
    }
  }

  private static void seed() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      s.execute(
          "insert into core.tenant(id,tenant_code,tenant_name,status) values ('"
              + OTHER
              + "','P014_OTHER','P014 Other','ACTIVE')");
      s.execute(
          "insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values"
              + " ('"
              + CENTER
              + "','"
              + TENANT
              + "','P014_CENTER','P014 Center','CENTER','p014_center'::ltree,'ACTIVE'),('"
              + OTHER_CENTER
              + "','"
              + OTHER
              + "','P014_OTHER','P014 Other','CENTER','p014_other'::ltree,'ACTIVE')");
      s.execute(
          "insert into"
              + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id)"
              + " values ('"
              + AFFECTED
              + "','"
              + TENANT
              + "','P014-E01','P014 Affected','ACTIVE',current_date-90,'"
              + CENTER
              + "'),('"
              + ACTOR
              + "','"
              + TENANT
              + "','P014-E02','P014 Actor','ACTIVE',current_date-90,'"
              + CENTER
              + "'),('"
              + OTHER_ACTOR
              + "','"
              + OTHER
              + "','P014-X01','P014 Other','ACTIVE',current_date-90,'"
              + OTHER_CENTER
              + "')");
      s.execute(
          "insert into"
              + " reward.discipline_case(id,tenant_id,business_no,status,created_by,updated_by,source_channel,business_date,subject,reason,priority,risk_level,owner_center_id,owner_employee_id,customer_id,customer_name,employee_event_type,fact_occurred_at,fact_summary,impact_level,source_fact_key,affected_employee_id,business_object_type,business_object_no,business_object_name)"
              + " values ('"
              + CASE
              + "','"
              + TENANT
              + "','P014-DB-1','Impact execution','"
              + ACTOR
              + "','"
              + ACTOR
              + "','PORTAL',current_date,'P014 private case','Source-backed disciplinary"
              + " clue','NORMAL','L2','"
              + CENTER
              + "','"
              + AFFECTED
              + "','OBJ-001','Internal object','DISCIPLINE',now(),'Verified private fact"
              + " summary','L2','DISCIPLINE-SOURCE-001','"
              + AFFECTED
              + "','INTERNAL_CASE','OBJ-001','Internal object')");
      s.execute(
          "insert into"
              + " reward.discipline_case_event(id,tenant_id,discipline_case_id,event_seq,event_type,evidence,actor_employee_id)"
              + " values ('"
              + EVENT
              + "','"
              + TENANT
              + "','"
              + CASE
              + "',1,'RECORD_DECISION','{}','"
              + ACTOR
              + "')");
      s.execute(
          "insert into"
              + " reward.discipline_decision_fact(id,tenant_id,discipline_case_id,decision_kind,outcome,authority_reference,decided_at,evidence,recorded_by)"
              + " values ('"
              + DECISION
              + "','"
              + TENANT
              + "','"
              + CASE
              + "','ORIGINAL','RECORDED','AUTH-P014-001',now(),'{}','"
              + ACTOR
              + "')");
      s.execute(
          "insert into"
              + " reward.discipline_impact_instruction(id,tenant_id,discipline_case_id,impact_type,authority_reference,evidence,instructed_by)"
              + " values ('"
              + IMPACT
              + "','"
              + TENANT
              + "','"
              + CASE
              + "','POINT_ADJUSTMENT','AUTH-P014-POINTS','{}','"
              + ACTOR
              + "')");
      s.execute(
          "insert into"
              + " reward.discipline_impact_receipt(id,tenant_id,discipline_case_id,instruction_id,receipt_type,external_reference,external_occurred_at,evidence,received_by)"
              + " values ('"
              + RECEIPT
              + "','"
              + TENANT
              + "','"
              + CASE
              + "','"
              + IMPACT
              + "','P015_POINT_LEDGER','P015-LEDGER-014',now(),'{}','"
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
        + " d.process_code='P014' and v.status='PUBLISHED' and x.tenant_id='"
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
