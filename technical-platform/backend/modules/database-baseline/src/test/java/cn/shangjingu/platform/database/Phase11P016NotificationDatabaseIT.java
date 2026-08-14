package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.PlatformOutboxEvent;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.notification.NotificationService;
import cn.shangjingu.platform.notification.NotificationTemplateRenderer;
import cn.shangjingu.platform.worker.Phase11P016NotificationHandler;
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

class Phase11P016NotificationDatabaseIT {
    private static final UUID TENANT=UUID.fromString("00000000-0000-0000-0000-000000002016"),RECIPIENT=UUID.fromString("30000000-0000-0000-0000-000000002016"),AGGREGATE=UUID.fromString("90000000-0000-0000-0000-000000002161"),EVENT=UUID.fromString("90000000-0000-0000-0000-000000002162");
    private static final String PRIVATE="P016-PRIVATE-AMOUNT-CONSENT-RECEIPT-MUST-NOT-LEAK",WORKER_PASSWORD="p16_notify_"+shortId();
    private static PostgreSQLContainer<?> postgres;private static TenantTransactionRunner transactions;private static Phase11P016NotificationHandler handler;private static Path root;

    @BeforeAll static void install()throws Exception{root=findRoot();postgres=new PostgreSQLContainer<>("postgres:16.14-alpine3.24").withDatabaseName("postgres").withUsername("postgres").withPassword("phase11-p016-notify-"+shortId());postgres.start();migrate("postgres","cluster",null);try(Connection c=admin("postgres");Statement s=c.createStatement()){s.execute("alter role sjg_worker_runtime password '"+WORKER_PASSWORD+"'");s.execute("create database sjg_oms");}migrate("sjg_oms","oms","oms");DriverManagerDataSource ds=new DriverManagerDataSource();ds.setDriverClassName("org.postgresql.Driver");ds.setUrl(url("sjg_oms"));ds.setUsername("sjg_worker_runtime");ds.setPassword(WORKER_PASSWORD);JdbcTemplate jdbc=new JdbcTemplate(ds);transactions=new TenantTransactionRunner(jdbc,new DataSourceTransactionManager(ds));ObjectMapper mapper=new ObjectMapper();handler=new Phase11P016NotificationHandler(new NotificationService(jdbc,new TransactionalOutboxService(jdbc),new NotificationTemplateRenderer(mapper)),jdbc,mapper);}
    @AfterAll static void stop(){if(postgres!=null)postgres.stop();}

    @Test void exactReplayCreatesOneMetadataOnlyNotification()throws Exception{PlatformOutboxEvent event=event(EVENT,"{\"businessNo\":\"P016-NOTIFY-001\",\"event\":\"P016.stage.05.completed\",\"nodeCode\":\"S06\",\"recipientEmployeeIds\":[\""+RECIPIENT+"\",\""+RECIPIENT+"\"],\"amount\":\""+PRIVATE+"\",\"consent\":\""+PRIVATE+"\",\"receipt\":\""+PRIVATE+"\"}");handle(event);handle(event);assertEquals(1,scalar("select count(*) from notification.message where tenant_id='"+TENANT+"' and recipient_id='"+RECIPIENT+"' and channel='IN_APP' and not is_deleted"));assertTrue(text("select body from notification.message where tenant_id='"+TENANT+"' and recipient_id='"+RECIPIENT+"' and not is_deleted").contains("P016-NOTIFY-001"));assertEquals(0,scalar("select count(*) from notification.message where tenant_id='"+TENANT+"' and row_to_json(message)::text like '%"+PRIVATE+"%'"));assertEquals(1,scalar("select count(*) from core.outbox_event where tenant_id='"+TENANT+"' and aggregate_type='NOTIFICATION_MESSAGE' and event_type='NOTIFICATION_SEND' and not is_deleted"));}
    @Test void unsupportedNodeAndInvalidRecipientRollbackWithoutSideEffects(){PlatformOutboxEvent invalidNode=event(UUID.fromString("90000000-0000-0000-0000-000000002163"),"{\"businessNo\":\"P016-NOTIFY-BAD-NODE\",\"event\":\"BROKEN\",\"nodeCode\":\"S99\",\"recipientEmployeeIds\":[\""+RECIPIENT+"\"]}");assertThrows(IllegalArgumentException.class,()->handle(invalidNode));PlatformOutboxEvent invalidRecipient=event(UUID.fromString("90000000-0000-0000-0000-000000002164"),"{\"businessNo\":\"P016-NOTIFY-BAD-RECIPIENT\",\"event\":\"BROKEN\",\"nodeCode\":\"S06\",\"recipientEmployeeIds\":[\"not-a-uuid\"]}");assertThrows(IllegalArgumentException.class,()->handle(invalidRecipient));assertEquals(0,scalar("select count(*) from notification.message where tenant_id='"+TENANT+"' and body like '%P016-NOTIFY-BAD%'"));}

    private static void handle(PlatformOutboxEvent event){transactions.required(TENANT,()->{handler.handle(event);return null;});}
    private static PlatformOutboxEvent event(UUID id,String payload){Instant now=Instant.now();return new PlatformOutboxEvent(id,TENANT,Phase11P016NotificationHandler.AGGREGATE_TYPE,AGGREGATE,Phase11P016NotificationHandler.EVENT_TYPE,1,payload,"p016-notification-it:"+id,null,null,0,now,now);}
    private static void migrate(String database,String generated,String overlay){List<String> locations=new ArrayList<>();locations.add("filesystem:"+root.resolve("technical-platform/database/flyway").resolve(generated));if(overlay!=null)locations.add("filesystem:"+root.resolve("technical-platform/database/flyway-overlays").resolve(overlay));Flyway f=Flyway.configure().dataSource(url(database),postgres.getUsername(),postgres.getPassword()).locations(locations.toArray(String[]::new)).placeholders(Map.of("sjg_tenant_id",TENANT.toString(),"sjg_tenant_code","PHASE11_P016_NOTIFY","sjg_tenant_name","P016 Notification Tenant")).cleanDisabled(true).load();assertTrue(f.migrate().success);f.validate();}
    private static long scalar(String sql){try(Connection c=admin("sjg_oms");Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){assertTrue(r.next());return r.getLong(1);}catch(SQLException e){throw new IllegalStateException(e);}}
    private static String text(String sql)throws SQLException{try(Connection c=admin("sjg_oms");Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}}
    private static Connection admin(String database)throws SQLException{return DriverManager.getConnection(url(database),postgres.getUsername(),postgres.getPassword());}
    private static String url(String database){String original=postgres.getJdbcUrl();int query=original.indexOf('?');String suffix=query<0?"":original.substring(query),base=query<0?original:original.substring(0,query);return base.substring(0,base.lastIndexOf('/')+1)+database+suffix;}
    private static Path findRoot(){Path p=Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();while(p!=null){if(Files.isRegularFile(p.resolve("AGENT.md"))&&Files.isDirectory(p.resolve("Knowledge Base")))return p;p=p.getParent();}throw new IllegalStateException("root not found");}
    private static String shortId(){return UUID.randomUUID().toString().replace("-","").substring(0,10);}
}
