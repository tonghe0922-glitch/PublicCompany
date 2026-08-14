<script setup lang="ts">
import { SgjCard, SgjEmpty, SgjList } from '@sgj/ui'
import { DescriptionList, ProcessRecordMeta } from '@sgj/platform-ui'
import type { P007ScheduleRecord } from './contracts'

defineProps<{ schedule: P007ScheduleRecord }>()
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>{{ schedule.businessNo }} · {{ schedule.subject }}</strong></template>
    <ProcessRecordMeta :record="{
      businessNo: schedule.businessNo,
      statusLabel: schedule.status,
      currentNodeLabel: schedule.currentNodeCode ?? undefined,
      versionNo: schedule.versionNo,
      updatedAt: schedule.updatedAt,
    }" />
    <DescriptionList :items="[
      { key: 'business-date', label: '业务日期', value: schedule.businessDate },
      { key: 'interval', label: '排班区间', value: `${schedule.startAt} — ${schedule.endAt}` },
      { key: 'duration', label: '时长', value: `${schedule.durationHours} 小时` },
      { key: 'content', label: '内容版本', value: schedule.contentVersion },
      { key: 'period', label: '班次/课程号', value: schedule.periodOrCourseNo },
    ]" />
    <SgjEmpty v-if="schedule.items.length === 0" title="暂无服务端记录项" description="详情以服务端白名单元数据为准。" />
    <SgjList v-else aria-label="服务端记录项">
      <li v-for="item in schedule.items" :key="item.id">
        {{ item.itemSeq }} · {{ item.fieldCode }} · {{ item.itemName }} · {{ item.createdAt }}
      </li>
    </SgjList>
  </SgjCard>
</template>
