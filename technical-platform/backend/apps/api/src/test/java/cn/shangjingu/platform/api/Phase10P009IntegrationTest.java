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
import java.time.temporal.ChronoUnit;
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
class Phase10P009IntegrationTest {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000002009"),
      CENTER_A = id("10000000-0000-0000-0000-000000003209"),
      CENTER_B = id("10000000-0000-0000-0000-000000003210"),
      POS_A = id("20000000-0000-0000-0000-000000003209"),
      POS_B = id("20000000-0000-0000-0000-000000003210");
  private static final UUID EMPLOYEE = id("30000000-0000-0000-0000-000000003209"),
      MANAGER = id("30000000-0000-0000-0000-000000003210"),
      REVIEWER = id("30000000-0000-0000-0000-000000003211"),
      HR = id("30000000-0000-0000-0000-000000003212"),
      TECH = id("30000000-0000-0000-0000-000000003213"),
      OUT = id("30000000-0000-0000-0000-000000003214");
  private static final String PASSWORD = "P009-Live-Test-9q!",
      API_PASSWORD = "p009_api_" + shortId(),
      AUDIT_PASSWORD = "p009_audit_" + shortId();

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
  void realHttpLifecycleRecordsExternalReceiptWithoutCalculatingPayrollAndEnforcesSeparation()
      throws Exception {
    String employee = login("employee"),
        manager = login("manager"),
        reviewer = login("reviewer"),
        hr = login("hr"),
        tech = login("tech"),
        out = login("out");
    Instant start = Instant.now().plus(5, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES),
        end = start.plus(2, ChronoUnit.HOURS);
    ObjectNode create = create(start, end, false, null, "P009 source-backed overtime request");
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests")
                .contentType(MediaType.APPLICATION_JSON)
                .content(create.toString())
                .header("Idempotency-Key", "unauth"))
        .andExpect(status().isUnauthorized());
    JsonNode current =
        json(
            mvc.perform(
                    post("/api/v1/processes/P009/overtime-requests")
                        .header("Authorization", bearer(employee))
                        .header("Idempotency-Key", "create-approved")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn());
    String requestId = current.path("id").asText();
    assertEquals("S01", current.path("currentNodeCode").asText());
    assertEquals(2.0, current.path("durationHours").asDouble());
    assertEquals(
        requestId,
        json(mvc.perform(
                    post("/api/v1/processes/P009/overtime-requests")
                        .header("Authorization", bearer(employee))
                        .header("Idempotency-Key", "create-approved")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn())
            .path("id")
            .asText());
    current = act(employee, requestId, "SUBMIT", 1, action(1), "submit");
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "overlap")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    create(
                            start.plus(30, ChronoUnit.MINUTES),
                            end.plus(30, ChronoUnit.MINUTES),
                            false,
                            null,
                            "P009 overlapping request must fail")
                        .toString()))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "emergency-no-evidence")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    create(
                            start.plus(1, ChronoUnit.DAYS),
                            end.plus(1, ChronoUnit.DAYS),
                            true,
                            null,
                            "P009 emergency without evidence")
                        .toString()))
        .andExpect(status().isConflict());
    assertEquals(
        0,
        json(mvc.perform(
                    get("/api/v1/processes/P009/overtime-requests")
                        .header("Authorization", bearer(out)))
                .andExpect(status().isOk())
                .andReturn())
            .size());
    mvc.perform(
            get("/api/v1/processes/P009/overtime-requests/" + requestId)
                .header("Authorization", bearer(out)))
        .andExpect(status().isForbidden());
    JsonNode masked =
        json(
            mvc.perform(
                    get("/api/v1/processes/P009/overtime-requests/" + requestId)
                        .header("Authorization", bearer(tech)))
                .andExpect(status().isOk())
                .andReturn());
    assertTrue(masked.path("reason").isNull());
    assertTrue(masked.path("actualAttendanceSummary").isNull());
    assertTrue(masked.path("schemeType").isNull());
    assertTrue(masked.path("actualAmount").isNull());
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests/" + requestId + "/actions/VALIDATE")
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "stale")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(1).toString()))
        .andExpect(status().isConflict());
    current = act(manager, requestId, "VALIDATE", 2, action(2), "validate");
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests/" + requestId + "/actions/APPROVE")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "self-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(3).put("reason", "self review forbidden").toString()))
        .andExpect(status().isForbidden());
    current =
        act(
            reviewer,
            requestId,
            "APPROVE",
            3,
            action(3).put("reason", "independent supervisor approval"),
            "approve");
    current =
        act(
            employee,
            requestId,
            "RECORD_FACT",
            4,
            action(4)
                .put("actualStartAt", start.toString())
                .put("actualEndAt", end.toString())
                .put(
                    "actualAttendanceSummary",
                    "Access-control attendance shows two factual labor hours")
                .set("evidence", evidence("immutable labor attendance source")),
            "fact");
    current =
        act(
            reviewer,
            requestId,
            "ACCEPT_RESULT",
            5,
            action(5)
                .put("resultSummary", "Deliverable independently accepted against assigned task"),
            "accept");
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests/" + requestId + "/actions/HR_CONFIRM")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "self-hr")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    action(6)
                        .put("schemeType", "PAYROLL")
                        .set("evidence", evidence("forbidden self HR review"))
                        .toString()))
        .andExpect(status().isForbidden());
    current =
        act(
            hr,
            requestId,
            "HR_CONFIRM",
            6,
            action(6)
                .put("schemeType", "PAYROLL")
                .set("evidence", evidence("HR verified external compensation route")),
            "hr-confirm");
    current =
        act(
            employee,
            requestId,
            "CONFIRM_SCHEME",
            7,
            action(7).set("evidence", evidence("employee confirmed payroll route")),
            "scheme-confirm");
    mvc.perform(
            post("/api/v1/processes/P009/overtime-requests/"
                    + requestId
                    + "/actions/RECORD_RECEIPT")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "self-receipt")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    action(8)
                        .put("externalReference", "PAY-EXT-0009")
                        .put("externallyDeterminedAmount", 125.50)
                        .set("evidence", evidence("forbidden self receipt"))
                        .toString()))
        .andExpect(status().isForbidden());
    current =
        act(
            hr,
            requestId,
            "RECORD_RECEIPT",
            8,
            action(8)
                .put("externalReference", "PAY-EXT-0009")
                .put("externallyDeterminedAmount", 125.50)
                .set("evidence", evidence("external payroll system signed receipt")),
            "receipt");
    assertEquals(125.50, current.path("actualAmount").asDouble());
    current =
        act(
            manager,
            requestId,
            "ARCHIVE",
            9,
            action(9).set("evidence", evidence("archive package checksum and retention record")),
            "archive");
    assertEquals("END", current.path("currentNodeCode").asText());
    assertEquals("PAY-EXT-0009", current.path("receiptReference").asText());
    JdbcTemplate oms = jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword());
    assertEquals(
        7,
        oms.queryForObject(
            "select count(*) from attendance.overtime_request_item where tenant_id=? and"
                + " master_id=?",
            Integer.class,
            TENANT,
            UUID.fromString(requestId)));
    assertEquals(
        10,
        oms.queryForObject(
            "select count(*) from core.outbox_event where tenant_id=? and aggregate_id=? and"
                + " event_type='P009_OVERTIME_EVENT'",
            Integer.class,
            TENANT,
            UUID.fromString(requestId)));
    assertEquals(
        "125.50",
        oms.queryForObject(
            "select actual_amount::text from attendance.overtime_request where tenant_id=? and"
                + " id=?",
            String.class,
            TENANT,
            UUID.fromString(requestId)));
    assertTrue(
        jdbc("sjg_audit", POSTGRES.getUsername(), POSTGRES.getPassword())
                .queryForObject(
                    "select count(*) from audit.operation_log where tenant_id=? and resource_id=?"
                        + " and action like 'P009_%'",
                    Integer.class, TENANT, UUID.fromString(requestId))
            >= 16);
  }

  private JsonNode act(
      String token, String id, String code, int version, ObjectNode body, String key)
      throws Exception {
    assertEquals(version, body.path("expectedVersion").asInt());
    return json(
        mvc.perform(
                post("/api/v1/processes/P009/overtime-requests/" + id + "/actions/" + code)
                    .header("Authorization", bearer(token))
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body.toString()))
            .andExpect(status().isOk())
            .andReturn());
  }

  private ObjectNode create(
      Instant start, Instant end, boolean emergency, JsonNode emergencyEvidence, String subject) {
    ObjectNode n =
        mapper
            .createObjectNode()
            .put("businessDate", LocalDate.now().toString())
            .put("subject", subject)
            .put(
                "reason", "Documented operational task requires verified work outside normal hours")
            .put("attendanceType", "OVERTIME")
            .put("emergency", emergency)
            .put("startAt", start.toString())
            .put("endAt", end.toString());
    if (emergencyEvidence == null) {
      n.putNull("emergencyEvidence");
    } else {
      n.set("emergencyEvidence", emergencyEvidence);
    }
    return n;
  }

  private ObjectNode action(int version) {
    return mapper
        .createObjectNode()
        .put("expectedVersion", version)
        .putNull("reason")
        .putNull("resultSummary")
        .putNull("actualAttendanceSummary")
        .putNull("actualStartAt")
        .putNull("actualEndAt")
        .putNull("schemeType")
        .putNull("externalReference")
        .putNull("externallyDeterminedAmount")
        .putNull("evidence");
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
                            .put("tenantCode", "PHASE10_P009")
                            .put("loginName", "p009." + name)
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

  private static String bearer(String token) {
    return "Bearer " + token;
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
                "PHASE10_P009",
                "sjg_tenant_name",
                "P009 Integration Tenant"))
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
              + "','P009_A','P009 Center A','CENTER','p009_a'::ltree,'ACTIVE'),('"
              + CENTER_B
              + "','"
              + TENANT
              + "','P009_B','P009 Center B','CENTER','p009_b'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POS_A
              + "','"
              + TENANT
              + "','P009_PA','P009 Position A','"
              + CENTER_A
              + "','ACTIVE'),('"
              + POS_B
              + "','"
              + TENANT
              + "','P009_PB','P009 Position B','"
              + CENTER_B
              + "','ACTIVE')");
      UUID[] actors = {EMPLOYEE, MANAGER, REVIEWER, HR, TECH, OUT};
      for (int i = 0; i < actors.length; i++) {
        UUID center = i == 5 ? CENTER_B : CENTER_A, pos = i == 5 ? POS_B : POS_A;
        s.execute(
            "insert into"
                + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
                + " values ('"
                + actors[i]
                + "','"
                + TENANT
                + "','P009-E00"
                + (i + 1)
                + "','P009 Actor "
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
              + "','P009_SELF','P009 Self','{\"scope\":\"SELF\"}'::jsonb,true),('"
              + TENANT
              + "','P009_CENTER','P009 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
      s.execute(
          "insert into"
              + " iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level)"
              + " values (gen_random_uuid(),'"
              + TENANT
              + "','platform.session.read','Session"
              + " read','SESSION','READ','NORMAL'),(gen_random_uuid(),'"
              + TENANT
              + "','platform.session.logout','Session logout','SESSION','LOGOUT','NORMAL')");
      String[][] roles = {
        {"employee", "SELF", "p009.overtime.submit,p009.overtime.read,p009.overtime.manage"},
        {"manager", "CENTER", "p009.overtime.read,p009.overtime.manage"},
        {"reviewer", "CENTER", "p009.overtime.read,p009.overtime.review"},
        {"hr", "CENTER", "p009.overtime.read,p009.overtime.hr"},
        {"tech", "CENTER", "p009.overtime.monitor"},
        {"out", "CENTER", "p009.overtime.read"}
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
            i == 5 ? CENTER_B : CENTER_A,
            i == 5 ? POS_B : POS_A);
      }
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
            + "','p009."
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
            + "','EMPLOYEE','P009 "
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
            + "','P009_"
            + login.toUpperCase()
            + "','P009 "
            + login
            + "','PLATFORM','P009_"
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

  private static JdbcTemplate jdbc(String db, String user, String pass) {
    DriverManagerDataSource ds = new DriverManagerDataSource();
    ds.setDriverClassName("org.postgresql.Driver");
    ds.setUrl(url(db));
    ds.setUsername(user);
    ds.setPassword(pass);
    return new JdbcTemplate(ds);
  }

  private static UUID derived(int group, int i) {
    return id("%d0000000-0000-0000-0000-%012d".formatted(group, 3209 + i));
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
    throw new IllegalStateException("root not found");
  }
}
