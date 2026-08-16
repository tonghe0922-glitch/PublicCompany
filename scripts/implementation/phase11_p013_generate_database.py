from pathlib import Path
import re


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.strip() + "\n", encoding="utf-8")


write(
    "technical-platform/database/flyway-overlays/oms/V124__phase11_p013_reward.sql",
    r'''
-- PHASE-11 / P013: reward recognition with evidence uniqueness and exactly-once point effect.
SET ROLE sjg_owner;

ALTER TABLE reward.reward_case
  ADD COLUMN IF NOT EXISTS current_node_code varchar(16) DEFAULT 'S01' NOT NULL,
  ADD COLUMN IF NOT EXISTS source_fact_key varchar(160),
  ADD COLUMN IF NOT EXISTS content_version varchar(64),
  ADD COLUMN IF NOT EXISTS period_no varchar(32),
  ADD COLUMN IF NOT EXISTS evidence_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS recommendation_summary text,
  ADD COLUMN IF NOT EXISTS approval_decision text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_reference_id uuid,
  ADD COLUMN IF NOT EXISTS point_effect_id uuid,
  ADD COLUMN IF NOT EXISTS reward_executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS employee_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_reference varchar(128),
  ADD COLUMN IF NOT EXISTS receipts_recorded_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE reward.point_transaction
  ADD COLUMN IF NOT EXISTS current_node_code varchar(16) DEFAULT 'S01' NOT NULL,
  ADD COLUMN IF NOT EXISTS source_fact_key varchar(160),
  ADD COLUMN IF NOT EXISTS source_reward_case_id uuid,
  ADD COLUMN IF NOT EXISTS content_version varchar(64),
  ADD COLUMN IF NOT EXISTS period_no varchar(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p013_current_node'
      AND n.nspname='reward' AND t.relname='reward_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.reward_case
      ADD CONSTRAINT ck_p013_current_node CHECK (
        employee_event_type <> 'P013_REWARD'
        OR current_node_code IN ('S01','S02','S03','S04','S05','S06','S07','S08','S09','END'))
    $ddl$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='ck_p013_benefit_non_negative'
      AND n.nspname='reward' AND t.relname='reward_case'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.reward_case
      ADD CONSTRAINT ck_p013_benefit_non_negative CHECK (
        employee_event_type <> 'P013_REWARD'
        OR coalesce(benefit_amount,0) >= 0)
      NOT VALID
    $ddl$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE c.conname='fk_p013_point_reward_source'
      AND n.nspname='reward' AND t.relname='point_transaction'
  ) THEN
    EXECUTE $ddl$
      ALTER TABLE reward.point_transaction
      ADD CONSTRAINT fk_p013_point_reward_source
      FOREIGN KEY (source_reward_case_id) REFERENCES reward.reward_case(id)
      NOT VALID
    $ddl$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_p013_business_no
  ON reward.reward_case(tenant_id,business_no) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS uq_p013_source_fact
  ON reward.reward_case(tenant_id,source_fact_key)
  WHERE employee_event_type='P013_REWARD' AND source_fact_key IS NOT NULL AND NOT is_deleted;
CREATE INDEX IF NOT EXISTS ix_p013_reward_recipient
  ON reward.reward_case(tenant_id,owner_employee_id,created_at DESC)
  WHERE employee_event_type='P013_REWARD' AND NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS uq_p013_point_effect
  ON reward.point_transaction(tenant_id,source_reward_case_id)
  WHERE source_reward_case_id IS NOT NULL AND NOT is_deleted;

ALTER TABLE reward.reward_case ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward.point_transaction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_tenant_reward_case ON reward.reward_case;
CREATE POLICY p_tenant_reward_case ON reward.reward_case
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);
DROP POLICY IF EXISTS p_tenant_point_transaction ON reward.point_transaction;
CREATE POLICY p_tenant_point_transaction ON reward.point_transaction
  USING (tenant_id=current_setting('app.tenant_id',true)::uuid)
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true)::uuid);

INSERT INTO core.sequence_rule(
  id,tenant_id,rule_code,prefix_template,date_pattern,current_value,step,
  created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,'P013','P013-','yyyyMMdd',0,1,now(),now(),false
WHERE NOT EXISTS (
  SELECT 1 FROM core.sequence_rule
  WHERE tenant_id='${sjg_tenant_id}'::uuid AND rule_code='P013' AND NOT is_deleted);

INSERT INTO iam.permission(
  id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level,
  created_at,updated_at,is_deleted)
SELECT gen_random_uuid(),'${sjg_tenant_id}'::uuid,v.code,v.name,'PROCESS',v.action,v.risk,now(),now(),false
FROM (VALUES
  ('p013.reward.create','P013奖励事实登记','CREATE','NORMAL'),
  ('p013.reward.read','P013奖励读取','READ','NORMAL'),
  ('p013.reward.review','P013奖励证据复核与审批','REVIEW','HIGH'),
  ('p013.reward.execute','P013奖励执行与回执','EXECUTE','CRITICAL'),
  ('p013.reward.monitor','P013奖励流程监控','MONITOR','NORMAL')
) AS v(code,name,action,risk)
WHERE NOT EXISTS (
  SELECT 1 FROM iam.permission p
  WHERE p.tenant_id='${sjg_tenant_id}'::uuid
    AND p.permission_code=v.code AND NOT p.is_deleted);

DO $$
DECLARE
  target_definition_id uuid;
  target_version_id uuid;
BEGIN
  SELECT id INTO target_definition_id
  FROM workflow.wf_definition
  WHERE tenant_id='${sjg_tenant_id}'::uuid
    AND process_code='P013' AND enabled AND NOT is_deleted
  ORDER BY created_at,id LIMIT 1;

  IF target_definition_id IS NULL THEN
    target_definition_id:=gen_random_uuid();
    INSERT INTO workflow.wf_definition(
      id,tenant_id,process_code,process_name,module_code,owner_schema,owner_table,
      enabled,created_at,updated_at,is_deleted)
    VALUES(
      target_definition_id,'${sjg_tenant_id}'::uuid,'P013','奖励与认可',
      '绩效成长福利','reward','reward_case',true,now(),now(),false);
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM workflow.wf_version
      WHERE tenant_id='${sjg_tenant_id}'::uuid AND definition_id=target_definition_id
        AND status='PUBLISHED' AND checksum='phase11-p013-c0-v1' AND NOT is_deleted) THEN
    target_version_id:=gen_random_uuid();
    INSERT INTO workflow.wf_version(
      id,tenant_id,definition_id,version_no,status,definition_json,checksum,
      created_at,updated_at,is_deleted)
    SELECT target_version_id,'${sjg_tenant_id}'::uuid,target_definition_id,
      coalesce(max(version_no),0)+1,'DRAFT',
      '{"processCode":"P013","source":"PHASE11_C0_CONTRACT","states":["S01","S02","S03","S04","S05","S06","S07","S08","S09","END"]}'::jsonb,
      'phase11-p013-c0-v1',now(),now(),false
    FROM workflow.wf_version
    WHERE tenant_id='${sjg_tenant_id}'::uuid AND definition_id=target_definition_id;

    INSERT INTO workflow.wf_node(
      id,tenant_id,version_id,node_code,node_name,node_type,actor_rule,sort_no,
      created_at,updated_at,is_deleted) VALUES
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S01','贡献事实登记','START',NULL,10,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S02','证据核验','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}'::jsonb,20,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S03','奖励建议','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}'::jsonb,30,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S04','奖励审批','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"specialistCandidateIds"}'::jsonb,40,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S05','重复影响校验','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"managerCandidateIds"}'::jsonb,50,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S06','奖励执行','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"specialistCandidateIds"}'::jsonb,60,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S07','员工告知','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"specialistCandidateIds"}'::jsonb,70,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S08','回执登记','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"specialistCandidateIds"}'::jsonb,80,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S09','归档','TASK','{"resolver":"CONTEXT_EMPLOYEE_IDS","field":"specialistCandidateIds"}'::jsonb,90,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'END','已关闭','END',NULL,100,now(),now(),false);

    INSERT INTO workflow.wf_transition(
      id,tenant_id,version_id,from_node_code,action_code,to_node_code,
      condition_expr,is_rollback,created_at,updated_at,is_deleted) VALUES
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S01','REGISTER_CONTRIBUTION','S02',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S02','VERIFY_EVIDENCE','S03',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S03','RECOMMEND_REWARD','S04',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S04','APPROVE_REWARD','S05',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S05','CHECK_DUPLICATE_IMPACT','S06',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S06','EXECUTE_REWARD','S07',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S07','NOTIFY_EMPLOYEE','S08',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S08','RECORD_RECEIPTS','S09',NULL,false,now(),now(),false),
      (gen_random_uuid(),'${sjg_tenant_id}'::uuid,target_version_id,'S09','ARCHIVE','END',NULL,false,now(),now(),false);

    UPDATE workflow.wf_version
    SET status='PUBLISHED',effective_at=now(),updated_at=now()
    WHERE tenant_id='${sjg_tenant_id}'::uuid AND id=target_version_id AND status='DRAFT';
  END IF;

  IF NOT EXISTS (
      SELECT 1 FROM workflow.wf_form_definition
      WHERE tenant_id='${sjg_tenant_id}'::uuid
        AND form_code='EMP-P013-F01' AND process_code='P013'
        AND node_code='S01' AND enabled AND NOT is_deleted) THEN
    INSERT INTO workflow.wf_form_definition(
      id,tenant_id,form_code,form_name,process_code,node_code,version_no,
      field_schema,layout_schema,validation_schema,visibility_matrix,edit_matrix,
      enabled,created_at,updated_at,is_deleted)
    VALUES(
      gen_random_uuid(),'${sjg_tenant_id}'::uuid,'EMP-P013-F01',
      '奖励与认可-贡献事实登记单','P013','S01',1,
      '{"type":"object","properties":{"process_code":{"type":"string","readOnly":true},"business_no":{"type":"string","readOnly":true},"subject":{"type":"string"},"reason":{"type":"string"},"owner_employee_id":{"type":"string"},"owner_center_id":{"type":"string"},"fact_summary":{"type":"string"},"period_no":{"type":"string"},"content_version":{"type":"string"}},"required":["subject","reason","owner_employee_id","owner_center_id","fact_summary","period_no","content_version"]}'::jsonb,
      '{"sections":["贡献事实","奖励影响","责任员工"]}'::jsonb,
      '{"serverAuthoritative":["business_no","workflow_instance_id","status","current_node_code","version_no","point_effect_id","finance_reference_id"]}'::jsonb,
      '{"employee":"SELF","center":"AUTHORIZED_SCOPE","tech":"METADATA_ONLY"}'::jsonb,
      '{"employee":["subject","reason","fact_summary"],"center":["subject","reason","fact_summary","period_no","content_version"],"tech":[]}'::jsonb,
      true,now(),now(),false);
  END IF;
END $$;

RESET ROLE;
''',
)

write(
    "technical-platform/backend/modules/database-baseline/src/test/java/cn/shangjingu/platform/database/Phase11P013DatabaseIT.java",
    r'''
package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

class Phase11P013DatabaseIT {
    private static final String POSTGRES_IMAGE = "postgres:16.14-alpine3.24";
    private static final UUID TENANT = UUID.fromString("00000000-0000-0000-0000-000000001113");
    private static final UUID CENTER = UUID.fromString("01000000-0000-0000-0000-000000001113");
    private static final UUID EMPLOYEE = UUID.fromString("02000000-0000-0000-0000-000000001113");
    private static final UUID POSITION = UUID.fromString("03000000-0000-0000-0000-000000001113");
    private static final UUID REWARD = UUID.fromString("10000000-0000-0000-0000-000000001113");

    private static PostgreSQLContainer<?> postgres;
    private static Path repoRoot;

    @BeforeAll
    static void installProductionSchema() throws Exception {
        repoRoot = findRepoRoot();
        postgres = new PostgreSQLContainer<>(POSTGRES_IMAGE)
                .withDatabaseName("postgres")
                .withUsername("postgres")
                .withPassword("phase11-p013-" + UUID.randomUUID());
        postgres.start();
        migrate("postgres", "cluster", null);
        try (Connection connection = admin("postgres");
                Statement statement = connection.createStatement()) {
            statement.execute("create database sjg_oms");
        }
        migrate("sjg_oms", "oms", "oms");
        seedFacts();
    }

    @AfterAll
    static void stopPostgres() {
        if (postgres != null) {
            postgres.stop();
        }
    }

    @Test
    void p013PublishedGraphMatchesFrozenContract() throws Exception {
        assertEquals(
                "S01,S02,S03,S04,S05,S06,S07,S08,S09,END",
                scalarString("""
                        select string_agg(n.node_code,',' order by n.sort_no)
                        from workflow.wf_node n
                        join workflow.wf_version v on v.tenant_id=n.tenant_id and v.id=n.version_id
                        join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id
                        where d.tenant_id='%s' and d.process_code='P013'
                          and v.status='PUBLISHED' and v.checksum='phase11-p013-c0-v1'
                          and not n.is_deleted and not v.is_deleted and not d.is_deleted
                        """.formatted(TENANT)));
        assertEquals(9L, scalarLong("""
                select count(*) from workflow.wf_transition t
                join workflow.wf_version v on v.tenant_id=t.tenant_id and v.id=t.version_id
                join workflow.wf_definition d on d.tenant_id=v.tenant_id and d.id=v.definition_id
                where d.tenant_id='%s' and d.process_code='P013'
                  and v.status='PUBLISHED' and v.checksum='phase11-p013-c0-v1'
                  and not t.is_deleted and not v.is_deleted and not d.is_deleted
                """.formatted(TENANT)));
    }

    @Test
    void oneSourceFactCreatesAtMostOneReward() {
        SQLException duplicate = assertSqlRejected("""
                insert into reward.reward_case(
                  id,tenant_id,business_no,status,current_node_code,subject,reason,
                  owner_center_id,owner_employee_id,benefit_amount,employee_event_type,
                  fact_occurred_at,fact_summary,impact_level,source_fact_key)
                values(gen_random_uuid(),'%s','P013-DUP','贡献事实登记','S01','duplicate','duplicate',
                  '%s','%s',0,'P013_REWARD',now(),'duplicate','CENTER','P013-SOURCE-1')
                """.formatted(TENANT, CENTER, EMPLOYEE));
        assertTrue(message(duplicate).contains("uq_p013_source_fact"));
    }

    @Test
    void rewardPointEffectIsExactlyOnce() throws Exception {
        execute(pointEffectInsert("P013-EFFECT-1"));
        SQLException duplicate = assertSqlRejected(pointEffectInsert("P013-EFFECT-2"));
        assertTrue(message(duplicate).contains("uq_p013_point_effect"));
        assertEquals(1L, scalarLong("""
                select count(*) from reward.point_transaction
                where tenant_id='%s' and source_reward_case_id='%s' and not is_deleted
                """.formatted(TENANT, REWARD)));
    }

    @Test
    void p013ConstraintsAndRlsFailClosed() throws Exception {
        SQLException node = assertSqlRejected(
                "update reward.reward_case set current_node_code='S99' where id='" + REWARD + "'");
        assertTrue(message(node).contains("ck_p013_current_node"));
        assertEquals(1L, scalarLong(
                "select count(*) from flyway_schema_history where success and version='124'"));
        assertTrue(scalarBoolean("""
                select exists(select 1 from pg_policies
                where schemaname='reward' and tablename='reward_case'
                  and policyname='p_tenant_reward_case')
                """));
        assertTrue(scalarBoolean("""
                select exists(select 1 from pg_indexes
                where schemaname='reward' and tablename='point_transaction'
                  and indexname='uq_p013_point_effect')
                """));
    }

    private static String pointEffectInsert(String businessNo) {
        return """
                insert into reward.point_transaction(
                  id,tenant_id,business_no,status,current_node_code,version_no,
                  source_channel,business_date,subject,reason,priority,risk_level,
                  owner_center_id,owner_employee_id,result_summary,closed_at,
                  actual_amount,benefit_amount,change_action,change_reason,
                  cost_center_id,currency,employee_event_type,fact_occurred_at,
                  fact_summary,impact_level,points_delta,source_fact_key,source_reward_case_id)
                values(gen_random_uuid(),'%s','%s','已入账','END',0,
                  'PHASE11_EFFECT',date '2026-08-16','reward effect','reward','NORMAL','NORMAL',
                  '%s','%s','effect',now(),0,0,'REWARD_POST','reward',
                  'NON_FINANCIAL','POINT','P013_REWARD_EFFECT',now(),
                  'reward fact','CENTER',10,'%s','%s')
                """.formatted(TENANT, businessNo, CENTER, EMPLOYEE, businessNo, REWARD);
    }

    private static void seedFacts() throws SQLException {
        execute("""
                insert into org.organization(id,tenant_id,org_code,org_name,org_type,status)
                values('%s','%s','PHASE11-P013-CENTER','PHASE-11 P013 Center','CENTER','ACTIVE')
                """.formatted(CENTER, TENANT));
        execute("""
                insert into org.position(id,tenant_id,position_code,position_name,org_id,status)
                values('%s','%s','P013-POS','P013 Position','%s','ACTIVE')
                """.formatted(POSITION, TENANT, CENTER));
        execute("""
                insert into org.employee(
                  id,tenant_id,employee_no,person_name,employment_status,hire_date,
                  primary_org_id,primary_position_id)
                values('%s','%s','P013-EMPLOYEE','P013 Employee','ACTIVE',
                  date '2026-01-01','%s','%s')
                """.formatted(EMPLOYEE, TENANT, CENTER, POSITION));
        execute("""
                insert into reward.reward_case(
                  id,tenant_id,business_no,status,current_node_code,version_no,
                  business_date,subject,reason,priority,risk_level,owner_center_id,
                  owner_employee_id,benefit_amount,employee_event_type,fact_occurred_at,
                  fact_summary,impact_level,points_delta,source_fact_key,content_version,period_no)
                values('%s','%s','P013-DB-TEST','奖励执行','S06',5,date '2026-08-16',
                  'P013 reward test','reward','NORMAL','NORMAL','%s','%s',0,
                  'P013_REWARD',timestamptz '2026-08-16 00:00:00+00',
                  'reward fact','CENTER',10,'P013-SOURCE-1','P013-CONTENT-V1','2026-Q3')
                """.formatted(REWARD, TENANT, CENTER, EMPLOYEE));
    }

    private static SQLException assertSqlRejected(String sql) {
        return assertThrows(SQLException.class, () -> {
            try (Connection connection = admin("sjg_oms");
                    Statement statement = connection.createStatement()) {
                statement.execute(sql);
            }
        });
    }

    private static String message(SQLException error) {
        StringBuilder result = new StringBuilder();
        for (SQLException current = error; current != null; current = current.getNextException()) {
            if (current.getMessage() != null) {
                result.append(current.getMessage()).append(' ');
            }
        }
        return result.toString();
    }

    private static String scalarString(String sql) throws SQLException {
        try (Connection connection = admin("sjg_oms");
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getString(1);
        }
    }

    private static long scalarLong(String sql) throws SQLException {
        try (Connection connection = admin("sjg_oms");
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getLong(1);
        }
    }

    private static boolean scalarBoolean(String sql) throws SQLException {
        try (Connection connection = admin("sjg_oms");
                Statement statement = connection.createStatement();
                ResultSet result = statement.executeQuery(sql)) {
            assertTrue(result.next());
            return result.getBoolean(1);
        }
    }

    private static void execute(String sql) throws SQLException {
        try (Connection connection = admin("sjg_oms");
                Statement statement = connection.createStatement()) {
            assertFalse(statement.execute(sql));
        }
    }

    private static void migrate(String database, String generatedFolder, String overlayFolder) {
        List<String> locations = new ArrayList<>();
        locations.add("filesystem:" + repoRoot
                .resolve("technical-platform/database/flyway")
                .resolve(generatedFolder));
        if (overlayFolder != null) {
            locations.add("filesystem:" + repoRoot
                    .resolve("technical-platform/database/flyway-overlays")
                    .resolve(overlayFolder));
        }
        Flyway flyway = Flyway.configure()
                .dataSource(jdbcUrl(database), postgres.getUsername(), postgres.getPassword())
                .locations(locations.toArray(String[]::new))
                .placeholders(Map.of(
                        "sjg_tenant_id", TENANT.toString(),
                        "sjg_tenant_code", "PHASE11_P013_GATE",
                        "sjg_tenant_name", "PHASE-11 P013 Gate Tenant"))
                .cleanDisabled(true)
                .load();
        assertTrue(flyway.migrate().success);
        flyway.validate();
    }

    private static Connection admin(String database) throws SQLException {
        return DriverManager.getConnection(
                jdbcUrl(database), postgres.getUsername(), postgres.getPassword());
    }

    private static String jdbcUrl(String database) {
        String url = postgres.getJdbcUrl();
        int query = url.indexOf('?');
        String suffix = query >= 0 ? url.substring(query) : "";
        String base = query >= 0 ? url.substring(0, query) : url;
        return base.substring(0, base.lastIndexOf('/') + 1) + database + suffix;
    }

    private static Path findRepoRoot() {
        Path current = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        while (current != null) {
            if (Files.isRegularFile(current.resolve("AGENT.md"))
                    && Files.isDirectory(current.resolve("Knowledge Base"))
                    && Files.isRegularFile(current.resolve("pom.xml"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("repository root not found");
    }
}
''',
)

pom_path = Path("technical-platform/backend/modules/database-baseline/pom.xml")
pom = pom_path.read_text(encoding="utf-8")
if "Phase11P013DatabaseIT.java" not in pom:
    pom = pom.replace(
        "<exclude>**/Phase11P011DatabaseIT.java</exclude><exclude>**/Phase11P012DatabaseIT.java</exclude>",
        "<exclude>**/Phase11P011DatabaseIT.java</exclude><exclude>**/Phase11P012DatabaseIT.java</exclude><exclude>**/Phase11P013DatabaseIT.java</exclude>",
    )
if "<id>phase11-p013-integration</id>" not in pom:
    profile = """    <profile><id>phase11-p013-integration</id><build><plugins><plugin><groupId>org.apache.maven.plugins</groupId><artifactId>maven-failsafe-plugin</artifactId><version>${maven-surefire-plugin.version}</version><configuration><includes><include>**/Phase11P013DatabaseIT.java</include></includes></configuration><executions><execution><goals><goal>integration-test</goal><goal>verify</goal></goals></execution></executions></plugin></plugins></build></profile>\n"""
    pom = pom.replace("  </profiles>", profile + "  </profiles>")
pom_path.write_text(pom, encoding="utf-8")

write(
    "scripts/implementation/phase11_p013_contract.py",
    r'''
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        raise SystemExit(f"missing required P013 file: {path}")
    return target.read_text(encoding="utf-8")


workflow_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_WORKFLOW_CONTRACT.json"))
http_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_HTTP_PERMISSION_CONTRACT.json"))
page_contract = json.loads(read("docs/implementation/phases/PHASE-11/PHASE11_PAGE_BINDINGS.json"))

expected_actions = [
    "REGISTER_CONTRIBUTION",
    "VERIFY_EVIDENCE",
    "RECOMMEND_REWARD",
    "APPROVE_REWARD",
    "CHECK_DUPLICATE_IMPACT",
    "EXECUTE_REWARD",
    "NOTIFY_EMPLOYEE",
    "RECORD_RECEIPTS",
    "ARCHIVE",
]
contract_text = json.dumps(workflow_contract, ensure_ascii=False)
for action in expected_actions:
    if action not in contract_text:
        raise SystemExit(f"P013 frozen action missing from workflow contract: {action}")

required = {
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/RewardService.java": [
        "TransactionalOutboxService", "IdempotencyRegistry", "paidFinanceReference", "createPointEffect"
    ],
    "technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/RewardRepository.java": [
        "reward.reward_case", "reward.point_transaction", "source_reward_case_id", "finance.budget_request"
    ],
    "technical-platform/backend/apps/api/src/main/java/cn/shangjingu/platform/api/phase11/P013RewardController.java": [
        "/api/v1/processes/P013/rewards", "p013.reward.create", "p013.reward.monitor"
    ],
    "technical-platform/database/flyway-overlays/oms/V124__phase11_p013_reward.sql": [
        "phase11-p013-c0-v1", "uq_p013_source_fact", "uq_p013_point_effect", "p013.reward.execute"
    ],
    "technical-platform/web/src/router/portal-route-specs.ts": [
        "/employee/08/07/02", "/center/10/10/02", "/tech/06/06/01"
    ],
}
for path, tokens in required.items():
    text = read(path)
    for token in tokens:
        if token not in text:
            raise SystemExit(f"P013 contract token missing: {path}: {token}")

migration = read("technical-platform/database/flyway-overlays/oms/V124__phase11_p013_reward.sql")
if re.search(r"(?i)CREATE\s+TABLE", migration):
    raise SystemExit("P013 shadow business table is forbidden")
if "targetStatus" in read("technical-platform/web/src/platform/phase11/p013/p013-config.ts"):
    raise SystemExit("client target status is forbidden")
if "P014" in read("technical-platform/backend/modules/workflow/src/main/java/cn/shangjingu/platform/workflow/phase11/Phase11Process.java"):
    raise SystemExit("P014 executable process was introduced before P013 closure")

http_text = json.dumps(http_contract, ensure_ascii=False)
for permission in (
    "p013.reward.create", "p013.reward.read", "p013.reward.review",
    "p013.reward.execute", "p013.reward.monitor",
):
    if permission not in http_text:
        raise SystemExit(f"P013 permission is not frozen: {permission}")
page_text = json.dumps(page_contract, ensure_ascii=False)
for route in ("/employee/08/07/02", "/center/10/10/02", "/tech/06/06/01"):
    if route not in page_text:
        raise SystemExit(f"P013 page route is not frozen: {route}")

print("PHASE11_P013_CONTRACT_OK")
''',
)

write(
    ".github/workflows/phase11-p013-checkpoint.yml",
    r'''
name: PHASE-11 P013 Checkpoint

on:
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: phase11-p013-${{ github.ref }}
  cancel-in-progress: false

env:
  PHASE11_C0_SHA: 5c4b3d75fe3afab86f3b83f5fdf5a2f70870f724

jobs:
  contract:
    name: P013 C0 scope and repository contract
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: {fetch-depth: 0}
      - uses: actions/setup-python@v5
        with: {python-version: "3.12"}
      - name: Verify ordered frozen contracts
        shell: bash
        run: |
          set -euo pipefail
          test "$GITHUB_REPOSITORY" = "tonghe0922-glitch/PublicCompany"
          test "$GITHUB_REF_NAME" = "agent/phase-11-performance-growth-welfare"
          python scripts/implementation/phase11_repository_identity.py
          python scripts/implementation/phase11_c0_contract.py
          python scripts/implementation/phase11_p011_contract.py
          python scripts/implementation/phase11_p012_contract.py
          python scripts/implementation/phase11_p013_contract.py
          git diff --check "$PHASE11_C0_SHA"...HEAD
      - name: Reject later process drift mock truth and secrets
        shell: bash
        run: |
          set -euo pipefail
          TARGETS=(technical-platform/backend technical-platform/web/src technical-platform/web/e2e technical-platform/database)
          ADDED=$(git diff -U0 "$PHASE11_C0_SHA"...HEAD -- "${TARGETS[@]}" | grep '^+' | grep -v '^+++' || true)
          if printf '%s\n' "$ADDED" | grep -Eq '\bP0(14|15|16|17|18|19|20)\b|\bPHASE-12\b'; then
            echo 'P013 checkpoint introduced a later executable process'
            exit 1
          fi
          if printf '%s\n' "$ADDED" | grep -Ei 'CREATE TABLE[^;]*(phase[_-]?11|p013|reward_request)'; then
            echo 'P013 shadow business table is forbidden'
            exit 1
          fi
          if grep -R -nEi 'TODO|FIXME|@ts-ignore|@ts-nocheck|localStorage.*P013|mock.*P013|bypass login' "${TARGETS[@]}"; then
            exit 1
          fi
          if grep -R -nE 'github_pat_[A-Za-z0-9_]+|gh[pousr]_[A-Za-z0-9_]+|\bsk-[A-Za-z0-9_-]{12,}\b' "${TARGETS[@]}"; then
            exit 1
          fi

  backend-unit:
    name: Java 21 P013 behavior
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "21"
          cache: maven
      - run: bash ./mvnw -B -ntp -pl technical-platform/backend/apps/api -am test
      - name: Require P013 tests explicitly
        run: >-
          bash ./mvnw -B -ntp
          -pl technical-platform/backend/apps/api -am
          -Dtest=RewardServiceTest,P013RewardControllerContractTest
          -Dsurefire.failIfNoSpecifiedTests=false test

  api-security-regression:
    name: PHASE-04 API security regression
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "21"
          cache: maven
      - name: Run PostgreSQL 16 API integration regression
        shell: bash
        run: |
          set -o pipefail
          if ! bash ./mvnw -B -ntp -e -pl technical-platform/backend/apps/api -am -Pphase04-integration verify 2>&1 | tee /tmp/phase11-p013-api.log; then
            find . -type f \( -path '*/surefire-reports/*' -o -path '*/failsafe-reports/*' \) -print | sort | while read -r report; do
              echo "===== $report ====="
              tail -n 220 "$report" || true
            done
            grep -nEi 'BUILD FAILURE|ERROR|Caused by:|Flyway|Migration|PSQLException|SQLException|AssertionFailedError' /tmp/phase11-p013-api.log | tail -n 320 || true
            exit 1
          fi

  database:
    name: PostgreSQL 16 P013 reward facts and exactly once impact
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v5
        with:
          distribution: temurin
          java-version: "21"
          cache: maven
      - name: Run P013 database integration profile
        shell: bash
        run: |
          set -o pipefail
          if ! bash ./mvnw -B -ntp -e -pl technical-platform/backend/modules/database-baseline -am -Pphase11-p013-integration verify 2>&1 | tee /tmp/phase11-p013-db.log; then
            find . -type f \( -path '*/surefire-reports/*' -o -path '*/failsafe-reports/*' \) -print | sort | while read -r report; do
              echo "===== $report ====="
              tail -n 260 "$report" || true
            done
            grep -nEi 'BUILD FAILURE|ERROR|Caused by:|Flyway|Migration|PSQLException|SQLException|AssertionFailedError|SQLSTATE' /tmp/phase11-p013-db.log | tail -n 380 || true
            exit 1
          fi

  web:
    name: P013 Vue TypeScript lint unit quality and three builds
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: technical-platform/web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: {version: 10.34.0}
      - uses: actions/setup-node@v4
        with:
          node-version: "22.20.0"
          cache: pnpm
          cache-dependency-path: technical-platform/web/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm quality:duplicates
      - run: pnpm quality:deadcode
      - run: pnpm build

  verdict:
    name: P013 checkpoint verdict
    if: always()
    needs: [contract, backend-unit, api-security-regression, database, web]
    runs-on: ubuntu-latest
    steps:
      - name: Require every P013 checkpoint job green
        shell: bash
        run: |
          set -euo pipefail
          test "${{ needs.contract.result }}" = success
          test "${{ needs.backend-unit.result }}" = success
          test "${{ needs.api-security-regression.result }}" = success
          test "${{ needs.database.result }}" = success
          test "${{ needs.web.result }}" = success

  close:
    name: Seal P013 checkpoint evidence
    needs: [verdict]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          ref: agent/phase-11-performance-growth-welfare
      - name: Record immutable checkpoint evidence
        shell: bash
        run: |
          set -euo pipefail
          test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
          python - <<'PY'
          from pathlib import Path
          import os
          progress = Path('docs/implementation/MASTER_PROGRESS.md')
          text = progress.read_text(encoding='utf-8')
          run = os.environ['GITHUB_RUN_ID']
          sha = os.environ['GITHUB_SHA']
          text = text.replace(
              'Current construction state: `PHASE-11 = IN_PROGRESS / P013_CHECKPOINT_CANDIDATE`',
              'Current construction state: `PHASE-11 = IN_PROGRESS / P014_READY`')
          text = text.replace(
              'Current legal checkpoint: `P013 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE`',
              'Current legal checkpoint: `P014 = NOT_STARTED / READY`')
          text = text.replace(
              '| PHASE-11 | IN_PROGRESS | P011–P016；P011、P012 已关闭；`P013_CHECKPOINT_CANDIDATE` |',
              '| PHASE-11 | IN_PROGRESS | P011–P016；P011–P013 已关闭；`P014_READY` |')
          text = text.replace(
              'P013 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE',
              f'P013 = CHECKPOINT_PASS / CLOSED / run {run}')
          text = text.replace(
              'P014 = NOT_STARTED_CHECKPOINT',
              'P014 = NOT_STARTED_CHECKPOINT / READY')
          text = text.replace(
              'P013 implementation = CANDIDATE / CHECKPOINT_GATE_PENDING',
              f'P013 implementation = CHECKPOINT_PASS / CLOSED / run {run}')
          progress.write_text(text, encoding='utf-8')
          evidence = Path('docs/implementation/phases/PHASE-11/P013_CHECKPOINT_EVIDENCE.md')
          evidence.write_text(
              '# P013 Checkpoint Evidence\n\n'
              f'- Workflow run: `{run}`\n'
              f'- Validated implementation SHA: `{sha}`\n'
              '- Contract: PASS\n'
              '- Java/API behavior: PASS\n'
              '- PHASE-04 security regression: PASS\n'
              '- PostgreSQL 16 integration: PASS\n'
              '- Vue/TypeScript/lint/unit/quality/build: PASS\n'
              '- Verdict: `CHECKPOINT_PASS / CLOSED`\n',
              encoding='utf-8')
          PY
          git config user.name phase11-checkpoint
          git config user.email actions@users.noreply.github.com
          git add docs/implementation/MASTER_PROGRESS.md docs/implementation/phases/PHASE-11/P013_CHECKPOINT_EVIDENCE.md
          git diff --cached --check
          git commit -m "phase-11: seal P013 reward checkpoint"
          git push origin HEAD:agent/phase-11-performance-growth-welfare
''',
)

progress_path = Path("docs/implementation/MASTER_PROGRESS.md")
progress = progress_path.read_text(encoding="utf-8")
progress = progress.replace(
    "Current construction state: `PHASE-11 = IN_PROGRESS / P012_CHECKPOINT_CANDIDATE`",
    "Current construction state: `PHASE-11 = IN_PROGRESS / P013_CHECKPOINT_CANDIDATE`",
)
progress = progress.replace(
    "Current legal checkpoint: `P012 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE`",
    "Current legal checkpoint: `P013 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE`",
)
progress = progress.replace(
    "P011 绩效管理已通过 Checkpoint Gate 并关闭；当前唯一合法施工点为 P012 晋升与任职发展，P013–P016 尚未施工，P017+ 保持锁定。",
    "P011 绩效管理与 P012 晋升任职已通过 Checkpoint Gate 并关闭；当前唯一合法施工点为 P013 奖励与认可，P014–P016 尚未施工，P017+ 保持锁定。",
)
progress = progress.replace(
    "| PHASE-11 | IN_PROGRESS | P011–P016；P011 已关闭；`P012_CHECKPOINT_CANDIDATE` |",
    "| PHASE-11 | IN_PROGRESS | P011–P016；P011、P012 已关闭；`P013_CHECKPOINT_CANDIDATE` |",
)
progress = progress.replace(
    "P012 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE",
    "P012 = CHECKPOINT_PASS / CLOSED / run 31924632658\nP013 = IN_PROGRESS / CHECKPOINT_GATE_PENDING / IMPLEMENTATION_CANDIDATE",
    1,
)
progress = progress.replace("P013 = NOT_STARTED_CHECKPOINT\n", "", 1)
progress = progress.replace(
    "P012 implementation = CANDIDATE / CHECKPOINT_GATE_PENDING",
    "P012 implementation = CHECKPOINT_PASS / CLOSED / run 31924632658\nP013 implementation = CANDIDATE / CHECKPOINT_GATE_PENDING",
)
progress_path.write_text(progress, encoding="utf-8")

p012 = Path(".github/workflows/phase11-p012-checkpoint.yml")
if p012.is_file():
    text = p012.read_text(encoding="utf-8")
    start = text.index("on:\n")
    permissions = text.index("\npermissions:", start)
    text = text[:start] + "on:\n  workflow_dispatch:\n" + text[permissions:]
    p012.write_text(text, encoding="utf-8")
