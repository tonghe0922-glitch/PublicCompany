<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import {
  SgjButton,
  SgjCard,
  SgjConflict,
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
import P014DisciplinePage from './P014DisciplinePage.vue'

type Mode = 'employee' | 'center' | 'tech'
interface CareCase {
  id: string
  businessNo: string
  currentNodeCode: string
  status: string
  versionNo: number
  subject: string
  reason: string | null
  affectedEmployeeId: string | null
  sourceFactKey: string | null
  careType: string
  requestedAmount: number | null
  currency: string | null
  externalBusinessRef: string | null
  factSummary: string | null
  eligibility: { outcome: string; authorityReference: string } | null
  approval: { outcome: string; approvedAmount: number | null } | null
  execution: { executionKind: string; externalReference: string; executedAmount: number | null } | null
  confirmation: { outcome: string } | null
  reconciliation: { outcome: string; externalReference: string } | null
  events: unknown[]
}
interface Action { code: string; label: string; permission: string; selfOnly?: boolean }

const COLLECTION = '/api/v1/processes/P016/care-cases'
const props = defineProps<{ portal: PortalDefinition; mode: Mode; sharedSupervision?: boolean }>()
const session = usePortalSessionStore()
const operations = useProcessOperation()
const cases = ref<CareCase[]>([])
const affectedEmployeeId = ref('')
const sourceFactKey = ref('')
const subject = ref('')
const reason = ref('')
const careType = ref('HARDSHIP')
const requestedAmount = ref('1000')
const currency = ref('CNY')
const costCenterId = ref('')
const externalBusinessRef = ref('')
const factSummary = ref('')
const authorityReference = ref('')
const consentScope = ref('WELFARE_CASE')
const consentHash = ref('')
const approvedAmount = ref('0')
const executionKind = ref('PAYMENT_RECEIPT')
const externalReference = ref('')
const executedAmount = ref('0')
const invoiceCode = ref('')
const invoiceNumber = ref('')
const invoiceAmount = ref('0')
const invoiceImageSha256 = ref('')
const confirmationOutcome = ref('CONFIRMED')
const reconciliationOutcome = ref('MATCHED')
const resultSummary = ref('')
const evidenceNote = ref('')

const isTech = computed(() => props.mode === 'tech')
const canRead = computed(
  () => session.can('p016.welfare.read') || session.can('p016.welfare.monitor'),
)
const canManage = computed(() => session.can('p016.welfare.manage'))
const showCare = computed(
  () => !props.sharedSupervision
    || canRead.value
    || canManage.value
    || session.can('p016.welfare.approve')
    || session.can('p016.welfare.execute')
    || session.can('p016.welfare.reconcile'),
)
const showDiscipline = computed(
  () => Boolean(props.sharedSupervision)
    && ['read', 'manage', 'investigate', 'decide', 'appeal']
      .some((permission) => session.can(`p014.discipline.${permission}`)),
)
const listState = computed(() => operations.resourceState('care-cases'))
const createState = computed(() => operations.actionState('create'))

const careTypeOptions = ['MARRIAGE_BIRTH', 'HARDSHIP', 'HEALTH', 'BEREAVEMENT', 'OTHER']
  .map((value) => ({ value, label: value }))
const executionKindOptions = ['PAYMENT_RECEIPT', 'GOODS_DELIVERY', 'SERVICE_COMPLETION']
  .map((value) => ({ value, label: value }))
const confirmationOptions = ['CONFIRMED', 'DISPUTED']
  .map((value) => ({ value, label: value }))
const reconciliationOptions = ['MATCHED', 'EXCEPTION_RESOLVED']
  .map((value) => ({ value, label: value }))

const ACTIONS: Record<string, Action[]> = {
  S01: [action('SUBMIT_APPLICATION', '提交关怀申请', 'p016.welfare.manage')],
  S02: [
    action('CONFIRM_ELIGIBILITY', '确认资格有效', 'p016.welfare.manage'),
    action('REJECT_ELIGIBILITY', '驳回资格', 'p016.welfare.manage'),
  ],
  S03: [action('AUTHORIZE_PRIVACY', '授权隐私材料', 'p016.welfare.read', true)],
  S04: [
    action('APPROVE_CARE', '批准关怀', 'p016.welfare.approve'),
    action('REJECT_CARE', '拒绝关怀', 'p016.welfare.approve'),
  ],
  S05: [action('RECORD_EXECUTION', '登记外部执行回执', 'p016.welfare.execute')],
  S06: [action('CONFIRM_RECEIPT', '确认收到关怀', 'p016.welfare.read', true)],
  S07: [action('RECONCILE', '完成对账', 'p016.welfare.reconcile')],
  S08: [action('ARCHIVE', '归档', 'p016.welfare.manage')],
}

function action(code: string, label: string, permission: string, selfOnly = false): Action {
  return { code, label, permission, selfOnly }
}

function now(): string {
  return new Date().toISOString()
}

function evidence() {
  return { note: evidenceNote.value.trim(), recordedAt: now() }
}

function isAffected(item: CareCase): boolean {
  return item.affectedEmployeeId === session.session?.employeeId
}

function actions(item: CareCase): Action[] {
  if (isTech.value) return []
  return (ACTIONS[item.currentNodeCode] ?? []).filter((candidate) =>
    session.can(candidate.permission)
      && (candidate.selfOnly ? isAffected(item) : !isAffected(item)))
}

async function load(): Promise<void> {
  if (!canRead.value) return
  const result = await operations.runResource('care-cases', () =>
    listProcessRecords<CareCase>(session, COLLECTION))
  if (result) cases.value = result
}

async function createCase(): Promise<void> {
  const body = {
    businessDate: new Date().toISOString().slice(0, 10),
    subject: subject.value.trim(),
    reason: reason.value.trim() || null,
    affectedEmployeeId: affectedEmployeeId.value.trim(),
    sourceFactKey: sourceFactKey.value.trim(),
    careType: careType.value,
    benefitAmount: Number(requestedAmount.value),
    currency: currency.value.trim(),
    costCenterId: costCenterId.value.trim(),
    externalBusinessRef: externalBusinessRef.value.trim() || null,
    factOccurredAt: now(),
    factSummary: factSummary.value.trim(),
    evidence: evidence(),
  }
  const created = await operations.runAction(
    'create',
    () => createProcessRecord<CareCase, typeof body>(session, COLLECTION, 'p016-create', body),
    '关怀事项已创建。',
  )
  if (created) await load()
}

function authorityFields() {
  return { authorityReference: authorityReference.value.trim(), occurredAt: now() }
}

function privacyFields() {
  return {
    consentScope: consentScope.value.trim(),
    consentHash: consentHash.value.trim(),
    occurredAt: now(),
  }
}

function approvalFields() {
  return { ...authorityFields(), approvedAmount: Number(approvedAmount.value) }
}

function executionFields() {
  const hasInvoice = Boolean(invoiceNumber.value.trim())
  return {
    executionKind: executionKind.value,
    externalReference: externalReference.value.trim(),
    occurredAt: now(),
    executedAmount: Number(executedAmount.value),
    currency: currency.value.trim(),
    invoiceCode: invoiceCode.value.trim() || null,
    invoiceNumber: invoiceNumber.value.trim() || null,
    invoiceDate: hasInvoice ? new Date().toISOString().slice(0, 10) : null,
    invoiceAmount: hasInvoice ? Number(invoiceAmount.value) : null,
    invoiceImageSha256: hasInvoice ? invoiceImageSha256.value.trim() : null,
  }
}

function confirmationFields() {
  return { confirmationOutcome: confirmationOutcome.value, occurredAt: now() }
}

function reconciliationFields() {
  return {
    reconciliationOutcome: reconciliationOutcome.value,
    externalReference: externalReference.value.trim(),
    occurredAt: now(),
  }
}

const ACTION_DETAILS: Record<string, () => Record<string, unknown>> = {
  CONFIRM_ELIGIBILITY: authorityFields,
  REJECT_ELIGIBILITY: authorityFields,
  AUTHORIZE_PRIVACY: privacyFields,
  APPROVE_CARE: approvalFields,
  REJECT_CARE: authorityFields,
  RECORD_EXECUTION: executionFields,
  CONFIRM_RECEIPT: confirmationFields,
  RECONCILE: reconciliationFields,
}

function actionBody(item: CareCase, code: string) {
  return {
    expectedVersion: item.versionNo,
    resultSummary: resultSummary.value.trim() || null,
    evidence: evidence(),
    ...(ACTION_DETAILS[code]?.() ?? {}),
  }
}

async function perform(item: CareCase, candidate: Action): Promise<void> {
  const operationKey = `${item.id}:${candidate.code}`
  const moved = await operations.runAction(
    operationKey,
    () => executeProcessAction<CareCase, ReturnType<typeof actionBody>>(
      session,
      COLLECTION,
      item.id,
      candidate.code,
      `p016-${candidate.code.toLowerCase()}`,
      actionBody(item, candidate.code),
    ),
    `${candidate.label}已完成。`,
  )
  if (moved) await load()
}

function actionState(item: CareCase, candidate: Action): ProcessState {
  return operations.actionState(`${item.id}:${candidate.code}`)
}

watchEffect(() => {
  if (!affectedEmployeeId.value && session.session?.employeeId) {
    affectedEmployeeId.value = session.session.employeeId
  }
})

onMounted(() => {
  if (showCare.value && canRead.value) void load()
})
</script>

<template>
  <P014DisciplinePage v-if="showDiscipline" :portal="props.portal" mode="center" />
  <SgjListPageTemplate
    v-if="showCare"
    data-testid="p016-page"
    :title="isTech ? '员工关怀流程技术监控' : '员工关怀与福利支持'"
    :description="isTech ? '仅显示流程编号、节点和状态；员工、金额、材料、票据与证据均被屏蔽。' : '平台只记录人类授权决定和外部执行回执，不发起付款或代替审批。'"
  >
    <template #actions>
      <SgjButton variant="secondary" :disabled="!canRead" :loading="isPending(listState)" @click="load">刷新</SgjButton>
    </template>

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
        <template #footer>
          <SgjButton :loading="isPending(createState)" @click="createCase">创建关怀事项</SgjButton>
        </template>
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
      <SgjNoPermission
        v-else-if="listState.failure === 'no-permission'"
        :description="listState.message"
      />
      <SgjError
        v-else-if="listState.failure === 'error'"
        title="关怀事项加载失败"
        :description="listState.message"
        :error-code="listState.errorCode"
        :trace-id="listState.traceId"
      >
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict v-else-if="listState.failure === 'conflict'" :description="listState.message">
        <template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template>
      </SgjConflict>
      <SgjEmpty v-else-if="cases.length === 0" title="暂无可见关怀事项" />

      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in cases"
          :key="item.id"
          class="record"
          :data-care-id="item.id"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
        >
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
              <SgjError
                v-else-if="actionState(item, candidate).failure === 'error' || actionState(item, candidate).failure === 'no-permission'"
                :title="`${candidate.label}失败`"
                :description="actionState(item, candidate).message"
                :error-code="actionState(item, candidate).errorCode"
                :trace-id="actionState(item, candidate).traceId"
              />
            </template>
          </template>
          <p v-else>员工、金额、材料、票据、来源事实和事件证据已屏蔽；技术端仅显示流程元数据。</p>
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
        v-if="createState.failure === 'error' || createState.failure === 'no-permission'"
        title="创建关怀事项失败"
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
