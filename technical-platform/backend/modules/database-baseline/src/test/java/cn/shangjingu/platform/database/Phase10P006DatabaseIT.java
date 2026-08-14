package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;

class Phase10P006DatabaseIT {
    private static final UUID TENANT=UUID.fromString("00000000-0000-0000-0000-000000001006");
    private static final UUID ACTOR=UUID.fromString("10000000-0000-0000-0000-000000001006");
    private static final UUID ORG=UUID.fromString("11000000-0000-0000-0000-000000001006");
    private static final UUID POSITION=UUID.fromString("12000000-0000-0000-0000-000000001006");
    private static final UUID MEETING=UUID.fromString("20000000-0000-0000-0000-000000001006");
    private static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>("postgres:16.14-alpine3.24")
            .withDatabaseName("postgres").withUsername("postgres").withPassword("phase10-p006-bootstrap");
    private static String omsUrl;

    @BeforeAll static void migrate() throws Exception {
        POSTGRES.start();Path root=root();
        Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword())
                .locations("filesystem:"+root.resolve("technical-platform/database/flyway/cluster")).cleanDisabled(true).load().migrate();
        try(Connection c=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());Statement s=c.createStatement()){
            s.execute("create database sjg_oms");
        }
        omsUrl="jdbc:postgresql://"+POSTGRES.getHost()+":"+POSTGRES.getMappedPort(5432)+"/sjg_oms";
        Flyway flyway=Flyway.configure().dataSource(omsUrl,POSTGRES.getUsername(),POSTGRES.getPassword())
                .locations("filesystem:"+root.resolve("technical-platform/database/flyway/oms"),"filesystem:"+root.resolve("technical-platform/database/flyway-overlays/oms"))
                .placeholders(Map.of("sjg_tenant_id",TENANT.toString(),"sjg_tenant_code","PHASE10_P006","sjg_tenant_name","P006 database test"))
                .cleanDisabled(true).load();assertTrue(flyway.migrate().success);flyway.validate();
        try(Connection c=connection();Statement s=c.createStatement()){
            s.execute("insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values ('"+ORG+"','"+TENANT+"','P006_CENTER','P006 Center','CENTER','p006_center'::ltree,'ACTIVE')");
            s.execute("insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values ('"+POSITION+"','"+TENANT+"','P006_POS','P006 Position','"+ORG+"','ACTIVE')");
            s.execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) values ('"+ACTOR+"','"+TENANT+"','P006-E001','P006 Actor','ACTIVE',current_date-30,'"+ORG+"','"+POSITION+"')");
        }
    }
    @AfterAll static void stop(){POSTGRES.stop();}

    @Test void migrationPublishesExactSourceWorkflowFormPermissionsAndSequence() throws Exception {
        try(Connection c=connection();Statement s=c.createStatement()){
            assertEquals(1L,scalar(s,"select count(*) from core.sequence_rule where tenant_id='"+TENANT+"' and rule_code='P006' and not is_deleted"));
            assertEquals(6L,scalar(s,"select count(*) from iam.permission where tenant_id='"+TENANT+"' and permission_code like 'p006.meeting.%' and not is_deleted"));
            assertEquals(12L,scalar(s,"select count(*) from workflow.wf_node n join workflow.wf_version v on v.id=n.version_id and v.tenant_id=n.tenant_id join workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id where d.process_code='P006' and v.status='PUBLISHED' and n.tenant_id='"+TENANT+"' and not n.is_deleted"));
            assertEquals(18L,scalar(s,"select count(*) from workflow.wf_transition t join workflow.wf_version v on v.id=t.version_id and v.tenant_id=t.tenant_id join workflow.wf_definition d on d.id=v.definition_id and d.tenant_id=v.tenant_id where d.process_code='P006' and v.status='PUBLISHED' and t.tenant_id='"+TENANT+"' and not t.is_deleted"));
            assertEquals(1L,scalar(s,"select count(*) from workflow.wf_form_definition where tenant_id='"+TENANT+"' and form_code='EMP-P006-F01' and field_schema#>>'{properties,visibility_level,enum,3}'='机密' and not is_deleted"));
        }
    }

    @Test void canonicalAggregateUsesOptimisticVersionAndAppendOnlyEvidence() throws Exception {
        try(Connection c=connection();Statement s=c.createStatement()){
            s.execute("""
                    insert into collaboration.meeting(id,tenant_id,business_no,status,version_no,created_by,updated_by,source_channel,
                    business_date,subject,reason,priority,owner_center_id,owner_employee_id,planned_start_at,official_subject,
                    official_content,official_type,start_at,visibility_level,attendance_type,employee_event_type)
                    values ('%s','%s','P006-DB-1','议题征集',0,'%s','%s','TEST',current_date,'真实会议议题','这是数据库集成测试登记原因','普通','%s','%s',now()+interval '1 day','正式会议标题','正式会议内容','MEETING',now()+interval '1 day','内部','MEETING','MEETING')
                    """.formatted(MEETING,TENANT,ACTOR,ACTOR,ORG,ACTOR));
            assertEquals(1,s.executeUpdate("update collaboration.meeting set status='材料完整性检查',version_no=version_no+1 where tenant_id='"+TENANT+"' and id='"+MEETING+"' and version_no=0"));
            assertEquals(0,s.executeUpdate("update collaboration.meeting set status='非法并发覆盖' where tenant_id='"+TENANT+"' and id='"+MEETING+"' and version_no=0"));
            s.execute("insert into collaboration.meeting_item(id,tenant_id,created_by,updated_by,master_id,field_code,item_seq,item_key,item_name,item_value_json) values (gen_random_uuid(),'"+TENANT+"','"+ACTOR+"','"+ACTOR+"','"+MEETING+"','execution_evidence',1,'E1','执行证据','{\"proof\":true}'::jsonb)");
        }
        SQLException update=assertThrows(SQLException.class,()->{try(Connection c=connection();Statement s=c.createStatement()){s.executeUpdate("update collaboration.meeting_item set item_name='tampered' where tenant_id='"+TENANT+"' and master_id='"+MEETING+"' and field_code='execution_evidence'");}});
        assertEquals("55000",update.getSQLState());
        SQLException delete=assertThrows(SQLException.class,()->{try(Connection c=connection();Statement s=c.createStatement()){s.executeUpdate("delete from collaboration.meeting_item where tenant_id='"+TENANT+"' and master_id='"+MEETING+"' and field_code='execution_evidence'");}});
        assertEquals("55000",delete.getSQLState());
    }

    private static long scalar(Statement s,String sql)throws SQLException{try(var rs=s.executeQuery(sql)){rs.next();return rs.getLong(1);}}
    private static Connection connection()throws SQLException{return DriverManager.getConnection(omsUrl,POSTGRES.getUsername(),POSTGRES.getPassword());}
    private static Path root(){Path p=Path.of("").toAbsolutePath();while(p!=null){if(Files.exists(p.resolve("mvnw")))return p;p=p.getParent();}throw new IllegalStateException("repository root not found");}
}
