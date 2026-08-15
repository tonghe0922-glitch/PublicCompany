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

/**
 * P011 notifications expose workflow metadata only; scores, appeals and source evidence remain
 * server-side.
 */
public final class Phase11P011NotificationHandler implements PlatformOutboxHandler {

  public static final String EVENT_TYPE = "P011_PERFORMANCE_EVENT",
      AGGREGATE_TYPE = "P011_PERFORMANCE";

  private static final String TEMPLATE = "P011_PERFORMANCE_EVENT";

  private final NotificationService notifications;

  private final JdbcTemplate jdbc;

  private final ObjectMapper mapper;

  public Phase11P011NotificationHandler(
      NotificationService notifications, JdbcTemplate jdbc, ObjectMapper mapper) {
    if (notifications == null || jdbc == null || mapper == null) {
      throw new IllegalArgumentException("P011 notification dependencies are required");
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
    return "phase11-p011-notification";
  }

  @Override
  public void handle(PlatformOutboxEvent event) {
    if (event == null
        || !AGGREGATE_TYPE.equals(event.aggregateType())
        || event.aggregateId() == null) {
      throw new IllegalArgumentException("P011 outbox aggregate is invalid");
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
              "p011-notify:" + event.id() + ":" + recipient,
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
        "select pg_advisory_xact_lock(hashtextextended(?,0))",
        r -> {
          r.next();
          return null;
        },
        tenant + ":" + TEMPLATE);
    jdbc.update(
        """
insert into notification.template(id,tenant_id,template_code,channel,title_template,body_template,variables_schema,enabled)
select gen_random_uuid(),?,'P011_PERFORMANCE_EVENT','IN_APP','Performance workflow: {{nodeLabel}}','Cycle {{businessNo}} is at {{nodeLabel}} ({{event}}).',cast(? as jsonb),true where not exists(select 1 from notification.template where tenant_id=? and template_code='P011_PERFORMANCE_EVENT' and not is_deleted)
""",
        tenant,
        "{\"type\":\"object\",\"properties\":{\"businessNo\":{\"type\":\"string\"},\"event\":{\"type\":\"string\"},\"nodeLabel\":{\"type\":\"string\"}},\"required\":[\"businessNo\",\"event\",\"nodeLabel\"]}",
        tenant);
  }

  private JsonNode parse(String raw) {
    try {
      JsonNode n = mapper.readTree(raw);
      if (n == null || !n.isObject()) {
        throw new IllegalArgumentException("P011 event payload must be an object");
      }
      return n;
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("P011 event payload is invalid JSON", e);
    }
  }

  private static String required(JsonNode n, String f) {
    JsonNode v = n.get(f);
    if (v == null || !v.isTextual() || v.asText().isBlank()) {
      throw new IllegalArgumentException("P011 event field is required: " + f);
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
              throw new IllegalArgumentException("P011 recipient is invalid", e);
            }
          });
    }
    return ids;
  }

  private static String label(String n) {
    return switch (n) {
      case "S01" -> "Target setting";
      case "S02" -> "Employee confirmation";
      case "S03" -> "Progress record and coaching";
      case "S04" -> "Authoritative data collection";
      case "S05" -> "Employee and supervisor evaluation";
      case "S06" -> "1000-point calculation";
      case "S07" -> "Calibration";
      case "S08" -> "Result feedback confirmation";
      case "S09" -> "Appeal review";
      case "S10" -> "Performance effect execution";
      case "S11" -> "Archive";
      case "END" -> "Closed";
      default -> throw new IllegalArgumentException("P011 event node is not source-backed: " + n);
    };
  }
}
