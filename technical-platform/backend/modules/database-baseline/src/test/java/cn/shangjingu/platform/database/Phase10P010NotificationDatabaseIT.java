package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.PlatformOutboxEvent;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.notification.NotificationService;
import cn.shangjingu.platform.notification.NotificationTemplateRenderer;
import cn.shangjingu.platform.worker.Phase10P010NotificationHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
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
import org.testcontainers.containers.PostgreSQLContainer;

class Phase10P010NotificationDatabaseIT {
    private static final UUID TENANT=UUID.fromString("00000000-0000-0000-0000-000000002020"),RECIPIENT=UUID.fromString("30000000-0000-0000-0000-000000002020"),AGGREGATE=UUID.fromString("90000000-0000-0000-0000-000000002051"),EVENT=UUID.fromString("90000000-0000-0000-0000-000000002052");private static final String PRIVATE="P010-PRIVATE-EXAM-PRACTICAL-QUALIFICATION-MUST-NOT-LEAK",WORKER_PASSWORD="p10_p010_notify_"+UUID.randomUUID().toString().replace("-","").substring(0,10);private static PostgreSQLContainer<?> postgres;private static Path root;private static TenantTransactionRunner transactions;private static Phase10P010NotificationHandler handler;
    @BeforeAll static void install()throws Exception{root=findRoot();postgres=new PostgreSQLContainer<>("postgres:16.14-alpine3.24").withDatabaseName("postgres").withUsername("postgres").withPassword("phase10-p010-notify-"+UUID.randomUUID());postgres.start();migrate("postgres","cluster",null);try(Connection c=admin("postgres");Statement s=c.createStatement()){s.execute("alter role sjg_worker_runtime password '"+WORKER_PASSWORD+"'");s.execute("create database sjg_oms");}migrate("sjg_oms","oms","oms");DriverManagerDataSource ds=new DriverManagerDataSource();ds.setDriverClassName("org.postgresql.Driver");ds.setUrl(url("sjg_oms"));ds.setUsername("sjg_worker_runtime");ds.setPassword(WORKER_PASSWORD);JdbcTemplate jdbc=new JdbcTemplate(ds);transactions=new TenantTransactionRunner(jdbc,new DataSourceTransactionManager(ds));ObjectMapper mapper=new ObjectMapper();handler=new Phase10P010NotificationHandler(new NotificationService(jdbc,new TransactionalOutboxService(jdbc),new NotificationTemplateRenderer(mapper)),jdbc,mapper);}
    @AfterAll static void stop(){if(postgres!=null)postgres.stop();}
    @Test void eventCreatesOneSanitizedNotificationAcrossExactReplay()throws Exception{PlatformOutboxEvent e=event(EVENT,"{\"businessNo\":\"P010-NOTIFY-001\",\"event\":\"P010.stage.08.completed\",\"nodeCode\":\"S09\",\"recipientEmployeeIds\":[\""+RECIPIENT+"\",\""+RECIPIENT+"\"],\"score1000\":886,\"practicalEvidence\":\""+PRIVATE+"\"}");handle(e);handle(e);assertEquals(1,scalar("select count(*) from notification.message where tenant_id='"+TENANT+"' and recipient_id='"+RECIPIENT+"' and channel='IN_APP' and not is_deleted"));assertTrue(text("select body from notification.message where tenant_id='"+TENANT+"' and recipient_id='"+RECIPIENT+"' and not is_deleted").contains("P010-NOTIFY-001"));assertEquals(0,scalar("select count(*) from notification.message where tenant_id='"+TENANT+"' and row_to_json(message)::text like '%"+PRIVATE+"%'"));assertEquals(1,scalar("select count(*) from core.outbox_event where tenant_id='"+TENANT+"' and aggregate_type='NOTIFICATION_MESSAGE' and event_type='NOTIFICATION_SEND' and not is_deleted"));}
    @Test void unsupportedNodeRollsBackWithoutDurableSideEffects(){PlatformOutboxEvent bad=event(UUID.fromString("90000000-0000-0000-0000-000000002053"),"{\"businessNo\":\"P010-NOTIFY-BAD\",\"event\":\"BROKEN\",\"nodeCode\":\"S99\",\"recipientEmployeeIds\":[\""+RECIPIENT+"\"]}");assertThrows(IllegalArgumentException.class,()->handle(bad));assertEquals(0,scalar("select count(*) from notification.message where tenant_id='"+TENANT+"' and body like '%P010-NOTIFY-BAD%'"));}
    private static void handle(PlatformOutboxEvent e){transactions.required(TENANT,()->{handler.handle(e);return null;});}private static PlatformOutboxEvent event(UUID id,String payload){Instant now=Instant.now();return new PlatformOutboxEvent(id,TENANT,Phase10P010NotificationHandler.AGGREGATE_TYPE,AGGREGATE,Phase10P010NotificationHandler.EVENT_TYPE,1,payload,"p010-notification-it:"+id,null,null,0,now,now);}private static void migrate(String database,String generated,String overlay){List<String> locations=new ArrayList<>();locations.add("filesystem:"+root.resolve("technical-platform/database/flyway").resolve(generated));if(overlay!=null)locations.add("filesystem:"+root.resolve("technical-platform/database/flyway-overlays").resolve(overlay));Flyway f=Flyway.configure().dataSource(url(database),postgres.getUsername(),postgres.getPassword()).locations(locations.toArray(String[]::new)).placeholders(Map.of("sjg_tenant_id",TENANT.toString(),"sjg_tenant_code","PHASE10_P010_NOTIFY","sjg_tenant_name","P010 Notification Tenant")).cleanDisabled(true).load();assertTrue(f.migrate().success);f.validate();}private static long scalar(String sql){try(Connection c=admin("sjg_oms");Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){assertTrue(r.next());return r.getLong(1);}catch(SQLException e){throw new IllegalStateException(e);}}private static String text(String sql)throws SQLException{try(Connection c=admin("sjg_oms");Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}}private static Connection admin(String database)throws SQLException{return DriverManager.getConnection(url(database),postgres.getUsername(),postgres.getPassword());}private static String url(String database){String u=postgres.getJdbcUrl();int q=u.indexOf('?');String suffix=q<0?"":u.substring(q),base=q<0?u:u.substring(0,q);return base.substring(0,base.lastIndexOf('/')+1)+database+suffix;}private static Path findRoot(){Path p=Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();while(p!=null){if(Files.isRegularFile(p.resolve("AGENT.md"))&&Files.isDirectory(p.resolve("Knowledge Base")))return p;p=p.getParent();}throw new IllegalStateException("root not found");}
}
