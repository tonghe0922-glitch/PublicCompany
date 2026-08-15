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
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.assertj.core.api.SoftAssertions;
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
class Phase11P013IntegrationTest {

  private static final UUID TENANT = id("00000000-0000-0000-0000-000000002013"),
      CENTER_A = id("10000000-0000-0000-0000-000000003513"),
      CENTER_B = id("10000000-0000-0000-0000-000000003514"),
      POSITION_A = id("20000000-0000-0000-0000-000000003513"),
      POSITION_B = id("20000000-0000-0000-0000-000000003514"),
      OWNER = id("30000000-0000-0000-0000-000000003513"),
      MANAGER = id("30000000-0000-0000-0000-000000003514"),
      REVIEWER_ONE = id("30000000-0000-0000-0000-000000003515"),
      REVIEWER_TWO = id("30000000-0000-0000-0000-000000003516"),
      APPROVER = id("30000000-0000-0000-0000-000000003517"),
      EXECUTOR = id("30000000-0000-0000-0000-000000003518"),
      TECH = id("30000000-0000-0000-0000-000000003519"),
      OUTSIDER = id("30000000-0000-0000-0000-000000003520");
  private static final String PASSWORD = "P013-Live-Test-9q!",
      API_PASSWORD = "p013_api_" + shortId(),
      AUDIT_PASSWORD = "p013_audit_" + shortId();

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
  static void properties(DynamicPropertyRegistry r) {
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
  void realHttpLifecycleSeparatesApprovalInstructionsAndAuthoritativeReceipts() throws Exception {
    SoftAssertions projected = new SoftAssertions();
    String owner = login("owner"),
        manager = login("manager"),
        reviewerOne = login("reviewer1"),
        reviewerTwo = login("reviewer2"),
        approver = login("approver"),
        executor = login("executor"),
        tech = login("tech"),
        outsider = login("outsider");
    ObjectNode create = create("SOURCE-FACT-P013-001");
    mvc.perform(
            post("/api/v1/processes/P013/reward-cases")
                .contentType(MediaType.APPLICATION_JSON)
                .content(create.toString())
                .header("Idempotency-Key", "unauth"))
        .andExpect(status().isUnauthorized());
    JsonNode current =
        json(
            mvc.perform(
                    post("/api/v1/processes/P013/reward-cases")
                        .header("Authorization", bearer(manager))
                        .header("Idempotency-Key", "create-reward")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn());
    String id = current.path("id").asText();
    assertEquals("S01", current.path("currentNodeCode").asText());
    checkActions(projected, current, 1, false, "RECORD_CONTRIBUTION");
    assertEquals(
        id,
        json(mvc.perform(
                    post("/api/v1/processes/P013/reward-cases")
                        .header("Authorization", bearer(manager))
                        .header("Idempotency-Key", "create-reward")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(create.toString()))
                .andExpect(status().isOk())
                .andReturn())
            .path("id")
            .asText());
    ObjectNode changedCreate = create.deepCopy().put("subject", "2026 changed reward contribution");
    mvc.perform(
            post("/api/v1/processes/P013/reward-cases")
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "create-reward")
                .contentType(MediaType.APPLICATION_JSON)
                .content(changedCreate.toString()))
        .andExpect(status().isConflict());
    JdbcTemplate replayOms = jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword()),
        replayAudit = jdbc("sjg_audit", POSTGRES.getUsername(), POSTGRES.getPassword());
    UUID replayId = UUID.fromString(id);
    projected
        .assertThat(
            replayOms.queryForObject(
                "select count(*) from reward.reward_case where tenant_id=? and id=?",
                Integer.class,
                TENANT,
                replayId))
        .as("P013 retry keeps one business fact")
        .isEqualTo(1);
    projected
        .assertThat(
            replayOms.queryForObject(
                "select count(*) from core.outbox_event where tenant_id=? and aggregate_id=?",
                Integer.class,
                TENANT,
                replayId))
        .as("P013 retry keeps one create outbox event")
        .isEqualTo(1);
    projected
        .assertThat(
            replayAudit.queryForObject(
                "select count(*) from audit.operation_log where tenant_id=? and resource_id=? and"
                    + " action='P013_CREATED' and idempotency_key=?",
                Integer.class,
                TENANT,
                replayId,
                "create-reward"))
        .as("P013 retry keeps one success audit")
        .isEqualTo(1);
    mvc.perform(
            post("/api/v1/processes/P013/reward-cases")
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "duplicate-source")
                .contentType(MediaType.APPLICATION_JSON)
                .content(create.toString()))
        .andExpect(status().isConflict());
    projected
        .assertThat(
            replayAudit.queryForObject(
                "select count(*) from audit.operation_log where tenant_id=? and resource_id is null"
                    + " and action='P013_CREATE_ATTEMPT' and idempotency_key=?",
                Integer.class,
                TENANT,
                "create-reward"))
        .as("P013 retry keeps one attempt audit")
        .isEqualTo(1);
    assertEquals(
        0,
        json(mvc.perform(
                    get("/api/v1/processes/P013/reward-cases")
                        .header("Authorization", bearer(outsider)))
                .andExpect(status().isOk())
                .andReturn())
            .size());
    mvc.perform(
            get("/api/v1/processes/P013/reward-cases/" + id)
                .header("Authorization", bearer(outsider)))
        .andExpect(status().isForbidden());
    JsonNode masked =
        json(
            mvc.perform(
                    get("/api/v1/processes/P013/reward-cases/" + id)
                        .header("Authorization", bearer(tech)))
                .andExpect(status().isOk())
                .andReturn());
    checkActions(projected, masked, 1, false);
    assertTrue(masked.path("reason").isNull());
    assertTrue(masked.path("factSummary").isNull());
    assertTrue(masked.path("approvedRewardLevel").isNull());
    assertTrue(masked.path("benefitAmount").isNull());
    assertTrue(masked.path("events").isArray() && masked.path("events").isEmpty());
    assertTrue(masked.path("impacts").isArray() && masked.path("impacts").isEmpty());
    assertTrue(masked.path("receipts").isArray() && masked.path("receipts").isEmpty());
    mvc.perform(
            post(actionUrl(id, "RECORD_CONTRIBUTION"))
                .header("Authorization", bearer(manager))
                .header("Idempotency-Key", "stale")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(0).toString()))
        .andExpect(status().isConflict());
    current = act(manager, id, "RECORD_CONTRIBUTION", 1, action(1), "contribution");
    current = act(manager, id, "VERIFY_EVIDENCE", 2, action(2), "evidence");
    checkActions(projected, getReward(owner, id), 3, true);
    checkActions(projected, getReward(reviewerOne, id), 3, true, "RECOMMEND_LEVEL");
    mvc.perform(
            post(actionUrl(id, "RECOMMEND_LEVEL"))
                .header("Authorization", bearer(owner))
                .header("Idempotency-Key", "owner-review")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(3).put("rewardLevel", "GOLD").toString()))
        .andExpect(status().isForbidden());
    current =
        act(
            reviewerOne,
            id,
            "RECOMMEND_LEVEL",
            3,
            action(3).put("rewardLevel", "GOLD"),
            "recommend");
    checkActions(projected, getReward(reviewerOne, id), 4, true);
    checkActions(projected, getReward(approver, id), 4, true, "APPROVE");
    mvc.perform(
            post(actionUrl(id, "APPROVE"))
                .header("Authorization", bearer(reviewerOne))
                .header("Idempotency-Key", "reviewer-approve")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(4).put("rewardLevel", "GOLD").toString()))
        .andExpect(status().isForbidden());
    current = act(approver, id, "APPROVE", 4, action(4).put("rewardLevel", "GOLD"), "approve");
    mvc.perform(
            post(actionUrl(id, "CHECK_DUPLICATE"))
                .header("Authorization", bearer(approver))
                .header("Idempotency-Key", "approver-dedup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(5).toString()))
        .andExpect(status().isForbidden());
    current = act(reviewerTwo, id, "CHECK_DUPLICATE", 5, action(5), "dedup");
    JdbcTemplate oms = jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword());
    assertEquals(
        0,
        oms.queryForObject(
            "select count(*) from reward.reward_impact_instruction where tenant_id=? and"
                + " reward_case_id=?",
            Integer.class,
            TENANT,
            UUID.fromString(id)));
    assertEquals(
        0,
        oms.queryForObject(
            "select count(*) from reward.point_transaction where tenant_id=?",
            Integer.class,
            TENANT));
    current =
        act(
            executor,
            id,
            "RECORD_IMPACT",
            6,
            action(6)
                .put("impactType", "HONOR_POINTS")
                .put("requestedPoints", 120)
                .put("authorityReference", "POINT-RULE-V7"),
            "points-instruction");
    UUID pointsInstruction = impactId(current, "HONOR_POINTS");
    current =
        act(
            executor,
            id,
            "RECORD_IMPACT",
            7,
            action(7)
                .put("impactType", "BONUS")
                .put("approvedAmount", 880.50)
                .put("authorityReference", "FINANCE-AUTH-013"),
            "bonus-instruction");
    UUID bonusInstruction = impactId(current, "BONUS");
    current = act(executor, id, "COMPLETE_IMPACTS", 8, action(8), "impacts-complete");
    current = act(owner, id, "CONFIRM_NOTICE", 9, action(9), "notice-confirm");
    mvc.perform(
            post(actionUrl(id, "COMPLETE_RECEIPTS"))
                .header("Authorization", bearer(executor))
                .header("Idempotency-Key", "missing-receipts")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(10).toString()))
        .andExpect(status().isConflict());
    mvc.perform(
            post(actionUrl(id, "RECORD_RECEIPT"))
                .header("Authorization", bearer(executor))
                .header("Idempotency-Key", "wrong-receipt-type")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    action(10)
                        .put("instructionId", bonusInstruction.toString())
                        .put("receiptType", "P015_POINT_LEDGER")
                        .put("externalReference", "P015-WRONG-001")
                        .put("externalOccurredAt", Instant.now().toString())
                        .toString()))
        .andExpect(status().isConflict());
    current =
        act(
            executor,
            id,
            "RECORD_RECEIPT",
            10,
            action(10)
                .put("instructionId", pointsInstruction.toString())
                .put("receiptType", "P015_POINT_LEDGER")
                .put("externalReference", "P015-LEDGER-2026-013")
                .put("externalOccurredAt", Instant.now().toString()),
            "points-receipt");
    mvc.perform(
            post(actionUrl(id, "COMPLETE_RECEIPTS"))
                .header("Authorization", bearer(executor))
                .header("Idempotency-Key", "bonus-missing")
                .contentType(MediaType.APPLICATION_JSON)
                .content(action(11).toString()))
        .andExpect(status().isConflict());
    current =
        act(
            executor,
            id,
            "RECORD_RECEIPT",
            11,
            action(11)
                .put("instructionId", bonusInstruction.toString())
                .put("receiptType", "FINANCE_BONUS")
                .put("externalReference", "FINANCE-PAID-RECEIPT-013")
                .put("externalOccurredAt", Instant.now().toString()),
            "bonus-receipt");
    current = act(executor, id, "COMPLETE_RECEIPTS", 12, action(12), "receipts-complete");
    current = act(manager, id, "ARCHIVE", 13, action(13), "archive");
    assertEquals("END", current.path("currentNodeCode").asText());
    assertEquals(
        2,
        oms.queryForObject(
            "select count(*) from reward.reward_impact_receipt where tenant_id=? and"
                + " reward_case_id=?",
            Integer.class,
            TENANT,
            UUID.fromString(id)));
    assertEquals(
        0,
        oms.queryForObject(
            "select count(*) from reward.point_transaction where tenant_id=?",
            Integer.class,
            TENANT));
    assertTrue(
        jdbc("sjg_audit", POSTGRES.getUsername(), POSTGRES.getPassword())
                .queryForObject(
                    "select count(*) from audit.operation_log where tenant_id=? and resource_id=?"
                        + " and action like 'P013_%'",
                    Integer.class, TENANT, UUID.fromString(id))
            >= 15);
    projected.assertAll();
  }

  private JsonNode getReward(String token, String id) throws Exception {
    return json(
        mvc.perform(
                get("/api/v1/processes/P013/reward-cases/" + id)
                    .header("Authorization", bearer(token)))
            .andExpect(status().isOk())
            .andReturn());
  }

  private static void checkActions(
      SoftAssertions softly, JsonNode view, int version, boolean pending, String... codes) {
    JsonNode actions = view.path("availableActions");
    softly.assertThat(actions.isArray()).as("availableActions array").isTrue();
    List<String> actual = new ArrayList<>();
    for (JsonNode action : actions) {
      softly
          .assertThat(new LinkedHashSet<>(toNames(action)))
          .as("four action fields")
          .containsExactlyInAnyOrder("code", "labelCode", "taskId", "expectedVersion");
      softly.assertThat(action.path("expectedVersion").asInt()).isEqualTo(version);
      if (pending) {
        softly.assertThat(action.path("taskId").asText()).isNotBlank();
      } else {
        softly.assertThat(action.path("taskId").isNull()).isTrue();
      }
      actual.add(action.path("code").asText());
    }
    softly.assertThat(actual).containsExactlyInAnyOrder(codes);
  }

  private static List<String> toNames(JsonNode node) {
    List<String> names = new ArrayList<>();
    node.fieldNames().forEachRemaining(names::add);
    return names;
  }

  private UUID impactId(JsonNode value, String type) {
    for (JsonNode impact : value.path("impacts")) {
      if (type.equals(impact.path("impactType").asText())) {
        return UUID.fromString(impact.path("id").asText());
      }
    }
    throw new IllegalStateException("missing impact " + type);
  }

  private JsonNode act(
      String token, String id, String code, int version, ObjectNode body, String key)
      throws Exception {
    assertEquals(version, body.path("expectedVersion").asInt());
    return json(
        mvc.perform(
                post(actionUrl(id, code))
                    .header("Authorization", bearer(token))
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body.toString()))
            .andExpect(status().isOk())
            .andReturn());
  }

  private ObjectNode action(int version) {
    return mapper
        .createObjectNode()
        .put("expectedVersion", version)
        .putNull("rewardLevel")
        .putNull("impactType")
        .putNull("requestedPoints")
        .putNull("approvedAmount")
        .putNull("authorityReference")
        .putNull("instructionId")
        .putNull("receiptType")
        .putNull("externalReference")
        .putNull("externalOccurredAt")
        .put("resultSummary", "P013 source fact accepted")
        .set("evidence", evidence("immutable " + version));
  }

  private ObjectNode create(String source) {
    return mapper
        .createObjectNode()
        .put("businessDate", LocalDate.now().toString())
        .put("subject", "2026 verified service contribution reward")
        .put("reason", "Contribution verified against source evidence")
        .put("ownerEmployeeId", OWNER.toString())
        .put("sourceFactKey", source)
        .put("employeeEventType", "SERVICE_CONTRIBUTION")
        .put("factOccurredAt", Instant.now().minusSeconds(3600).toString())
        .put("factSummary", "Verified guest service recovery contribution")
        .put("impactLevel", "HIGH")
        .set("evidence", evidence("source contribution package"));
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
                            .put("tenantCode", "PHASE11_P013")
                            .put("loginName", "p013." + name)
                            .put("password", PASSWORD)
                            .toString()))
            .andExpect(status().isOk())
            .andReturn())
        .path("accessToken")
        .asText();
  }

  private JsonNode json(MvcResult result) throws Exception {
    return mapper.readTree(result.getResponse().getContentAsByteArray());
  }

  private static String bearer(String token) {
    return "Bearer " + token;
  }

  private static String actionUrl(String id, String action) {
    return "/api/v1/processes/P013/reward-cases/" + id + "/actions/" + action;
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
                "PHASE11_P013",
                "sjg_tenant_name",
                "P013 Integration Tenant"))
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
              + "','P013_A','P013 Center A','CENTER','p013_a'::ltree,'ACTIVE'),('"
              + CENTER_B
              + "','"
              + TENANT
              + "','P013_B','P013 Center B','CENTER','p013_b'::ltree,'ACTIVE')");
      s.execute(
          "insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values"
              + " ('"
              + POSITION_A
              + "','"
              + TENANT
              + "','P013_A','P013 Position A','"
              + CENTER_A
              + "','ACTIVE'),('"
              + POSITION_B
              + "','"
              + TENANT
              + "','P013_B','P013 Position B','"
              + CENTER_B
              + "','ACTIVE')");
      UUID[] actors = {
        OWNER, MANAGER, REVIEWER_ONE, REVIEWER_TWO, APPROVER, EXECUTOR, TECH, OUTSIDER
      };
      for (int i = 0; i < actors.length; i++) {
        UUID center = i == 7 ? CENTER_B : CENTER_A, position = i == 7 ? POSITION_B : POSITION_A;
        s.execute(
            "insert into"
                + " org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id)"
                + " values ('"
                + actors[i]
                + "','"
                + TENANT
                + "','P013-E00"
                + (i + 1)
                + "','P013 Actor "
                + i
                + "','ACTIVE',current_date-90,'"
                + center
                + "','"
                + position
                + "')");
      }
      s.execute(
          "insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled)"
              + " values ('"
              + TENANT
              + "','P013_SELF','P013 Self','{\"scope\":\"SELF\"}'::jsonb,true),('"
              + TENANT
              + "','P013_CENTER','P013 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
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
        {"owner", "SELF", "p013.reward.read"},
        {"manager", "CENTER", "p013.reward.read,p013.reward.manage"},
        {"reviewer1", "CENTER", "p013.reward.read,p013.reward.review"},
        {"reviewer2", "CENTER", "p013.reward.read,p013.reward.review"},
        {"approver", "CENTER", "p013.reward.read,p013.reward.approve"},
        {"executor", "CENTER", "p013.reward.read,p013.reward.execute"},
        {"tech", "CENTER", "p013.reward.monitor"},
        {"outsider", "CENTER", "p013.reward.read"}
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
            i == 7 ? CENTER_B : CENTER_A,
            i == 7 ? POSITION_B : POSITION_A);
      }
    }
  }

  private static void seedActor(
      Statement s,
      int index,
      UUID employee,
      String login,
      String scope,
      String permissions,
      String hash,
      UUID center,
      UUID position)
      throws Exception {
    UUID user = derived(4, index),
        identity = derived(5, index),
        role = derived(6, index),
        appointment = derived(7, index);
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
            + position
            + "','"
            + center
            + "',true,current_date-90,'ACTIVE')");
    s.execute(
        "insert into iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level)"
            + " values ('"
            + user
            + "','"
            + TENANT
            + "','p013."
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
            + "','EMPLOYEE','P013 "
            + login
            + "','"
            + center
            + "','"
            + position
            + "',true,now()-interval '1 day')");
    s.execute(
        "insert into iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled)"
            + " values ('"
            + role
            + "','"
            + TENANT
            + "','P013_"
            + login.toUpperCase()
            + "','P013 "
            + login
            + "','PLATFORM','P013_"
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

  private static JdbcTemplate jdbc(String database, String username, String password) {
    DriverManagerDataSource ds = new DriverManagerDataSource();
    ds.setDriverClassName("org.postgresql.Driver");
    ds.setUrl(url(database));
    ds.setUsername(username);
    ds.setPassword(password);
    return new JdbcTemplate(ds);
  }

  private static UUID derived(int group, int index) {
    return id("%d0000000-0000-0000-0000-%012d".formatted(group, 3513 + index));
  }

  private static UUID id(String value) {
    return UUID.fromString(value);
  }

  private static String shortId() {
    return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
  }

  private static String url(String database) {
    String original = POSTGRES.getJdbcUrl();
    int query = original.indexOf('?');
    String suffix = query < 0 ? "" : original.substring(query),
        base = query < 0 ? original : original.substring(0, query);
    return base.substring(0, base.lastIndexOf('/') + 1) + database + suffix;
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
