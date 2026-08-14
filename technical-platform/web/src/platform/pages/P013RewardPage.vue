<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import {
  SgjButton,
  SgjCard,
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

interface ImpactInstruction {
  id: string
  impactType: string
  requestedPoints: number | null
  approvedAmount: number | null
  authorityReference: string
}

interface ImpactReceipt {
  id: string
  instructionId: string
  receiptType: string
  externalReference: string
}

interface RewardCase {
  id: string
  businessNo: string
  currentNodeCode: string | null
  status: string
  versionNo: number
  subject: string
  reason: string | null
  ownerEmployeeId: string
  sourceFactKey: string
  employeeEventType: string
  factSummary: string | null
  impactLevel: string
  recommendedRewardLevel: string | null
  approvedRewardLevel: string | null
  events: EventFact[]
  impacts: ImpactInstruction[]
  receipts: ImpactReceipt[]
}

interface Action {
  code: string
  label: string
  permission: string
}

const COLLECTION = '/api/v1/processes/P013/reward-cases'
const props = defineProps<{ portal: PortalDefinition; mode: Mode }>()
const session = usePortalSessionStore()
const operations = useProcessOperation()
const records = ref<RewardCase[]>([])
const businessDate = ref(new Date().toISOString().slice(0, 10))
const subject = ref('')
const reason = ref('')
const ownerEmployeeId = ref('')
const sourceFactKey = ref('')
const employeeEventType = ref('SERVICE_CONTRIBUTION')
const factOccurredAt = ref(new Date().toISOString().slice(0, 16))
const factSummary = ref('')
const impactLevel = ref('HIGH')
const rewardLevel = ref('GOLD')
const impactType = ref('HONOR_POINTS')
const requestedPoints = ref('')
const approvedAmount = ref('')
const authorityReference = ref('')
const instructionId = ref('')
const receiptType = ref('P015_POINT_LEDGER')
const externalReference = ref('')
const externalOccurredAt = ref(new Date().toISOString().slice(0, 16))
const resultSummary = ref('')
const evidenceNote = ref('')

const isTech = computed(() => props.mode === 'tech')
const canRead = computed(
  () => session.can('p013.reward.read') || session.can('p013.reward.monitor'),
)
const canCreate = computed(() => session.can('p013.reward.manage'))
const listState = computed(() => operations.resourceState('rewards'))
const createState = computed(() => operations.actionState('create'))

const eventTypeOptions = [
  { value: 'SERVICE_CONTRIBUTION', label: '服务贡献' },
  { value: 'INNOVATION', label: '创新贡献' },
  { value: 'EMERGENCY_RESPONSE', label: '应急响应' },
] as const
const impactLevelOptions = [
  { value: 'HIGH', label: '高' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' },
] as const
const impactTypeOptions = [
  { value: 'HONOR_POINTS', label: '荣誉积分' },
  { value: 'BONUS', label: '外部奖金' },
  { value: 'DEVELOPMENT', label: '发展机会' },
] as const
const receiptTypeOptions = [
  { value: 'P015_POINT_LEDGER', label: 'P015 积分账本' },
  { value: 'FINANCE_BONUS', label: '财务奖金回执' },
  { value: 'HR_DEVELOPMENT', label: '人力发展回执' },
] as const

const ACTIONS: Record<string, Action[]> = {
  S01: [{ code: 'RECORD_CONTRIBUTION', label: '确认贡献事实', permission: 'p013.reward.manage' }],
  S02: [{ code: 'VERIFY_EVIDENCE', label: '完成证据核验', permission: 'p013.reward.manage' }],
  S03: [{ code: 'RECOMMEND_LEVEL', label: '提交奖励等级建议', permission: 'p013.reward.review' }],
  S04: [{ code: 'APPROVE', label: '独立审批奖励等级', permission: 'p013.reward.approve' }],
  S05: [{ code: 'CHECK_DUPLICATE', label: '独立复核重复奖励', permission: 'p013.reward.review' }],
  S06: [
    { code: 'RECORD_IMPACT', label: '登记影响指令', permission: 'p013.reward.execute' },
    { code: 'COMPLETE_IMPACTS', label: '完成影响指令登记', permission: 'p013.reward.execute' },
  ],
  S07: [{ code: 'CONFIRM_NOTICE', label: '员工确认奖励告知', permission: 'p013.reward.read' }],
  S08: [
    { code: 'RECORD_RECEIPT', label: '登记权威执行回执', permission: 'p013.reward.execute' },
    { code: 'COMPLETE_RECEIPTS', label: '完成全部回执核验', permission: 'p013.reward.execute' },
  ],
  S09: [{ code: 'ARCHIVE', label: '归档奖励案例', permission: 'p013.reward.manage' }],
}

watchEffect(() => {
  if (!ownerEmployeeId.value && session.session?.employeeId) {
    ownerEmployeeId.value = session.session.employeeId
  }
})

function evidence() {
  return { note: evidenceNote.value.trim(), recordedAt: new Date().toISOString() }
}

function instant(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function optionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null
}

async function load(): Promise<void> {
  if (!canRead.value) return
  const result = await operations.runResource('rewards', () =>
    listProcessRecords<RewardCase>(session, COLLECTION))
  if (result) records.value = result
}

async function create(): Promise<void> {
  const body = {
    businessDate: businessDate.value,
    subject: subject.value.trim(),
    reason: reason.value.trim() || null,
    ownerEmployeeId: ownerEmployeeId.value.trim(),
    sourceFactKey: sourceFactKey.value.trim(),
    employeeEventType: employeeEventType.value,
    factOccurredAt: instant(factOccurredAt.value),
    factSummary: factSummary.value.trim(),
    impactLevel: impactLevel.value,
    evidence: evidence(),
  }
  const created = await operations.runAction(
    'create',
    () => createProcessRecord<RewardCase, typeof body>(session, COLLECTION, 'p013-create', body),
    '奖励案例已创建。',
  )
  if (created) await load()
}

const actionPayloads: Record<string, () => Record<string, unknown>> = {
  RECOMMEND_LEVEL: () => ({ rewardLevel: rewardLevel.value.trim() }),
  APPROVE: () => ({ rewardLevel: rewardLevel.value.trim() }),
  RECORD_IMPACT: () => ({
    impactType: impactType.value,
    requestedPoints: optionalNumber(requestedPoints.value),
    approvedAmount: optionalNumber(approvedAmount.value),
    authorityReference: authorityReference.value.trim(),
  }),
  RECORD_RECEIPT: () => ({
    instructionId: instructionId.value.trim() || null,
    receiptType: receiptType.value,
    externalReference: externalReference.value.trim(),
    externalOccurredAt: instant(externalOccurredAt.value),
  }),
}

function actionBody(item: RewardCase, action: Action) {
  return {
    expectedVersion: item.versionNo,
    rewardLevel: null,
    impactType: null,
    requestedPoints: null,
    approvedAmount: null,
    authorityReference: null,
    instructionId: null,
    receiptType: null,
    externalReference: null,
    externalOccurredAt: null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: evidence(),
    ...(actionPayloads[action.code]?.() ?? {}),
  }
}

async function perform(item: RewardCase, action: Action): Promise<void> {
  const operationKey = `${item.id}:${action.code}`
  const moved = await operations.runAction(
    operationKey,
    () => executeProcessAction<RewardCase, ReturnType<typeof actionBody>>(
      session,
      COLLECTION,
      item.id,
      action.code,
      `p013-${action.code.toLowerCase()}`,
      actionBody(item, action),
    ),
    `${action.label}已完成。`,
  )
  if (moved) await load()
}

function actions(item: RewardCase): Action[] {
  if (isTech.value || !item.currentNodeCode) return []
  return (ACTIONS[item.currentNodeCode] ?? [])
    .filter((action) => session.can(action.permission))
}

function actionState(item: RewardCase, action: Action): ProcessState {
  return operations.actionState(`${item.id}:${action.code}`)
}

onMounted(() => {
  if (canRead.value) void load()
})
</script>

<template>
  <SgjListPageTemplate
    data-testid="p013-page"
    :title="isTech ? '奖励流程元数据监控' : '奖励事实、审批与执行回执'"
    :description="isTech ? '技术端仅查看流程元数据；贡献内容、金额、积分、证据和执行回执均不可见。' : '贡献事实、奖励审批、影响指令和权威回执分别留痕；平台不直接付款。'"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton>
    </template>

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
        <template #footer>
          <SgjButton :loading="isPending(createState)" @click="create">创建奖励案例</SgjButton>
        </template>
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
      <SgjNoPermission
        v-else-if="listState.failure === 'no-permission'"
        :description="listState.message"
      />
      <SgjError
        v-else-if="listState.failure === 'error'"
        title="奖励案例加载失败"
        :description="listState.message"
        :error-code="listState.errorCode"
        :trace-id="listState.traceId"
      >
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message">
        <template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template>
      </SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无奖励案例" />

      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in records"
          :key="item.id"
          class="record"
          :data-reward-id="item.id"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
        >
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>来源事实：{{ item.sourceFactKey }}；事件：{{ item.employeeEventType }}；影响：{{ item.impactLevel }}</p>
            <p>建议等级：{{ item.recommendedRewardLevel ?? '未登记' }}；批准等级：{{ item.approvedRewardLevel ?? '未登记' }}</p>
            <p>影响指令 {{ item.impacts.length }} 条；权威回执 {{ item.receipts.length }} 条</p>
            <ul v-if="item.impacts.length">
              <li v-for="impact in item.impacts" :key="impact.id">
                {{ impact.id }} · {{ impact.impactType }} · {{ impact.authorityReference }}
              </li>
            </ul>
            <template v-for="action in actions(item)" :key="action.code">
              <SgjConflict v-if="actionState(item, action).failure === 'conflict'" :description="actionState(item, action).message" />
              <SgjError
                v-else-if="actionState(item, action).failure === 'error' || actionState(item, action).failure === 'no-permission'"
                :title="`${action.label}失败`"
                :description="actionState(item, action).message"
                :error-code="actionState(item, action).errorCode"
                :trace-id="actionState(item, action).traceId"
              />
            </template>
          </template>
          <p v-else>贡献内容、奖励等级、金额、积分、证据、影响指令和执行回执已隐藏。</p>
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
        title="创建奖励案例失败"
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
