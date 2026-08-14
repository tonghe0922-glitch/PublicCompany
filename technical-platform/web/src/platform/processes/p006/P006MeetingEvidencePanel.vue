<script setup lang="ts">
import { SgjCard, SgjEmpty, SgjList } from '@sgj/ui'
import { DescriptionList, ProcessRecordMeta } from '@sgj/platform-ui'
import type { P006MeetingRecord } from './contracts'

defineProps<{ meeting: P006MeetingRecord }>()
</script>

<template>
  <SgjCard as="section" variant="muted">
    <template #header><strong>{{ meeting.businessNo }} · {{ meeting.subject }}</strong></template>
    <ProcessRecordMeta :record="{
      businessNo: meeting.businessNo,
      statusLabel: meeting.status,
      currentNodeLabel: meeting.currentNodeCode ?? undefined,
      versionNo: meeting.versionNo,
      updatedAt: meeting.updatedAt,
    }" />
    <DescriptionList :items="[
      { key: 'start', label: '开始时间', value: meeting.startAt },
      { key: 'venue', label: '地点/渠道', value: meeting.venueChannel },
      { key: 'summary', label: '结果摘要', value: meeting.resultSummary },
    ]" />
    <SgjEmpty v-if="meeting.items.length === 0" title="暂无服务端证据" description="证据以服务端记录为准。" />
    <SgjList v-else aria-label="服务端证据列表">
      <li v-for="item in meeting.items" :key="item.id">
        {{ item.itemSeq }} · {{ item.itemKey }} · {{ item.itemName }} · {{ item.createdAt }}
      </li>
    </SgjList>
  </SgjCard>
</template>
