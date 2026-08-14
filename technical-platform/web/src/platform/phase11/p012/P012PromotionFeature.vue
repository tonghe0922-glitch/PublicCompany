<script setup lang="ts">
import {
  SgjButton, SgjCard, SgjCheckbox, SgjConflict, SgjDateTime, SgjEmpty,
  SgjError, SgjInput, SgjListPageTemplate, SgjLoading, SgjNoPermission,
  SgjRecordCard, SgjSelect, SgjStatusChip, SgjTextarea,
} from '@sgj/ui'
import { isPending } from '../process-state'
import { useP012Promotion } from './use-p012-promotion'
import type { P012Props } from './use-p012-promotion'

const props = defineProps<P012Props>()
const {
  records, businessDate, subject, reason, ownerEmployeeId, employmentType, headcountNo,
  periodOrCourseNo, targetPositionCode, plannedEffectiveDate, score1000,
  eligibilityConfirmed, freezeClear, vacancyConfirmed, budgetVerificationReference,
  reviewPassed, approved, salaryConfirmationReference, externalReference,
  probationResult, actualEffectiveDate, resultSummary, evidenceNote, isTech, canRead,
  canCreate, listState, createState, employmentOptions, probationOptions,
  load, create, perform, actions, actionState,
} = useP012Promotion(props)
</script>

<template>
  <SgjListPageTemplate
    data-testid="p012-page"
    :title="isTech ? '晋升与任命流程元数据监控' : '晋升申请、评审与任命'"
    :description="isTech ? '技术端仅查看流程状态；人员、分数、薪资权威引用、证据与任命执行均已隐藏。' : '审批不等于生效；薪资只登记外部权威回执。'"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton>
    </template>
    <SgjNoPermission v-if="!canRead" />
    <template v-else>
      <SgjCard v-if="!isTech && canCreate">
        <template #header><h2>发起申请或组织提名</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" data-field="subject" label="晋升主题" placeholder="晋升主题" required />
          <SgjInput v-model="ownerEmployeeId" data-field="owner-employee-id" label="员工 ID" placeholder="员工 ID" required />
          <SgjDateTime v-model="businessDate" label="业务日期" required />
          <SgjSelect v-model="employmentType" label="用工类型" :options="employmentOptions" />
          <SgjInput v-model="headcountNo" label="编制编号" placeholder="编制编号" />
          <SgjInput v-model="periodOrCourseNo" label="周期或批次编号" placeholder="周期或批次编号" required />
          <SgjInput v-model="targetPositionCode" data-field="target-position-code" label="目标岗位编码" placeholder="目标岗位编码" required />
          <SgjDateTime v-model="plannedEffectiveDate" label="计划生效日期" required />
          <SgjTextarea v-model="reason" label="申请或提名原因" placeholder="申请或提名原因" />
          <SgjTextarea v-model="evidenceNote" label="不可变来源证据" placeholder="不可变来源证据" required />
        </div>
        <template #footer><SgjButton :loading="isPending(createState)" @click="create">创建晋升申请</SgjButton></template>
      </SgjCard>
      <SgjCard v-if="!isTech">
        <template #header><h2>节点事实与外部权威引用</h2></template>
        <div class="phase11-form-grid">
          <SgjCheckbox v-model="eligibilityConfirmed" label="资格已确认" />
          <SgjCheckbox v-model="freezeClear" label="冻结状态已清除" />
          <SgjInput v-model="score1000" label="千分制评估" type="number" min="0" max="1000" />
          <SgjCheckbox v-model="vacancyConfirmed" label="岗位空缺已确认" />
          <SgjInput v-model="budgetVerificationReference" label="外部预算核验引用" />
          <SgjCheckbox v-model="reviewPassed" label="独立评审通过" />
          <SgjCheckbox v-model="approved" label="审批通过" />
          <SgjInput v-model="salaryConfirmationReference" label="薪资权威确认引用（不计算薪资）" />
          <SgjInput v-model="externalReference" label="外部任命或生效引用" />
          <SgjSelect v-model="probationResult" label="验证期结果" :options="probationOptions" />
          <SgjDateTime v-model="actualEffectiveDate" label="实际生效或回退日期" />
          <SgjInput v-model="resultSummary" label="结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点不可变证据" placeholder="节点不可变证据" />
        </div>
      </SgjCard>
      <SgjLoading v-if="isPending(listState) && records.length === 0" />
      <SgjNoPermission v-else-if="listState.failure === 'no-permission'" :description="listState.message" />
      <SgjError
        v-else-if="listState.failure === 'error'"
        title="晋升申请加载失败"
        :description="listState.message"
        :error-code="listState.errorCode"
        :trace-id="listState.traceId"
      >
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message">
        <template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template>
      </SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无晋升申请" />
      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in records"
          :key="item.id"
          class="record"
          :data-promotion-id="item.id"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
        >
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>目标岗位：{{ item.targetPositionCode }}；计划生效：{{ item.plannedEffectiveDate }}；评估：{{ item.score1000 ?? '未登记' }}</p>
            <p>任命执行事实：{{ item.executions.length }}</p>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict v-if="actionState(item, candidate).failure === 'conflict'" :description="actionState(item, candidate).message" />
              <SgjError
                v-else-if="['error', 'no-permission'].includes(actionState(item, candidate).failure)"
                :title="`${candidate.label}失败`"
                :description="actionState(item, candidate).message"
                :error-code="actionState(item, candidate).errorCode"
                :trace-id="actionState(item, candidate).traceId"
              />
            </template>
          </template>
          <p v-else>人员、分数、薪资引用、证据和任命执行已隐藏。</p>
          <template #actions>
            <SgjButton
              v-for="candidate in actions(item)"
              :key="candidate.code"
              :data-action="candidate.code"
              :loading="isPending(actionState(item, candidate))"
              @click="perform(item, candidate)"
            >{{ candidate.label }}</SgjButton>
          </template>
        </SgjRecordCard>
      </div>
      <SgjError
        v-if="['error', 'no-permission'].includes(createState.failure)"
        title="创建晋升申请失败"
        :description="createState.message"
        :error-code="createState.errorCode"
        :trace-id="createState.traceId"
      />
      <SgjConflict v-if="createState.failure === 'conflict'" :description="createState.message" />
    </template>
  </SgjListPageTemplate>
</template>

<style scoped>
.phase11-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--sgj-space-4); }
.phase11-records { display: grid; gap: var(--sgj-space-4); }
</style>
