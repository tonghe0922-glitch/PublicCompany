package cn.shangjingu.platform.api.phase10;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MonitorProjection(
        UUID recordId,
        String businessNo,
        String processCode,
        String currentNodeCode,
        String status,
        int versionNo,
        Instant updatedAt,
        Long approvedCount) {}
