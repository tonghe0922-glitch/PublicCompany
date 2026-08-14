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

/** Delivers P006 meeting/action workflow events without exposing meeting content in notifications. */
public final class Phase10P006NotificationHandler implements PlatformOutboxHandler {
    public static final String EVENT_TYPE="P006_MEETING_EVENT",AGGREGATE_TYPE="P006_MEETING";
    private static final String TEMPLATE="P006_MEETING_EVENT";
    private final NotificationService notifications;private final JdbcTemplate jdbc;private final ObjectMapper mapper;
    public Phase10P006NotificationHandler(NotificationService notifications,JdbcTemplate jdbc,ObjectMapper mapper){
        if(notifications==null||jdbc==null||mapper==null)throw new IllegalArgumentException("P006 notification dependencies are required");
        this.notifications=notifications;this.jdbc=jdbc;this.mapper=mapper;}
    @Override public String eventType(){return EVENT_TYPE;} @Override public String consumerName(){return "phase10-p006-notification";}
    @Override public void handle(PlatformOutboxEvent event){
        if(event==null||!AGGREGATE_TYPE.equals(event.aggregateType())||event.aggregateId()==null)throw new IllegalArgumentException("P006 outbox aggregate is invalid");
        ensureTemplate(event.tenantId());JsonNode payload=parse(event.payload());String businessNo=required(payload,"businessNo"),eventCode=required(payload,"event"),node=required(payload,"nodeCode");
        for(UUID recipient:recipients(payload.path("recipientEmployeeIds")))notifications.create(new NotificationService.CreateCommand(
                event.tenantId(),null,"p006-notify:"+event.id()+":"+recipient,TEMPLATE,"IN_APP","EMPLOYEE",recipient,
                Map.of("businessNo",businessNo,"event",eventCode,"nodeLabel",label(node)),(Instant)null));
    }
    private void ensureTemplate(UUID tenant){
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(cast(? as text),0))",rs->{rs.next();return null;},tenant+"|"+TEMPLATE);
        jdbc.update("""
                insert into notification.template(id,tenant_id,template_code,channel,title_template,body_template,variables_schema,enabled)
                select gen_random_uuid(),?,'P006_MEETING_EVENT','IN_APP','会议行动进度：{{nodeLabel}}',
                '会议 {{businessNo}} 当前节点：{{nodeLabel}}（事件 {{event}}）。',cast(? as jsonb),true
                where not exists(select 1 from notification.template where tenant_id=? and template_code='P006_MEETING_EVENT' and not is_deleted)
                """,tenant,"{\"type\":\"object\",\"properties\":{\"businessNo\":{\"type\":\"string\"},\"event\":{\"type\":\"string\"},\"nodeLabel\":{\"type\":\"string\"}},\"required\":[\"businessNo\",\"event\",\"nodeLabel\"]}",tenant);
    }
    private JsonNode parse(String raw){try{JsonNode n=mapper.readTree(raw);if(n==null||!n.isObject())throw new IllegalArgumentException("P006 event payload must be an object");return n;}catch(IllegalArgumentException e){throw e;}catch(Exception e){throw new IllegalArgumentException("P006 event payload is invalid JSON",e);}}
    private static String required(JsonNode n,String f){JsonNode v=n.get(f);if(v==null||!v.isTextual()||v.asText().isBlank())throw new IllegalArgumentException("P006 event field is required: "+f);return v.asText();}
    private static Set<UUID> recipients(JsonNode n){Set<UUID> ids=new LinkedHashSet<>();if(n!=null&&n.isArray())n.forEach(v->{try{ids.add(UUID.fromString(v.asText()));}catch(Exception e){throw new IllegalArgumentException("P006 recipient is invalid",e);}});return ids;}
    private static String label(String n){return switch(n){case"S01"->"议题征集";case"S02"->"材料完整性检查";case"S03"->"会议发布";case"S04"->"签到与请假";case"S05"->"会议召开";case"S06"->"主持人确认纪要";case"S07"->"行动项生成";case"S08"->"责任人执行";case"S09"->"验收与返工";case"S10"->"逾期升级";case"S11"->"归档复盘";case"END"->"已归档";default->throw new IllegalArgumentException("P006 event node is not source-backed: "+n);};}
}
