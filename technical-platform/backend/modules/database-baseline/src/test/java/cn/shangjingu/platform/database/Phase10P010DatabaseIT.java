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

class Phase10P010DatabaseIT {

  private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-000000001010"),
      EMPLOYEE = UUID.fromString("10000000-0000-0000-0000-000000001010"),
      CENTER = UUID.fromString("11000000-0000-0000-0000-000000001010"),
      POSITION = UUID.fromString("12000000-0000-0000-0000-000000001010"),
      USER = UUID.fromString("13000000-0000-0000-0000-000000001010"),
      IDENTITY = UUID.fromString("14000000-0000-0000-0000-000000001010"),
      ASSIGNMENT = UUID.fromString("20000000-0000-0000-0000-000000001010"),
      EVENT = UUID.fromString("21000000-0000-0000-0000-000000001010"),
      POLICY = UUID.fromString("22000000-0000-0000-0000-000000001010"),
      GRANT = UUID.fromString("23000000-0000-0000-0000-000000001010");

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
          .withDatabaseName("postgres")
          .withUsername("postgres")
          .withPassword("phase10-p010-bootstrap");

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
                    "PHASE10_P010",
                    "sjg_tenant_name",
                    "P010 database test"))
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
  void migrationPublishesSourceWorkflowAndFailClosedPermissionPolicy() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from core.sequence_rule where tenant_id='"
                  + TENANT
                  + "' and rule_code='P010' and not is_deleted"));
      assertEquals(
          7,
          scalar(
              s,
              "select count(*) from iam.permission where tenant_id='"
                  + TENANT
                  + "' and permission_code like 'p010.learning.%' and not is_deleted"));
      assertEquals(11, scalar(s, workflowCount("wf_node")));
      assertEquals(10, scalar(s, workflowCount("wf_transition")));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from workflow.wf_form_definition where tenant_id='"
                  + TENANT
                  + "' and form_code='CTR-P010-F01' and validation_schema->'guards' ?"
                  + " 'approved-policy-only' and not is_deleted"));
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from learning.qualification_permission_policy where tenant_id='"
                  + TENANT
                  + "' and enabled and approval_reference='APPROVAL-P010-001' and approved_by is"
                  + " not null and approved_at is not null"));
      assertEquals(
          0,
          scalar(
              s,
              "select count(*) from information_schema.role_table_grants where grantee in"
                  + " ('sjg_api_runtime','sjg_worker_runtime') and table_schema='learning' and"
                  + " table_name in ('learning_assignment_event','qualification_permission_grant')"
                  + " and privilege_type in ('UPDATE','DELETE','TRUNCATE')"));
    }
  }

  @Test
  void qualificationEvidenceAndExecutedGrantAreAppendOnly() {
    assertSqlState(
        "55000",
        "update learning.learning_assignment_event set event_type='TAMPERED' where id='"
            + EVENT
            + "'");
    assertSqlState(
        "55000", "delete from learning.qualification_permission_grant where id='" + GRANT + "'");
  }

  @Test
  void qualificationGrantIsEffectiveOnlyInsideApprovedDates() throws Exception {
    try (Connection c = connection();
        Statement s = c.createStatement()) {
      assertEquals(
          1,
          scalar(
              s,
              "select count(*) from learning.qualification_permission_grant where tenant_id='"
                  + TENANT
                  + "' and user_id='"
                  + USER
                  + "' and identity_id='"
                  + IDENTITY
                  + "' and execution_status='ACTIVE' and effective_start_date<=current_date and"
                  + " effective_end_date>=current_date"));
      assertSqlState(
          "23514",
          "insert into"
              + " learning.qualification_permission_grant(id,tenant_id,assignment_id,policy_id,employee_id,user_id,identity_id,permission_id,data_scope_code,effective_start_date,effective_end_date,executed_by)"
              + " select gen_random_uuid(),'"
              + TENANT
              + "','"
              + ASSIGNMENT
              + "','"
              + POLICY
              + "','"
              + EMPLOYEE
              + "','"
              + USER
              + "','"
              + IDENTITY
              + "',permission_id,'SELF',current_date,current_date-1,'"
              + EMPLOYEE
              + "' from learning.qualification_permission_policy where id='"
              + POLICY
              + "'");
    }
  }

  @Test
  void crossTenantEvidenceAndGrantReferencesAreRejected() {
    String otherTenant = "00000000-0000-0000-0000-000000009999";
    assertSqlState(
        "23514",
        "insert into"
            + " learning.learning_assignment_event(tenant_id,assignment_id,event_seq,event_type,evidence,actor_employee_id)"
            + " values ('"
            + otherTenant
            + "','"
            + ASSIGNMENT
            + "',2,'TAMPERED','{}'::jsonb,'"
            + EMPLOYEE
            + "')");
    assertSqlState(
        "23514",
        "insert into"
            + " learning.qualification_permission_grant(tenant_id,assignment_id,policy_id,employee_id,user_id,identity_id,permission_id,data_scope_code,effective_start_date,effective_end_date,executed_by)"
            + " select '"
            + otherTenant
            + "','"
            + ASSIGNMENT
            + "','"
            + POLICY
            + "','"
            + EMPLOYEE
            + "','"
            + USER
            + "','"
            + IDENTITY
            + "',permission_id,'SELF',current_date,current_date+1,'"
            + EMPLOYEE
            + "' from learning.qualification_permission_policy where id='"
            + POLICY
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
              + "','P010_CENTER','P010 Center','CENTER','p010_center'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POSITION
              + "','"
              + TENANT
              + "','P010_POS','P010 Position','"
              + CENTER
              + "','ACTIVE')");
      s.execute(
          "insert into"
              + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
              + " values ('"
              + EMPLOYEE
              + "','"
              + TENANT
              + "','P010-E001','P010 Employee','ACTIVE',current_date-30,'"
              + CENTER
              + "','"
              + POSITION
              + "')");
      s.execute(
          "insert into iam.user_account(id,tenant_id,login_name,password_hash,status) values ('"
              + USER
              + "','"
              + TENANT
              + "','p010.db','test','ACTIVE')");
      s.execute(
          "insert into"
              + " iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at)"
              + " values ('"
              + IDENTITY
              + "','"
              + TENANT
              + "','"
              + USER
              + "','"
              + EMPLOYEE
              + "','EMPLOYEE','P010 DB','"
              + CENTER
              + "','"
              + POSITION
              + "',true,now()-interval '1 day')");
      s.execute(
          "insert into"
              + " learning.learning_assignment(id,tenant_id,business_no,status,created_by,owner_center_id,owner_employee_id,completion_rate,content_version,course_team_name,course_version_id,period_or_course_no,qualification_effective_date,qualification_expire_date)"
              + " values ('"
              + ASSIGNMENT
              + "','"
              + TENANT
              + "','P010-DB-1','Qualification effective','"
              + EMPLOYEE
              + "','"
              + CENTER
              + "','"
              + EMPLOYEE
              + "',100,'v1','Safety course','SAFETY-V1','SAFE-001',current_date,current_date+30)");
      s.execute(
          "insert into"
              + " learning.learning_assignment_event(id,tenant_id,assignment_id,event_seq,event_type,evidence,actor_employee_id)"
              + " values ('"
              + EVENT
              + "','"
              + TENANT
              + "','"
              + ASSIGNMENT
              + "',1,'CERTIFY','{\"decision\":\"QUALIFIED\"}'::jsonb,'"
              + EMPLOYEE
              + "')");
      s.execute(
          "insert into"
              + " learning.qualification_permission_policy(id,tenant_id,course_version_id,permission_id,data_scope_code,enabled,approval_reference,approved_by,approved_at)"
              + " select '"
              + POLICY
              + "','"
              + TENANT
              + "','SAFETY-V1',id,'SELF',true,'APPROVAL-P010-001','"
              + EMPLOYEE
              + "',now() from iam.permission where tenant_id='"
              + TENANT
              + "' and permission_code='p010.learning.read'");
      s.execute(
          "insert into"
              + " learning.qualification_permission_grant(id,tenant_id,assignment_id,policy_id,employee_id,user_id,identity_id,permission_id,data_scope_code,effective_start_date,effective_end_date,executed_by)"
              + " select '"
              + GRANT
              + "','"
              + TENANT
              + "','"
              + ASSIGNMENT
              + "','"
              + POLICY
              + "','"
              + EMPLOYEE
              + "','"
              + USER
              + "','"
              + IDENTITY
              + "',permission_id,'SELF',current_date,current_date+30,'"
              + EMPLOYEE
              + "' from learning.qualification_permission_policy where id='"
              + POLICY
              + "'");
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
        + " d.process_code='P010' and v.status='PUBLISHED' and x.tenant_id='"
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
