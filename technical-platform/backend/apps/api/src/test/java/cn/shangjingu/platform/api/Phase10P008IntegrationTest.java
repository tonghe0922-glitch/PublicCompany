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
class Phase10P008IntegrationTest {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000002008"),
      CENTER_A = id("10000000-0000-0000-0000-000000003108"),
      CENTER_B = id("10000000-0000-0000-0000-000000003109"),
      POS_A = id("20000000-0000-0000-0000-000000003108"),
      POS_B = id("20000000-0000-0000-0000-000000003109");
  private static final UUID EMPLOYEE = id("30000000-0000-0000-0000-000000003108"),
      MANAGER = id("30000000-0000-0000-0000-000000003109"),
      REVIEWER = id("30000000-0000-0000-0000-000000003110"),
      TECH = id("30000000-0000-0000-0000-000000003111"),
      OUT = id("30000000-0000-0000-0000-000000003112");
  private static final String PASSWORD = "P008-Live-Test-8q!",
      API_PASSWORD = "p008_api_" + shortId(),
      AUDIT_PASSWORD = "p008_audit_" + shortId();

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
  void realHttpLifecycleConservesQuotaRejectsOverlapAndEnforcesScopeAndReviewSeparation()
      throws Exception {
    String employee = login("p008.employee"),
        manager = login("p008.manager"),
        reviewer = login("p008.reviewer"),
        tech = login("p008.tech"),
        out = login("p008.out");
    Instant start = Instant.now().plus(3, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MINUTES),
        end = start.plus(8, ChronoUnit.HOURS);
    ObjectNode create = create(start, end, "P008 真实请假与考勤闭环");
    mvc.perform(
            post("/api/v1/processes/P008/leaves")
                .contentType(MediaType.APPLICATION_JSON)
                .content(create.toString())
                .header("Idempotency-Key", "unauth"))
        .andExpect(status().isUnauthorized());
    JsonNode current =
        json(
            mvc.perform(
                    post("/api/v1/processes/P008/leaves")
                        .header("Authorization", bearer(employee))
                        .header("Idempotency-Key", "create-approved")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn());
    String leaveId = current.path("id").asText();
    assertEquals("S01", current.path("currentNodeCode").asText());
    assertEquals(8.0, current.path("quotaAmount").asDouble());
    assertEquals(
        leaveId,
        json(mvc.perform(
                    post("/api/v1/processes/P008/leaves")
                        .header("Authorization", bearer(employee))
                        .header("Idempotency-Key", "create-approved")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn())
            .path("id")
            .asText());
    current = act(employee, leaveId, "SUBMIT", 1, null, null, null, "submit");
    mvc.perform(
            post("/api/v1/processes/P008/leaves")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "overlap")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    create(
                            start.plus(1, ChronoUnit.HOURS),
                            end.plus(1, ChronoUnit.HOURS),
                            "P008 冲突请假必须拒绝")
                        .toString()))
        .andExpect(status().isConflict());
    assertEquals(
        0,
        json(mvc.perform(get("/api/v1/processes/P008/leaves").header("Authorization", bearer(out)))
                .andExpect(status().isOk())
                .andReturn())
            .size());
    mvc.perform(
            get("/api/v1/processes/P008/leaves/" + leaveId).header("Authorization", bearer(out)))
        .andExpect(status().isForbidden());
    JsonNode masked =
        json(
            mvc.perform(
                    get("/api/v1/processes/P008/leaves/" + leaveId)
                        .header("Authorization", bearer(tech)))
                .andExpect(status().isOk())
                .andReturn());
    assertTrue(masked.path("reason").isNull());
    assertTrue(masked.path("quotaAccountId").isNull());
    mvc.perform(
            post("/api/v1/processes/P008/leaves/" + leaveId + "/actions/RESERVE")
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "stale")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(1, null, null, null, null).toString()))
        .andExpect(status().isConflict());
    current = act(manager, leaveId, "RESERVE", 2, "额度预占校验通过", null, null, "reserve");
    current = act(employee, leaveId, "CONFIRM_HANDOVER", 3, null, null, handover(), "handover");
    mvc.perform(
            post("/api/v1/processes/P008/leaves/" + leaveId + "/actions/APPROVE")
                .header("Authorization", bearer(employee))
                .header("Idempotency-Key", "self-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(4, "本人不得审批", null, null, null).toString()))
        .andExpect(status().isForbidden());
    current = act(reviewer, leaveId, "APPROVE", 4, "独立复核通过", null, null, "approve");
    current = act(manager, leaveId, "DEDUCT", 5, "审批后转扣减", null, null, "deduct");
    current =
        act(manager, leaveId, "MARK_ATTENDANCE", 6, null, null, evidence("排班与考勤标记完成"), "mark");
    current = act(employee, leaveId, "START_LEAVE", 7, null, null, evidence("实际休假开始回执"), "start");
    Instant actualEnd = start.plus(6, ChronoUnit.HOURS);
    current =
        act(
            employee,
            leaveId,
            "EARLY_RETURN",
            8,
            "员工提前返岗",
            actualEnd,
            evidence("提前返岗本人确认"),
            "early-return");
    current = act(manager, leaveId, "ADJUST", 9, "按实际六小时差额调整", null, null, "adjust");
    current =
        act(
            manager,
            leaveId,
            "CLOSE_DAY",
            10,
            null,
            null,
            evidence("考勤日结归档回执"),
            "close",
            "实际休假6小时，提前返岗2小时");
    assertEquals("END", current.path("currentNodeCode").asText());
    JsonNode ledger =
        json(
            mvc.perform(
                    get("/api/v1/processes/P008/quota-ledger")
                        .header("Authorization", bearer(employee)))
                .andExpect(status().isOk())
                .andReturn());
    assertEquals(4, ledger.size());
    JsonNode last = ledger.get(ledger.size() - 1);
    assertEquals(10.0, last.path("availableAfter").asDouble());
    assertEquals(0.0, last.path("reservedAfter").asDouble());
    assertEquals(6.0, last.path("consumedAfter").asDouble());
    JdbcTemplate oms = jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword());
    assertEquals(
        4,
        oms.queryForObject(
            "select count(*) from attendance.leave_quota_ledger where tenant_id=? and"
                + " employee_id=?",
            Integer.class,
            TENANT,
            EMPLOYEE));
    assertEquals(
        6,
        oms.queryForObject(
            "select count(*) from attendance.leave_request_item where tenant_id=? and master_id=?",
            Integer.class,
            TENANT,
            UUID.fromString(leaveId)));
    assertEquals(
        11,
        oms.queryForObject(
            "select count(*) from core.outbox_event where tenant_id=? and aggregate_id=? and"
                + " event_type='P008_LEAVE_EVENT'",
            Integer.class,
            TENANT,
            UUID.fromString(leaveId)));
    assertTrue(
        jdbc("sjg_audit", POSTGRES.getUsername(), POSTGRES.getPassword())
                .queryForObject(
                    "select count(*) from audit.operation_log where tenant_id=? and resource_id=?"
                        + " and action like 'P008_%'",
                    Integer.class, TENANT, UUID.fromString(leaveId))
            >= 18);
  }

  private JsonNode act(
      String token,
      String id,
      String code,
      int version,
      String reason,
      Instant actualEnd,
      JsonNode evidence,
      String key)
      throws Exception {
    return act(token, id, code, version, reason, actualEnd, evidence, key, null);
  }

  private JsonNode act(
      String token,
      String id,
      String code,
      int version,
      String reason,
      Instant actualEnd,
      JsonNode evidence,
      String key,
      String attendance)
      throws Exception {
    return json(
        mvc.perform(
                post("/api/v1/processes/P008/leaves/" + id + "/actions/" + code)
                    .header("Authorization", bearer(token))
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(action(version, reason, attendance, actualEnd, evidence).toString()))
            .andExpect(status().isOk())
            .andReturn());
  }

  private ObjectNode create(Instant start, Instant end, String subject) {
    return mapper
        .createObjectNode()
        .put("businessDate", LocalDate.now().toString())
        .put("subject", subject)
        .put("reason", "用于验证请假额度守恒、审批隔离与考勤闭环的真实申请")
        .put("attendanceType", "年假")
        .put("quotaAccountId", "ANNUAL")
        .put("startAt", start.toString())
        .put("endAt", end.toString());
  }

  private ObjectNode action(
      int version, String reason, String attendance, Instant actualEnd, JsonNode evidence) {
    ObjectNode n = mapper.createObjectNode().put("expectedVersion", version);
    put(n, "reason", reason);
    n.putNull("resultSummary");
    put(n, "actualAttendanceSummary", attendance);
    if (actualEnd == null) {
      n.putNull("actualEndAt");
    } else {
      n.put("actualEndAt", actualEnd.toString());
    }
    n.set(
        "handoverItems",
        evidence != null && evidence.isArray() ? evidence : mapper.createArrayNode());
    if (evidence == null || evidence.isArray()) {
      n.putNull("evidence");
    } else {
      n.set("evidence", evidence);
    }
    return n;
  }

  private JsonNode handover() {
    return mapper.createArrayNode().add("当日工作交由值班同事").add("紧急事项已同步主管");
  }

  private ObjectNode evidence(String note) {
    return mapper.createObjectNode().put("note", note).put("recordedAt", Instant.now().toString());
  }

  private static void put(ObjectNode n, String f, String v) {
    if (v == null) {
      n.putNull(f);
    } else {
      n.put(f, v);
    }
  }

  private String login(String name) throws Exception {
    return json(mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        mapper
                            .createObjectNode()
                            .put("tenantCode", "PHASE10_P008")
                            .put("loginName", name)
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
                "PHASE10_P008",
                "sjg_tenant_name",
                "P008 Integration Tenant"))
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
              + "','P008_A','P008 Center A','CENTER','p008_a'::ltree,'ACTIVE'),('"
              + CENTER_B
              + "','"
              + TENANT
              + "','P008_B','P008 Center B','CENTER','p008_b'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POS_A
              + "','"
              + TENANT
              + "','P008_PA','P008 Position A','"
              + CENTER_A
              + "','ACTIVE'),('"
              + POS_B
              + "','"
              + TENANT
              + "','P008_PB','P008 Position B','"
              + CENTER_B
              + "','ACTIVE')");
      UUID[] actors = {EMPLOYEE, MANAGER, REVIEWER, TECH, OUT};
      for (int i = 0; i < actors.length; i++) {
        UUID center = i == 4 ? CENTER_B : CENTER_A, pos = i == 4 ? POS_B : POS_A;
        s.execute(
            "insert into"
                + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
                + " values ('"
                + actors[i]
                + "','"
                + TENANT
                + "','P008-E00"
                + (i + 1)
                + "','P008 Actor "
                + i
                + "','ACTIVE',current_date-30,'"
                + center
                + "','"
                + pos
                + "')");
      }
      s.execute(
          "insert into"
              + " attendance.leave_quota_ledger(id,tenant_id,employee_id,quota_account_id,entry_type,available_delta,reserved_delta,consumed_delta,available_after,reserved_after,consumed_after,idempotency_key,reason,created_by)"
              + " values(gen_random_uuid(),'"
              + TENANT
              + "','"
              + EMPLOYEE
              + "','ANNUAL','GRANT',16,0,0,16,0,0,'p008-test-grant','HR entitlement prerequisite','"
              + MANAGER
              + "')");
      s.execute(
          "insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled)"
              + " values ('"
              + TENANT
              + "','P008_SELF','P008 Self','{\"scope\":\"SELF\"}'::jsonb,true),('"
              + TENANT
              + "','P008_CENTER','P008 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
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
        {"employee", "SELF", "p008.leave.submit,p008.leave.read,p008.leave.manage"},
        {"manager", "CENTER", "p008.leave.read,p008.leave.manage"},
        {"reviewer", "CENTER", "p008.leave.read,p008.leave.review"},
        {"tech", "CENTER", "p008.leave.monitor"},
        {"out", "CENTER", "p008.leave.read"}
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
            i == 4 ? CENTER_B : CENTER_A,
            i == 4 ? POS_B : POS_A);
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
            + "','p008."
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
            + "','EMPLOYEE','P008 "
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
            + "','P008_"
            + login.toUpperCase()
            + "','P008 "
            + login
            + "','PLATFORM','P008_"
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
    return id("%d0000000-0000-0000-0000-%012d".formatted(group, 3108 + i));
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
