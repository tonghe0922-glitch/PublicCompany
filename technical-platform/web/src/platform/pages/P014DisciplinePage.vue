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

interface EventFact { id: string; eventType: string }
interface DecisionFact { id: string; decisionKind: string; outcome: string; authorityReference: string }
interface ImpactInstruction { id: string; impactType: string; authorityReference: string }
interface ImpactReceipt { id: string; instructionId: string; receiptType: string; externalReference: string }

interface DisciplineCase {
  id: string
  businessNo: string
  currentNodeCode: string
  status: string
  versionNo: number
  subject: string
  reason: string | null
  affectedEmployeeId: string | null
  sourceFactKey: string | null
  businessObjectType: string
  businessObjectNo: string | null
  businessObjectName: string | null
  employeeEventType: string | null
  factSummary: string | null
  impactLevel: string
  events: EventFact[]
  decisions: DecisionFact[]
  impacts: ImpactInstruction[]
  receipts: ImpactReceipt[]
}

interface Action { code: string; label: string; permission: string }

const COLLECTION = '/api/v1/processes/P014/discipline-cases'
const props = defineProps<{ portal: PortalDefinition; mode: Mode }>()
const session = usePortalSessionStore()
const operations = useProcessOperation()
const records = ref<DisciplineCase[]>([])
const businessDate = ref(new Date().toISOString().slice(0, 10))
const subject = ref('')
const reason = ref('')
const affectedEmployeeId = ref('')
const sourceFactKey = ref('')
const businessObjectType = ref('INTERNAL_CASE')
const businessObjectNo = ref('')
const businessObjectName = ref('')
const employeeEventType = ref('DISCIPLINE_CLUE')
const factOccurredAt = ref(new Date().toISOString().slice(0, 16))
const factSummary = ref('')
const impactLevel = ref('L2')
const resultSummary = ref('')
const evidenceNote = ref('')
const decisionOutcome = ref('UPHELD')
const authorityReference = ref('')
const decidedAt = ref(new Date().toISOString().slice(0, 16))
const impactType = ref('POINT_ADJUSTMENT')
const instructionId = ref('')
const receiptType = ref('P015_POINT_LEDGER')
const externalReference = ref('')
const externalOccurredAt = ref(new Date().toISOString().slice(0, 16))
const appealRequested = ref(true)

const isTech = computed(() => props.mode === 'tech')
const canRead = computed(
  () => session.can('p014.discipline.read') || session.can('p014.discipline.monitor'),
)
const canCreate = computed(
  () => session.can('p014.discipline.manage') || session.can('p014.discipline.appeal'),
)
const listState = computed(() => operations.resourceState('discipline'))
const createState = computed(() => operations.actionState('create'))

const businessObjectOptions = [
  { value: 'INTERNAL_CASE', label: '内部案件' },
  { value: 'SERVICE_EVENT', label: '服务事件' },
] as const
const employeeEventOptions = [
  { value: 'DISCIPLINE_CLUE', label: '纪律线索' },
  { value: 'DUTY_INCIDENT', label: '履职事件' },
] as const
const impactLevelOptions = ['L1', 'L2', 'L3', 'L4'].map((value) => ({ value, label: value }))
const decisionOptions = ['UPHELD', 'AMENDED', 'REVOKED', 'NOT_APPLICABLE']
  .map((value) => ({ value, label: value }))
const impactTypeOptions = ['POINT_ADJUSTMENT', 'HR_DISCIPLINE', 'REMEDIATION']
  .map((value) => ({ value, label: value }))
const receiptTypeOptions = ['P015_POINT_LEDGER', 'HR_CASE_RECEIPT', 'REMEDIATION_RECEIPT']
  .map((value) => ({ value, label: value }))

const ACTIONS: Record<string, Action[]> = {
  S01: [{ code: 'REGISTER_CLUE', label: '登记线索事实', permission: 'p014.discipline.manage' }],
  S02: [{ code: 'RECORD_SAFEGUARD', label: '记录临时止险', permission: 'p014.discipline.manage' }],
  S03: [{ code: 'COMPLETE_INVESTIGATION', label: '完成正式调查', permission: 'p014.discipline.investigate' }],
  S04: [{ code: 'SUBMIT_STATEMENT', label: '提交陈述申辩', permission: 'p014.discipline.appeal' }],
  S05: [{ code: 'COMPLETE_RESPONSIBILITY_REVIEW', label: '完成责任评审', permission: 'p014.discipline.investigate' }],
  S06: [{ code: 'RECORD_DECISION', label: '记录外部授权决定', permission: 'p014.discipline.decide' }],
  S07: [{ code: 'CONFIRM_SERVICE', label: '确认决定送达', permission: 'p014.discipline.appeal' }],
  S08: [
    { code: 'RECORD_IMPACT', label: '登记下游影响指令', permission: 'p014.discipline.manage' },
    { code: 'RECORD_RECEIPT', label: '登记权威执行回执', permission: 'p014.discipline.manage' },
    { code: 'COMPLETE_IMPACTS', label: '完成影响回执核验', permission: 'p014.discipline.manage' },
  ],
  S09: [
    { code: 'SUBMIT_APPEAL', label: '提交申诉选择', permission: 'p014.discipline.appeal' },
    { code: 'REVIEW_APPEAL', label: '独立复核申诉', permission: 'p014.discipline.appeal' },
  ],
  S10: [{ code: 'CLOSE_CORE', label: '关闭核心案件', permission: 'p014.discipline.manage' }],
  S11: [{ code: 'VERIFY_REMEDIATION', label: '验证整改结果', permission: 'p014.discipline.manage' }],
  S12: [{ code: 'SUPPLEMENT_ARCHIVE', label: '补充归档', permission: 'p014.discipline.manage' }],
}

watchEffect(() => {
  if (!affectedEmployeeId.value && session.session?.employeeId) {
    affectedEmployeeId.value = session.session.employeeId
  }
})

function evidence() {
  return { note: evidenceNote.value.trim(), recordedAt: new Date().toISOString() }
}

function instant(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

async function load(): Promise<void> {
  if (!canRead.value) return
  const result = await operations.runResource('discipline', () =>
    listProcessRecords<DisciplineCase>(session, COLLECTION))
  if (result) records.value = result
}

async function create(): Promise<void> {
  const body = {
    businessDate: businessDate.value,
    subject: subject.value.trim(),
    reason: reason.value.trim(),
    affectedEmployeeId: affectedEmployeeId.value.trim(),
    sourceFactKey: sourceFactKey.value.trim(),
    businessObjectType: businessObjectType.value,
    businessObjectNo: businessObjectNo.value.trim(),
    businessObjectName: businessObjectName.value.trim(),
    employeeEventType: employeeEventType.value,
    factOccurredAt: instant(factOccurredAt.value),
    factSummary: factSummary.value.trim(),
    impactLevel: impactLevel.value,
    evidence: evidence(),
  }
  const created = await operations.runAction(
    'create',
    () => createProcessRecord<DisciplineCase, typeof body>(
      session,
      COLLECTION,
      'p014-create',
      body,
    ),
    '纪律案件已创建。',
  )
  if (created) await load()
}

const payloads: Record<string, () => Record<string, unknown>> = {
  RECORD_DECISION: () => ({
    authorityReference: authorityReference.value.trim(),
    decidedAt: instant(decidedAt.value),
  }),
  RECORD_IMPACT: () => ({
    impactType: impactType.value,
    authorityReference: authorityReference.value.trim(),
  }),
  RECORD_RECEIPT: () => ({
    instructionId: instructionId.value.trim() || null,
    receiptType: receiptType.value,
    externalReference: externalReference.value.trim(),
    externalOccurredAt: instant(externalOccurredAt.value),
  }),
  SUBMIT_APPEAL: () => ({ appealRequested: appealRequested.value }),
  REVIEW_APPEAL: () => ({
    decisionOutcome: decisionOutcome.value,
    authorityReference: authorityReference.value.trim(),
    decidedAt: instant(decidedAt.value),
  }),
  VERIFY_REMEDIATION: () => ({ authorityReference: authorityReference.value.trim() }),
}

function actionBody(item: DisciplineCase, action: Action) {
  return {
    expectedVersion: item.versionNo,
    decisionOutcome: null,
    authorityReference: null,
    decidedAt: null,
    impactType: null,
    instructionId: null,
    receiptType: null,
    externalReference: null,
    externalOccurredAt: null,
    appealRequested: null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: evidence(),
    ...(payloads[action.code]?.() ?? {}),
  }
}

async function perform(item: DisciplineCase, action: Action): Promise<void> {
  const operationKey = `${item.id}:${action.code}`
  const moved = await operations.runAction(
    operationKey,
    () => executeProcessAction<DisciplineCase, ReturnType<typeof actionBody>>(
      session,
      COLLECTION,
      item.id,
      action.code,
      `p014-${action.code.toLowerCase()}`,
      actionBody(item, action),
    ),
    `${action.label}已完成。`,
  )
  if (moved) await load()
}

function actions(item: DisciplineCase): Action[] {
  if (isTech.value || !item.currentNodeCode) return []
  const self = item.affectedEmployeeId === session.session?.employeeId
  return (ACTIONS[item.currentNodeCode] ?? []).filter((action) => {
    if (!session.can(action.permission)) return false
    if (['SUBMIT_STATEMENT', 'CONFIRM_SERVICE', 'SUBMIT_APPEAL'].includes(action.code)) {
      return self
    }
    return !self
  })
}

function actionState(item: DisciplineCase, action: Action): ProcessState {
  return operations.actionState(`${item.id}:${action.code}`)
}

onMounted(() => {
  if (canRead.value) void load()
})
</script>

<template>
  <SgjListPageTemplate
    data-testid="p014-page"
    :title="isTech ? '纪律案件流程元数据监控' : '纪律事实、职责分离与申诉闭环'"
    :description="isTech ? '技术端仅查看流程元数据；当事人、事实、证据、决定和回执均不可见。' : '平台只记录外部人工授权决定及下游权威回执，不自动认定责任或直接处分。'"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton>
    </template>

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
        <template #footer>
          <SgjButton :loading="isPending(createState)" @click="create">创建纪律案件</SgjButton>
        </template>
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
      <SgjNoPermission
        v-else-if="listState.failure === 'no-permission'"
        :description="listState.message"
      />
      <SgjError
        v-else-if="listState.failure === 'error'"
        title="纪律案件加载失败"
        :description="listState.message"
        :error-code="listState.errorCode"
        :trace-id="listState.traceId"
      >
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message">
        <template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template>
      </SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无纪律案件" />

      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in records"
          :key="item.id"
          class="record"
          :data-discipline-id="item.id"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
        >
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>来源：{{ item.sourceFactKey }}；对象：{{ item.businessObjectNo }}；影响：{{ item.impactLevel }}</p>
            <p>决定 {{ item.decisions.length }} 条；影响指令 {{ item.impacts.length }} 条；权威回执 {{ item.receipts.length }} 条</p>
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
          <p v-else>当事人、事实、证据、决定、影响指令和执行回执已隐藏。</p>
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
        title="创建纪律案件失败"
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
