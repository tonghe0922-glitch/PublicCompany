package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.shangjingu.platform.org.infrastructure.JdbcOrgDirectoryAdapter;
import cn.shangjingu.platform.workflow.JdbcWorkflowTaskAssignmentRepository;
import cn.shangjingu.platform.workflow.WorkflowCandidateResolver;
import cn.shangjingu.platform.workflow.WorkflowException;
import cn.shangjingu.platform.workflow.WorkflowTaskAssignmentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;

class Phase10SelfServiceWorkflowSuccessorDatabaseIT {
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-000000001251");
    private static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
            .withDatabaseName("postgres").withUsername("postgres").withPassword("cxr03-workflow-successor");
    private static final List<TargetNode> TARGETS = List.of(
            new TargetNode("P007", "S05"), new TargetNode("P007", "S06"),
            new TargetNode("P008", "S03"), new TargetNode("P008", "S07"), new TargetNode("P008", "S08"),
            new TargetNode("P009", "S04"));
    private static final List<TargetNode> SEPARATION = List.of(
            new TargetNode("P007", "S07"), new TargetNode("P009", "S03"),
            new TargetNode("P009", "S05"), new TargetNode("P009", "S06"));
    private static final Map<String, PublishedFingerprint> LEGACY = new LinkedHashMap<>();
    private static Path repoRoot;
    private static String omsUrl;
    private static int successorMigrations;
    private static int repeatedMigrations;
    private static UUID initiator;
    private static UUID approver;

    @BeforeAll
    static void migrateFromPublishedV125ToSuccessor() throws Exception {
        repoRoot = findRepoRoot();
        POSTGRES.start();
        migrateCluster();
        try (Connection connection = connection("postgres"); Statement statement = connection.createStatement()) {
            statement.execute("create database sjg_oms");
        }
        omsUrl = jdbcUrl("sjg_oms");
        Flyway baseline = omsFlyway("125");
        assertTrue(baseline.migrate().success);
        baseline.validate();
        for (String process : List.of("P007", "P008", "P009")) LEGACY.put(process, fingerprint(process));

        Flyway successor = omsFlyway("125.1");
        var first = successor.migrate();
        successorMigrations = first.migrationsExecuted;
        successor.validate();
        repeatedMigrations = successor.migrate().migrationsExecuted;
        seedEmployees();
    }

    @AfterAll
    static void stopDatabase() {
        POSTGRES.stop();
    }

    @Test
    void publishesOneDeterministicSuccessorPerProcessAndPreservesPublishedPredecessors() throws Exception {
        assertEquals(1, successorMigrations, "exactly V125_1 must execute after the V125 baseline");
        assertEquals(0, repeatedMigrations, "a repeated Flyway migrate must be a no-op");
        for (String process : List.of("P007", "P008", "P009")) {
            PublishedFingerprint old = LEGACY.get(process);
            PublishedFingerprint current = latestFingerprint(process);
            assertEquals(old.versionNo() + 1, current.versionNo(), process + " successor version number");
            assertNotEquals(old.versionId(), current.versionId(), process + " successor UUID must be new");
            assertTrue(current.definitionJson().contains("\"supersedesVersionId\": \"" + old.versionId() + "\"")
                            || current.definitionJson().contains("\"supersedesVersionId\":\"" + old.versionId() + "\""),
                    process + " successor provenance");
            assertEquals(old, fingerprintById(old.versionId()), process + " old published content must remain byte-stable");
            assertEquals(old.nodeCount(), current.nodeCount(), process + " must copy every node");
            assertEquals(old.transitionCount(), current.transitionCount(), process + " must copy every transition");
        }
        assertEquals(2, targetRuleCount("P007", List.of("S05", "S06")));
        assertEquals(3, targetRuleCount("P008", List.of("S03", "S07", "S08")));
        assertEquals(1, targetRuleCount("P009", List.of("S04")));
    }

    @Test
    void targetNodesAllowInitiatorThroughRealCandidateResolverAndJdbcClaim() throws Exception {
        AssignmentRuntime runtime = assignmentRuntime();
        assertAll(TARGETS.stream().map(target -> () -> {
            UUID task = seedTask(target, initiator, context());
            WorkflowTaskAssignmentService.ClaimResult claim = runtime.tx().execute(status -> runtime.service().claim(
                    new WorkflowTaskAssignmentService.ClaimCommand(TENANT, task, initiator)));
            assertNotNull(claim);
            assertEquals(initiator, claim.assigneeId(), target.toString());
            assertTrue(claim.eligibleCandidateIds().contains(initiator), target.toString());
            assertEquals(initiator, scalarUuid("select assignee_id from workflow.wf_task where id='" + task + "'"));
        }));
    }

    @Test
    void approvalReviewHrAndAcceptanceNodesStillExcludeInitiatorFailClosed() throws Exception {
        AssignmentRuntime runtime = assignmentRuntime();
        for (TargetNode target : SEPARATION) {
            UUID task = seedTask(target, initiator, context());
            WorkflowException failure = assertThrows(WorkflowException.class, () -> runtime.tx().execute(status ->
                    runtime.service().claim(new WorkflowTaskAssignmentService.ClaimCommand(TENANT, task, initiator))),
                    target.toString());
            assertTrue(failure.code() == WorkflowException.Code.NO_ELIGIBLE_APPROVER
                    || failure.code() == WorkflowException.Code.FORBIDDEN, target.toString());
            assertEquals(null, scalarNullableUuid("select assignee_id from workflow.wf_task where id='" + task + "'"));
        }
    }

    private static long targetRuleCount(String process, List<String> nodes) throws SQLException {
        String in = nodes.stream().map(value -> "'" + value + "'").reduce((a, b) -> a + "," + b).orElseThrow();
        return scalarLong("""
                select count(*) from workflow.wf_node n
                join workflow.wf_version v on v.id=n.version_id and v.tenant_id=n.tenant_id
                join workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id
                where n.tenant_id='%s' and d.process_code='%s' and v.status='PUBLISHED'
                  and v.version_no=(select max(v2.version_no) from workflow.wf_version v2 where v2.tenant_id=v.tenant_id and v2.definition_id=v.definition_id and v2.status='PUBLISHED' and not v2.is_deleted)
                  and n.node_code in (%s) and n.actor_rule->>'resolver'='CONTEXT_EMPLOYEE_IDS'
                  and n.actor_rule->>'field'='targetEmployeeIds' and n.actor_rule->>'allowInitiator'='true'
                  and not n.is_deleted and not v.is_deleted and not d.is_deleted
                """.formatted(TENANT, process, in));
    }

    private static PublishedFingerprint latestFingerprint(String process) throws SQLException {
        UUID id = scalarUuid("""
                select v.id from workflow.wf_version v join workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id
                where v.tenant_id='%s' and d.process_code='%s' and v.status='PUBLISHED' and not v.is_deleted and not d.is_deleted
                order by v.version_no desc,v.id limit 1
                """.formatted(TENANT, process));
        return fingerprintById(id);
    }

    private static PublishedFingerprint fingerprint(String process) throws SQLException {
        return latestFingerprint(process);
    }

    private static PublishedFingerprint fingerprintById(UUID versionId) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("""
                     select v.id,v.version_no,v.status,v.checksum,v.definition_json::text,
                       (select count(*) from workflow.wf_node n where n.tenant_id=v.tenant_id and n.version_id=v.id and not n.is_deleted),
                       (select md5(coalesce(string_agg(n.node_code||'|'||n.node_name||'|'||n.node_type||'|'||coalesce(n.actor_rule::text,'')||'|'||n.sort_no,';' order by n.node_code),'')) from workflow.wf_node n where n.tenant_id=v.tenant_id and n.version_id=v.id and not n.is_deleted),
                       (select count(*) from workflow.wf_transition t where t.tenant_id=v.tenant_id and t.version_id=v.id and not t.is_deleted),
                       (select md5(coalesce(string_agg(t.from_node_code||'|'||t.action_code||'|'||t.to_node_code||'|'||coalesce(t.condition_expr::text,'')||'|'||t.is_rollback,';' order by t.from_node_code,t.action_code,t.to_node_code),'')) from workflow.wf_transition t where t.tenant_id=v.tenant_id and t.version_id=v.id and not t.is_deleted)
                     from workflow.wf_version v where v.tenant_id='%s' and v.id='%s'
                     """.formatted(TENANT, versionId))) {
            assertTrue(result.next());
            return new PublishedFingerprint(result.getObject(1, UUID.class), result.getInt(2), result.getString(3),
                    result.getString(4), result.getString(5), result.getInt(6), result.getString(7),
                    result.getInt(8), result.getString(9));
        }
    }

    private static UUID seedTask(TargetNode target, UUID taskInitiator, String context) throws SQLException {
        UUID version = scalarUuid("""
                select v.id from workflow.wf_version v join workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id
                where v.tenant_id='%s' and d.process_code='%s' and v.status='PUBLISHED' and not v.is_deleted
                order by v.version_no desc limit 1
                """.formatted(TENANT, target.process()));
        UUID definition = scalarUuid("select definition_id from workflow.wf_version where id='" + version + "'");
        String rule = scalarString("select actor_rule::text from workflow.wf_node where tenant_id='" + TENANT
                + "' and version_id='" + version + "' and node_code='" + target.node() + "' and not is_deleted");
        UUID instance = UUID.randomUUID();
        UUID task = UUID.randomUUID();
        execute("insert into workflow.wf_instance(id,tenant_id,instance_no,definition_id,version_id,process_code,business_object_type,title,initiator_id,current_node_code,status,priority,context_snapshot) values ('"
                + instance + "','" + TENANT + "','WFI-CXR03-" + shortId() + "','" + definition + "','" + version + "','"
                + target.process() + "','CXR03_TEST','Self-service successor','" + taskInitiator + "','" + target.node()
                + "','RUNNING','NORMAL','" + context.replace("'", "''") + "'::jsonb)");
        execute("insert into workflow.wf_task(id,tenant_id,instance_id,task_no,node_code,task_type,candidate_rule,status,received_at) values ('"
                + task + "','" + TENANT + "','" + instance + "','WFT-CXR03-" + shortId() + "','" + target.node()
                + "','APPROVAL','" + rule.replace("'", "''") + "'::jsonb,'PENDING',now())");
        return task;
    }

    private static String context() {
        return "{\"targetEmployeeIds\":[\"" + initiator + "\"],\"managerCandidateIds\":[\"" + approver
                + "\"],\"reviewerCandidateIds\":[\"" + approver + "\"],\"hrCandidateIds\":[\"" + approver + "\"]}";
    }

    private static void seedEmployees() throws SQLException {
        initiator = UUID.randomUUID();
        approver = UUID.randomUUID();
        execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status) values ('" + initiator
                + "','" + TENANT + "','CXR03-INIT','CXR03 Initiator','ACTIVE'),('" + approver + "','" + TENANT
                + "','CXR03-APP','CXR03 Approver','ACTIVE')");
    }

    private static AssignmentRuntime assignmentRuntime() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(omsUrl, POSTGRES.getUsername(), POSTGRES.getPassword());
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        WorkflowTaskAssignmentService service = new WorkflowTaskAssignmentService(
                new JdbcWorkflowTaskAssignmentRepository(jdbc, new ObjectMapper()),
                new WorkflowCandidateResolver(new JdbcOrgDirectoryAdapter(jdbc)));
        return new AssignmentRuntime(service, new TransactionTemplate(new DataSourceTransactionManager(dataSource)));
    }

    private static void migrateCluster() {
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:" + repoRoot.resolve("technical-platform/database/flyway/cluster"))
                .cleanDisabled(true).load().migrate();
    }

    private static Flyway omsFlyway(String target) {
        var configuration = Flyway.configure().dataSource(omsUrl, POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("filesystem:" + repoRoot.resolve("technical-platform/database/flyway/oms"),
                        "filesystem:" + repoRoot.resolve("technical-platform/database/flyway-overlays/oms"))
                .placeholders(Map.of("sjg_tenant_id", TENANT.toString(), "sjg_tenant_code", "CXR03_WORKFLOW",
                        "sjg_tenant_name", "CXR-03 workflow successor"))
                .cleanDisabled(true);
        if (target != null) configuration.target(target);
        return configuration.load();
    }

    private static void execute(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static long scalarLong(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getLong(1);
        }
    }

    private static UUID scalarUuid(String sql) throws SQLException {
        UUID value = scalarNullableUuid(sql);
        assertNotNull(value);
        return value;
    }

    private static UUID scalarNullableUuid(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getObject(1, UUID.class);
        }
    }

    private static String scalarString(String sql) throws SQLException {
        try (Connection connection = connection("sjg_oms"); Statement statement = connection.createStatement(); ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }

    private static Connection connection(String database) throws SQLException {
        return DriverManager.getConnection(jdbcUrl(database), POSTGRES.getUsername(), POSTGRES.getPassword());
    }

    private static String jdbcUrl(String database) {
        String url = POSTGRES.getJdbcUrl();
        int query = url.indexOf('?');
        String suffix = query >= 0 ? url.substring(query) : "";
        String base = query >= 0 ? url.substring(0, query) : url;
        return base.substring(0, base.lastIndexOf('/') + 1) + database + suffix;
    }

    private static Path findRepoRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("mvnw")) && Files.isDirectory(current.resolve("Knowledge Base"))) return current;
            current = current.getParent();
        }
        throw new IllegalStateException("repository root not found");
    }

    private static String shortId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }

    private record TargetNode(String process, String node) {}
    private record AssignmentRuntime(WorkflowTaskAssignmentService service, TransactionTemplate tx) {}
    private record PublishedFingerprint(UUID versionId, int versionNo, String status, String checksum,
                                        String definitionJson, int nodeCount, String nodeDigest,
                                        int transitionCount, String transitionDigest) {}
}
