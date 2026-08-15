<script setup lang="ts">
import {
  SgjButton, SgjCard, SgjCheckbox, SgjConflict, SgjDateTime, SgjEmpty,
  SgjError, SgjInput, SgjListPageTemplate, SgjLoading, SgjNoPermission,
  SgjPartialFailure, SgjRecordCard, SgjSelect, SgjStatusChip, SgjTextarea,
} from '@sgj/ui'
import { isPending } from '../process-state'
import { useP015PointLedger } from './use-p015-point-ledger'
import type { P015Props } from './use-p015-point-ledger'

const props = defineProps<P015Props>()
const {
  records, rules, affectedEmployeeId, sourceFactKey, subject, reason, pointKind,
  quantity, businessObjectNo, businessObjectName, employeeEventType, factSummary,
  evidenceNote, resultSummary, adjustmentRequested, adjustmentPoints, adjustmentReason,
  adjustmentApproved, ruleCode, ruleVersionNo, ruleEventType, unitPoints, minPoints,
  maxPoints, reviewThreshold, effectiveFrom, effectiveTo, rankCode, rankMin, rankMax,
  isTech, canRead, canManage, transactionState, ruleState, createTransactionState,
  createRuleState, partialFailure, pointKindOptions, load, loadTransactions,
  createTransaction, createRule, publish, perform, actions, actionState, publishState,
  recordPending, rulePending,
} = useP015PointLedger(props)
</script>

<template>
  <SgjListPageTemplate data-testid="p015-page" :title="isTech ? '积分规则与流程监控' : '成长积分与荣誉积分不可变账本'" :description="isTech ? '技术端配置版本化规则并查看流程元数据，不代替业务审核或调整积分。' : '每次奖励、调整和冲销均形成新账本事实；已入账记录不可覆盖。'">
    <template #actions><SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(transactionState)" @click="load">刷新</SgjButton></template>
    <SgjNoPermission v-if="!canRead" />
    <template v-else>
      <SgjPartialFailure v-if="partialFailure" description="积分记录与规则中有一项加载失败，已保留成功返回的内容。">
        <template #details>
          <p v-if="transactionState.failure !== 'none'">积分记录：{{ transactionState.message }}</p>
          <p v-if="ruleState.failure !== 'none'">规则版本：{{ ruleState.message }}</p>
        </template>
        <template #actions><SgjButton @click="load">重试失败资源</SgjButton></template>
      </SgjPartialFailure>
      <SgjCard v-if="isTech && canManage">
        <template #header><h2>创建规则草稿</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="ruleCode" label="规则编码" placeholder="规则编码" required />
          <SgjInput v-model="ruleVersionNo" label="规则版本" type="number" min="1" />
          <SgjSelect v-model="pointKind" label="积分类型" :options="pointKindOptions" />
          <SgjInput v-model="ruleEventType" label="业务事件类型" placeholder="业务事件类型" />
          <SgjInput v-model="unitPoints" label="单位积分" type="number" />
          <SgjInput v-model="minPoints" label="单次最低积分" type="number" />
          <SgjInput v-model="maxPoints" label="单次最高积分" type="number" />
          <SgjInput v-model="reviewThreshold" label="人工复核阈值" type="number" min="1" />
          <SgjDateTime v-model="effectiveFrom" label="生效时间" mode="datetime" />
          <SgjDateTime v-model="effectiveTo" label="失效时间" mode="datetime" />
          <SgjInput v-model="rankCode" label="等级编码" placeholder="等级编码" />
          <SgjInput v-model="rankMin" label="等级最低余额" type="number" />
          <SgjInput v-model="rankMax" label="等级最高余额" type="number" />
        </div>
        <template #footer><SgjButton :loading="isPending(createRuleState)" @click="createRule">保存规则草稿</SgjButton></template>
      </SgjCard>
      <SgjCard v-if="isTech">
        <template #header><h2>规则版本</h2></template>
        <SgjLoading v-if="isPending(ruleState) && rules.length === 0" />
        <SgjEmpty v-else-if="rules.length === 0" title="暂无规则版本" />
        <div v-else class="phase11-records">
          <SgjRecordCard v-for="rule in rules" :key="rule.rule.id" class="record" :data-rule-id="rule.rule.id" :title="`${rule.rule.ruleCode} · v${rule.rule.versionNo}`" :subtitle="`${rule.rule.pointKind} / ${rule.rule.eventType}`">
            <template #status><SgjStatusChip>{{ rule.status }}</SgjStatusChip></template>
            <p>单位 {{ rule.rule.unitPoints }}；边界 {{ rule.rule.minPoints }} 至 {{ rule.rule.maxPoints }}</p>
            <SgjConflict
              v-if="publishState(rule).failure === 'conflict'"
              :description="publishState(rule).message"
            />
            <SgjError
              v-else-if="['error', 'no-permission'].includes(publishState(rule).failure)"
              title="发布规则版本失败"
              :description="publishState(rule).message"
              :error-code="publishState(rule).errorCode"
              :trace-id="publishState(rule).traceId"
            />
            <template #actions><SgjButton v-if="canManage && rule.status === 'DRAFT'" :disabled="rulePending(rule)" :loading="isPending(publishState(rule))" @click="publish(rule)">发布规则版本</SgjButton></template>
          </SgjRecordCard>
        </div>
      </SgjCard>
      <SgjCard v-if="props.mode === 'center' && canManage">
        <template #header><h2>登记来源业务事实</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" label="积分业务主题" placeholder="积分业务主题" required />
          <SgjInput v-model="affectedEmployeeId" label="受影响员工 ID" placeholder="受影响员工 ID" required />
          <SgjInput v-model="sourceFactKey" label="唯一来源事实编号" placeholder="唯一来源事实编号" required />
          <SgjSelect v-model="pointKind" label="积分类型" :options="pointKindOptions" />
          <SgjInput v-model="quantity" label="事实数量" type="number" min="1" />
          <SgjInput v-model="businessObjectNo" label="业务对象编号" placeholder="业务对象编号" />
          <SgjInput v-model="businessObjectName" label="业务对象名称" placeholder="业务对象名称" />
          <SgjInput v-model="employeeEventType" label="业务事件类型" placeholder="业务事件类型" />
          <SgjTextarea v-model="factSummary" label="可核验事实摘要" placeholder="可核验事实摘要" required />
          <SgjTextarea v-model="reason" label="积分登记说明" placeholder="积分登记说明" />
          <SgjTextarea v-model="evidenceNote" label="不可变来源证据" placeholder="不可变来源证据" required />
        </div>
        <template #footer><SgjButton :loading="isPending(createTransactionState)" @click="createTransaction">创建积分业务</SgjButton></template>
      </SgjCard>
      <SgjCard v-if="!isTech">
        <template #header><h2>节点证据与申诉选择</h2></template>
        <div class="phase11-form-grid">
          <SgjCheckbox v-model="adjustmentRequested" label="申请调整或冲销" />
          <SgjInput v-model="adjustmentPoints" label="调整积分" placeholder="调整积分" type="number" />
          <SgjInput v-model="adjustmentReason" label="调整理由" placeholder="调整理由" />
          <SgjCheckbox v-model="adjustmentApproved" label="独立复核批准调整" />
          <SgjInput v-model="resultSummary" label="节点结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点不可变证据" placeholder="节点不可变证据" />
        </div>
      </SgjCard>
      <SgjLoading v-if="isPending(transactionState) && records.length === 0" />
      <SgjNoPermission v-else-if="transactionState.failure === 'no-permission' && !partialFailure" :description="transactionState.message" />
      <SgjError v-else-if="transactionState.failure === 'error' && !partialFailure" title="积分记录加载失败" :description="transactionState.message" :error-code="transactionState.errorCode" :trace-id="transactionState.traceId"><template #actions><SgjButton @click="loadTransactions">重试</SgjButton></template></SgjError>
      <SgjConflict v-else-if="transactionState.failure === 'conflict'" :description="transactionState.message" />
      <SgjEmpty v-else-if="records.length === 0" title="暂无可见积分记录" />
      <div v-else class="phase11-records">
        <SgjRecordCard v-for="item in records" :key="item.id" class="record" :data-point-id="item.id" :title="`${item.businessNo} · ${item.subject}`" :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`">
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>类型 {{ item.pointKind }}；规则 {{ item.ruleCode }} v{{ item.ruleVersionNo }}；计算 {{ item.calculatedPoints }}；入账 {{ item.cappedPoints }}</p>
            <p v-if="item.posting">{{ item.posting.postingMode }} · {{ item.posting.riskGrade }}</p>
            <p v-if="item.balance">有效余额 {{ item.balance.effectiveBalance }} · 等级 {{ item.balance.rankCode }}</p>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict v-if="actionState(item, candidate).failure === 'conflict'" :description="actionState(item, candidate).message" />
              <SgjError v-else-if="['error', 'no-permission'].includes(actionState(item, candidate).failure)" :title="`${candidate.label}失败`" :description="actionState(item, candidate).message" :error-code="actionState(item, candidate).errorCode" :trace-id="actionState(item, candidate).traceId" />
            </template>
          </template>
          <p v-else>员工、来源、积分值、等级和证据已隐藏；技术端仅显示流程元数据。</p>
          <template #actions><SgjButton v-for="candidate in actions(item)" :key="candidate.code" :data-action="candidate.code" :disabled="recordPending(item)" :loading="isPending(actionState(item, candidate))" @click="perform(item, candidate)">{{ candidate.label }}</SgjButton></template>
        </SgjRecordCard>
      </div>
      <SgjError
        v-if="['error', 'no-permission'].includes(createTransactionState.failure) || ['error', 'no-permission'].includes(createRuleState.failure)"
        title="保存失败"
        :description="createTransactionState.message || createRuleState.message"
        :error-code="createTransactionState.errorCode || createRuleState.errorCode"
        :trace-id="createTransactionState.traceId || createRuleState.traceId"
      />
      <SgjConflict
        v-if="createTransactionState.failure === 'conflict' || createRuleState.failure === 'conflict'"
        :description="createTransactionState.message || createRuleState.message"
      />
    </template>
  </SgjListPageTemplate>
</template>

<style scoped>
.phase11-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--sgj-space-4); }
.phase11-records { display: grid; gap: var(--sgj-space-4); }
</style>
