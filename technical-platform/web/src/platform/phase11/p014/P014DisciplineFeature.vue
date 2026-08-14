<script setup lang="ts">
import {
  SgjButton, SgjCard, SgjCheckbox, SgjConflict, SgjDateTime, SgjEmpty,
  SgjError, SgjInput, SgjListPageTemplate, SgjLoading, SgjNoPermission,
  SgjRecordCard, SgjSelect, SgjStatusChip, SgjTextarea,
} from '@sgj/ui'
import { isPending } from '../process-state'
import { useP014Discipline } from './use-p014-discipline'
import type { P014Props } from './use-p014-discipline'

const props = defineProps<P014Props>()
const {
  records, businessDate, subject, reason, affectedEmployeeId, sourceFactKey,
  businessObjectType, businessObjectNo, businessObjectName, employeeEventType,
  factOccurredAt, factSummary, impactLevel, resultSummary, evidenceNote,
  decisionOutcome, authorityReference, decidedAt, impactType, instructionId,
  receiptType, externalReference, externalOccurredAt, appealRequested,
  isTech, canRead, canCreate, listState, createState, businessObjectOptions,
  employeeEventOptions, impactLevelOptions, decisionOptions, impactTypeOptions,
  receiptTypeOptions, load, create, perform, actions, actionState,
} = useP014Discipline(props)
</script>

<template>
  <SgjListPageTemplate data-testid="p014-page" :title="isTech ? '纪律案件流程元数据监控' : '纪律事实、职责分离与申诉闭环'" :description="isTech ? '技术端仅查看流程元数据；当事人、事实、证据、决定和回执均不可见。' : '平台只记录外部人工授权决定及下游权威回执，不自动认定责任或直接处分。'">
    <template #actions><SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton></template>
    <SgjNoPermission v-if="!canRead" />
    <template v-else>
      <SgjCard v-if="!isTech && canCreate">
        <template #header><h2>建立纪律线索</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" label="纪律案件主题" placeholder="纪律案件主题" required />
          <SgjInput v-model="affectedEmployeeId" label="受影响员工 ID" placeholder="受影响员工 ID" required />
          <SgjInput v-model="sourceFactKey" label="唯一来源事实编号" placeholder="唯一来源事实编号" required />
          <SgjInput v-model="businessObjectNo" label="业务对象编号" placeholder="业务对象编号" />
          <SgjInput v-model="businessObjectName" label="业务对象名称" placeholder="业务对象名称" />
          <SgjDateTime v-model="businessDate" label="业务日期" required />
          <SgjSelect v-model="businessObjectType" label="业务对象类型" :options="businessObjectOptions" />
          <SgjSelect v-model="employeeEventType" label="员工事件类型" :options="employeeEventOptions" />
          <SgjDateTime v-model="factOccurredAt" label="事实发生时间" mode="datetime" required />
          <SgjSelect v-model="impactLevel" label="影响等级" :options="impactLevelOptions" />
          <SgjTextarea v-model="factSummary" label="可核验事实摘要" placeholder="可核验事实摘要" required />
          <SgjTextarea v-model="reason" label="案件立项说明" placeholder="案件立项说明" />
          <SgjTextarea v-model="evidenceNote" label="不可变来源证据" placeholder="不可变来源证据" required />
        </div>
        <template #footer><SgjButton :loading="isPending(createState)" @click="create">创建纪律案件</SgjButton></template>
      </SgjCard>
      <SgjCard v-if="!isTech">
        <template #header><h2>节点事实与外部权威引用</h2></template>
        <div class="phase11-form-grid">
          <SgjSelect v-model="decisionOutcome" label="申诉复核结果" :options="decisionOptions" />
          <SgjSelect v-model="impactType" label="影响指令类型" :options="impactTypeOptions" />
          <SgjInput v-model="authorityReference" label="外部授权或验证引用" />
          <SgjDateTime v-model="decidedAt" label="外部决定时间" mode="datetime" />
          <SgjInput v-model="instructionId" label="影响指令 ID" />
          <SgjSelect v-model="receiptType" label="权威回执类型" :options="receiptTypeOptions" />
          <SgjInput v-model="externalReference" label="外部回执编号" />
          <SgjDateTime v-model="externalOccurredAt" label="外部执行时间" mode="datetime" />
          <SgjCheckbox v-model="appealRequested" label="申请申诉（取消勾选表示明确放弃）" />
          <SgjInput v-model="resultSummary" label="节点结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点不可变证据" placeholder="节点不可变证据" />
        </div>
      </SgjCard>
      <SgjLoading v-if="isPending(listState) && records.length === 0" />
      <SgjNoPermission v-else-if="listState.failure === 'no-permission'" :description="listState.message" />
      <SgjError v-else-if="listState.failure === 'error'" title="纪律案件加载失败" :description="listState.message" :error-code="listState.errorCode" :trace-id="listState.traceId"><template #actions><SgjButton @click="load">重试</SgjButton></template></SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message"><template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template></SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无纪律案件" />
      <div v-else class="phase11-records">
        <SgjRecordCard v-for="item in records" :key="item.id" class="record" :data-discipline-id="item.id" :title="`${item.businessNo} · ${item.subject}`" :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`">
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>来源：{{ item.sourceFactKey }}；对象：{{ item.businessObjectNo }}；影响：{{ item.impactLevel }}</p>
            <p>决定 {{ item.decisions.length }} 条；影响指令 {{ item.impacts.length }} 条；权威回执 {{ item.receipts.length }} 条</p>
            <ul v-if="item.impacts.length"><li v-for="impact in item.impacts" :key="impact.id">{{ impact.id }} · {{ impact.impactType }} · {{ impact.authorityReference }}</li></ul>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict v-if="actionState(item, candidate).failure === 'conflict'" :description="actionState(item, candidate).message" />
              <SgjError v-else-if="['error', 'no-permission'].includes(actionState(item, candidate).failure)" :title="`${candidate.label}失败`" :description="actionState(item, candidate).message" :error-code="actionState(item, candidate).errorCode" :trace-id="actionState(item, candidate).traceId" />
            </template>
          </template>
          <p v-else>当事人、事实、证据、决定、影响指令和执行回执已隐藏。</p>
          <template #actions><SgjButton v-for="candidate in actions(item)" :key="candidate.code" :data-action="candidate.code" :loading="isPending(actionState(item, candidate))" @click="perform(item, candidate)">{{ candidate.label }}</SgjButton></template>
        </SgjRecordCard>
      </div>
      <SgjError v-if="['error', 'no-permission'].includes(createState.failure)" title="创建纪律案件失败" :description="createState.message" :error-code="createState.errorCode" :trace-id="createState.traceId" />
      <SgjConflict v-if="createState.failure === 'conflict'" :description="createState.message" />
    </template>
  </SgjListPageTemplate>
</template>

<style scoped>
.phase11-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--sgj-space-4); }
.phase11-records { display: grid; gap: var(--sgj-space-4); }
</style>
