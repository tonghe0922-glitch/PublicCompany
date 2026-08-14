package cn.shangjingu.platform.api;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
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

/** Real PHASE-11 / P011 Spring Boot + PostgreSQL 16 + Redis browser fixture. */
public final class Phase11P011BrowserBackendFixture {
    private static final UUID TENANT = uuid("00000000-0000-0000-0000-000000002021");
    private static final UUID CENTER_A = uuid("10000000-0000-0000-0000-000000003321");
    private static final UUID CENTER_B = uuid("10000000-0000-0000-0000-000000003322");
    private static final UUID POSITION_A = uuid("20000000-0000-0000-0000-000000003321");
    private static final UUID POSITION_B = uuid("20000000-0000-0000-0000-000000003322");
    private static final UUID OWNER = uuid("30000000-0000-0000-0000-000000003321");
    private static final UUID MANAGER = uuid("30000000-0000-0000-0000-000000003322");
    private static final UUID CALIBRATOR = uuid("30000000-0000-0000-0000-000000003323");
    private static final UUID APPEAL = uuid("30000000-0000-0000-0000-000000003324");
    private static final UUID EXECUTOR = uuid("30000000-0000-0000-0000-000000003325");
    private static final UUID TECH = uuid("30000000-0000-0000-0000-000000003326");
    private static final UUID OUTSIDER = uuid("30000000-0000-0000-0000-000000003327");
    private static final String API_PASSWORD = "p011_browser_api_" + shortId();
    private static final String AUDIT_PASSWORD = "p011_browser_audit_" + shortId();

    private Phase11P011BrowserBackendFixture() {}

    public static void main(String[] args) throws Exception {
        String tenant = required("PHASE11_P011_TENANT");
        String managerLogin = required("PHASE11_P011_LOGIN");
        String password = required("PHASE11_P011_PASSWORD");
        PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
            .withDatabaseName("postgres").withUsername("postgres").withPassword("bootstrap-" + shortId());
        GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine")).withExposedPorts(6379);
        postgres.start();
        redis.start();
        prepare(postgres, tenant, managerLogin, password);
        ConfigurableApplicationContext context = startApi(postgres, redis);
        writeFacts(postgres, redis);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            context.close();
            redis.stop();
            postgres.stop();
        }));
        System.out.println("PHASE11_P011_BROWSER_FIXTURE_READY");
        new CountDownLatch(1).await();
    }

    private static ConfigurableApplicationContext startApi(PostgreSQLContainer<?> postgres, GenericContainer<?> redis) {
        return new SpringApplication(ApiApplication.class).run(
            "--server.port=18090", "--spring.flyway.enabled=false",
            "--spring.datasource.url=" + url(postgres, "sjg_oms"), "--spring.datasource.username=sjg_api_runtime",
            "--spring.datasource.password=" + API_PASSWORD, "--spring.data.redis.host=" + redis.getHost(),
            "--spring.data.redis.port=" + redis.getMappedPort(6379), "--sjg.audit.datasource.url=" + url(postgres, "sjg_audit"),
            "--sjg.audit.datasource.username=sjg_audit_writer", "--sjg.audit.datasource.password=" + AUDIT_PASSWORD,
            "--sjg.security.session.access-ttl=PT30M", "--sjg.security.session.refresh-ttl=PT1H"
        );
    }

    private static void prepare(PostgreSQLContainer<?> postgres, String tenant, String managerLogin, String password) throws Exception {
        Path root = root();
        Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .locations("filesystem:" + root.resolve("technical-platform/database/flyway/cluster")).cleanDisabled(true).load().migrate();
        try (Connection connection = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()); Statement statement = connection.createStatement()) {
            statement.execute("alter role sjg_api_runtime password '" + API_PASSWORD + "'");
            statement.execute("alter role sjg_audit_writer password '" + AUDIT_PASSWORD + "'");
            statement.execute("create database sjg_oms");
            statement.execute("create database sjg_audit");
        }
        Flyway.configure().dataSource(url(postgres, "sjg_oms"), postgres.getUsername(), postgres.getPassword())
            .locations("filesystem:" + root.resolve("technical-platform/database/flyway/oms"), "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/oms"))
            .placeholders(Map.of("sjg_tenant_id", TENANT.toString(), "sjg_tenant_code", tenant, "sjg_tenant_name", "P011 Browser Tenant"))
            .cleanDisabled(true).load().migrate();
        Flyway.configure().dataSource(url(postgres, "sjg_audit"), postgres.getUsername(), postgres.getPassword())
            .locations("filesystem:" + root.resolve("technical-platform/database/flyway/audit"), "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/audit"))
            .cleanDisabled(true).load().migrate();
        seed(postgres, managerLogin, password);
    }

    private static void seed(PostgreSQLContainer<?> postgres, String managerLogin, String password) throws Exception {
        String hash = new BCryptPasswordEncoder(12).encode(password);
        try (Connection connection = DriverManager.getConnection(url(postgres, "sjg_oms"), postgres.getUsername(), postgres.getPassword()); Statement statement = connection.createStatement()) {
            statement.execute("insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values ('" + CENTER_A + "','" + TENANT + "','P011_A','P011 Center A','CENTER','p011_a'::ltree,'ACTIVE'),('" + CENTER_B + "','" + TENANT + "','P011_B','P011 Center B','CENTER','p011_b'::ltree,'ACTIVE')");
            statement.execute("insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values ('" + POSITION_A + "','" + TENANT + "','P011_PA','P011 Position A','" + CENTER_A + "','ACTIVE'),('" + POSITION_B + "','" + TENANT + "','P011_PB','P011 Position B','" + CENTER_B + "','ACTIVE')");
            UUID[] actors = {OWNER, MANAGER, CALIBRATOR, APPEAL, EXECUTOR, TECH, OUTSIDER};
            for (int index = 0; index < actors.length; index++) {
                UUID center = index == 6 ? CENTER_B : CENTER_A;
                UUID position = index == 6 ? POSITION_B : POSITION_A;
                statement.execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) values ('" + actors[index] + "','" + TENANT + "','P011-B00" + (index + 1) + "','P011 Browser Actor " + index + "','ACTIVE',current_date-30,'" + center + "','" + position + "')");
            }
            statement.execute("insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled) values ('" + TENANT + "','P011_SELF','P011 Self','{\"scope\":\"SELF\"}'::jsonb,true),('" + TENANT + "','P011_CENTER','P011 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
            statement.execute("insert into iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level) values (gen_random_uuid(),'" + TENANT + "','platform.session.read','Session read','SESSION','READ','NORMAL'),(gen_random_uuid(),'" + TENANT + "','platform.session.logout','Session logout','SESSION','LOGOUT','NORMAL')");
            String[][] roles = {
                {"phase11.p011.owner", "SELF", "p011.performance.read,p011.performance.evaluate"},
                {managerLogin, "CENTER", "p011.performance.read,p011.performance.manage,p011.performance.evaluate"},
                {"phase11.p011.calibrator", "CENTER", "p011.performance.read,p011.performance.calibrate"},
                {"phase11.p011.appeal", "CENTER", "p011.performance.read,p011.performance.appeal"},
                {"phase11.p011.executor", "CENTER", "p011.performance.read,p011.performance.execute"},
                {"phase11.p011.tech", "CENTER", "p011.performance.monitor"},
                {"phase11.p011.out", "CENTER", "p011.performance.read"}
            };
            for (int index = 0; index < roles.length; index++) {
                seedActor(statement, index, actors[index], roles[index][0], roles[index][1], roles[index][2], hash,
                    index == 6 ? CENTER_B : CENTER_A, index == 6 ? POSITION_B : POSITION_A);
            }
        }
    }

    private static void seedActor(Statement statement, int index, UUID employee, String login, String scope,
                                  String permissions, String hash, UUID center, UUID position) throws Exception {
        UUID user = derived(4, index), identity = derived(5, index), role = derived(6, index), appointment = derived(7, index);
        String roleCode = "P011_BROWSER_" + index;
        statement.execute("insert into org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status) values ('" + appointment + "','" + TENANT + "','" + employee + "','" + position + "','" + center + "',true,current_date-30,'ACTIVE')");
        statement.execute("insert into iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level) values ('" + user + "','" + TENANT + "','" + login + "','" + hash + "','ACTIVE',0)");
        statement.execute("insert into iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at) values ('" + identity + "','" + TENANT + "','" + user + "','" + employee + "','EMPLOYEE','P011 " + login + "','" + center + "','" + position + "',true,now()-interval '1 day')");
        statement.execute("insert into iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled) values ('" + role + "','" + TENANT + "','" + roleCode + "','" + roleCode + "','PLATFORM','P011_" + scope + "',true)");
        statement.execute("insert into iam.role_permission(tenant_id,role_id,permission_id) select '" + TENANT + "','" + role + "',id from iam.permission where tenant_id='" + TENANT + "' and permission_code in ('platform.session.read','platform.session.logout','" + permissions.replace(",", "','") + "') and not is_deleted");
        statement.execute("insert into iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source) values ('" + TENANT + "','" + user + "','" + identity + "','" + role + "',now()-interval '1 day','TEST_ONLY')");
    }

    private static void writeFacts(PostgreSQLContainer<?> postgres, GenericContainer<?> redis) throws Exception {
        Path output = root().resolve("technical-platform/backend/apps/api/target/phase11-p011-fixture-runtime.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, "{\n  \"postgresContainerId\": \"" + postgres.getContainerId() + "\",\n  \"redisContainerId\": \"" + redis.getContainerId() + "\",\n  \"tenantId\": \"" + TENANT + "\",\n  \"ownerId\": \"" + OWNER + "\"\n}\n");
    }

    private static String url(PostgreSQLContainer<?> postgres, String database) { return "jdbc:postgresql://" + postgres.getHost() + ":" + postgres.getMappedPort(5432) + "/" + database; }
    private static String required(String name) { String value = System.getenv(name); if (value == null || value.isBlank()) throw new IllegalStateException("required environment missing: " + name); return value; }
    private static UUID derived(int group, int index) { return uuid("%d0000000-0000-0000-0000-%012d".formatted(group, 3321 + index)); }
    private static UUID uuid(String value) { return UUID.fromString(value); }
    private static String shortId() { return UUID.randomUUID().toString().replace("-", "").substring(0, 16); }
    private static Path root() { Path current = Path.of("").toAbsolutePath(); while (current != null) { if (Files.exists(current.resolve("AGENT.md"))) return current; current = current.getParent(); } throw new IllegalStateException("repository root not found"); }
}
