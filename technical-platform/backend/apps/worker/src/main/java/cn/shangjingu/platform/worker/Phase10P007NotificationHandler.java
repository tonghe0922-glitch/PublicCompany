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

/** P007 schedule notification projection; shift reasons and handover data never enter messages. */
public final class Phase10P007NotificationHandler implements PlatformOutboxHandler {

  public static final String EVENT_TYPE = "P007_SHIFT_EVENT", AGGREGATE_TYPE = "P007_SHIFT_CHANGE";

  private static final String TEMPLATE = "P007_SHIFT_EVENT";

  private final NotificationService notifications;

  private final JdbcTemplate jdbc;

  private final ObjectMapper mapper;

  public Phase10P007NotificationHandler(
      NotificationService notifications, JdbcTemplate jdbc, ObjectMapper mapper) {
    if (notifications == null || jdbc == null || mapper == null) {
      throw new IllegalArgumentException("P007 notification dependencies are required");
    }
    this.notifications = notifications;
    this.jdbc = jdbc;
    this.mapper = mapper;
  }

  @Override
  public String eventType() {
    return EVENT_TYPE;
  }

  @Override
  public String consumerName() {
    return "phase10-p007-notification";
  }

  @Override
  public void handle(PlatformOutboxEvent event) {
    if (event == null
        || !AGGREGATE_TYPE.equals(event.aggregateType())
        || event.aggregateId() == null) {
      throw new IllegalArgumentException("P007 outbox aggregate is invalid");
    }
    ensureTemplate(event.tenantId());
    JsonNode p = parse(event.payload());
    String no = required(p, "businessNo"),
        code = required(p, "event"),
        node = required(p, "nodeCode");
    for (UUID recipient : recipients(p.path("recipientEmployeeIds"))) {
      notifications.create(
          new NotificationService.CreateCommand(
              event.tenantId(),
              null,
              "p007-notify:" + event.id() + ":" + recipient,
              TEMPLATE,
              "IN_APP",
              "EMPLOYEE",
              recipient,
              Map.of("businessNo", no, "event", code, "nodeLabel", label(node)),
              (Instant) null));
    }
  }

  private void ensureTemplate(UUID tenant) {
    jdbc.query(
        "select pg_advisory_xact_lock(hashtextextended(cast(? as text),0))",
        r -> {
          r.next();
          return null;
        },
        tenant + "|" + TEMPLATE);
    jdbc.update(
        """
insert into notification.template(id,tenant_id,template_code,channel,title_template,body_template,variables_schema,enabled)
select gen_random_uuid(),?,'P007_SHIFT_EVENT','IN_APP','排班进度：{{nodeLabel}}','排班 {{businessNo}} 当前节点：{{nodeLabel}}（事件 {{event}}）。',cast(? as jsonb),true
where not exists(select 1 from notification.template where tenant_id=? and template_code='P007_SHIFT_EVENT' and not is_deleted)
""",
        tenant,
        "{\"type\":\"object\",\"properties\":{\"businessNo\":{\"type\":\"string\"},\"event\":{\"type\":\"string\"},\"nodeLabel\":{\"type\":\"string\"}},\"required\":[\"businessNo\",\"event\",\"nodeLabel\"]}",
        tenant);
  }

  private JsonNode parse(String raw) {
    try {
      JsonNode n = mapper.readTree(raw);
      if (n == null || !n.isObject()) {
        throw new IllegalArgumentException("P007 event payload must be an object");
      }
      return n;
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("P007 event payload is invalid JSON", e);
    }
  }

  private static String required(JsonNode n, String f) {
    JsonNode v = n.get(f);
    if (v == null || !v.isTextual() || v.asText().isBlank()) {
      throw new IllegalArgumentException("P007 event field is required: " + f);
    }
    return v.asText();
  }

  private static Set<UUID> recipients(JsonNode n) {
    Set<UUID> ids = new LinkedHashSet<>();
    if (n != null && n.isArray()) {
      n.forEach(
          v -> {
            try {
              ids.add(UUID.fromString(v.asText()));
            } catch (Exception e) {
              throw new IllegalArgumentException("P007 recipient is invalid", e);
            }
          });
    }
    return ids;
  }

  private static String label(String n) {
    return switch (n) {
      case "S01" -> "业务量与活动需求输入";
      case "S02" -> "班次模板匹配";
      case "S03" -> "资格与连续工时校验";
      case "S04" -> "主管发布排班";
      case "S05" -> "员工确认";
      case "S06" -> "换班/替班申请";
      case "S07" -> "变更审批";
      case "S08" -> "考勤与餐饮/班车联动";
      case "S09" -> "日结";
      case "END" -> "已日结";
      default -> throw new IllegalArgumentException("P007 event node is not source-backed: " + n);
    };
  }
}
