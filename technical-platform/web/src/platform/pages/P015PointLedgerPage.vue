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
  SgjPartialFailure,
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
import { idempotencyKey } from '../phase11/process-client'
import { isPending } from '../phase11/process-state'
import type { ProcessState } from '../phase11/process-state'
import { useProcessOperation } from '../phase11/use-process-operation'
import type { PortalDefinition } from '../portal-config'

type Mode = 'employee' | 'center' | 'tech'
interface RankRule { rankCode: string; minBalance: number; maxBalance: number | null }
interface Rule {
  rule: {
    id: string
    ruleCode: string
    versionNo: number
    pointKind: string
    eventType: string
    unitPoints: number
    minPoints: number
    maxPoints: number
    manualReviewThreshold: number
  }
  status: string
  effectiveFrom: string
  effectiveTo: string | null
  ranks: RankRule[]
}
interface Posting { postedPoints: number; postingMode: string; riskGrade: string }
interface Balance { effectiveBalance: number; rankCode: string }
interface PointTransaction {
  id: string
  businessNo: string
  currentNodeCode: string
  status: string
  versionNo: number
  subject: string
  affectedEmployeeId: string | null
  sourceFactKey: string | null
  pointKind: string
  ruleCode: string
  ruleVersionNo: number
  quantity: number
  calculatedPoints: number
  cappedPoints: number
  riskGrade: string
  businessObjectNo: string | null
  factSummary: string | null
  changeAction: string
  originalTransactionId: string | null
  posting: Posting | null
  balance: Balance | null
}
interface Action { code: string; label: string; permission: string }

const TRANSACTIONS = '/api/v1/processes/P015/point-transactions'
const RULES = '/api/v1/processes/P015/point-rules'
const props = defineProps<{ portal: PortalDefinition; mode: Mode }>()
const session = usePortalSessionStore()
const operations = useProcessOperation()
const records = ref<PointTransaction[]>([])
const rules = ref<Rule[]>([])
const affectedEmployeeId = ref('')
const sourceFactKey = ref('')
const subject = ref('')
const reason = ref('')
const pointKind = ref('GROWTH')
const quantity = ref('1')
const businessObjectNo = ref('')
const businessObjectName = ref('')
const employeeEventType = ref('SERVICE')
const factSummary = ref('')
const evidenceNote = ref('')
const resultSummary = ref('')
const adjustmentRequested = ref(false)
const adjustmentPoints = ref('0')
const adjustmentReason = ref('')
const adjustmentApproved = ref(false)
const ruleCode = ref('')
const ruleVersionNo = ref('1')
const ruleEventType = ref('SERVICE')
const unitPoints = ref('1')
const minPoints = ref('0')
const maxPoints = ref('1')
const reviewThreshold = ref('1')
const effectiveFrom = ref(new Date().toISOString().slice(0, 16))
const effectiveTo = ref('')
const rankCode = ref('BASE')
const rankMin = ref('0')
const rankMax = ref('')

const isTech = computed(() => props.mode === 'tech')
const canRead = computed(
  () => session.can('p015.points.read') || session.can('p015.points.monitor'),
)
const canManage = computed(() => session.can('p015.points.manage'))
const transactionState = computed(() => operations.resourceState('transactions'))
const ruleState = computed(() => operations.resourceState('rules'))
const createTransactionState = computed(() => operations.actionState('create-transaction'))
const createRuleState = computed(() => operations.actionState('create-rule'))
const partialFailure = computed(() => {
  const transactionFailed = transactionState.value.failure !== 'none'
  const ruleFailed = ruleState.value.failure !== 'none'
  return transactionFailed !== ruleFailed
})

const pointKindOptions = [
  { value: 'GROWTH', label: '成长积分' },
  { value: 'HONOR', label: '荣誉积分' },
] as const
const ACTIONS: Record<string, Action[]> = {
  S01: [action('REGISTER_EVENT', '登记业务事件', 'p015.points.manage')],
  S02: [action('VALIDATE_SOURCE', '校验人员与来源', 'p015.points.manage')],
  S03: [action('CHECK_DUPLICATE', '检查异常与重复', 'p015.points.manage')],
  S04: [action('MATCH_RULE', '匹配已发布规则', 'p015.points.manage')],
  S05: [action('CALCULATE_CAP', '确认计算与封顶', 'p015.points.manage')],
  S06: [action('CLASSIFY_RISK', '完成人工风险分类', 'p015.points.review')],
  S07: [action('POST_LEDGER', '写入不可变积分事实', 'p015.points.review')],
  S08: [action('CONFIRM_NOTICE', '确认积分通知', 'p015.points.read')],
  S09: [
    action('SUBMIT_ADJUSTMENT', '提交调整选择', 'p015.points.adjust'),
    action('REVIEW_ADJUSTMENT', '独立复核调整', 'p015.points.adjust'),
  ],
  S10: [action('RECALCULATE_BALANCE', '复算余额与等级', 'p015.points.manage')],
}

function action(code: string, label: string, permission: string): Action {
  return { code, label, permission }
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

async function loadTransactions(): Promise<void> {
  if (!canRead.value) return
  const result = await operations.runResource('transactions', () =>
    listProcessRecords<PointTransaction>(session, TRANSACTIONS))
  if (result) records.value = result
}

async function loadRules(): Promise<void> {
  if (!isTech.value && !canManage.value) return
  const result = await operations.runResource('rules', () =>
    listProcessRecords<Rule>(session, RULES))
  if (result) rules.value = result
}

async function load(): Promise<void> {
  await Promise.all([loadTransactions(), loadRules()])
}

async function createTransaction(): Promise<void> {
  const body = {
    businessDate: new Date().toISOString().slice(0, 10),
    subject: subject.value.trim(),
    reason: reason.value.trim(),
    affectedEmployeeId: affectedEmployeeId.value.trim(),
    sourceFactKey: sourceFactKey.value.trim(),
    pointKind: pointKind.value,
    quantity: Number(quantity.value),
    businessObjectType: 'SERVICE_CASE',
    businessObjectNo: businessObjectNo.value.trim(),
    businessObjectName: businessObjectName.value.trim(),
    employeeEventType: employeeEventType.value,
    factOccurredAt: new Date().toISOString(),
    factSummary: factSummary.value.trim(),
    expiresAt: null,
    evidence: evidence(),
  }
  const created = await operations.runAction(
    'create-transaction',
    () => createProcessRecord<PointTransaction, typeof body>(
      session,
      TRANSACTIONS,
      'p015-create',
      body,
    ),
    '积分业务已创建。',
  )
  if (created) await loadTransactions()
}

async function createRule(): Promise<void> {
  const body = {
    ruleCode: ruleCode.value.trim(),
    versionNo: Number(ruleVersionNo.value),
    pointKind: pointKind.value,
    eventType: ruleEventType.value.trim(),
    unitPoints: Number(unitPoints.value),
    minPoints: Number(minPoints.value),
    maxPoints: Number(maxPoints.value),
    manualReviewThreshold: Number(reviewThreshold.value),
    effectiveFrom: instant(effectiveFrom.value),
    effectiveTo: instant(effectiveTo.value),
    ranks: [{
      rankCode: rankCode.value.trim(),
      minBalance: Number(rankMin.value),
      maxBalance: rankMax.value.trim() ? Number(rankMax.value) : null,
    }],
  }
  const created = await operations.runAction(
    'create-rule',
    () => createProcessRecord<Rule, typeof body>(session, RULES, 'p015-rule', body),
    '规则草稿已保存。',
  )
  if (created) await loadRules()
}

async function publish(rule: Rule): Promise<void> {
  const operationKey = `publish:${rule.rule.id}`
  const published = await operations.runAction(
    operationKey,
    () => session.request<Rule>(`${RULES}/${rule.rule.id}/publish`, {
      method: 'POST',
      idempotencyKey: idempotencyKey('p015-publish'),
    }),
    '规则版本已发布。',
  )
  if (published) await loadRules()
}

function actionBody(item: PointTransaction, candidate: Action) {
  const submitsAdjustment = candidate.code === 'SUBMIT_ADJUSTMENT'
  return {
    expectedVersion: item.versionNo,
    adjustmentRequested: submitsAdjustment ? adjustmentRequested.value : null,
    adjustmentPoints: submitsAdjustment && adjustmentRequested.value
      ? Number(adjustmentPoints.value)
      : null,
    adjustmentReason: submitsAdjustment && adjustmentRequested.value
      ? adjustmentReason.value.trim()
      : null,
    adjustmentApproved: candidate.code === 'REVIEW_ADJUSTMENT'
      ? adjustmentApproved.value
      : null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: evidence(),
  }
}

async function perform(item: PointTransaction, candidate: Action): Promise<void> {
  const operationKey = `${item.id}:${candidate.code}`
  const moved = await operations.runAction(
    operationKey,
    () => executeProcessAction<PointTransaction, ReturnType<typeof actionBody>>(
      session,
      TRANSACTIONS,
      item.id,
      candidate.code,
      `p015-${candidate.code.toLowerCase()}`,
      actionBody(item, candidate),
    ),
    `${candidate.label}已完成。`,
  )
  if (moved) await loadTransactions()
}

function actions(item: PointTransaction): Action[] {
  if (isTech.value) return []
  const self = item.affectedEmployeeId === session.session?.employeeId
  return (ACTIONS[item.currentNodeCode] ?? []).filter((candidate) => {
    if (!session.can(candidate.permission)) return false
    const selfAction = ['CONFIRM_NOTICE', 'SUBMIT_ADJUSTMENT'].includes(candidate.code)
    return selfAction ? self : !self
  })
}

function actionState(item: PointTransaction, candidate: Action): ProcessState {
  return operations.actionState(`${item.id}:${candidate.code}`)
}

onMounted(() => {
  void load()
})
</script>

<template>
  <SgjListPageTemplate
    data-testid="p015-page"
    :title="isTech ? '积分规则与流程监控' : '成长积分与荣誉积分不可变账本'"
    :description="isTech ? '技术端配置版本化规则并查看流程元数据，不代替业务审核或调整积分。' : '每次奖励、调整和冲销均形成新账本事实；已入账记录不可覆盖。'"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(transactionState)" @click="load">刷新</SgjButton>
    </template>

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
        <template #footer>
          <SgjButton :loading="isPending(createRuleState)" @click="createRule">保存规则草稿</SgjButton>
        </template>
      </SgjCard>

      <SgjCard v-if="isTech">
        <template #header><h2>规则版本</h2></template>
        <SgjLoading v-if="isPending(ruleState) && rules.length === 0" />
        <SgjEmpty v-else-if="rules.length === 0" title="暂无规则版本" />
        <div v-else class="phase11-records">
          <SgjRecordCard
            v-for="rule in rules"
            :key="rule.rule.id"
            class="record"
            :data-rule-id="rule.rule.id"
            :title="`${rule.rule.ruleCode} · v${rule.rule.versionNo}`"
            :subtitle="`${rule.rule.pointKind} / ${rule.rule.eventType}`"
          >
            <template #status><SgjStatusChip>{{ rule.status }}</SgjStatusChip></template>
            <p>单位 {{ rule.rule.unitPoints }}；边界 {{ rule.rule.minPoints }} 至 {{ rule.rule.maxPoints }}</p>
            <template #actions>
              <SgjButton
                v-if="canManage && rule.status === 'DRAFT'"
                :loading="isPending(operations.actionState(`publish:${rule.rule.id}`))"
                @click="publish(rule)"
              >发布规则版本</SgjButton>
            </template>
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
        <template #footer>
          <SgjButton :loading="isPending(createTransactionState)" @click="createTransaction">创建积分业务</SgjButton>
        </template>
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
      <SgjNoPermission
        v-else-if="transactionState.failure === 'no-permission' && !partialFailure"
        :description="transactionState.message"
      />
      <SgjError
        v-else-if="transactionState.failure === 'error' && !partialFailure"
        title="积分记录加载失败"
        :description="transactionState.message"
        :error-code="transactionState.errorCode"
        :trace-id="transactionState.traceId"
      >
        <template #actions><SgjButton @click="loadTransactions">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="transactionState.failure === 'conflict'" :description="transactionState.message" />
      <SgjEmpty v-else-if="records.length === 0" title="暂无可见积分记录" />

      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in records"
          :key="item.id"
          class="record"
          :data-point-id="item.id"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
        >
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>类型 {{ item.pointKind }}；规则 {{ item.ruleCode }} v{{ item.ruleVersionNo }}；计算 {{ item.calculatedPoints }}；入账 {{ item.cappedPoints }}</p>
            <p v-if="item.posting">{{ item.posting.postingMode }} · {{ item.posting.riskGrade }}</p>
            <p v-if="item.balance">有效余额 {{ item.balance.effectiveBalance }} · 等级 {{ item.balance.rankCode }}</p>
            <template v-for="candidate in actions(item)" :key="candidate.code">
              <SgjConflict v-if="actionState(item, candidate).failure === 'conflict'" :description="actionState(item, candidate).message" />
              <SgjError
                v-else-if="actionState(item, candidate).failure === 'error' || actionState(item, candidate).failure === 'no-permission'"
                :title="`${candidate.label}失败`"
                :description="actionState(item, candidate).message"
                :error-code="actionState(item, candidate).errorCode"
                :trace-id="actionState(item, candidate).traceId"
              />
            </template>
          </template>
          <p v-else>员工、来源、积分值、等级和证据已隐藏；技术端仅显示流程元数据。</p>
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
        v-if="createTransactionState.failure === 'error' || createRuleState.failure === 'error'"
        title="保存失败"
        :description="createTransactionState.message || createRuleState.message"
        :error-code="createTransactionState.errorCode || createRuleState.errorCode"
        :trace-id="createTransactionState.traceId || createRuleState.traceId"
      />
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
