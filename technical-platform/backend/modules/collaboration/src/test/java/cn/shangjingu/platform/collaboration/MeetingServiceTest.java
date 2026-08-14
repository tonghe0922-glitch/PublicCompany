package cn.shangjingu.platform.collaboration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import cn.shangjingu.platform.core.database.DatabaseSecurityContext;
import cn.shangjingu.platform.core.database.TenantTransactionRunner;
import cn.shangjingu.platform.core.event.TransactionalOutboxService;
import cn.shangjingu.platform.core.process.BusinessNumberService;
import cn.shangjingu.platform.core.process.IdempotencyRegistry;
import cn.shangjingu.platform.core.process.ProcessRejectedException;
import cn.shangjingu.platform.workflow.WorkflowFormService;
import cn.shangjingu.platform.workflow.WorkflowRuntimeService;
import cn.shangjingu.platform.workflow.WorkflowTaskAssignmentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MeetingServiceTest {
    private final MeetingService service=new MeetingService(mock(TenantTransactionRunner.class),mock(IdempotencyRegistry.class),
            mock(BusinessNumberService.class),mock(TransactionalOutboxService.class),mock(WorkflowRuntimeService.class),
            mock(WorkflowTaskAssignmentService.class),mock(WorkflowFormService.class),mock(MeetingService.Repository.class),new ObjectMapper());
    private final DatabaseSecurityContext actor=new DatabaseSecurityContext(UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),UUID.randomUUID(),null,UUID.randomUUID(),UUID.randomUUID());

    @Test void preservesEverySourceStageLabel(){
        assertEquals(List.of("议题征集","材料完整性检查","会议发布","签到与请假","会议召开","主持人确认纪要","行动项生成","责任人执行","验收与返工","逾期升级","归档复盘"),
                java.util.stream.IntStream.rangeClosed(1,11).mapToObj(i->MeetingService.label("S%02d".formatted(i))).toList());
    }
    @Test void rejectsSourceEnumAndLengthViolationsBeforePersistence(){
        var invalid=new MeetingService.CreateCommand(LocalDate.now(),"短", "不足", "NORMAL",Instant.now().plus(1,ChronoUnit.DAYS),"标题","正文",null,"ALL");
        assertThrows(ProcessRejectedException.class,()->service.create(actor,"key","hash",invalid));
    }
    @Test void rejectsPastMeetingTimeBeforePersistence(){
        var invalid=new MeetingService.CreateCommand(LocalDate.now(),"有效会议主题", "这是满足十个字符的登记原因", "普通",Instant.now().minus(1,ChronoUnit.HOURS),"正式标题","会议正文",null,"内部");
        assertThrows(ProcessRejectedException.class,()->service.create(actor,"key","hash",invalid));
    }
}
