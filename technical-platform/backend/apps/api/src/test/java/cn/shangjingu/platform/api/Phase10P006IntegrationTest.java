package cn.shangjingu.platform.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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

@SpringBootTest(classes=ApiApplication.class)
@AutoConfigureMockMvc
class Phase10P006IntegrationTest {
    private static final UUID TENANT=uuid("00000000-0000-0000-0000-000000002006"),CENTER_A=uuid("10000000-0000-0000-0000-000000002006"),CENTER_B=uuid("10000000-0000-0000-0000-000000002007"),POS_A=uuid("20000000-0000-0000-0000-000000002006"),POS_B=uuid("20000000-0000-0000-0000-000000002007");
    private static final UUID OWNER=uuid("30000000-0000-0000-0000-000000002006"),MANAGER=uuid("30000000-0000-0000-0000-000000002007"),ACCEPTOR=uuid("30000000-0000-0000-0000-000000002008"),TECH=uuid("30000000-0000-0000-0000-000000002009"),OUT=uuid("30000000-0000-0000-0000-000000002010");
    private static final String PASSWORD="P006-Live-Test-8q!",API_PASSWORD="p006_api_"+shortId(),AUDIT_PASSWORD="p006_audit_"+shortId();
    private static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>("postgres:16.14-alpine3.24").withDatabaseName("postgres").withUsername("postgres").withPassword("bootstrap-"+shortId());
    private static final GenericContainer<?> REDIS=new GenericContainer<>(DockerImageName.parse("redis:7.4-alpine")).withExposedPorts(6379);
    static {POSTGRES.start();REDIS.start();try{prepare();}catch(Exception e){POSTGRES.stop();REDIS.stop();throw new ExceptionInInitializerError(e);}}
    @Autowired MockMvc mvc;@Autowired ObjectMapper mapper;
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r){
        r.add("spring.datasource.url",()->url("sjg_oms"));r.add("spring.datasource.username",()->"sjg_api_runtime");r.add("spring.datasource.password",()->API_PASSWORD);
        r.add("spring.data.redis.host",REDIS::getHost);r.add("spring.data.redis.port",()->REDIS.getMappedPort(6379));
        r.add("sjg.audit.datasource.url",()->url("sjg_audit"));r.add("sjg.audit.datasource.username",()->"sjg_audit_writer");r.add("sjg.audit.datasource.password",()->AUDIT_PASSWORD);
    }
    @AfterAll static void stop(){REDIS.stop();POSTGRES.stop();}

    @Test void realHttpLifecycleEnforcesThreePortalScopeIdempotencyReworkAndIndependentAcceptance() throws Exception {
        String owner=login("p006.owner"),manager=login("p006.manager"),acceptor=login("p006.acceptor"),tech=login("p006.tech"),out=login("p006.out");
        ObjectNode create=mapper.createObjectNode().put("businessDate",java.time.LocalDate.now().toString()).put("subject","P006 真实会议行动闭环")
                .put("reason","用于验证会议纪要和行动项真实闭环的登记原因").put("priority","普通").put("startAt",Instant.now().plus(2,ChronoUnit.DAYS).toString())
                .put("officialSubject","P006 集成测试正式会议").put("officialContent","讨论并确认可追溯的会议行动项、责任人、证据与独立验收。")
                .put("venueChannel","第一会议室").put("visibilityLevel","内部");
        mvc.perform(post("/api/v1/processes/P006/meetings").contentType(MediaType.APPLICATION_JSON).content(create.toString()).header("Idempotency-Key","unauth-create")).andExpect(status().isUnauthorized());
        ObjectNode invalid=create.deepCopy().put("subject","短");
        mvc.perform(post("/api/v1/processes/P006/meetings").header("Authorization",bearer(owner)).header("Idempotency-Key","invalid-create").contentType(MediaType.APPLICATION_JSON).content(invalid.toString())).andExpect(status().isConflict());
        MvcResult made=mvc.perform(post("/api/v1/processes/P006/meetings").header("Authorization",bearer(owner)).header("Idempotency-Key","p006-create-1").contentType(MediaType.APPLICATION_JSON).content(create.toString())).andExpect(status().isOk()).andReturn();
        JsonNode meeting=json(made);String id=meeting.path("id").asText();assertEquals("S01",meeting.path("currentNodeCode").asText());assertEquals(1,meeting.path("versionNo").asInt());
        MvcResult replay=mvc.perform(post("/api/v1/processes/P006/meetings").header("Authorization",bearer(owner)).header("Idempotency-Key","p006-create-1").contentType(MediaType.APPLICATION_JSON).content(create.toString())).andExpect(status().isOk()).andReturn();
        assertEquals(id,json(replay).path("id").asText());
        ObjectNode collision=create.deepCopy().put("officialContent","different idempotency payload");
        mvc.perform(post("/api/v1/processes/P006/meetings").header("Authorization",bearer(owner)).header("Idempotency-Key","p006-create-1").contentType(MediaType.APPLICATION_JSON).content(collision.toString())).andExpect(status().isConflict());

        assertEquals(0,json(mvc.perform(get("/api/v1/processes/P006/meetings").header("Authorization",bearer(out))).andExpect(status().isOk()).andReturn()).size());
        JsonNode techView=json(mvc.perform(get("/api/v1/processes/P006/meetings/"+id).header("Authorization",bearer(tech))).andExpect(status().isOk()).andReturn());
        assertTrue(techView.path("officialContent").isNull());assertTrue(techView.path("reason").isNull());

        meeting=act(owner,id,"SUBMIT",1,null,null,null,null,"submit-1","ok");
        mvc.perform(post("/api/v1/processes/P006/meetings/"+id+"/actions/ACCEPT").header("Authorization",bearer(manager)).header("Idempotency-Key","stale-accept").contentType(MediaType.APPLICATION_JSON).content(action(1,"stale",null,null,null).toString())).andExpect(status().isConflict());
        meeting=act(manager,id,"ACCEPT",2,"材料完整",null,null,null,"accept-material","ok");
        meeting=act(manager,id,"PUBLISH",3,"批准发布",null,null,null,"publish","ok");
        meeting=act(owner,id,"RECORD_ATTENDANCE",4,"签到和请假记录已核验",null,null,null,"attendance","ok");
        meeting=act(manager,id,"CONVENE",5,"会议按计划召开",null,null,null,"convene","ok");
        meeting=act(manager,id,"CONFIRM_MINUTES",6,"主持人确认", "纪要已由主持人确认并冻结",null,null,"minutes","ok");
        ObjectNode item=mapper.createObjectNode().put("itemKey","A01").put("itemName","完成会议行动闭环验证").put("ownerEmployeeId",OWNER.toString())
                .put("plannedStartAt",Instant.now().plus(1,ChronoUnit.DAYS).toString()).put("plannedFinishAt",Instant.now().plus(3,ChronoUnit.DAYS).toString()).put("acceptanceCriteria","数据库、接口和页面证据完整");
        meeting=act(manager,id,"GENERATE_ACTIONS",7,"依据已确认纪要生成",null,mapper.createArrayNode().add(item),null,"actions","ok");
        mvc.perform(post("/api/v1/processes/P006/meetings/"+id+"/actions/SUBMIT_EXECUTION").header("Authorization",bearer(manager)).header("Idempotency-Key","manager-execute").contentType(MediaType.APPLICATION_JSON).content(action(8,"越权执行",null,null,evidence("bad")).toString())).andExpect(status().isForbidden());
        meeting=act(owner,id,"SUBMIT_EXECUTION",8,"责任人执行",null,null,evidence("第一次执行证据"),"execute-1","ok");
        mvc.perform(post("/api/v1/processes/P006/meetings/"+id+"/actions/ACCEPT_RESULT").header("Authorization",bearer(owner)).header("Idempotency-Key","self-accept").contentType(MediaType.APPLICATION_JSON).content(action(9,"自验收",null,null,evidence("bad")).toString())).andExpect(status().isForbidden());
        meeting=act(acceptor,id,"REWORK",9,"证据不满足验收标准",null,null,evidence("缺少可复现输出"),"rework","ok");
        meeting=act(owner,id,"SUBMIT_EXECUTION",10,"完成受控返工",null,null,evidence("补充第二次执行证据"),"execute-2","ok");
        meeting=act(acceptor,id,"ACCEPT_RESULT",11,"独立验收通过",null,null,evidence("验收人复核通过"),"accept-result","ok");
        meeting=act(manager,id,"ACKNOWLEDGE_OVERDUE",12,"完成逾期事实核对",null,null,evidence("无逾期；核对时间已留痕"),"overdue","ok");
        meeting=act(manager,id,"ARCHIVE",13,"归档复盘完成","闭环完成，返工及验收证据齐全",null,evidence("归档清单已核对"),"archive","ok");
        assertEquals("END",meeting.path("currentNodeCode").asText());assertEquals("已归档",meeting.path("status").asText());

        JdbcTemplate jdbc=jdbc("sjg_oms",POSTGRES.getUsername(),POSTGRES.getPassword());
        assertEquals(2,jdbc.queryForObject("select count(*) from collaboration.meeting_item where tenant_id=? and master_id=? and field_code='execution_evidence'",Integer.class,TENANT,UUID.fromString(id)));
        assertEquals(1,jdbc.queryForObject("select count(*) from workflow.wf_action_log where tenant_id=? and instance_id=? and from_status='S09' and action_code='REWORK'",Integer.class,TENANT,UUID.fromString(meeting.path("workflowInstanceId").asText())));
        assertEquals(14,jdbc.queryForObject("select count(*) from core.outbox_event where tenant_id=? and aggregate_id=? and event_type='P006_MEETING_EVENT'",Integer.class,TENANT,UUID.fromString(id)));
        assertNotEquals(jdbc.queryForObject("select event_key from core.outbox_event where tenant_id=? and aggregate_id=? and event_key like '%s08:submit_execution' order by event_version limit 1",String.class,TENANT,UUID.fromString(id)),
                jdbc.queryForObject("select event_key from core.outbox_event where tenant_id=? and aggregate_id=? and event_key like '%s08:submit_execution' order by event_version desc limit 1",String.class,TENANT,UUID.fromString(id)));
        assertTrue(jdbc("sjg_audit",POSTGRES.getUsername(),POSTGRES.getPassword()).queryForObject("select count(*) from audit.operation_log where tenant_id=? and resource_id=? and action like 'P006_%'",Integer.class,TENANT,UUID.fromString(id))>=20);
    }

    private JsonNode act(String token,String id,String code,int version,String reason,String summary,JsonNode items,JsonNode evidence,String key,String ignored)throws Exception{
        return json(mvc.perform(post("/api/v1/processes/P006/meetings/"+id+"/actions/"+code).header("Authorization",bearer(token)).header("Idempotency-Key",key)
                .contentType(MediaType.APPLICATION_JSON).content(action(version,reason,summary,items,evidence).toString())).andExpect(status().isOk()).andReturn());}
    private ObjectNode action(int version,String reason,String summary,JsonNode items,JsonNode evidence){ObjectNode n=mapper.createObjectNode().put("expectedVersion",version);if(reason!=null)n.put("reason",reason);else n.putNull("reason");if(summary!=null)n.put("resultSummary",summary);else n.putNull("resultSummary");n.set("actionItems",items==null?mapper.createArrayNode():items);if(evidence==null)n.putNull("evidence");else n.set("evidence",evidence);return n;}
    private ObjectNode evidence(String note){return mapper.createObjectNode().put("note",note).put("recordedAt",Instant.now().toString());}
    private String login(String name)throws Exception{ObjectNode body=mapper.createObjectNode().put("tenantCode","PHASE10_P006").put("loginName",name).put("password",PASSWORD);return json(mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body.toString())).andExpect(status().isOk()).andReturn()).path("accessToken").asText();}
    private JsonNode json(MvcResult r)throws Exception{return mapper.readTree(r.getResponse().getContentAsByteArray());} private static String bearer(String token){return "Bearer "+token;}

    private static void prepare()throws Exception{Path root=root();Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).locations("filesystem:"+root.resolve("technical-platform/database/flyway/cluster")).cleanDisabled(true).load().migrate();
        try(Connection c=DriverManager.getConnection(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword());Statement s=c.createStatement()){s.execute("alter role sjg_api_runtime password '"+API_PASSWORD+"'");s.execute("alter role sjg_audit_writer password '"+AUDIT_PASSWORD+"'");s.execute("create database sjg_oms");s.execute("create database sjg_audit");}
        Flyway.configure().dataSource(url("sjg_oms"),POSTGRES.getUsername(),POSTGRES.getPassword()).locations("filesystem:"+root.resolve("technical-platform/database/flyway/oms"),"filesystem:"+root.resolve("technical-platform/database/flyway-overlays/oms")).placeholders(Map.of("sjg_tenant_id",TENANT.toString(),"sjg_tenant_code","PHASE10_P006","sjg_tenant_name","P006 Integration Tenant")).cleanDisabled(true).load().migrate();
        Flyway.configure().dataSource(url("sjg_audit"),POSTGRES.getUsername(),POSTGRES.getPassword()).locations("filesystem:"+root.resolve("technical-platform/database/flyway/audit"),"filesystem:"+root.resolve("technical-platform/database/flyway-overlays/audit")).cleanDisabled(true).load().migrate();seed();}
    private static void seed()throws Exception{String hash=new BCryptPasswordEncoder(12).encode(PASSWORD);try(Connection c=DriverManager.getConnection(url("sjg_oms"),POSTGRES.getUsername(),POSTGRES.getPassword());Statement s=c.createStatement()){
        s.execute("insert into org.organization(id,tenant_id,org_code,org_name,org_type,path,status) values ('"+CENTER_A+"','"+TENANT+"','P006_A','P006 Center A','CENTER','p006_a'::ltree,'ACTIVE'),('"+CENTER_B+"','"+TENANT+"','P006_B','P006 Center B','CENTER','p006_b'::ltree,'ACTIVE')");
        s.execute("insert into org.position(id,tenant_id,position_code,position_name,org_id,status) values ('"+POS_A+"','"+TENANT+"','P006_PA','P006 Position A','"+CENTER_A+"','ACTIVE'),('"+POS_B+"','"+TENANT+"','P006_PB','P006 Position B','"+CENTER_B+"','ACTIVE')");
        UUID[] employees={OWNER,MANAGER,ACCEPTOR,TECH,OUT};String[] names={"Owner","Manager","Acceptor","Tech","Out"};for(int i=0;i<employees.length;i++){UUID center=i==4?CENTER_B:CENTER_A,pos=i==4?POS_B:POS_A;String no="P006-E00"+(i+1);s.execute("insert into org.employee(id,tenant_id,employee_no,person_name,employment_status,hire_date,primary_org_id,primary_position_id) values ('"+employees[i]+"','"+TENANT+"','"+no+"','P006 "+names[i]+"','ACTIVE',current_date-30,'"+center+"','"+pos+"')");}
        s.execute("insert into iam.data_scope_rule(tenant_id,scope_code,scope_name,rule_expr,enabled) values ('"+TENANT+"','P006_SELF','P006 Self','{\"scope\":\"SELF\"}'::jsonb,true),('"+TENANT+"','P006_CENTER','P006 Center','{\"scope\":\"CENTER\"}'::jsonb,true)");
        s.execute("insert into iam.permission(id,tenant_id,permission_code,permission_name,resource_type,action_code,risk_level) values (gen_random_uuid(),'"+TENANT+"','platform.session.read','Session read','SESSION','READ','NORMAL'),(gen_random_uuid(),'"+TENANT+"','platform.session.logout','Session logout','SESSION','LOGOUT','NORMAL')");
        String[][] actors={{"owner","SELF","p006.meeting.create,p006.meeting.read,p006.meeting.action"},{"manager","CENTER","p006.meeting.read,p006.meeting.manage"},{"acceptor","CENTER","p006.meeting.read,p006.meeting.accept"},{"tech","CENTER","p006.meeting.monitor"},{"out","CENTER","p006.meeting.read"}};
        for(int i=0;i<actors.length;i++)seedActor(s,i,employees[i],actors[i][0],actors[i][1],actors[i][2],hash,i==4?CENTER_B:CENTER_A,i==4?POS_B:POS_A);
    }}
    private static void seedActor(Statement s,int i,UUID employee,String login,String scope,String permissions,String hash,UUID center,UUID pos)throws Exception{UUID user=derived(4,i),identity=derived(5,i),role=derived(6,i),appointment=derived(7,i);String roleCode="P006_"+login.toUpperCase();
        s.execute("insert into org.employee_position(id,tenant_id,employee_id,position_id,org_id,is_primary,effective_start_date,status) values ('"+appointment+"','"+TENANT+"','"+employee+"','"+pos+"','"+center+"',true,current_date-30,'ACTIVE')");
        s.execute("insert into iam.user_account(id,tenant_id,login_name,password_hash,status,mfa_level) values ('"+user+"','"+TENANT+"','p006."+login+"','"+hash+"','ACTIVE',0)");
        s.execute("insert into iam.user_identity(id,tenant_id,user_id,employee_id,identity_type,identity_name,org_id,position_id,is_primary,effective_start_at) values ('"+identity+"','"+TENANT+"','"+user+"','"+employee+"','EMPLOYEE','P006 "+login+"','"+center+"','"+pos+"',true,now()-interval '1 day')");
        s.execute("insert into iam.role(id,tenant_id,role_code,role_name,role_type,data_scope_code,enabled) values ('"+role+"','"+TENANT+"','"+roleCode+"','"+roleCode+"','PLATFORM','P006_"+scope+"',true)");
        s.execute("insert into iam.role_permission(tenant_id,role_id,permission_id) select '"+TENANT+"','"+role+"',id from iam.permission where tenant_id='"+TENANT+"' and permission_code in ('platform.session.read','platform.session.logout','"+permissions.replace(",","','")+"') and not is_deleted");
        s.execute("insert into iam.user_role(tenant_id,user_id,identity_id,role_id,effective_start_at,grant_source) values ('"+TENANT+"','"+user+"','"+identity+"','"+role+"',now()-interval '1 day','TEST_ONLY')");}
    private static JdbcTemplate jdbc(String db,String user,String password){DriverManagerDataSource ds=new DriverManagerDataSource();ds.setDriverClassName("org.postgresql.Driver");ds.setUrl(url(db));ds.setUsername(user);ds.setPassword(password);return new JdbcTemplate(ds);}
    private static UUID derived(int group,int index){return uuid("%d0000000-0000-0000-0000-%012d".formatted(group,2006+index));} private static UUID uuid(String v){return UUID.fromString(v);}private static String shortId(){return UUID.randomUUID().toString().replace("-","").substring(0,16);}
    private static String url(String db){String u=POSTGRES.getJdbcUrl();int q=u.indexOf('?');String suffix=q<0?"":u.substring(q),base=q<0?u:u.substring(0,q);return base.substring(0,base.lastIndexOf('/')+1)+db+suffix;}
    private static Path root(){Path p=Path.of("").toAbsolutePath();while(p!=null){if(Files.exists(p.resolve("AGENT.md")))return p;p=p.getParent();}throw new IllegalStateException("root not found");}
}
