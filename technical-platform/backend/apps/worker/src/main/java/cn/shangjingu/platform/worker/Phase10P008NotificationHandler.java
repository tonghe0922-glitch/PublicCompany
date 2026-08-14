package cn.shangjingu.platform.worker;

import cn.shangjingu.platform.core.event.PlatformOutboxEvent;
import cn.shangjingu.platform.core.event.PlatformOutboxHandler;
import cn.shangjingu.platform.notification.NotificationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/** P008 leave progress projection. Reasons, quota account identifiers and immutable evidence never enter messages. */
public final class Phase10P008NotificationHandler implements PlatformOutboxHandler {
    public static final String EVENT_TYPE="P008_LEAVE_EVENT",AGGREGATE_TYPE="P008_LEAVE";private static final String TEMPLATE="P008_LEAVE_EVENT";
    private final NotificationService notifications;private final JdbcTemplate jdbc;private final ObjectMapper mapper;
    public Phase10P008NotificationHandler(NotificationService notifications,JdbcTemplate jdbc,ObjectMapper mapper){if(notifications==null||jdbc==null||mapper==null)throw new IllegalArgumentException("P008 notification dependencies are required");this.notifications=notifications;this.jdbc=jdbc;this.mapper=mapper;}
    @Override public String eventType(){return EVENT_TYPE;}@Override public String consumerName(){return"phase10-p008-notification";}
    @Override public void handle(PlatformOutboxEvent event){if(event==null||!AGGREGATE_TYPE.equals(event.aggregateType())||event.aggregateId()==null)throw new IllegalArgumentException("P008 outbox aggregate is invalid");ensureTemplate(event.tenantId());JsonNode p=parse(event.payload());String no=required(p,"businessNo"),code=required(p,"event"),node=required(p,"nodeCode");for(UUID recipient:recipients(p.path("recipientEmployeeIds")))notifications.create(new NotificationService.CreateCommand(event.tenantId(),null,"p008-notify:"+event.id()+":"+recipient,TEMPLATE,"IN_APP","EMPLOYEE",recipient,Map.of("businessNo",no,"event",code,"nodeLabel",label(node)),(Instant)null));}
    private void ensureTemplate(UUID tenant){jdbc.query("select pg_advisory_xact_lock(hashtextextended(cast(? as text),0))",r->{r.next();return null;},tenant+"|"+TEMPLATE);jdbc.update("""
        insert into notification.template(id,tenant_id,template_code,channel,title_template,body_template,variables_schema,enabled)
        select gen_random_uuid(),?,'P008_LEAVE_EVENT','IN_APP','请假进度：{{nodeLabel}}','请假 {{businessNo}} 当前节点：{{nodeLabel}}（事件 {{event}}）。',cast(? as jsonb),true
        where not exists(select 1 from notification.template where tenant_id=? and template_code='P008_LEAVE_EVENT' and not is_deleted)
        """,tenant,"{\"type\":\"object\",\"properties\":{\"businessNo\":{\"type\":\"string\"},\"event\":{\"type\":\"string\"},\"nodeLabel\":{\"type\":\"string\"}},\"required\":[\"businessNo\",\"event\",\"nodeLabel\"]}",tenant);}
    private JsonNode parse(String raw){try{JsonNode n=mapper.readTree(raw);if(n==null||!n.isObject())throw new IllegalArgumentException("P008 event payload must be an object");return n;}catch(IllegalArgumentException e){throw e;}catch(Exception e){throw new IllegalArgumentException("P008 event payload is invalid JSON",e);}}
    private static String required(JsonNode n,String f){JsonNode v=n.get(f);if(v==null||!v.isTextual()||v.asText().isBlank())throw new IllegalArgumentException("P008 event field is required: "+f);return v.asText();}
    private static Set<UUID> recipients(JsonNode n){Set<UUID> ids=new LinkedHashSet<>();if(n!=null&&n.isArray())n.forEach(v->{try{ids.add(UUID.fromString(v.asText()));}catch(Exception e){throw new IllegalArgumentException("P008 recipient is invalid",e);}});return ids;}
    private static String label(String n){return switch(n){case"S01"->"请假申请";case"S02"->"假期额度预占";case"S03"->"工作交接与代理";case"S04"->"审批";case"S05"->"预占转扣减/驳回释放";case"S06"->"排班与考勤标记";case"S07"->"实际休假";case"S08"->"销假/提前返岗/变更";case"S09"->"差额账本调整";case"S10"->"考勤日结与归档";case"END"->"已关闭";default->throw new IllegalArgumentException("P008 event node is not source-backed: "+n);};}
}
