import { computed, onMounted, reactive, toRefs, watchEffect } from 'vue'
import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { createProcessRecord, executeProcessAction, listProcessRecords } from '../process-client'
import type { ProcessState } from '../process-state'
import { useProcessOperation } from '../use-process-operation'

export interface P016Props {
  portal: PortalDefinition
  mode: 'employee' | 'center' | 'tech'
  sharedSupervision?: boolean
}
export interface CareCase {
  id: string; businessNo: string; currentNodeCode: string; status: string; versionNo: number
  subject: string; affectedEmployeeId: string | null; careType: string
  requestedAmount: number | null; currency: string | null
  eligibility: { outcome: string; authorityReference: string } | null
  approval: { outcome: string; approvedAmount: number | null } | null
  execution: { executionKind: string; externalReference: string } | null
  confirmation: { outcome: string } | null; reconciliation: { outcome: string } | null
}
export interface P016Action { code: string; label: string; permission: string; selfOnly?: boolean }
type Session = ReturnType<typeof usePortalSessionStore>
type Operations = ReturnType<typeof useProcessOperation>
type Form = ReturnType<typeof createForm>
interface Context {
  props: P016Props; session: Session; operations: Operations; form: Form
  resourceKey: string; createKey: string
}

const COLLECTION = '/api/v1/processes/P016/care-cases'
const careTypeOptions = ['MARRIAGE_BIRTH', 'HARDSHIP', 'HEALTH', 'BEREAVEMENT', 'OTHER'].map(value => ({ value, label: value }))
const executionKindOptions = ['PAYMENT_RECEIPT', 'GOODS_DELIVERY', 'SERVICE_COMPLETION'].map(value => ({ value, label: value }))
const confirmationOptions = ['CONFIRMED', 'DISPUTED'].map(value => ({ value, label: value }))
const reconciliationOptions = ['MATCHED', 'EXCEPTION_RESOLVED'].map(value => ({ value, label: value }))
const ACTIONS: Record<string, P016Action[]> = {
  S01: [action('SUBMIT_APPLICATION', '提交关怀申请', 'p016.welfare.manage')],
  S02: [action('CONFIRM_ELIGIBILITY', '确认资格有效', 'p016.welfare.manage'), action('REJECT_ELIGIBILITY', '驳回资格', 'p016.welfare.manage')],
  S03: [action('AUTHORIZE_PRIVACY', '授权隐私材料', 'p016.welfare.read', true)],
  S04: [action('APPROVE_CARE', '批准关怀', 'p016.welfare.approve'), action('REJECT_CARE', '拒绝关怀', 'p016.welfare.approve')],
  S05: [action('RECORD_EXECUTION', '登记外部执行回执', 'p016.welfare.execute')],
  S06: [action('CONFIRM_RECEIPT', '确认收到关怀', 'p016.welfare.read', true)],
  S07: [action('RECONCILE', '完成对账', 'p016.welfare.reconcile')],
  S08: [action('ARCHIVE', '归档', 'p016.welfare.manage')],
}

function action(code: string, label: string, permission: string, selfOnly = false): P016Action {
  return { code, label, permission, selfOnly }
}
function now(): string {
  return new Date().toISOString()
}
function createForm() {
  return reactive({
    affectedEmployeeId: '', sourceFactKey: '', subject: '', reason: '', careType: 'HARDSHIP',
    requestedAmount: '1000', currency: 'CNY', costCenterId: '', externalBusinessRef: '',
    factSummary: '', authorityReference: '', consentScope: 'WELFARE_CASE', consentHash: '',
    approvedAmount: '0', executionKind: 'PAYMENT_RECEIPT', externalReference: '',
    executedAmount: '0', invoiceCode: '', invoiceNumber: '', invoiceAmount: '0',
    invoiceImageSha256: '', confirmationOutcome: 'CONFIRMED',
    reconciliationOutcome: 'MATCHED', resultSummary: '', evidenceNote: '',
  })
}
function evidence(form: Form) {
  return { note: form.evidenceNote.trim(), recordedAt: now() }
}
function availableActions(context: Context, item: CareCase): P016Action[] {
  if (context.props.mode === 'tech') return []
  const affected = item.affectedEmployeeId === context.session.session?.employeeId
  return (ACTIONS[item.currentNodeCode] ?? []).filter(candidate =>
    context.session.can(candidate.permission)
    && (candidate.selfOnly ? affected : !affected))
}
function createBody(form: Form) {
  return {
    businessDate: new Date().toISOString().slice(0, 10), subject: form.subject.trim(),
    reason: form.reason.trim() || null, affectedEmployeeId: form.affectedEmployeeId.trim(),
    sourceFactKey: form.sourceFactKey.trim(), careType: form.careType,
    benefitAmount: Number(form.requestedAmount), currency: form.currency.trim(),
    costCenterId: form.costCenterId.trim(), externalBusinessRef: form.externalBusinessRef.trim() || null,
    factOccurredAt: now(), factSummary: form.factSummary.trim(), evidence: evidence(form),
  }
}
function executionFields(form: Form): Record<string, unknown> {
  const hasInvoice = Boolean(form.invoiceNumber.trim())
  return {
    executionKind: form.executionKind, externalReference: form.externalReference.trim(),
    occurredAt: now(), executedAmount: Number(form.executedAmount), currency: form.currency.trim(),
    invoiceCode: form.invoiceCode.trim() || null, invoiceNumber: form.invoiceNumber.trim() || null,
    invoiceDate: hasInvoice ? new Date().toISOString().slice(0, 10) : null,
    invoiceAmount: hasInvoice ? Number(form.invoiceAmount) : null,
    invoiceImageSha256: hasInvoice ? form.invoiceImageSha256.trim() : null,
  }
}
function actionDetails(form: Form, code: string): Record<string, unknown> {
  const authority = { authorityReference: form.authorityReference.trim(), occurredAt: now() }
  const values: Record<string, Record<string, unknown>> = {
    CONFIRM_ELIGIBILITY: authority, REJECT_ELIGIBILITY: authority,
    AUTHORIZE_PRIVACY: { consentScope: form.consentScope.trim(), consentHash: form.consentHash.trim(), occurredAt: now() },
    APPROVE_CARE: { ...authority, approvedAmount: Number(form.approvedAmount) },
    REJECT_CARE: authority, RECORD_EXECUTION: executionFields(form),
    CONFIRM_RECEIPT: { confirmationOutcome: form.confirmationOutcome, occurredAt: now() },
    RECONCILE: { reconciliationOutcome: form.reconciliationOutcome,
      externalReference: form.externalReference.trim(), occurredAt: now() },
  }
  return values[code] ?? {}
}
function actionBody(form: Form, item: CareCase, candidate: P016Action) {
  return {
    expectedVersion: item.versionNo, resultSummary: form.resultSummary.trim() || null,
    evidence: evidence(form), ...actionDetails(form, candidate.code),
  }
}
function createLoad(context: Context) {
  return async (): Promise<void> => {
    const allowed = context.session.can('p016.welfare.read') || context.session.can('p016.welfare.monitor')
    if (!allowed) return
    await context.operations.runResource(context.resourceKey, request =>
      listProcessRecords<CareCase>(context.session, COLLECTION, request))
  }
}
function createCare(context: Context, load: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = createBody(context.form)
    const result = await context.operations.runAction(
      context.createKey,
      request => createProcessRecord<CareCase, typeof body>(
        context.session, COLLECTION, 'p016-create', body, request,
      ),
      '关怀事项已创建。',
    )
    if (result.ok) await load()
  }
}
function performAction(context: Context, load: () => Promise<void>) {
  return async (item: CareCase, candidate: P016Action): Promise<void> => {
    const key = `P016:action:${item.id}:${candidate.code}`
    const body = actionBody(context.form, item, candidate)
    const result = await context.operations.runAction(
      key,
      request => executeProcessAction<CareCase, typeof body>(
        context.session, COLLECTION, item.id, candidate.code,
        `p016-${candidate.code.toLowerCase()}`, body, request,
      ),
      `${candidate.label}已完成。`,
    )
    if (result.ok) await load()
  }
}

export function useP016CareSupport(props: P016Props) {
  const session = usePortalSessionStore()
  const operations = useProcessOperation()
  const form = createForm()
  const resourceKey = `P016:care:${props.portal.code}:${props.mode}`
  const createKey = `P016:create:${props.portal.code}:${props.mode}`
  const context = { props, session, operations, form, resourceKey, createKey }
  const listState = computed(() => operations.resourceState<CareCase[]>(resourceKey))
  const canRead = computed(() => session.can('p016.welfare.read') || session.can('p016.welfare.monitor'))
  const canManage = computed(() => session.can('p016.welfare.manage'))
  const showCare = computed(() => !props.sharedSupervision || canRead.value || canManage.value
    || ['approve', 'execute', 'reconcile'].some(code => session.can(`p016.welfare.${code}`)))
  const showDiscipline = computed(() => Boolean(props.sharedSupervision)
    && ['read', 'manage', 'investigate', 'decide', 'appeal'].some(code => session.can(`p014.discipline.${code}`)))
  const load = createLoad(context)
  watchEffect(() => { if (!form.affectedEmployeeId) form.affectedEmployeeId = session.session?.employeeId ?? '' })
  onMounted(() => { if (showCare.value && canRead.value) void load() })
  return {
    ...toRefs(form), cases: computed(() => listState.value.data ?? []), listState,
    createState: computed(() => operations.actionState(createKey)), canRead, canManage,
    showCare, showDiscipline, isTech: computed(() => props.mode === 'tech'),
    careTypeOptions, executionKindOptions, confirmationOptions, reconciliationOptions,
    load, createCase: createCare(context, load), perform: performAction(context, load),
    actions: (item: CareCase) => availableActions(context, item),
    actionState: (item: CareCase, candidate: P016Action): ProcessState =>
      operations.actionState(`P016:action:${item.id}:${candidate.code}`),
  }
}
