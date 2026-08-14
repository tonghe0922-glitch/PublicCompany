package cn.shangjingu.platform.api;

import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.workflow.GenericRequestService;
import cn.shangjingu.platform.workflow.NoticeReceiptService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import org.flywaydb.core.Flyway;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/** Fresh P004/P005 allowlist-monitor fixture for the PHASE-10 representative browser gate. */
public final class Phase10TechMonitorBrowserBackendFixture {
    private static final String POSTGRES_IMAGE = "postgres:16.14-alpine3.24";
    private static final String REDIS_IMAGE = "redis:7.4-alpine";
    private static final String BASE_URL = "http://127.0.0.1:18093";
    private static final String API_PASSWORD = "phase10_monitor_api_" + shortId();
    private static final String AUDIT_PASSWORD = "phase10_monitor_audit_" + shortId();

    private static final UUID TENANT = uuid("00000000-0000-0000-0000-000000006006");
    private static final UUID CENTER_A = uuid("10000000-0000-0000-0000-000000006006");
    private static final UUID CENTER_B = uuid("10000000-0000-0000-0000-000000006007");
    private static final UUID POSITION_A = uuid("20000000-0000-0000-0000-000000006006");
    private static final UUID POSITION_B = uuid("20000000-0000-0000-0000-000000006007");

    private static final Actor SEED = actor(0, CENTER_A, POSITION_A);
    private static final Actor P004_ACTOR_ONE = actor(1, CENTER_A, POSITION_A);
    private static final Actor P004_ACTOR_TWO = actor(2, CENTER_A, POSITION_A);
    private static final Actor TECH = actor(3, CENTER_A, POSITION_A);
    private static final Actor OUT = actor(4, CENTER_B, POSITION_B);
    private static final Actor DENIED = actor(5, CENTER_A, POSITION_A);
    private static final String ACTOR_ONE_LOGIN = "phase10.monitor.actor1";
    private static final String ACTOR_TWO_LOGIN = "phase10.monitor.actor2";

    private Phase10TechMonitorBrowserBackendFixture() {}

    public static void main(String[] args) throws Exception {
        String tenantCode = required("PHASE10_TECH_MONITOR_TENANT");
        Credentials credentials = new Credentials(
                required("PHASE10_TECH_MONITOR_SEED_LOGIN"),
                required("PHASE10_TECH_MONITOR_TECH_LOGIN"),
                required("PHASE10_TECH_MONITOR_OUT_LOGIN"),
                required("PHASE10_TECH_MONITOR_DENIED_LOGIN"),
                required("PHASE10_TECH_MONITOR_PASSWORD"));
        PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(POSTGRES_IMAGE)
                .withDatabaseName("postgres").withUsername("postgres")
                .withPassword("bootstrap-" + shortId());
        GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse(REDIS_IMAGE))
                .withExposedPorts(6379);
        postgres.start();
        redis.start();
        prepare(postgres, tenantCode, credentials);
        ConfigurableApplicationContext context = startApi(postgres, redis);
        Facts facts = seedFacts(context);
        writeRuntime(context.getBean(ObjectMapper.class), postgres, redis, tenantCode, credentials, facts);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            context.close();
            redis.stop();
            postgres.stop();
        }));
        System.out.println("PHASE10_TECH_MONITOR_BROWSER_FIXTURE_READY");
        new CountDownLatch(1).await();
    }

    private static ConfigurableApplicationContext startApi(
            PostgreSQLContainer<?> postgres, GenericContainer<?> redis) {
        return new SpringApplication(ApiApplication.class).run(
                "--server.port=18093", "--spring.flyway.enabled=false",
                "--spring.datasource.url=" + jdbcUrl(postgres, "sjg_oms"),
                "--spring.datasource.username=sjg_api_runtime",
                "--spring.datasource.password=" + API_PASSWORD,
                "--spring.data.redis.host=" + redis.getHost(),
                "--spring.data.redis.port=" + redis.getMappedPort(6379),
                "--sjg.audit.datasource.url=" + jdbcUrl(postgres, "sjg_audit"),
                "--sjg.audit.datasource.username=sjg_audit_writer",
                "--sjg.audit.datasource.password=" + AUDIT_PASSWORD,
                "--sjg.security.session.access-ttl=PT30M",
                "--sjg.security.session.refresh-ttl=PT1H");
    }

    private static void prepare(
            PostgreSQLContainer<?> postgres, String tenantCode, Credentials credentials) throws Exception {
        Path root = root();
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("filesystem:" + root.resolve("technical-platform/database/flyway/cluster"))
                .cleanDisabled(true).load().migrate();
        try (Connection connection = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                Statement statement = connection.createStatement()) {
            statement.execute("alter role sjg_api_runtime password '" + API_PASSWORD + "'");
            statement.execute("alter role sjg_audit_writer password '" + AUDIT_PASSWORD + "'");
            statement.execute("create database sjg_oms");
            statement.execute("create database sjg_audit");
        }
        Flyway.configure().dataSource(jdbcUrl(postgres, "sjg_oms"), postgres.getUsername(), postgres.getPassword())
                .locations("filesystem:" + root.resolve("technical-platform/database/flyway/oms"),
                        "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/oms"))
                .placeholders(Map.of(
                        "sjg_tenant_id", TENANT.toString(),
                        "sjg_tenant_code", tenantCode,
                        "sjg_tenant_name", "PHASE10 Tech Monitor Browser Tenant"))
                .cleanDisabled(true).load().migrate();
        Flyway.configure().dataSource(jdbcUrl(postgres, "sjg_audit"), postgres.getUsername(), postgres.getPassword())
                .locations("filesystem:" + root.resolve("technical-platform/database/flyway/audit"),
                        "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/audit"))
                .cleanDisabled(true).load().migrate();
        seedIam(postgres, credentials);
    }

    private static void seedIam(PostgreSQLContainer<?> postgres, Credentials credentials) throws Exception {
        String hash = new BCryptPasswordEncoder(12).encode(credentials.password());
        try (Connection connection = DriverManager.getConnection(
                jdbcUrl(postgres, "sjg_oms"), postgres.getUsername(), postgres.getPassword());
                Statement statement = connection.createStatement()) {
            statement.execute("insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values "
                    + "('" + CENTER_A + "','" + TENANT + "','TM_CENTER_A','Tech Monitor Center A','CENTER','tm_center_a'::ltree,'ACTIVE'),"
                    + "('" + CENTER_B + "','" + TENANT + "','TM_CENTER_B','Tech Monitor Center B','CENTER','tm_center_b'::ltree,'ACTIVE')");
            statement.execute("insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values "
                    + "('" + POSITION_A + "','" + TENANT + "','TM_POS_A','Tech Monitor Position A','" + CENTER_A + "','ACTIVE'),"
                    + "('" + POSITION_B + "','" + TENANT + "','TM_POS_B','Tech Monitor Position B','" + CENTER_B + "','ACTIVE')");
            statement.execute("insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled) values "
                    + "('" + TENANT + "','TM_SELF','Tech Monitor Self','{\"scope\":\"SELF\"}'::jsonb,true),"
                    + "('" + TENANT + "','TM_CENTER','Tech Monitor Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
            statement.execute("insert into iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level) values "
                    + permission("platform.session.read", "Session read", "SESSION", "READ", "NORMAL") + ","
                    + permission("platform.session.logout", "Session logout", "SESSION", "LOGOUT", "NORMAL") + ","
                    + permission("p004.request.submit", "Submit P004", "P004_GENERIC_REQUEST", "SUBMIT", "NORMAL") + ","
                    + permission("p004.request.read", "Read P004", "P004_GENERIC_REQUEST", "READ", "NORMAL") + ","
                    + permission("p004.request.act", "Act P004", "P004_GENERIC_REQUEST", "ACT", "HIGH") + ","
                    + permission("p005.notice.publish", "Publish P005", "P005_NOTICE", "PUBLISH", "HIGH") + ","
                    + permission("p005.notice.read", "Read P005", "P005_NOTICE", "READ", "NORMAL") + ","
                    + permission("p005.notice.receipt", "Receipt P005", "P005_NOTICE", "RECEIPT", "NORMAL") + ","
                    + permission("p005.notice.manage", "Manage P005", "P005_NOTICE", "MANAGE", "HIGH") + ","
                    + permission("p005.notice.monitor", "Monitor P005", "P005_NOTICE", "MONITOR", "NORMAL"));
            seedActor(statement, SEED, credentials.seedLogin(), "TM_SEED", "TM_CENTER",
                    "p004.request.submit,p004.request.read,p005.notice.publish,p005.notice.manage", hash);
            seedActor(statement, P004_ACTOR_ONE, ACTOR_ONE_LOGIN, "TM_P004_ACTOR_ONE", "TM_CENTER",
                    "p004.request.read,p004.request.act", hash);
            seedActor(statement, P004_ACTOR_TWO, ACTOR_TWO_LOGIN, "TM_P004_ACTOR_TWO", "TM_CENTER",
                    "p004.request.read,p004.request.act", hash);
            seedActor(statement, TECH, credentials.techLogin(), "TM_TECH", "TM_CENTER",
                    "p004.request.read,p005.notice.monitor", hash);
            seedActor(statement, OUT, credentials.outLogin(), "TM_OUT", "TM_CENTER",
                    "p004.request.read,p005.notice.monitor", hash);
            seedActor(statement, DENIED, credentials.deniedLogin(), "TM_DENIED", "TM_SELF", "", hash);
        }
    }

    private static void seedActor(
            Statement statement, Actor actor, String login, String roleCode, String scope,
            String processPermissions, String hash) throws Exception {
        statement.execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) values "
                + "('" + actor.employee() + "','" + TENANT + "','TM-" + actor.index()
                + "','Tech Monitor Actor " + actor.index() + "','ACTIVE',current_date-30,'"
                + actor.center() + "','" + actor.position() + "')");
        statement.execute("insert into org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status) values "
                + "('" + actor.appointment() + "','" + TENANT + "','" + actor.employee() + "','"
                + actor.position() + "','" + actor.center() + "',true,current_date-30,'ACTIVE')");
        statement.execute("insert into iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level) values "
                + "('" + actor.user() + "','" + TENANT + "','" + login + "','" + hash + "','ACTIVE',0)");
        statement.execute("insert into iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at) values "
                + "('" + actor.identity() + "','" + TENANT + "','" + actor.user() + "','"
                + actor.employee() + "','EMPLOYEE','Tech Monitor " + roleCode + "','" + actor.center()
                + "','" + actor.position() + "',true,now()-interval '1 day')");
        statement.execute("insert into iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled) values "
                + "('" + actor.role() + "','" + TENANT + "','" + roleCode + "','" + roleCode
                + "','PLATFORM','" + scope + "',true)");
        String permissions = "platform.session.read,platform.session.logout"
                + (processPermissions.isBlank() ? "" : "," + processPermissions);
        statement.execute("insert into iam.role_permission(tenant_id,role_id,permission_id) select '"
                + TENANT + "','" + actor.role() + "',id from iam.permission where tenant_id='" + TENANT
                + "' and permission_code in ('" + permissions.replace(",", "','") + "') and not is_deleted");
        statement.execute("insert into iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source) values "
                + "('" + TENANT + "','" + actor.user() + "','" + actor.identity() + "','"
                + actor.role() + "',now()-interval '1 day','TEST_ONLY')");
    }

    private static Facts seedFacts(ConfigurableApplicationContext context) {
        GenericRequestService requests = context.getBean(GenericRequestService.class);
        NoticeReceiptService notices = context.getBean(NoticeReceiptService.class);
        GenericRequestService.GenericRequest p004 = requests.create(
                databaseContext(SEED), "phase10-monitor-p004-create", "phase10-monitor-p004-create-v1",
                new GenericRequestService.CreateCommand(
                        "TECH_MONITOR", "P004 monitor seed", "Source-backed fixture request",
                        "Create a minimal monitor projection", LocalDate.now(), "NORMAL", "NORMAL", BigDecimal.ZERO));
        NoticeReceiptService.NoticeAggregate p005 = notices.publish(
                databaseContext(SEED), "phase10-monitor-p005-publish", "phase10-monitor-p005-publish-v1",
                new NoticeReceiptService.PublishCommand(
                        "TM.P005.001", "P005 monitor seed", "POLICY", "Fixture-only policy body",
                        "TM-2026-001", "\u5185\u90e8", "TECH-MONITOR", CENTER_A, null, 80,
                        LocalDate.now(), Instant.now().minusSeconds(60), Instant.now().plusSeconds(86400),
                        Instant.now().plusSeconds(43200)));
        return new Facts(p004, p005.notice());
    }

    private static void writeRuntime(
            ObjectMapper mapper, PostgreSQLContainer<?> postgres, GenericContainer<?> redis,
            String tenantCode, Credentials credentials, Facts facts) throws Exception {
        ObjectNode root = mapper.createObjectNode();
        root.put("baseUrl", BASE_URL);
        root.put("tenantCode", tenantCode);
        root.put("tenantId", TENANT.toString());
        root.put("password", credentials.password());
        root.put("seedLogin", credentials.seedLogin());
        root.put("p004ActorOneLogin", ACTOR_ONE_LOGIN);
        root.put("p004ActorTwoLogin", ACTOR_TWO_LOGIN);
        root.put("techLogin", credentials.techLogin());
        root.put("outLogin", credentials.outLogin());
        root.put("deniedLogin", credentials.deniedLogin());
        root.put("postgresContainerId", postgres.getContainerId());
        root.put("redisContainerId", redis.getContainerId());
        root.put("p004RecordId", facts.p004().id().toString());
        root.put("p004BusinessNo", facts.p004().businessNo());
        root.put("p004Node", facts.p004().currentNodeCode());
        root.put("p004Version", facts.p004().versionNo());
        root.put("p005RecordId", facts.p005().id().toString());
        root.put("p005BusinessNo", facts.p005().businessNo());
        root.put("p005Node", facts.p005().currentNodeCode());
        root.put("p005Version", facts.p005().versionNo());
        Path output = root().resolve(
                "technical-platform/backend/apps/api/target/phase10-tech-monitor-fixture-runtime.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root) + System.lineSeparator());
    }

    private static DatabaseSecurityContext databaseContext(Actor actor) {
        return new DatabaseSecurityContext(
                TENANT, actor.user(), actor.identity(), actor.employee(), actor.appointment(),
                actor.center(), actor.position());
    }

    private static Actor actor(int index, UUID center, UUID position) {
        return new Actor(index, derived(3, index), derived(4, index), derived(5, index),
                derived(6, index), derived(7, index), center, position);
    }

    private static String permission(
            String code, String name, String resource, String action, String risk) {
        return "(gen_random_uuid(),'" + TENANT + "','" + code + "','" + name + "','"
                + resource + "','" + action + "','" + risk + "')";
    }

    private static String jdbcUrl(PostgreSQLContainer<?> postgres, String database) {
        return "jdbc:postgresql://" + postgres.getHost() + ":" + postgres.getMappedPort(5432) + "/" + database;
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("required environment missing: " + name);
        }
        return value;
    }

    private static UUID derived(int group, int index) {
        return uuid("%d0000000-0000-0000-0000-%012d".formatted(group, 6006 + index));
    }

    private static UUID uuid(String value) {
        return UUID.fromString(value);
    }

    private static String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private static Path root() {
        Path cursor = Path.of("").toAbsolutePath();
        while (cursor != null) {
            if (Files.exists(cursor.resolve("AGENT.md"))) return cursor;
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("repository root not found");
    }

    private record Actor(
            int index, UUID employee, UUID appointment, UUID user, UUID identity, UUID role,
            UUID center, UUID position) {}

    private record Credentials(
            String seedLogin, String techLogin, String outLogin, String deniedLogin, String password) {}

    private record Facts(
            GenericRequestService.GenericRequest p004, NoticeReceiptService.Notice p005) {}
}
