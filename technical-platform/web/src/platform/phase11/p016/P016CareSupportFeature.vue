<script setup lang="ts">
import {
  SgjButton, SgjCard, SgjConflict, SgjEmpty, SgjError, SgjInput,
  SgjListPageTemplate, SgjLoading, SgjNoPermission, SgjRecordCard,
  SgjSelect, SgjStatusChip, SgjTextarea,
} from '@sgj/ui'
import P014DisciplinePage from '../../pages/P014DisciplinePage.vue'
import { isPending } from '../process-state'
import { useP016CareSupport } from './use-p016-care-support'
import type { P016Props } from './use-p016-care-support'

const props = defineProps<P016Props>()
const {
  cases, affectedEmployeeId, sourceFactKey, subject, reason, careType,
  requestedAmount, currency, costCenterId, externalBusinessRef, factSummary,
  authorityReference, consentScope, consentHash, approvedAmount, executionKind,
  externalReference, executedAmount, invoiceCode, invoiceNumber, invoiceAmount,
  invoiceImageSha256, confirmationOutcome, reconciliationOutcome, resultSummary,
  evidenceNote, isTech, canRead, canManage, showCare, showDiscipline, listState,
  createState, careTypeOptions, executionKindOptions, confirmationOptions,
  reconciliationOptions, load, createCase, perform, actions, actionState,
} = useP016CareSupport(props)
</script>

<template>
  <P014DisciplinePage v-if="showDiscipline" :portal="props.portal" mode="center" />
  <SgjListPageTemplate v-if="showCare" data-testid="p016-page" :title="isTech ? '员工关怀流程技术监控' : '员工关怀与福利支持'" :description="isTech ? '仅显示流程编号、节点和状态；员工、金额、材料、票据与证据均被屏蔽。' : '平台只记录人类授权决定和外部执行回执，不发起付款或代替审批。'">
    <template #actions><SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton></template>
    <SgjNoPermission v-if="!canRead" />
    <template v-else>
      <SgjCard v-if="!isTech && (canManage || props.mode === 'employee')">
        <template #header><h2>登记来源事实</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" label="关怀事项主题" placeholder="关怀事项主题" required />
          <SgjInput v-model="affectedEmployeeId" label="受影响员工 ID" placeholder="受影响员工 ID" required />
          <SgjInput v-model="sourceFactKey" label="唯一来源事实编号" placeholder="唯一来源事实编号" required />
          <SgjSelect v-model="careType" label="关怀类型" :options="careTypeOptions" />
          <SgjInput v-model="requestedAmount" label="申请金额" type="number" min="0" />
          <SgjInput v-model="currency" label="币种" placeholder="币种" />
          <SgjInput v-model="costCenterId" label="成本中心编号" placeholder="成本中心编号" />
          <SgjInput v-model="externalBusinessRef" label="外部业务参考号" placeholder="外部业务参考号" />
          <SgjTextarea v-model="factSummary" label="可核验来源事实摘要" placeholder="可核验来源事实摘要" required />
          <SgjTextarea v-model="reason" label="关怀申请说明" placeholder="关怀申请说明" />
          <SgjTextarea v-model="evidenceNote" label="不可变来源证据" placeholder="不可变来源证据" required />
        </div>
        <template #footer><SgjButton :loading="isPending(createState)" @click="createCase">创建关怀事项</SgjButton></template>
      </SgjCard>
      <SgjCard v-if="!isTech" data-testid="p016-action-fields">
        <template #header><h2>节点事实与外部回执</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="authorityReference" label="外部授权参考号" />
          <SgjInput v-model="consentScope" label="隐私授权范围" />
          <SgjInput v-model="consentHash" label="隐私授权 SHA-256" placeholder="隐私授权 SHA-256" />
          <SgjInput v-model="approvedAmount" label="批准金额" type="number" min="0" />
          <SgjSelect v-model="executionKind" label="外部执行类型" :options="executionKindOptions" />
          <SgjInput v-model="externalReference" label="外部执行参考号" />
          <SgjInput v-model="executedAmount" label="外部执行金额" type="number" min="0" />
          <SgjInput v-model="invoiceCode" label="发票代码（可选）" />
          <SgjInput v-model="invoiceNumber" label="发票号码（可选）" />
          <SgjInput v-model="invoiceAmount" label="发票金额" type="number" min="0" />
          <SgjInput v-model="invoiceImageSha256" label="发票影像 SHA-256" />
          <SgjSelect v-model="confirmationOutcome" label="员工确认结果" :options="confirmationOptions" />
          <SgjSelect v-model="reconciliationOutcome" label="对账结果" :options="reconciliationOptions" />
          <SgjInput v-model="resultSummary" label="节点结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点不可变证据" placeholder="节点不可变证据" />
        </div>
      </SgjCard>
      <SgjLoading v-if="isPending(listState) && cases.length === 0" />
      <SgjNoPermission v-else-if="listState.failure === 'no-permission'" :description="listState.message" />
      <SgjError v-else-if="listState.failure === 'error'" title="关怀事项加载失败" :description="listState.message" :error-code="listState.errorCode" :trace-id="listState.traceId"><template #actions><SgjButton @click="load">重试</SgjButton></template></SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message"><template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template></SgjConflict>
      <SgjEmpty v-else-if="cases.length === 0" title="暂无可见关怀事项" />
      <div v-else class="phase11-records">
        <SgjRecordCard v-for="item in cases" :key="item.id" class="record" :data-care-id="item.id" :title="`${item.businessNo} · ${item.subject}`" :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`">
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>{{ item.careType }} · {{ item.requestedAmount }} {{ item.currency }}</p>
            <p v-if="item.eligibility">资格 {{ item.eligibility.outcome }} · {{ item.eligibility.authorityReference }}</p>
            <p v-if="item.approval">审批 {{ item.approval.outcome }} · {{ item.approval.approvedAmount }}</p>
            <p v-if="item.execution">外部回执 {{ item.execution.executionKind }} · {{ item.execution.externalReference }}</p>
            <p v-if="item.confirmation">员工确认 {{ item.confirmation.outcome }}</p>
            <p v-if="item.reconciliation">对账 {{ item.reconciliation.outcome }}</p>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict v-if="actionState(item, candidate).failure === 'conflict'" :description="actionState(item, candidate).message" />
              <SgjError v-else-if="['error', 'no-permission'].includes(actionState(item, candidate).failure)" :title="`${candidate.label}失败`" :description="actionState(item, candidate).message" :error-code="actionState(item, candidate).errorCode" :trace-id="actionState(item, candidate).traceId" />
            </template>
          </template>
          <p v-else>员工、金额、材料、票据、来源事实和事件证据已屏蔽；技术端仅显示流程元数据。</p>
          <template #actions><SgjButton v-for="candidate in actions(item)" :key="candidate.code" :data-action="candidate.code" :loading="isPending(actionState(item, candidate))" @click="perform(item, candidate)">{{ candidate.label }}</SgjButton></template>
        </SgjRecordCard>
      </div>
      <SgjError v-if="['error', 'no-permission'].includes(createState.failure)" title="创建关怀事项失败" :description="createState.message" :error-code="createState.errorCode" :trace-id="createState.traceId" />
      <SgjConflict v-if="createState.failure === 'conflict'" :description="createState.message" />
    </template>
  </SgjListPageTemplate>
</template>

<style scoped>
.phase11-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--sgj-space-4); }
.phase11-records { display: grid; gap: var(--sgj-space-4); }
</style>
