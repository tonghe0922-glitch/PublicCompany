package cn.shangjingu.platform.database;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.PlatformOutboxEvent;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.notification.NotificationService;
import cn.shangjingu.platform.notification.NotificationTemplateRenderer;
import cn.shangjingu.platform.worker.Phase10P007NotificationHandler;
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

/** Real PostgreSQL checkpoint for P007 Outbox -> durable, sanitized in-app notifications. */
class Phase10P007NotificationDatabaseIT {
    private static final UUID TENANT=UUID.fromString("00000000-0000-0000-0000-000000002017");
    private static final UUID RECIPIENT=UUID.fromString("30000000-0000-0000-0000-000000002017");
    private static final UUID AGGREGATE=UUID.fromString("90000000-0000-0000-0000-000000002027");
    private static final UUID EVENT=UUID.fromString("90000000-0000-0000-0000-000000002028");
    private static final String PRIVATE_REASON="P007-PRIVATE-SHIFT-REASON-MUST-NOT-LEAK";
    private static final String WORKER_PASSWORD="p10_p007_notify_"+shortId();
    private static PostgreSQLContainer<?> postgres;private static Path repoRoot;private static JdbcTemplate jdbc;
    private static TenantTransactionRunner transactions;private static Phase10P007NotificationHandler handler;

    @BeforeAll static void installApprovedBaseline()throws Exception{
        repoRoot=findRepoRoot();postgres=new PostgreSQLContainer<>("postgres:16.14-alpine3.24").withDatabaseName("postgres").withUsername("postgres").withPassword("phase10-p007-notify-"+UUID.randomUUID());postgres.start();migrate("postgres","cluster",null);
        try(Connection c=admin("postgres");Statement s=c.createStatement()){s.execute("alter role sjg_worker_runtime password '"+WORKER_PASSWORD+"'");s.execute("create database sjg_oms");}migrate("sjg_oms","oms","oms");
        DriverManagerDataSource ds=new DriverManagerDataSource();ds.setDriverClassName("org.postgresql.Driver");ds.setUrl(jdbcUrl("sjg_oms"));ds.setUsername("sjg_worker_runtime");ds.setPassword(WORKER_PASSWORD);jdbc=new JdbcTemplate(ds);transactions=new TenantTransactionRunner(jdbc,new DataSourceTransactionManager(ds));ObjectMapper mapper=new ObjectMapper();TransactionalOutboxService outbox=new TransactionalOutboxService(jdbc);handler=new Phase10P007NotificationHandler(new NotificationService(jdbc,outbox,new NotificationTemplateRenderer(mapper)),jdbc,mapper);
    }
    @AfterAll static void stopPostgres(){if(postgres!=null)postgres.stop();}

    @Test void shiftEventCreatesOneSanitizedNotificationAcrossExactReplay()throws Exception{
        PlatformOutboxEvent event=event(EVENT,"{\"businessNo\":\"P007-NOTIFY-001\",\"event\":\"REQUEST_CHANGE\",\"nodeCode\":\"S07\",\"recipientEmployeeIds\":[\""+RECIPIENT+"\",\""+RECIPIENT+"\"],\"changeReason\":\""+PRIVATE_REASON+"\",\"handoverItems\":[\"private\"]}");handle(event);handle(event);
        assertEquals(1L,scalarLong("select count(*) from notification.message where tenant_id='"+TENANT+"' and recipient_id='"+RECIPIENT+"' and channel='IN_APP' and status='PENDING' and not is_deleted"));
        assertTrue(scalarString("select body from notification.message where tenant_id='"+TENANT+"' and recipient_id='"+RECIPIENT+"' and not is_deleted").contains("P007-NOTIFY-001"));
        assertEquals(0L,scalarLong("select count(*) from notification.message where tenant_id='"+TENANT+"' and row_to_json(message)::text like '%"+PRIVATE_REASON+"%'"));
        assertEquals(1L,scalarLong("select count(*) from core.outbox_event where tenant_id='"+TENANT+"' and aggregate_type='NOTIFICATION_MESSAGE' and event_type='NOTIFICATION_SEND' and not is_deleted"));
        assertEquals(0L,scalarLong("select count(*) from core.outbox_event where tenant_id='"+TENANT+"' and payload::text like '%"+PRIVATE_REASON+"%'"));
    }
    @Test void unsupportedNodeFailsClosedWithoutDurableSideEffects()throws Exception{
        PlatformOutboxEvent invalid=event(UUID.fromString("90000000-0000-0000-0000-000000002029"),"{\"businessNo\":\"P007-NOTIFY-BAD\",\"event\":\"BROKEN\",\"nodeCode\":\"S99\",\"recipientEmployeeIds\":[\""+RECIPIENT+"\"]}");assertThrows(IllegalArgumentException.class,()->handle(invalid));assertEquals(0L,scalarLong("select count(*) from notification.message where tenant_id='"+TENANT+"' and body like '%P007-NOTIFY-BAD%'"));
    }
    private static void handle(PlatformOutboxEvent e){transactions.required(TENANT,()->{handler.handle(e);return null;});}
    private static PlatformOutboxEvent event(UUID id,String payload){Instant now=Instant.now();return new PlatformOutboxEvent(id,TENANT,Phase10P007NotificationHandler.AGGREGATE_TYPE,AGGREGATE,Phase10P007NotificationHandler.EVENT_TYPE,1,payload,"p007-notification-it:"+id,null,null,0,now,now);}
    private static long scalarLong(String sql)throws SQLException{try(Connection c=admin("sjg_oms");Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){assertTrue(r.next());return r.getLong(1);}}
    private static String scalarString(String sql)throws SQLException{try(Connection c=admin("sjg_oms");Statement s=c.createStatement();ResultSet r=s.executeQuery(sql)){assertTrue(r.next());return r.getString(1);}}
    private static void migrate(String database,String generated,String overlay){List<String> locations=new ArrayList<>();locations.add("filesystem:"+repoRoot.resolve("technical-platform/database/flyway").resolve(generated));if(overlay!=null)locations.add("filesystem:"+repoRoot.resolve("technical-platform/database/flyway-overlays").resolve(overlay));Flyway f=Flyway.configure().dataSource(jdbcUrl(database),postgres.getUsername(),postgres.getPassword()).locations(locations.toArray(String[]::new)).placeholders(Map.of("sjg_tenant_id",TENANT.toString(),"sjg_tenant_code","PHASE10_P007_NOTIFY","sjg_tenant_name","P007 Notification Tenant")).cleanDisabled(true).load();assertTrue(f.migrate().success);f.validate();}
    private static Connection admin(String database)throws SQLException{return DriverManager.getConnection(jdbcUrl(database),postgres.getUsername(),postgres.getPassword());}
    private static String jdbcUrl(String database){String u=postgres.getJdbcUrl();int q=u.indexOf('?');String suffix=q<0?"":u.substring(q),base=q<0?u:u.substring(0,q);return base.substring(0,base.lastIndexOf('/')+1)+database+suffix;}
    private static Path findRepoRoot(){Path p=Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();while(p!=null){if(Files.isRegularFile(p.resolve("AGENT.md"))&&Files.isDirectory(p.resolve("Knowledge Base"))&&Files.isRegularFile(p.resolve("pom.xml")))return p;p=p.getParent();}throw new IllegalStateException("repository root not found");}
    private static String shortId(){return UUID.randomUUID().toString().replace("-","").substring(0,10);}
}
