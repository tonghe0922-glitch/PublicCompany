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

/** Real PHASE-09 / P005 Spring Boot + PostgreSQL16 + Redis browser fixture. */
public final class Phase09P005BrowserBackendFixture {
    private static final String POSTGRES_IMAGE = "postgres:16.14-alpine3.24";
    private static final DockerImageName REDIS_IMAGE = DockerImageName.parse("redis:7.4-alpine");
    private static final UUID TENANT = id("00000000-0000-0000-0000-000000001005");
    private static final UUID CENTER_A = id("10000000-0000-0000-0000-000000001005");
    private static final UUID CENTER_B = id("10000000-0000-0000-0000-000000001006");
    private static final UUID MANAGER_POSITION = id("20000000-0000-0000-0000-000000001005");
    private static final UUID RECIPIENT_POSITION = id("20000000-0000-0000-0000-000000001006");
    private static final UUID TECH_POSITION = id("20000000-0000-0000-0000-000000001007");
    private static final UUID OUT_POSITION = id("20000000-0000-0000-0000-000000001008");

    private static final UUID PUBLISHER = id("30000000-0000-0000-0000-000000001005");
    private static final UUID RECIPIENT1 = id("30000000-0000-0000-0000-000000001006");
    private static final UUID RECIPIENT2 = id("30000000-0000-0000-0000-000000001007");
    private static final UUID TECH = id("30000000-0000-0000-0000-000000001008");
    private static final UUID OUTSIDER = id("30000000-0000-0000-0000-000000001009");

    private static final UUID PUBLISHER_APPOINTMENT = id("40000000-0000-0000-0000-000000001005");
    private static final UUID RECIPIENT1_APPOINTMENT = id("40000000-0000-0000-0000-000000001006");
    private static final UUID RECIPIENT2_APPOINTMENT = id("40000000-0000-0000-0000-000000001007");
    private static final UUID TECH_APPOINTMENT = id("40000000-0000-0000-0000-000000001008");
    private static final UUID OUTSIDER_APPOINTMENT = id("40000000-0000-0000-0000-000000001009");

    private static final UUID PUBLISHER_USER = id("50000000-0000-0000-0000-000000001005");
    private static final UUID RECIPIENT1_USER = id("50000000-0000-0000-0000-000000001006");
    private static final UUID RECIPIENT2_USER = id("50000000-0000-0000-0000-000000001007");
    private static final UUID TECH_USER = id("50000000-0000-0000-0000-000000001008");
    private static final UUID OUTSIDER_USER = id("50000000-0000-0000-0000-000000001009");

    private static final UUID PUBLISHER_IDENTITY = id("60000000-0000-0000-0000-000000001005");
    private static final UUID RECIPIENT1_IDENTITY = id("60000000-0000-0000-0000-000000001006");
    private static final UUID RECIPIENT2_IDENTITY = id("60000000-0000-0000-0000-000000001007");
    private static final UUID TECH_IDENTITY = id("60000000-0000-0000-0000-000000001008");
    private static final UUID OUTSIDER_IDENTITY = id("60000000-0000-0000-0000-000000001009");

    private static final UUID PUBLISHER_ROLE = id("70000000-0000-0000-0000-000000001005");
    private static final UUID RECIPIENT_ROLE = id("70000000-0000-0000-0000-000000001006");
    private static final UUID TECH_ROLE = id("70000000-0000-0000-0000-000000001007");
    private static final UUID OUTSIDER_ROLE = id("70000000-0000-0000-0000-000000001008");

    private static final UUID SESSION_READ = id("80000000-0000-0000-0000-000000001001");
    private static final UUID SESSION_LOGOUT = id("80000000-0000-0000-0000-000000001002");
    private static final UUID NOTICE_PUBLISH = id("80000000-0000-0000-0000-000000001005");
    private static final UUID NOTICE_READ = id("80000000-0000-0000-0000-000000001006");
    private static final UUID NOTICE_RECEIPT = id("80000000-0000-0000-0000-000000001007");
    private static final UUID NOTICE_MANAGE = id("80000000-0000-0000-0000-000000001008");
    private static final UUID NOTICE_MONITOR = id("80000000-0000-0000-0000-000000001009");

    private static final String PUBLISHER_LOGIN = "phase09.p004.actor1";
    private static final String RECIPIENT2_LOGIN = "phase09.p004.actor2";
    private static final String TECH_LOGIN = "phase09.p004.tech";
    private static final String OUTSIDER_LOGIN = "phase09.p004.out";

    private Phase09P005BrowserBackendFixture() {}

    public static void main(String[] args) throws Exception {
        String tenantCode = requiredEnv("PHASE09_P005_TENANT");
        String recipient1Login = requiredEnv("PHASE09_P005_RECIPIENT1_LOGIN");
        String password = requiredEnv("PHASE09_P005_PASSWORD");
        String apiDatabasePassword = requiredEnv("PHASE09_P005_API_DB_PASSWORD");
        String auditDatabasePassword = requiredEnv("PHASE09_P005_AUDIT_DB_PASSWORD");
        PostgreSQLContainer<?> postgres = postgres();
        GenericContainer<?> redis = redis();
        postgres.start();
        redis.start();
        prepareDatabases(
                postgres, tenantCode, recipient1Login, password,
                apiDatabasePassword, auditDatabasePassword);
        ConfigurableApplicationContext context = startApi(
                postgres, redis, apiDatabasePassword, auditDatabasePassword);
        writeRuntimeFacts(postgres, redis);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> stop(context, redis, postgres)));
        System.out.println("PHASE09_P005_BROWSER_FIXTURE_READY");
        new CountDownLatch(1).await();
    }

    private static PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>(POSTGRES_IMAGE)
                .withDatabaseName("postgres")
                .withUsername("postgres")
                .withPassword("bootstrap-" + UUID.randomUUID());
    }

    private static GenericContainer<?> redis() {
        return new GenericContainer<>(REDIS_IMAGE).withExposedPorts(6379);
    }

    private static void stop(
            ConfigurableApplicationContext context,
            GenericContainer<?> redis,
            PostgreSQLContainer<?> postgres) {
        context.close();
        redis.stop();
        postgres.stop();
    }

    private static ConfigurableApplicationContext startApi(
            PostgreSQLContainer<?> postgres,
            GenericContainer<?> redis,
            String apiDatabasePassword,
            String auditDatabasePassword) {
        SpringApplication application = new SpringApplication(ApiApplication.class);
        return application.run(
                "--server.port=18084",
                "--spring.flyway.enabled=false",
                "--spring.datasource.url=" + jdbcUrl(postgres, "sjg_oms"),
                "--spring.datasource.username=sjg_api_runtime",
                "--spring.datasource.password=" + apiDatabasePassword,
                "--spring.data.redis.host=" + redis.getHost(),
                "--spring.data.redis.port=" + redis.getMappedPort(6379),
                "--sjg.audit.datasource.url=" + jdbcUrl(postgres, "sjg_audit"),
                "--sjg.audit.datasource.username=sjg_audit_writer",
                "--sjg.audit.datasource.password=" + auditDatabasePassword,
                "--sjg.security.session.access-ttl=PT30M",
                "--sjg.security.session.refresh-ttl=PT1H");
    }

    private static void prepareDatabases(
            PostgreSQLContainer<?> postgres,
            String tenantCode,
            String recipient1Login,
            String password,
            String apiDatabasePassword,
            String auditDatabasePassword) throws Exception {
        Path root = findRepoRoot();
        migrateCluster(postgres, root);
        createRuntimeDatabases(postgres, apiDatabasePassword, auditDatabasePassword);
        migrateOms(postgres, root, tenantCode);
        migrateAudit(postgres, root);
        seed(postgres, recipient1Login, password);
    }

    private static void migrateCluster(PostgreSQLContainer<?> postgres, Path root) {
        Flyway.configure()
                .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("filesystem:" + root.resolve("technical-platform/database/flyway/cluster"))
                .cleanDisabled(true)
                .load()
                .migrate();
    }

    private static void createRuntimeDatabases(
            PostgreSQLContainer<?> postgres,
            String apiDatabasePassword,
            String auditDatabasePassword) throws Exception {
        try (Connection connection = DriverManager.getConnection(
                        postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
                Statement statement = connection.createStatement()) {
            statement.execute("ALTER ROLE sjg_api_runtime PASSWORD '" + apiDatabasePassword + "'");
            statement.execute("ALTER ROLE sjg_audit_writer PASSWORD '" + auditDatabasePassword + "'");
            statement.execute("CREATE DATABASE sjg_oms");
            statement.execute("CREATE DATABASE sjg_audit");
        }
    }

    private static void migrateOms(PostgreSQLContainer<?> postgres, Path root, String tenantCode) {
        Flyway.configure()
                .dataSource(jdbcUrl(postgres, "sjg_oms"), postgres.getUsername(), postgres.getPassword())
                .locations(
                        "filesystem:" + root.resolve("technical-platform/database/flyway/oms"),
                        "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/oms"))
                .placeholders(Map.of(
                        "sjg_tenant_id", TENANT.toString(),
                        "sjg_tenant_code", tenantCode,
                        "sjg_tenant_name", "PHASE09 P005 Browser Tenant"))
                .cleanDisabled(true)
                .load()
                .migrate();
    }

    private static void migrateAudit(PostgreSQLContainer<?> postgres, Path root) {
        Flyway.configure()
                .dataSource(jdbcUrl(postgres, "sjg_audit"), postgres.getUsername(), postgres.getPassword())
                .locations(
                        "filesystem:" + root.resolve("technical-platform/database/flyway/audit"),
                        "filesystem:" + root.resolve("technical-platform/database/flyway-overlays/audit"))
                .cleanDisabled(true)
                .load()
                .migrate();
    }

    private static void seed(
            PostgreSQLContainer<?> postgres, String recipient1Login, String password) throws Exception {
        String hash = new BCryptPasswordEncoder(12).encode(password);
        try (Connection connection = DriverManager.getConnection(
                        jdbcUrl(postgres, "sjg_oms"), postgres.getUsername(), postgres.getPassword());
                Statement statement = connection.createStatement()) {
            seedOrganizations(statement);
            seedPeople(statement);
            seedAccess(statement, recipient1Login, hash);
            verifyRecipientBoundary(statement);
        }
    }

    private static void seedOrganizations(Statement statement) throws Exception {
        statement.execute("INSERT INTO org.organization(id,tenant_id,org_code,org_name,org_type,path,status) VALUES "
                + organization(CENTER_A, "P005_CENTER_A", "P005 Center A", "p005_center_a") + ","
                + organization(CENTER_B, "P005_CENTER_B", "P005 Center B", "p005_center_b"));
        statement.execute("INSERT INTO org.position(id,tenant_id,position_code,position_name,org_id,status) VALUES "
                + position(MANAGER_POSITION, "P005_MANAGER", "P005 Publisher Manager", CENTER_A) + ","
                + position(RECIPIENT_POSITION, "P005_RECIPIENT", "P005 Notice Recipient", CENTER_A) + ","
                + position(TECH_POSITION, "P005_TECH", "P005 Tech Monitor", CENTER_A) + ","
                + position(OUT_POSITION, "P005_OUT", "P005 Outside Reader", CENTER_B));
    }

    private static void seedPeople(Statement statement) throws Exception {
        statement.execute("INSERT INTO org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) VALUES "
                + employee(PUBLISHER, "P005-E001", "P005 Publisher", CENTER_A, MANAGER_POSITION) + ","
                + employee(RECIPIENT1, "P005-E002", "P005 Recipient One", CENTER_A, RECIPIENT_POSITION) + ","
                + employee(RECIPIENT2, "P005-E003", "P005 Recipient Two", CENTER_A, RECIPIENT_POSITION) + ","
                + employee(TECH, "P005-E004", "P005 Tech Monitor", CENTER_A, TECH_POSITION) + ","
                + employee(OUTSIDER, "P005-E005", "P005 Cross Center", CENTER_B, OUT_POSITION));
        statement.execute("INSERT INTO org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status) VALUES "
                + appointment(PUBLISHER_APPOINTMENT, PUBLISHER, MANAGER_POSITION, CENTER_A) + ","
                + appointment(RECIPIENT1_APPOINTMENT, RECIPIENT1, RECIPIENT_POSITION, CENTER_A) + ","
                + appointment(RECIPIENT2_APPOINTMENT, RECIPIENT2, RECIPIENT_POSITION, CENTER_A) + ","
                + appointment(TECH_APPOINTMENT, TECH, TECH_POSITION, CENTER_A) + ","
                + appointment(OUTSIDER_APPOINTMENT, OUTSIDER, OUT_POSITION, CENTER_B));
    }

    private static void seedAccess(
            Statement statement, String recipient1Login, String passwordHash) throws Exception {
        seedAccounts(statement, recipient1Login, passwordHash);
        seedScopesAndRoles(statement);
        seedPermissions(statement);
        seedRoleBindings(statement);
    }

    private static void seedAccounts(
            Statement statement, String recipient1Login, String passwordHash) throws Exception {
        statement.execute("INSERT INTO iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level) VALUES "
                + account(PUBLISHER_USER, PUBLISHER_LOGIN, passwordHash) + ","
                + account(RECIPIENT1_USER, recipient1Login, passwordHash) + ","
                + account(RECIPIENT2_USER, RECIPIENT2_LOGIN, passwordHash) + ","
                + account(TECH_USER, TECH_LOGIN, passwordHash) + ","
                + account(OUTSIDER_USER, OUTSIDER_LOGIN, passwordHash));
        statement.execute("INSERT INTO iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at) VALUES "
                + identity(PUBLISHER_IDENTITY, PUBLISHER_USER, PUBLISHER, "P005 Publisher", CENTER_A, MANAGER_POSITION) + ","
                + identity(RECIPIENT1_IDENTITY, RECIPIENT1_USER, RECIPIENT1, "P005 Recipient One", CENTER_A, RECIPIENT_POSITION) + ","
                + identity(RECIPIENT2_IDENTITY, RECIPIENT2_USER, RECIPIENT2, "P005 Recipient Two", CENTER_A, RECIPIENT_POSITION) + ","
                + identity(TECH_IDENTITY, TECH_USER, TECH, "P005 Tech", CENTER_A, TECH_POSITION) + ","
                + identity(OUTSIDER_IDENTITY, OUTSIDER_USER, OUTSIDER, "P005 Out", CENTER_B, OUT_POSITION));
    }

    private static void seedScopesAndRoles(Statement statement) throws Exception {
        statement.execute("INSERT INTO iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled) VALUES "
                + "('" + TENANT + "','P005_SELF','P005 Self','{\"scope\":\"SELF\"}'::jsonb,true),"
                + "('" + TENANT + "','P005_CENTER','P005 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
        statement.execute("INSERT INTO iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled) VALUES "
                + role(PUBLISHER_ROLE, "P005_PUBLISHER", "P005 Publisher", "P005_CENTER") + ","
                + role(RECIPIENT_ROLE, "P005_RECIPIENT", "P005 Recipient", "P005_SELF") + ","
                + role(TECH_ROLE, "P005_TECH", "P005 Tech", "P005_CENTER") + ","
                + role(OUTSIDER_ROLE, "P005_OUT", "P005 Out", "P005_CENTER"));
    }

    private static void seedPermissions(Statement statement) throws Exception {
        statement.execute("INSERT INTO iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level) VALUES "
                + permission(SESSION_READ, "platform.session.read", "Session read", "SESSION", "READ", "NORMAL") + ","
                + permission(SESSION_LOGOUT, "platform.session.logout", "Session logout", "SESSION", "LOGOUT", "NORMAL") + ","
                + permission(NOTICE_PUBLISH, "p005.notice.publish", "Publish P005", "P005_NOTICE", "PUBLISH", "HIGH") + ","
                + permission(NOTICE_READ, "p005.notice.read", "Read P005", "P005_NOTICE", "READ", "NORMAL") + ","
                + permission(NOTICE_RECEIPT, "p005.notice.receipt", "Receipt P005", "P005_NOTICE", "RECEIPT", "NORMAL") + ","
                + permission(NOTICE_MANAGE, "p005.notice.manage", "Manage P005", "P005_NOTICE", "MANAGE", "HIGH") + ","
                + permission(NOTICE_MONITOR, "p005.notice.monitor", "Monitor P005", "P005_NOTICE", "MONITOR", "NORMAL"));
    }

    private static void seedRoleBindings(Statement statement) throws Exception {
        statement.execute("INSERT INTO iam.role_permission(tenant_id,role_id,permission_id) VALUES "
                + commonRolePermissions(PUBLISHER_ROLE) + ","
                + rp(PUBLISHER_ROLE, NOTICE_PUBLISH) + ","
                + rp(PUBLISHER_ROLE, NOTICE_READ) + ","
                + rp(PUBLISHER_ROLE, NOTICE_MANAGE) + ","
                + commonRolePermissions(RECIPIENT_ROLE) + ","
                + rp(RECIPIENT_ROLE, NOTICE_READ) + ","
                + rp(RECIPIENT_ROLE, NOTICE_RECEIPT) + ","
                + commonRolePermissions(TECH_ROLE) + ","
                + rp(TECH_ROLE, NOTICE_MONITOR) + ","
                + commonRolePermissions(OUTSIDER_ROLE) + ","
                + rp(OUTSIDER_ROLE, NOTICE_READ));
        statement.execute("INSERT INTO iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source) VALUES "
                + ur(PUBLISHER_USER, PUBLISHER_IDENTITY, PUBLISHER_ROLE) + ","
                + ur(RECIPIENT1_USER, RECIPIENT1_IDENTITY, RECIPIENT_ROLE) + ","
                + ur(RECIPIENT2_USER, RECIPIENT2_IDENTITY, RECIPIENT_ROLE) + ","
                + ur(TECH_USER, TECH_IDENTITY, TECH_ROLE) + ","
                + ur(OUTSIDER_USER, OUTSIDER_IDENTITY, OUTSIDER_ROLE));
    }

    private static String commonRolePermissions(UUID role) {
        return rp(role, SESSION_READ) + "," + rp(role, SESSION_LOGOUT);
    }

    private static void verifyRecipientBoundary(Statement statement) throws Exception {
        String exactRecipients = "select count(*) from org.employee_position ep "
                + "join org.position p on p.tenant_id=ep.tenant_id and p.id=ep.position_id "
                + "where ep.tenant_id='" + TENANT + "' and p.position_code='P005_RECIPIENT' "
                + "and ep.status='ACTIVE' and not ep.is_deleted and p.status='ACTIVE' and not p.is_deleted";
        try (var rows = statement.executeQuery(exactRecipients)) {
            if (!rows.next() || rows.getInt(1) != 2) {
                throw new IllegalStateException("P005 recipient position must resolve exactly two active employees");
            }
        }
    }

    private static String organization(UUID id, String code, String name, String path) {
        return "('" + id + "','" + TENANT + "','" + code + "','" + name
                + "','CENTER','" + path + "'::ltree,'ACTIVE')";
    }

    private static String position(UUID id, String code, String name, UUID org) {
        return "('" + id + "','" + TENANT + "','" + code + "','" + name + "','" + org + "','ACTIVE')";
    }

    private static String employee(UUID id, String no, String name, UUID org, UUID position) {
        return "('" + id + "','" + TENANT + "','" + no + "','" + name
                + "','ACTIVE',current_date-30,'" + org + "','" + position + "')";
    }

    private static String appointment(UUID id, UUID employee, UUID position, UUID org) {
        return "('" + id + "','" + TENANT + "','" + employee + "','" + position
                + "','" + org + "',true,current_date-30,'ACTIVE')";
    }

    private static String account(UUID id, String login, String hash) {
        return "('" + id + "','" + TENANT + "','" + login + "','" + hash + "','ACTIVE',0)";
    }

    private static String identity(
            UUID id, UUID user, UUID employee, String name, UUID org, UUID position) {
        return "('" + id + "','" + TENANT + "','" + user + "','" + employee + "','EMPLOYEE','"
                + name + "','" + org + "','" + position + "',true,now()-interval '1 day')";
    }

    private static String role(UUID id, String code, String name, String scope) {
        return "('" + id + "','" + TENANT + "','" + code + "','" + name + "','PLATFORM','" + scope + "',true)";
    }

    private static String permission(
            UUID id, String code, String name, String resource, String action, String risk) {
        return "('" + id + "','" + TENANT + "','" + code + "','" + name + "','"
                + resource + "','" + action + "','" + risk + "')";
    }

    private static String rp(UUID role, UUID permission) {
        return "('" + TENANT + "','" + role + "','" + permission + "')";
    }

    private static String ur(UUID user, UUID identity, UUID role) {
        return "('" + TENANT + "','" + user + "','" + identity + "','" + role
                + "',now()-interval '1 day','TEST_ONLY')";
    }

    private static void writeRuntimeFacts(
            PostgreSQLContainer<?> postgres, GenericContainer<?> redis) throws Exception {
        Path output = findRepoRoot().resolve(
                "technical-platform/backend/apps/api/target/phase09-p005-fixture-runtime.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, "{\n"
                + "  \"postgresContainerId\": \"" + postgres.getContainerId() + "\",\n"
                + "  \"redisContainerId\": \"" + redis.getContainerId() + "\",\n"
                + "  \"tenantId\": \"" + TENANT + "\",\n"
                + "  \"publisherEmployeeId\": \"" + PUBLISHER + "\",\n"
                + "  \"recipient1EmployeeId\": \"" + RECIPIENT1 + "\",\n"
                + "  \"recipient2EmployeeId\": \"" + RECIPIENT2 + "\",\n"
                + "  \"techEmployeeId\": \"" + TECH + "\",\n"
                + "  \"outsiderEmployeeId\": \"" + OUTSIDER + "\",\n"
                + "  \"recipientPositionId\": \"" + RECIPIENT_POSITION + "\"\n"
                + "}\n");
    }

    private static String jdbcUrl(PostgreSQLContainer<?> postgres, String database) {
        return "jdbc:postgresql://" + postgres.getHost() + ":" + postgres.getMappedPort(5432) + "/" + database;
    }

    private static String requiredEnv(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("required environment missing: " + name);
        }
        return value;
    }

    private static UUID id(String value) {
        return UUID.fromString(value);
    }

    private static String shortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }

    private static Path findRepoRoot() {
        Path cursor = Path.of("").toAbsolutePath();
        while (cursor != null) {
            if (Files.exists(cursor.resolve("mvnw"))
                    && Files.isDirectory(cursor.resolve("technical-platform"))) {
                return cursor;
            }
            cursor = cursor.getParent();
        }
        throw new IllegalStateException("repository root not found");
    }
}
