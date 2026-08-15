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
 * P012 notifications disclose workflow metadata only; assessment, salary references and evidence
 * stay server-side.
 */
public final class Phase11P012NotificationHandler implements PlatformOutboxHandler {

  public static final String EVENT_TYPE = "P012_PROMOTION_EVENT", AGGREGATE_TYPE = "P012_PROMOTION";

  private static final String TEMPLATE = "P012_PROMOTION_EVENT";

  private final NotificationService notifications;

  private final JdbcTemplate jdbc;

  private final ObjectMapper mapper;

  public Phase11P012NotificationHandler(
      NotificationService notifications, JdbcTemplate jdbc, ObjectMapper mapper) {
    if (notifications == null || jdbc == null || mapper == null) {
      throw new IllegalArgumentException("P012 notification dependencies are required");
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
    return "phase11-p012-notification";
  }

  @Override
  public void handle(PlatformOutboxEvent event) {
    if (event == null
        || !AGGREGATE_TYPE.equals(event.aggregateType())
        || event.aggregateId() == null) {
      throw new IllegalArgumentException("P012 outbox aggregate is invalid");
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
              "p012-notify:" + event.id() + ":" + recipient,
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
select gen_random_uuid(),?,'P012_PROMOTION_EVENT','IN_APP','Promotion workflow: {{nodeLabel}}','Request {{businessNo}} is at {{nodeLabel}} ({{event}}).',cast(? as jsonb),true where not exists(select 1 from notification.template where tenant_id=? and template_code='P012_PROMOTION_EVENT' and not is_deleted)
""",
        tenant,
        "{\"type\":\"object\",\"properties\":{\"businessNo\":{\"type\":\"string\"},\"event\":{\"type\":\"string\"},\"nodeLabel\":{\"type\":\"string\"}},\"required\":[\"businessNo\",\"event\",\"nodeLabel\"]}",
        tenant);
  }

  private JsonNode parse(String raw) {
    try {
      JsonNode n = mapper.readTree(raw);
      if (n == null || !n.isObject()) {
        throw new IllegalArgumentException("P012 event payload must be an object");
      }
      return n;
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("P012 event payload is invalid JSON", e);
    }
  }

  private static String required(JsonNode n, String f) {
    JsonNode v = n.get(f);
    if (v == null || !v.isTextual() || v.asText().isBlank()) {
      throw new IllegalArgumentException("P012 event field is required: " + f);
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
              throw new IllegalArgumentException("P012 recipient is invalid", e);
            }
          });
    }
    return ids;
  }

  private static String label(String n) {
    return switch (n) {
      case "S01" -> "Application or nomination";
      case "S02" -> "Eligibility and freeze review";
      case "S03" -> "1000-point assessment";
      case "S04" -> "Vacancy and budget verification";
      case "S05" -> "Competition review";
      case "S06" -> "Approval";
      case "S07" -> "Publication and notice";
      case "S08" -> "Appointment and salary confirmation";
      case "S09" -> "Validation period";
      case "S10" -> "Effective assignment or rollback";
      case "END" -> "Closed";
      default -> throw new IllegalArgumentException("P012 event node is not source-backed: " + n);
    };
  }
}
