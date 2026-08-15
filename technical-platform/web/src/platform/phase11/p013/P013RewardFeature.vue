<script setup lang="ts">
import {
  SgjButton, SgjCard, SgjConflict, SgjDateTime, SgjEmpty, SgjError, SgjInput,
  SgjListPageTemplate, SgjLoading, SgjNoPermission, SgjRecordCard, SgjSelect,
  SgjStatusChip, SgjTextarea,
} from '@sgj/ui'
import { isPending } from '../process-state'
import { useP013Reward } from './use-p013-reward'
import type { P013Props } from './use-p013-reward'

const props = defineProps<P013Props>()
const vm = useP013Reward(props)
const {
  records, businessDate, subject, reason, ownerEmployeeId, sourceFactKey,
  employeeEventType, factOccurredAt, factSummary, impactLevel, rewardLevel,
  impactType, requestedPoints, approvedAmount, authorityReference, instructionId,
  receiptType, externalReference, externalOccurredAt, resultSummary, evidenceNote,
  isTech, canRead, canCreate, listState, createState, eventTypeOptions,
  impactLevelOptions, impactTypeOptions, receiptTypeOptions,
  load, create, perform, actions, actionState, recordPending,
} = vm
</script>

<template>
  <SgjListPageTemplate data-testid="p013-page" :title="isTech ? '奖励流程元数据监控' : '奖励事实、审批与执行回执'" :description="isTech ? '技术端仅查看流程元数据；贡献内容、金额、积分、证据和执行回执均不可见。' : '贡献事实、奖励审批、影响指令和权威回执分别留痕；平台不直接付款。'">
    <template #actions><SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton></template>
    <SgjNoPermission v-if="!canRead" />
    <template v-else>
      <SgjCard v-if="!isTech && canCreate">
        <template #header><h2>建立奖励案例</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" data-field="subject" label="奖励案例主题" placeholder="奖励案例主题" required />
          <SgjInput v-model="ownerEmployeeId" data-field="owner-employee-id" label="受影响员工 ID" placeholder="受影响员工 ID" required />
          <SgjInput v-model="sourceFactKey" data-field="source-fact-key" label="唯一来源事实编号" placeholder="唯一来源事实编号" required />
          <SgjDateTime v-model="businessDate" label="业务日期" required />
          <SgjSelect v-model="employeeEventType" label="员工事件类型" :options="eventTypeOptions" />
          <SgjDateTime v-model="factOccurredAt" label="事实发生时间" mode="datetime" required />
          <SgjSelect v-model="impactLevel" label="贡献影响等级" :options="impactLevelOptions" />
          <SgjTextarea v-model="factSummary" label="可核验贡献事实摘要" placeholder="可核验贡献事实摘要" required />
          <SgjTextarea v-model="reason" label="奖励案例说明" placeholder="奖励案例说明" />
          <SgjTextarea v-model="evidenceNote" label="不可变来源证据" placeholder="不可变来源证据" required />
        </div>
        <template #footer><SgjButton :loading="isPending(createState)" @click="create">创建奖励案例</SgjButton></template>
      </SgjCard>
      <SgjCard v-if="!isTech">
        <template #header><h2>节点事实与外部权威引用</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="rewardLevel" label="建议或审批奖励等级" />
          <SgjSelect v-model="impactType" label="影响指令类型" :options="impactTypeOptions" />
          <SgjInput v-model="requestedPoints" label="申请荣誉积分" type="number" min="1" />
          <SgjInput v-model="approvedAmount" label="外部批准奖金金额" type="number" min="0.01" step="0.01" />
          <SgjInput v-model="authorityReference" label="影响指令权威依据" />
          <SgjInput v-model="instructionId" label="影响指令 ID" />
          <SgjSelect v-model="receiptType" label="权威回执类型" :options="receiptTypeOptions" />
          <SgjInput v-model="externalReference" label="外部权威回执编号" />
          <SgjDateTime v-model="externalOccurredAt" label="外部执行发生时间" mode="datetime" />
          <SgjInput v-model="resultSummary" label="节点结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点不可变证据" placeholder="节点不可变证据" />
        </div>
      </SgjCard>
      <SgjLoading v-if="isPending(listState) && records.length === 0" />
      <SgjNoPermission v-else-if="listState.failure === 'no-permission'" :description="listState.message" />
      <SgjError v-else-if="listState.failure === 'error'" title="奖励案例加载失败" :description="listState.message" :error-code="listState.errorCode" :trace-id="listState.traceId">
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message"><template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template></SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无奖励案例" />
      <div v-else class="phase11-records">
        <SgjRecordCard v-for="item in records" :key="item.id" class="record" :data-reward-id="item.id" :title="`${item.businessNo} · ${item.subject}`" :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`">
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>来源事实：{{ item.sourceFactKey }}；事件：{{ item.employeeEventType }}；影响：{{ item.impactLevel }}</p>
            <p>建议等级：{{ item.recommendedRewardLevel ?? '未登记' }}；批准等级：{{ item.approvedRewardLevel ?? '未登记' }}</p>
            <p>影响指令 {{ item.impacts.length }} 条；权威回执 {{ item.receipts.length }} 条</p>
            <ul v-if="item.impacts.length"><li v-for="impact in item.impacts" :key="impact.id">{{ impact.id }} · {{ impact.impactType }} · {{ impact.authorityReference }}</li></ul>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict v-if="actionState(item, candidate).failure === 'conflict'" :description="actionState(item, candidate).message" />
              <SgjError v-else-if="['error', 'no-permission'].includes(actionState(item, candidate).failure)" :title="`${candidate.label}失败`" :description="actionState(item, candidate).message" :error-code="actionState(item, candidate).errorCode" :trace-id="actionState(item, candidate).traceId" />
            </template>
          </template>
          <p v-else>贡献内容、奖励等级、金额、积分、证据、影响指令和执行回执已隐藏。</p>
          <template #actions><SgjButton v-for="candidate in actions(item)" :key="candidate.code" :data-action="candidate.code" :disabled="recordPending(item)" :loading="isPending(actionState(item, candidate))" @click="perform(item, candidate)">{{ candidate.label }}</SgjButton></template>
        </SgjRecordCard>
      </div>
      <SgjError v-if="['error', 'no-permission'].includes(createState.failure)" title="创建奖励案例失败" :description="createState.message" :error-code="createState.errorCode" :trace-id="createState.traceId" />
      <SgjConflict v-if="createState.failure === 'conflict'" :description="createState.message" />
    </template>
  </SgjListPageTemplate>
</template>

<style scoped>
.phase11-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--sgj-space-4); }
.phase11-records { display: grid; gap: var(--sgj-space-4); }
</style>
