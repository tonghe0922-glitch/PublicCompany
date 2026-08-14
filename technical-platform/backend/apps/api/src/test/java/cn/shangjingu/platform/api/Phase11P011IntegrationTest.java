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
class Phase11P011IntegrationTest {
    private static final UUID TENANT = id("00000000-0000-0000-0000-000000002011");
    private static final UUID CENTER_A = id("10000000-0000-0000-0000-000000003311");
    private static final UUID CENTER_B = id("10000000-0000-0000-0000-000000003312");
    private static final UUID POSITION_A = id("20000000-0000-0000-0000-000000003311");
    private static final UUID POSITION_B = id("20000000-0000-0000-0000-000000003312");
    private static final UUID OWNER = id("30000000-0000-0000-0000-000000003311");
    private static final UUID MANAGER = id("30000000-0000-0000-0000-000000003312");
    private static final UUID CALIBRATOR = id("30000000-0000-0000-0000-000000003313");
    private static final UUID APPEAL = id("30000000-0000-0000-0000-000000003314");
    private static final UUID EXECUTOR = id("30000000-0000-0000-0000-000000003315");
    private static final UUID TECH = id("30000000-0000-0000-0000-000000003316");
    private static final UUID OUTSIDER = id("30000000-0000-0000-0000-000000003317");
    private static final String PASSWORD = "P011-Live-Test-9q!";
    private static final String API_PASSWORD = "p011_api_" + shortId();
    private static final String AUDIT_PASSWORD = "p011_audit_" + shortId();
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
        .withDatabaseName("postgres").withUsername("postgres").withPassword("bootstrap-" + shortId());
    private static final GenericContainer<?> REDIS = new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine"))
        .withExposedPorts(6379);

    static {
        POSTGRES.start();
        REDIS.start();
        try {
            prepare();
        } catch (Exception exception) {
            POSTGRES.stop();
            REDIS.stop();
            throw new ExceptionInInitializerError(exception);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> url("sjg_oms"));
        registry.add("spring.datasource.username", () -> "sjg_api_runtime");
        registry.add("spring.datasource.password", () -> API_PASSWORD);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("sjg.audit.datasource.url", () -> url("sjg_audit"));
        registry.add("sjg.audit.datasource.username", () -> "sjg_audit_writer");
        registry.add("sjg.audit.datasource.password", () -> AUDIT_PASSWORD);
    }

    @AfterAll
    static void stop() {
        REDIS.stop();
        POSTGRES.stop();
    }

    @Test
    void realHttpLifecycleSeparatesScoresRecusalAppealAndExternalEffectReceipt() throws Exception {
        String owner = login("owner");
        String manager = login("manager");
        String calibrator = login("calibrator");
        String appeal = login("appeal");
        String executor = login("executor");
        String tech = login("tech");
        String outsider = login("outsider");
        ObjectNode create = mapper.createObjectNode()
            .put("businessDate", LocalDate.now().toString())
            .put("subject", "2026 H2 service-quality performance cycle")
            .put("reason", "Approved performance plan and source KPI package")
            .put("ownerEmployeeId", OWNER.toString())
            .put("contentVersion", "2026-H2-V1")
            .put("periodOrCourseNo", "PERF-2026-H2")
            .set("evidence", evidence("approved target package"));

        mvc.perform(post("/api/v1/processes/P011/performance-cycles")
            .contentType(MediaType.APPLICATION_JSON).content(create.toString()).header("Idempotency-Key", "unauth"))
            .andExpect(status().isUnauthorized());
        JsonNode current = json(mvc.perform(post("/api/v1/processes/P011/performance-cycles")
            .header("Authorization", bearer(manager)).header("Idempotency-Key", "create-approved")
            .contentType(MediaType.APPLICATION_JSON).content(create.toString()))
            .andExpect(status().isOk()).andReturn());
        String cycleId = current.path("id").asText();
        assertEquals("S01", current.path("currentNodeCode").asText());
        assertEquals(cycleId, json(mvc.perform(post("/api/v1/processes/P011/performance-cycles")
            .header("Authorization", bearer(manager)).header("Idempotency-Key", "create-approved")
            .contentType(MediaType.APPLICATION_JSON).content(create.toString()))
            .andExpect(status().isOk()).andReturn()).path("id").asText());

        assertEquals(0, json(mvc.perform(get("/api/v1/processes/P011/performance-cycles")
            .header("Authorization", bearer(outsider))).andExpect(status().isOk()).andReturn()).size());
        mvc.perform(get("/api/v1/processes/P011/performance-cycles/" + cycleId)
            .header("Authorization", bearer(outsider))).andExpect(status().isForbidden());
        JsonNode masked = json(mvc.perform(get("/api/v1/processes/P011/performance-cycles/" + cycleId)
            .header("Authorization", bearer(tech))).andExpect(status().isOk()).andReturn());
        assertTrue(masked.path("reason").isNull());
        assertTrue(masked.path("score1000").isNull());
        assertTrue(masked.path("appealStatus").isNull());
        assertTrue(masked.path("scores").isArray() && masked.path("scores").isEmpty());
        assertTrue(masked.path("events").isArray() && masked.path("events").isEmpty());
        assertTrue(masked.path("effects").isArray() && masked.path("effects").isEmpty());

        mvc.perform(post(actionUrl(cycleId, "SET_TARGET")).header("Authorization", bearer(manager))
            .header("Idempotency-Key", "stale").contentType(MediaType.APPLICATION_JSON).content(action(0).toString()))
            .andExpect(status().isConflict());
        current = act(manager, cycleId, "SET_TARGET", 1, action(1), "target");
        mvc.perform(post(actionUrl(cycleId, "CONFIRM_TARGET")).header("Authorization", bearer(manager))
            .header("Idempotency-Key", "not-owner-confirm").contentType(MediaType.APPLICATION_JSON).content(action(2).toString()))
            .andExpect(status().isConflict());
        current = act(owner, cycleId, "CONFIRM_TARGET", 2, action(2), "confirm");
        current = act(manager, cycleId, "RECORD_COACHING", 3, action(3), "coaching");
        current = act(manager, cycleId, "COLLECT_AUTHORITY_DATA", 4, action(4), "authority-data");

        mvc.perform(post(actionUrl(cycleId, "SUBMIT_SELF_EVALUATION")).header("Authorization", bearer(owner))
            .header("Idempotency-Key", "invalid-score").contentType(MediaType.APPLICATION_JSON)
            .content(action(5).put("score1000", 1001).toString())).andExpect(status().isConflict());
        current = act(owner, cycleId, "SUBMIT_SELF_EVALUATION", 5, action(5).put("score1000", 860), "self-score");
        assertEquals("S05", current.path("currentNodeCode").asText());
        mvc.perform(post(actionUrl(cycleId, "SUBMIT_SUPERVISOR_EVALUATION")).header("Authorization", bearer(owner))
            .header("Idempotency-Key", "self-supervision").contentType(MediaType.APPLICATION_JSON)
            .content(action(6).put("score1000", 900).toString())).andExpect(status().isConflict());
        current = act(manager, cycleId, "SUBMIT_SUPERVISOR_EVALUATION", 6, action(6).put("score1000", 900), "supervisor-score");
        current = act(manager, cycleId, "CALCULATE_SCORE", 7, action(7), "calculate");
        assertEquals(880, current.path("score1000").asInt());
        mvc.perform(post(actionUrl(cycleId, "CALIBRATE")).header("Authorization", bearer(manager))
            .header("Idempotency-Key", "same-calibrator").contentType(MediaType.APPLICATION_JSON)
            .content(action(8).put("score1000", 885).toString())).andExpect(status().isForbidden());
        mvc.perform(post(actionUrl(cycleId, "CALIBRATE")).header("Authorization", bearer(tech))
            .header("Idempotency-Key", "tech-calibrate").contentType(MediaType.APPLICATION_JSON)
            .content(action(8).put("score1000", 885).toString())).andExpect(status().isForbidden());
        current = act(calibrator, cycleId, "CALIBRATE", 8, action(8).put("score1000", 885), "calibrate");
        current = act(owner, cycleId, "CONFIRM_FEEDBACK", 9, action(9).put("appealRaised", true), "appeal-raised");
        mvc.perform(post(actionUrl(cycleId, "NO_APPEAL")).header("Authorization", bearer(appeal))
            .header("Idempotency-Key", "ignore-appeal").contentType(MediaType.APPLICATION_JSON)
            .content(action(10).toString())).andExpect(status().isConflict());
        current = act(appeal, cycleId, "RESOLVE_APPEAL", 10, action(10), "appeal-resolved");
        mvc.perform(post(actionUrl(cycleId, "EXECUTE_EFFECT")).header("Authorization", bearer(executor))
            .header("Idempotency-Key", "missing-external-ref").contentType(MediaType.APPLICATION_JSON)
            .content(action(11).put("executionType", "DEVELOPMENT_PLAN").toString())).andExpect(status().isConflict());
        current = act(executor, cycleId, "EXECUTE_EFFECT", 11,
            action(11).put("executionType", "DEVELOPMENT_PLAN").put("externalReference", "HR-DEVELOPMENT-RECEIPT-2026-011"),
            "effect-receipt");
        current = act(manager, cycleId, "ARCHIVE", 12, action(12), "archive");
        assertEquals("END", current.path("currentNodeCode").asText());
        assertEquals("RESOLVED", current.path("appealStatus").asText());
        assertEquals(4, current.path("scores").size());
        assertEquals("DEVELOPMENT_PLAN", current.path("effects").get(0).path("executionType").asText());

        JdbcTemplate oms = jdbc("sjg_oms", POSTGRES.getUsername(), POSTGRES.getPassword());
        UUID id = UUID.fromString(cycleId);
        assertEquals(13, oms.queryForObject("select count(*) from performance.performance_cycle_event where tenant_id=? and cycle_id=?", Integer.class, TENANT, id));
        assertEquals(4, oms.queryForObject("select count(distinct score_type) from performance.performance_score_fact where tenant_id=? and cycle_id=?", Integer.class, TENANT, id));
        assertEquals(1, oms.queryForObject("select count(*) from performance.performance_effect_execution where tenant_id=? and cycle_id=? and execution_status='RECORDED'", Integer.class, TENANT, id));
        assertEquals(13, oms.queryForObject("select count(*) from core.outbox_event where tenant_id=? and aggregate_id=? and event_type='P011_PERFORMANCE_EVENT'", Integer.class, TENANT, id));
        assertTrue(jdbc("sjg_audit", POSTGRES.getUsername(), POSTGRES.getPassword())
            .queryForObject("select count(*) from audit.operation_log where tenant_id=? and resource_id=? and action like 'P011_%'", Integer.class, TENANT, id) >= 20);
    }

    private JsonNode act(String token, String id, String code, int version, ObjectNode body, String key) throws Exception {
        assertEquals(version, body.path("expectedVersion").asInt());
        return json(mvc.perform(post(actionUrl(id, code)).header("Authorization", bearer(token))
            .header("Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(body.toString()))
            .andExpect(status().isOk()).andReturn());
    }

    private ObjectNode action(int version) {
        return mapper.createObjectNode().put("expectedVersion", version).putNull("score1000")
            .putNull("appealRaised").putNull("executionType").putNull("externalReference")
            .put("resultSummary", "P011 source fact accepted").set("evidence", evidence("immutable " + version));
    }

    private ObjectNode evidence(String note) {
        return mapper.createObjectNode().put("note", note).put("recordedAt", Instant.now().toString());
    }

    private String login(String name) throws Exception {
        return json(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
            .content(mapper.createObjectNode().put("tenantCode", "PHASE11_P011").put("loginName", "p011." + name)
                .put("password", PASSWORD).toString())).andExpect(status().isOk()).andReturn()).path("accessToken").asText();
    }

    private JsonNode json(MvcResult result) throws Exception {
        return mapper.readTree(result.getResponse().getContentAsByteArray());
    }

    private static String bearer(String token) { return "Bearer " + token; }
    private static String actionUrl(String id, String action) { return "/api/v1/processes/P011/performance-cycles/" + id + "/actions/" + action; }

    private static void prepare() throws Exception {
        Path root = root();
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:" + root.resolve("technical-platform/database/flyway/cluster")).cleanDisabled(true).load().migrate();
        try (Connection connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()); Statement statement = connection.createStatement()) {
            statement.execute("alter role sjg_api_runtime password '" + API_PASSWORD + "'");
            statement.execute("alter role sjg_audit_writer password '" + AUDIT_PASSWORD + "'");
            statement.execute("create database sjg_oms");
            statement.execute("create database sjg_audit");
        }
        Flyway.configure().dataSource(url("sjg_oms"), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:" + root.resolve("technical-platform/database/flyway/oms"), "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/oms"))
            .placeholders(Map.of("sjg_tenant_id", TENANT.toString(), "sjg_tenant_code", "PHASE11_P011", "sjg_tenant_name", "P011 Integration Tenant"))
            .cleanDisabled(true).load().migrate();
        Flyway.configure().dataSource(url("sjg_audit"), POSTGRES.getUsername(), POSTGRES.getPassword())
            .locations("filesystem:" + root.resolve("technical-platform/database/flyway/audit"), "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/audit"))
            .cleanDisabled(true).load().migrate();
        seed();
    }

    private static void seed() throws Exception {
        String hash = new BCryptPasswordEncoder(12).encode(PASSWORD);
        try (Connection connection = DriverManager.getConnection(url("sjg_oms"), POSTGRES.getUsername(), POSTGRES.getPassword()); Statement statement = connection.createStatement()) {
            statement.execute("insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values ('" + CENTER_A + "','" + TENANT + "','P011_A','P011 Center A','CENTER','p011_a'::ltree,'ACTIVE'),('" + CENTER_B + "','" + TENANT + "','P011_B','P011 Center B','CENTER','p011_b'::ltree,'ACTIVE')");
            statement.execute("insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values ('" + POSITION_A + "','" + TENANT + "','P011_PA','P011 Position A','" + CENTER_A + "','ACTIVE'),('" + POSITION_B + "','" + TENANT + "','P011_PB','P011 Position B','" + CENTER_B + "','ACTIVE')");
            UUID[] actors = {OWNER, MANAGER, CALIBRATOR, APPEAL, EXECUTOR, TECH, OUTSIDER};
            for (int i = 0; i < actors.length; i++) {
                UUID center = i == 6 ? CENTER_B : CENTER_A;
                UUID position = i == 6 ? POSITION_B : POSITION_A;
                statement.execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) values ('" + actors[i] + "','" + TENANT + "','P011-E00" + (i + 1) + "','P011 Actor " + i + "','ACTIVE',current_date-30,'" + center + "','" + position + "')");
            }
            statement.execute("insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled) values ('" + TENANT + "','P011_SELF','P011 Self','{\"scope\":\"SELF\"}'::jsonb,true),('" + TENANT + "','P011_CENTER','P011 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
            statement.execute("insert into iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level) values (gen_random_uuid(),'" + TENANT + "','platform.session.read','Session read','SESSION','READ','NORMAL'),(gen_random_uuid(),'" + TENANT + "','platform.session.logout','Session logout','SESSION','LOGOUT','NORMAL')");
            String[][] roles = {
                {"owner", "SELF", "p011.performance.read,p011.performance.evaluate"},
                {"manager", "CENTER", "p011.performance.read,p011.performance.manage,p011.performance.evaluate"},
                {"calibrator", "CENTER", "p011.performance.read,p011.performance.calibrate"},
                {"appeal", "CENTER", "p011.performance.read,p011.performance.appeal"},
                {"executor", "CENTER", "p011.performance.read,p011.performance.execute"},
                {"tech", "CENTER", "p011.performance.monitor"},
                {"outsider", "CENTER", "p011.performance.read"}
            };
            for (int i = 0; i < roles.length; i++) {
                seedActor(statement, i, actors[i], roles[i][0], roles[i][1], roles[i][2], hash,
                    i == 6 ? CENTER_B : CENTER_A, i == 6 ? POSITION_B : POSITION_A);
            }
        }
    }

    private static void seedActor(Statement statement, int index, UUID employee, String login, String scope,
                                  String permissions, String hash, UUID center, UUID position) throws Exception {
        UUID user = derived(4, index), identity = derived(5, index), role = derived(6, index), appointment = derived(7, index);
        statement.execute("insert into org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status) values ('" + appointment + "','" + TENANT + "','" + employee + "','" + position + "','" + center + "',true,current_date-30,'ACTIVE')");
        statement.execute("insert into iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level) values ('" + user + "','" + TENANT + "','p011." + login + "','" + hash + "','ACTIVE',0)");
        statement.execute("insert into iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at) values ('" + identity + "','" + TENANT + "','" + user + "','" + employee + "','EMPLOYEE','P011 " + login + "','" + center + "','" + position + "',true,now()-interval '1 day')");
        statement.execute("insert into iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled) values ('" + role + "','" + TENANT + "','P011_" + login.toUpperCase() + "','P011 " + login + "','PLATFORM','P011_" + scope + "',true)");
        statement.execute("insert into iam.role_permission(tenant_id,role_id,permission_id) select '" + TENANT + "','" + role + "',id from iam.permission where tenant_id='" + TENANT + "' and permission_code in ('platform.session.read','platform.session.logout','" + permissions.replace(",", "','") + "') and not is_deleted");
        statement.execute("insert into iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source) values ('" + TENANT + "','" + user + "','" + identity + "','" + role + "',now()-interval '1 day','TEST_ONLY')");
    }

    private static JdbcTemplate jdbc(String database, String username, String password) {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        dataSource.setDriverClassName("org.postgresql.Driver");
        dataSource.setUrl(url(database));
        dataSource.setUsername(username);
        dataSource.setPassword(password);
        return new JdbcTemplate(dataSource);
    }

    private static UUID derived(int group, int index) { return id("%d0000000-0000-0000-0000-%012d".formatted(group, 3311 + index)); }
    private static UUID id(String value) { return UUID.fromString(value); }
    private static String shortId() { return UUID.randomUUID().toString().replace("-", "").substring(0, 16); }

    private static String url(String database) {
        String original = POSTGRES.getJdbcUrl();
        int query = original.indexOf('?');
        String suffix = query < 0 ? "" : original.substring(query);
        String base = query < 0 ? original : original.substring(0, query);
        return base.substring(0, base.lastIndexOf('/') + 1) + database + suffix;
    }

    private static Path root() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("AGENT.md"))) return current;
            current = current.getParent();
        }
        throw new IllegalStateException("repository root not found");
    }
}
