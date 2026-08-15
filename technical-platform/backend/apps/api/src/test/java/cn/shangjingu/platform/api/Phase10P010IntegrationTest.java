package cn.shangjingu.platform.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@SpringBootTest(classes = ApiApplication.class)
@AutoConfigureMockMvc
class Phase10P010IntegrationTest {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000002010"),
      CENTER_A = id("10000000-0000-0000-0000-000000003210"),
      CENTER_B = id("10000000-0000-0000-0000-000000003211"),
      POS_A = id("20000000-0000-0000-0000-000000003210"),
      POS_B = id("20000000-0000-0000-0000-000000003211");
  private static final UUID LEARNER = id("30000000-0000-0000-0000-000000003210"),
      MANAGER = id("30000000-0000-0000-0000-000000003211"),
      ASSESSOR = id("30000000-0000-0000-0000-000000003212"),
      CERTIFIER = id("30000000-0000-0000-0000-000000003213"),
      LINKER = id("30000000-0000-0000-0000-000000003214"),
      TECH = id("30000000-0000-0000-0000-000000003215"),
      OUT = id("30000000-0000-0000-0000-000000003216");
  private static final String PASSWORD = "P010-Live-Test-9q!",
      API_PASSWORD = "p010_api_" + shortId(),
      AUDIT_PASSWORD = "p010_audit_" + shortId();

  private static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
          .withDatabaseName("postgres")
          .withUsername("postgres")
          .withPassword("bootstrap-" + shortId());

  private static final GenericContainer<?> REDIS =
      new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine")).withExposedPorts(6379);

  static {
    POSTGRES.start();
    REDIS.start();
    try {
      prepare();
    } catch (Exception e) {
      POSTGRES.stop();
      REDIS.stop();
      throw new ExceptionInInitializerError(e);
    }
  }

  @Autowired MockMvc mvc;

  @Autowired ObjectMapper mapper;

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", () -> url("sjg_oms"));
    r.add("spring.datasource.username", () -> "sjg_api_runtime");
    r.add("spring.datasource.password", () -> API_PASSWORD);
    r.add("spring.data.redis.host", REDIS::getHost);
    r.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
    r.add("sjg.audit.datasource.url", () -> url("sjg_audit"));
    r.add("sjg.audit.datasource.username", () -> "sjg_audit_writer");
    r.add("sjg.audit.datasource.password", () -> AUDIT_PASSWORD);
  }

  @AfterAll
  static void stop() {
    REDIS.stop();
    POSTGRES.stop();
  }

  @Test
  void realHttpLifecycleSeparatesLearningFactsAndExecutesOnlyApprovedQualificationPolicy()
      throws Exception {
    String learner = login("learner"),
        manager = login("manager"),
        assessor = login("assessor"),
        certifier = login("certifier"),
        linker = login("linker"),
        tech = login("tech"),
        out = login("out");
    ObjectNode create =
        mapper
            .createObjectNode()
            .put("businessDate", LocalDate.now().toString())
            .put("subject", "High-risk operations qualification course")
            .put("reason", "Position risk matrix requires current qualification")
            .put("ownerEmployeeId", LEARNER.toString())
            .put("courseVersionId", "SAFETY-V1")
            .put("contentVersion", "2026.08")
            .put("courseTeamName", "Safety Operations Academy")
            .put("periodOrCourseNo", "SAFE-001")
            .put("learnerProfile", "High-risk position operators")
            .set("evidence", evidence("approved publication package"));
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments")
                .contentType(MediaType.APPLICATION_JSON)
                .content(create.toString())
                .header("Idempotency-Key", "unauth"))
        .andExpect(status().isUnauthorized());
    JsonNode current =
        json(
            mvc.perform(
                    post("/api/v1/processes/P010/learning-assignments")
                        .header("Authorization", bearer(manager))
                        .header("Idempotency-Key", "create-approved")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn());
    String assignmentId = current.path("id").asText();
    assertEquals("S01", current.path("currentNodeCode").asText());
    assertEquals(
        assignmentId,
        json(mvc.perform(
                    post("/api/v1/processes/P010/learning-assignments")
                        .header("Authorization", bearer(manager))
                        .header("Idempotency-Key", "create-approved")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn())
            .path("id")
            .asText());
    assertEquals(
        0,
        json(mvc.perform(
                    get("/api/v1/processes/P010/learning-assignments")
                        .header("Authorization", bearer(out)))
                .andExpect(status().isOk())
                .andReturn())
            .size());
    mvc.perform(
            get("/api/v1/processes/P010/learning-assignments/" + assignmentId)
                .header("Authorization", bearer(out)))
        .andExpect(status().isForbidden());
    JsonNode masked =
        json(
            mvc.perform(
                    get("/api/v1/processes/P010/learning-assignments/" + assignmentId)
                        .header("Authorization", bearer(tech)))
                .andExpect(status().isOk())
                .andReturn());
    assertTrue(masked.path("reason").isNull());
    assertTrue(masked.path("score1000").isNull());
    assertTrue(masked.path("events").isArray() && masked.path("events").isEmpty());
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments/" + assignmentId + "/actions/PUBLISH")
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "stale")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(0).toString()))
        .andExpect(status().isConflict());
    current = act(manager, assignmentId, "PUBLISH", 1, action(1), "publish");
    current = act(manager, assignmentId, "ASSIGN", 2, action(2), "assign");
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments/"
                    + assignmentId
                    + "/actions/COMPLETE_LEARNING")
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "wrong-learner")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(3).toString()))
        .andExpect(status().isForbidden());
    current = act(learner, assignmentId, "COMPLETE_LEARNING", 3, action(3), "learning");
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments/"
                    + assignmentId
                    + "/actions/SUBMIT_EXAM")
                .header("Authorization", bearer(learner))
                .header("Idempotency-Key", "bad-score")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(4).put("score1000", 1001).toString()))
        .andExpect(status().isConflict());
    current = act(learner, assignmentId, "SUBMIT_EXAM", 4, action(4).put("score1000", 886), "exam");
    assertEquals(886, current.path("score1000").asInt());
    current =
        act(
            assessor,
            assignmentId,
            "RECORD_PRACTICAL",
            5,
            action(5)
                .put("practicalResult", "PASS: equipment isolation and emergency stop verified"),
            "practical");
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments/" + assignmentId + "/actions/CERTIFY")
                .header("Authorization", bearer(assessor))
                .header("Idempotency-Key", "same-certifier")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(6).toString()))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments/" + assignmentId + "/actions/CERTIFY")
                .header("Authorization", bearer(tech))
                .header("Idempotency-Key", "tech-certify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(6).toString()))
        .andExpect(status().isForbidden());
    current = act(certifier, assignmentId, "CERTIFY", 6, action(6), "certify");
    LocalDate effective = LocalDate.now(),
        expiry = effective.plusDays(365),
        retrain = expiry.minusDays(30);
    current =
        act(
            manager,
            assignmentId,
            "ACTIVATE",
            7,
            action(7)
                .put("effectiveDate", effective.toString())
                .put("expireDate", expiry.toString()),
            "activate");
    mvc.perform(
            post("/api/v1/processes/P010/learning-assignments/"
                    + assignmentId
                    + "/actions/LINK_PERMISSION")
                .header("Authorization", bearer(linker))
                .header("Idempotency-Key", "disabled-policy")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(8).toString()))
        .andExpect(status().isConflict());
    jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword())
        .update(
            "update learning.qualification_permission_policy set enabled=true where tenant_id=? and"
                + " course_version_id='SAFETY-V1'",
            TENANT);
    current = act(linker, assignmentId, "LINK_PERMISSION", 8, action(8), "link");
    JsonNode session =
        json(
            mvc.perform(get("/api/v1/session").header("Authorization", bearer(learner)))
                .andExpect(status().isOk())
                .andReturn());
    assertTrue(session.path("permissions").toString().contains("qualified.safety.access"));
    current =
        act(
            manager,
            assignmentId,
            "SCHEDULE_RECERTIFICATION",
            9,
            action(9).put("recertificationDate", retrain.toString()),
            "retrain");
    current = act(manager, assignmentId, "ARCHIVE", 10, action(10), "archive");
    assertEquals("END", current.path("currentNodeCode").asText());
    JdbcTemplate oms = jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword());
    UUID id = UUID.fromString(assignmentId);
    assertEquals(
        11,
        oms.queryForObject(
            "select count(*) from learning.learning_assignment_event where tenant_id=? and"
                + " assignment_id=?",
            Integer.class,
            TENANT,
            id));
    assertEquals(
        1,
        oms.queryForObject(
            "select count(*) from learning.qualification_permission_grant where tenant_id=? and"
                + " assignment_id=? and execution_status='ACTIVE'",
            Integer.class,
            TENANT,
            id));
    assertEquals(
        11,
        oms.queryForObject(
            "select count(*) from core.outbox_event where tenant_id=? and aggregate_id=? and"
                + " event_type='P010_LEARNING_EVENT'",
            Integer.class,
            TENANT,
            id));
    assertTrue(
        jdbc("sjg_audit", POSTGRES.getUsername(), POSTGRES.getPassword())
                .queryForObject(
                    "select count(*) from audit.operation_log where tenant_id=? and resource_id=?"
                        + " and action like 'P010_%'",
                    Integer.class, TENANT, id)
            >= 18);
  }

  private JsonNode act(
      String token, String id, String code, int version, ObjectNode body, String key)
      throws Exception {
    assertEquals(version, body.path("expectedVersion").asInt());
    return json(
        mvc.perform(
                post("/api/v1/processes/P010/learning-assignments/" + id + "/actions/" + code)
                    .header("Authorization", bearer(token))
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body.toString()))
            .andExpect(status().isOk())
            .andReturn());
  }

  private ObjectNode action(int v) {
    return mapper
        .createObjectNode()
        .put("expectedVersion", v)
        .putNull("score1000")
        .putNull("practicalResult")
        .putNull("effectiveDate")
        .putNull("expireDate")
        .putNull("recertificationDate")
        .put("resultSummary", "P010 source fact accepted")
        .set("evidence", evidence("immutable " + v));
  }

  private ObjectNode evidence(String note) {
    return mapper.createObjectNode().put("note", note).put("recordedAt", Instant.now().toString());
  }

  private String login(String name) throws Exception {
    return json(mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper
                            .createObjectNode()
                            .put("tenantCode", "PHASE10_P010")
                            .put("loginName", "p010." + name)
                            .put("password", PASSWORD)
                            .toString()))
            .andExpect(status().isOk())
            .andReturn())
        .path("accessToken")
        .asText();
  }

  private JsonNode json(MvcResult r) throws Exception {
    return mapper.readTree(r.getResponse().getContentAsByteArray());
  }

  private static String bearer(String t) {
    return "Bearer " + t;
  }

  private static void prepare() throws Exception {
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
      s.execute("alter role sjg_api_runtime password '" + API_PASSWORD + "'");
      s.execute("alter role sjg_audit_writer password '" + AUDIT_PASSWORD + "'");
      s.execute("create database sjg_oms");
      s.execute("create database sjg_audit");
    }
    Flyway.configure()
        .dataSource(url("sjg_oms"), POSTGRES.getUsername(), POSTGRES.getPassword())
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
                "P010 Integration Tenant"))
        .cleanDisabled(true)
        .load()
        .migrate();
    Flyway.configure()
        .dataSource(url("sjg_audit"), POSTGRES.getUsername(), POSTGRES.getPassword())
        .locations(
            "filesystem:" + root.resolve("technical-platform/database/flyway/audit"),
            "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/audit"))
        .cleanDisabled(true)
        .load()
        .migrate();
    seed();
  }

  private static void seed() throws Exception {
    String hash = new BCryptPasswordEncoder(12).encode(PASSWORD);
    try (Connection c =
            DriverManager.getConnection(
                url("sjg_oms"), POSTGRES.getUsername(), POSTGRES.getPassword());
        Statement s = c.createStatement()) {
      s.execute(
          "insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values"
              + " ('"
              + CENTER_A
              + "','"
              + TENANT
              + "','P010_A','P010 Center A','CENTER','p010_a'::ltree,'ACTIVE'),('"
              + CENTER_B
              + "','"
              + TENANT
              + "','P010_B','P010 Center B','CENTER','p010_b'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POS_A
              + "','"
              + TENANT
              + "','P010_PA','P010 Position A','"
              + CENTER_A
              + "','ACTIVE'),('"
              + POS_B
              + "','"
              + TENANT
              + "','P010_PB','P010 Position B','"
              + CENTER_B
              + "','ACTIVE')");
      UUID[] actors = {LEARNER, MANAGER, ASSESSOR, CERTIFIER, LINKER, TECH, OUT};
      for (int i = 0; i < actors.length; i++) {
        UUID center = i == 6 ? CENTER_B : CENTER_A, pos = i == 6 ? POS_B : POS_A;
        s.execute(
            "insert into"
                + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
                + " values ('"
                + actors[i]
                + "','"
                + TENANT
                + "','P010-E00"
                + (i + 1)
                + "','P010 Actor "
                + i
                + "','ACTIVE',current_date-30,'"
                + center
                + "','"
                + pos
                + "')");
      }
      s.execute(
          "insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled)"
              + " values ('"
              + TENANT
              + "','P010_SELF','P010 Self','{\"scope\":\"SELF\"}'::jsonb,true),('"
              + TENANT
              + "','P010_CENTER','P010 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
      s.execute(
          "insert into"
              + " iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level)"
              + " values (gen_random_uuid(),'"
              + TENANT
              + "','platform.session.read','Session"
              + " read','SESSION','READ','NORMAL'),(gen_random_uuid(),'"
              + TENANT
              + "','platform.session.logout','Session"
              + " logout','SESSION','LOGOUT','NORMAL'),(gen_random_uuid(),'"
              + TENANT
              + "','qualified.safety.access','Qualified safety access','SAFETY','ACCESS','HIGH')");
      String[][] roles = {
        {"learner", "SELF", "p010.learning.read,p010.learning.complete,p010.learning.exam"},
        {"manager", "CENTER", "p010.learning.read,p010.learning.manage"},
        {"assessor", "CENTER", "p010.learning.read,p010.learning.certify"},
        {"certifier", "CENTER", "p010.learning.read,p010.learning.certify"},
        {"linker", "CENTER", "p010.learning.read,p010.learning.link"},
        {"tech", "CENTER", "p010.learning.monitor"},
        {"out", "CENTER", "p010.learning.read"}
      };
      for (int i = 0; i < roles.length; i++) {
        seedActor(
            s,
            i,
            actors[i],
            roles[i][0],
            roles[i][1],
            roles[i][2],
            hash,
            i == 6 ? CENTER_B : CENTER_A,
            i == 6 ? POS_B : POS_A);
      }
      s.execute(
          "insert into"
              + " learning.qualification_permission_policy(tenant_id,course_version_id,permission_id,data_scope_code,enabled,approval_reference,approved_by,approved_at)"
              + " select '"
              + TENANT
              + "','SAFETY-V1',id,'P010_SELF',false,'APPROVAL-P010-INTEGRATION','"
              + MANAGER
              + "',now() from iam.permission where tenant_id='"
              + TENANT
              + "' and permission_code='qualified.safety.access'");
    }
  }

  private static void seedActor(
      Statement s,
      int i,
      UUID employee,
      String login,
      String scope,
      String permissions,
      String hash,
      UUID center,
      UUID pos)
      throws Exception {
    UUID user = derived(4, i),
        identity = derived(5, i),
        role = derived(6, i),
        appointment = derived(7, i);
    s.execute(
        "insert into"
            + " org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status)"
            + " values ('"
            + appointment
            + "','"
            + TENANT
            + "','"
            + employee
            + "','"
            + pos
            + "','"
            + center
            + "',true,current_date-30,'ACTIVE')");
    s.execute(
        "insert into iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level)"
            + " values ('"
            + user
            + "','"
            + TENANT
            + "','p010."
            + login
            + "','"
            + hash
            + "','ACTIVE',0)");
    s.execute(
        "insert into"
            + " iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at)"
            + " values ('"
            + identity
            + "','"
            + TENANT
            + "','"
            + user
            + "','"
            + employee
            + "','EMPLOYEE','P010 "
            + login
            + "','"
            + center
            + "','"
            + pos
            + "',true,now()-interval '1 day')");
    s.execute(
        "insert into iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled)"
            + " values ('"
            + role
            + "','"
            + TENANT
            + "','P010_"
            + login.toUpperCase()
            + "','P010 "
            + login
            + "','PLATFORM','P010_"
            + scope
            + "',true)");
    s.execute(
        "insert into iam.role_permission(tenant_id,role_id,permission_id) select '"
            + TENANT
            + "','"
            + role
            + "',id from iam.permission where tenant_id='"
            + TENANT
            + "' and permission_code in ('platform.session.read','platform.session.logout','"
            + permissions.replace(",", "','")
            + "') and not is_deleted");
    s.execute(
        "insert into"
            + " iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source)"
            + " values ('"
            + TENANT
            + "','"
            + user
            + "','"
            + identity
            + "','"
            + role
            + "',now()-interval '1 day','TEST_ONLY')");
  }

  private static JdbcTemplate jdbc(String db, String u, String p) {
    DriverManagerDataSource ds = new DriverManagerDataSource();
    ds.setDriverClassName("org.postgresql.Driver");
    ds.setUrl(url(db));
    ds.setUsername(u);
    ds.setPassword(p);
    return new JdbcTemplate(ds);
  }

  private static UUID derived(int g, int i) {
    return id("%d0000000-0000-0000-0000-%012d".formatted(g, 3210 + i));
  }

  private static UUID id(String v) {
    return UUID.fromString(v);
  }

  private static String shortId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
  }

  private static String url(String db) {
    String u = POSTGRES.getJdbcUrl();
    int q = u.indexOf('?');
    String suffix = q < 0 ? "" : u.substring(q), base = q < 0 ? u : u.substring(0, q);
    return base.substring(0, base.lastIndexOf('/') + 1) + db + suffix;
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
