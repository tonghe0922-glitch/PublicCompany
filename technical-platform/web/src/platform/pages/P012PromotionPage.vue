<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import {
  SgjButton,
  SgjCard,
  SgjCheckbox,
  SgjConflict,
  SgjDateTime,
  SgjEmpty,
  SgjError,
  SgjInput,
  SgjListPageTemplate,
  SgjLoading,
  SgjNoPermission,
  SgjRecordCard,
  SgjSelect,
  SgjStatusChip,
  SgjTextarea,
} from '../../design-system'
import { usePortalSessionStore } from '../../session'
import {
  createProcessRecord,
  executeProcessAction,
  listProcessRecords,
} from '../phase11/process-client'
import { isPending } from '../phase11/process-state'
import type { ProcessState } from '../phase11/process-state'
import { useProcessOperation } from '../phase11/use-process-operation'
import type { PortalDefinition } from '../portal-config'

type Mode = 'employee' | 'center' | 'tech'

interface EventFact {
  id: string
  eventType: string
}

interface ExecutionFact {
  id: string
  executionType: string
  effectiveDate: string
  externalReference: string
}

interface RequestRecord {
  id: string
  businessNo: string
  currentNodeCode: string | null
  status: string
  versionNo: number
  subject: string
  reason: string | null
  ownerEmployeeId: string
  personName: string | null
  personNo: string | null
  targetPositionCode: string
  plannedEffectiveDate: string
  score1000: number | null
  events: EventFact[]
  executions: ExecutionFact[]
}

interface Action {
  code: string
  label: string
  permission: string
}

const COLLECTION = '/api/v1/processes/P012/promotion-requests'
const props = defineProps<{ portal: PortalDefinition; mode: Mode }>()
const session = usePortalSessionStore()
const operations = useProcessOperation()
const records = ref<RequestRecord[]>([])
const businessDate = ref(new Date().toISOString().slice(0, 10))
const subject = ref('')
const reason = ref('')
const ownerEmployeeId = ref('')
const employmentType = ref('FULL_TIME')
const headcountNo = ref('')
const periodOrCourseNo = ref('')
const targetPositionCode = ref('')
const plannedEffectiveDate = ref('')
const score1000 = ref('')
const eligibilityConfirmed = ref(false)
const freezeClear = ref(false)
const vacancyConfirmed = ref(false)
const budgetVerificationReference = ref('')
const reviewPassed = ref(false)
const approved = ref(false)
const salaryConfirmationReference = ref('')
const externalReference = ref('')
const probationResult = ref('PASS')
const actualEffectiveDate = ref('')
const resultSummary = ref('')
const evidenceNote = ref('')

const isTech = computed(() => props.mode === 'tech')
const canRead = computed(
  () => session.can('p012.promotion.read') || session.can('p012.promotion.monitor'),
)
const canCreate = computed(
  () => session.can('p012.promotion.read') || session.can('p012.promotion.manage'),
)
const listState = computed(() => operations.resourceState('promotions'))
const createState = computed(() => operations.actionState('create'))

const employmentOptions = [
  { value: 'FULL_TIME', label: '正式员工' },
  { value: 'CONTRACT', label: '合同员工' },
] as const
const probationOptions = [
  { value: 'PASS', label: '通过' },
  { value: 'ROLLBACK', label: '回退' },
] as const

const ACTIONS: Record<string, Action[]> = {
  S01: [{ code: 'SUBMIT', label: '提交申请或提名', permission: 'p012.promotion.read' }],
  S02: [{ code: 'CHECK_ELIGIBILITY', label: '完成资格与冻结审查', permission: 'p012.promotion.manage' }],
  S03: [{ code: 'RECORD_ASSESSMENT', label: '登记千分制评估', permission: 'p012.promotion.review' }],
  S04: [{ code: 'VERIFY_VACANCY_BUDGET', label: '核验岗位空缺与预算', permission: 'p012.promotion.manage' }],
  S05: [{ code: 'COMPLETE_REVIEW', label: '完成独立竞聘评审', permission: 'p012.promotion.review' }],
  S06: [{ code: 'APPROVE', label: '审批', permission: 'p012.promotion.approve' }],
  S07: [{ code: 'COMPLETE_NOTICE', label: '完成公示与告知', permission: 'p012.promotion.manage' }],
  S08: [
    { code: 'RECORD_APPOINTMENT', label: '登记任命与薪资权威回执', permission: 'p012.promotion.appoint' },
    { code: 'CONFIRM_APPOINTMENT', label: '员工确认任命', permission: 'p012.promotion.read' },
  ],
  S09: [{ code: 'COMPLETE_PROBATION', label: '完成验证期', permission: 'p012.promotion.review' }],
  S10: [
    { code: 'MAKE_EFFECTIVE', label: '正式生效', permission: 'p012.promotion.appoint' },
    { code: 'ROLL_BACK', label: '登记回退安排', permission: 'p012.promotion.appoint' },
  ],
}

watchEffect(() => {
  if (!ownerEmployeeId.value && session.session?.employeeId) {
    ownerEmployeeId.value = session.session.employeeId
  }
})

function evidence() {
  return { note: evidenceNote.value.trim(), recordedAt: new Date().toISOString() }
}

async function load(): Promise<void> {
  if (!canRead.value) return
  const result = await operations.runResource('promotions', () =>
    listProcessRecords<RequestRecord>(session, COLLECTION))
  if (result) records.value = result
}

async function create(): Promise<void> {
  const body = {
    businessDate: businessDate.value,
    subject: subject.value.trim(),
    reason: reason.value.trim() || null,
    ownerEmployeeId: ownerEmployeeId.value.trim(),
    employmentType: employmentType.value,
    headcountNo: headcountNo.value.trim() || null,
    periodOrCourseNo: periodOrCourseNo.value.trim(),
    targetPositionCode: targetPositionCode.value.trim(),
    plannedEffectiveDate: plannedEffectiveDate.value,
    evidence: evidence(),
  }
  const created = await operations.runAction(
    'create',
    () => createProcessRecord<RequestRecord, typeof body>(
      session,
      COLLECTION,
      'p012-create',
      body,
    ),
    '晋升申请已创建。',
  )
  if (created) await load()
}

const actionPayloads: Record<string, () => Record<string, unknown>> = {
  CHECK_ELIGIBILITY: () => ({
    eligibilityConfirmed: eligibilityConfirmed.value,
    freezeClear: freezeClear.value,
  }),
  RECORD_ASSESSMENT: () => ({ score1000: Number(score1000.value) }),
  VERIFY_VACANCY_BUDGET: () => ({
    vacancyConfirmed: vacancyConfirmed.value,
    budgetVerificationReference: budgetVerificationReference.value.trim(),
  }),
  COMPLETE_REVIEW: () => ({ reviewPassed: reviewPassed.value }),
  APPROVE: () => ({ approved: approved.value }),
  RECORD_APPOINTMENT: () => ({
    salaryConfirmationReference: salaryConfirmationReference.value.trim(),
    externalReference: externalReference.value.trim(),
    actualEffectiveDate: actualEffectiveDate.value,
  }),
  COMPLETE_PROBATION: () => ({ probationResult: probationResult.value }),
  MAKE_EFFECTIVE: () => ({
    externalReference: externalReference.value.trim(),
    actualEffectiveDate: actualEffectiveDate.value,
  }),
  ROLL_BACK: () => ({
    externalReference: externalReference.value.trim(),
    actualEffectiveDate: actualEffectiveDate.value,
  }),
}

function actionBody(item: RequestRecord, action: Action) {
  return {
    expectedVersion: item.versionNo,
    score1000: null,
    eligibilityConfirmed: null,
    freezeClear: null,
    vacancyConfirmed: null,
    budgetVerificationReference: null,
    reviewPassed: null,
    approved: null,
    salaryConfirmationReference: null,
    externalReference: null,
    probationResult: null,
    actualEffectiveDate: null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: evidence(),
    ...(actionPayloads[action.code]?.() ?? {}),
  }
}

async function perform(item: RequestRecord, action: Action): Promise<void> {
  const operationKey = `${item.id}:${action.code}`
  const moved = await operations.runAction(
    operationKey,
    () => executeProcessAction<RequestRecord, ReturnType<typeof actionBody>>(
      session,
      COLLECTION,
      item.id,
      action.code,
      `p012-${action.code.toLowerCase()}`,
      actionBody(item, action),
    ),
    `${action.label}已完成。`,
  )
  if (moved) await load()
}

function actions(item: RequestRecord): Action[] {
  if (isTech.value || !item.currentNodeCode) return []
  return (ACTIONS[item.currentNodeCode] ?? []).filter(
    (action) => session.can(action.permission)
      || (action.code === 'SUBMIT' && session.can('p012.promotion.manage')),
  )
}

function actionState(item: RequestRecord, action: Action): ProcessState {
  return operations.actionState(`${item.id}:${action.code}`)
}

onMounted(() => {
  if (canRead.value) void load()
})
</script>

<template>
  <SgjListPageTemplate
    data-testid="p012-page"
    :title="isTech ? '晋升与任命流程元数据监控' : '晋升申请、评审与任命'"
    :description="isTech ? '技术端仅查看流程状态；人员、分数、薪资权威引用、证据与任命执行均已隐藏。' : '审批不等于生效；薪资只登记外部权威回执。'"
  >
    <template #actions>
      <SgjButton
        variant="secondary"
        :disabled="!canRead"
        :loading="isPending(listState)"
        @click="load"
      >刷新</SgjButton>
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
        <template #footer>
          <SgjButton :loading="isPending(createState)" @click="create">创建晋升申请</SgjButton>
        </template>
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
      <SgjNoPermission
        v-else-if="listState.failure === 'no-permission'"
        :description="listState.message"
      />
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
            <template v-for="action in actions(item)" :key="action.code">
              <SgjConflict
                v-if="actionState(item, action).failure === 'conflict'"
                :description="actionState(item, action).message"
              />
              <SgjError
                v-else-if="actionState(item, action).failure === 'error' || actionState(item, action).failure === 'no-permission'"
                :title="`${action.label}失败`"
                :description="actionState(item, action).message"
                :error-code="actionState(item, action).errorCode"
                :trace-id="actionState(item, action).traceId"
              />
            </template>
          </template>
          <p v-else>人员、分数、薪资引用、证据和任命执行已隐藏。</p>
          <template #actions>
            <SgjButton
              v-for="action in actions(item)"
              :key="action.code"
              :data-action="action.code"
              :loading="isPending(actionState(item, action))"
              @click="perform(item, action)"
            >{{ action.label }}</SgjButton>
          </template>
        </SgjRecordCard>
      </div>

      <SgjError
        v-if="createState.failure === 'error' || createState.failure === 'no-permission'"
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
.phase11-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--sgj-space-4);
}

.phase11-records {
  display: grid;
  gap: var(--sgj-space-4);
}
</style>
