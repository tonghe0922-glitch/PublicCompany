import { computed, onMounted, reactive, toRefs, watchEffect } from 'vue'
import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { createProcessRecord, executeProcessAction, listProcessRecords } from '../process-client'
import type { ProcessState } from '../process-state'
import { useProcessOperation } from '../use-process-operation'

export interface P014Props { portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }
interface Impact { id: string; impactType: string; authorityReference: string }
export interface DisciplineCase {
  id: string; businessNo: string; currentNodeCode: string; status: string; versionNo: number
  subject: string; affectedEmployeeId: string | null; sourceFactKey: string | null
  businessObjectNo: string | null; impactLevel: string; decisions: unknown[]
  impacts: Impact[]; receipts: unknown[]
}
export interface P014Action { code: string; label: string; permission: string }
type Session = ReturnType<typeof usePortalSessionStore>
type Operations = ReturnType<typeof useProcessOperation>
type Form = ReturnType<typeof createForm>
interface Context {
  props: P014Props; session: Session; operations: Operations; form: Form
  resourceKey: string; createKey: string
}

const COLLECTION = '/api/v1/processes/P014/discipline-cases'
const businessObjectOptions = ['INTERNAL_CASE', 'SERVICE_EVENT'].map(value => ({ value, label: value }))
const employeeEventOptions = ['DISCIPLINE_CLUE', 'DUTY_INCIDENT'].map(value => ({ value, label: value }))
const impactLevelOptions = ['L1', 'L2', 'L3', 'L4'].map(value => ({ value, label: value }))
const decisionOptions = ['UPHELD', 'AMENDED', 'REVOKED', 'NOT_APPLICABLE'].map(value => ({ value, label: value }))
const impactTypeOptions = ['POINT_ADJUSTMENT', 'HR_DISCIPLINE', 'REMEDIATION'].map(value => ({ value, label: value }))
const receiptTypeOptions = ['P015_POINT_LEDGER', 'HR_CASE_RECEIPT', 'REMEDIATION_RECEIPT'].map(value => ({ value, label: value }))
const ACTIONS: Record<string, P014Action[]> = {
  S01: [action('REGISTER_CLUE', '登记线索事实', 'p014.discipline.manage')],
  S02: [action('RECORD_SAFEGUARD', '记录临时止险', 'p014.discipline.manage')],
  S03: [action('COMPLETE_INVESTIGATION', '完成正式调查', 'p014.discipline.investigate')],
  S04: [action('SUBMIT_STATEMENT', '提交陈述申辩', 'p014.discipline.appeal')],
  S05: [action('COMPLETE_RESPONSIBILITY_REVIEW', '完成责任评审', 'p014.discipline.investigate')],
  S06: [action('RECORD_DECISION', '记录外部授权决定', 'p014.discipline.decide')],
  S07: [action('CONFIRM_SERVICE', '确认决定送达', 'p014.discipline.appeal')],
  S08: [
    action('RECORD_IMPACT', '登记下游影响指令', 'p014.discipline.manage'),
    action('RECORD_RECEIPT', '登记权威执行回执', 'p014.discipline.manage'),
    action('COMPLETE_IMPACTS', '完成影响回执核验', 'p014.discipline.manage'),
  ],
  S09: [action('SUBMIT_APPEAL', '提交申诉选择', 'p014.discipline.appeal'), action('REVIEW_APPEAL', '独立复核申诉', 'p014.discipline.appeal')],
  S10: [action('CLOSE_CORE', '关闭核心案件', 'p014.discipline.manage')],
  S11: [action('VERIFY_REMEDIATION', '验证整改结果', 'p014.discipline.manage')],
  S12: [action('SUPPLEMENT_ARCHIVE', '补充归档', 'p014.discipline.manage')],
}

function action(code: string, label: string, permission: string): P014Action {
  return { code, label, permission }
}
function instant(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
function createForm() {
  return reactive({
    businessDate: new Date().toISOString().slice(0, 10), subject: '', reason: '',
    affectedEmployeeId: '', sourceFactKey: '', businessObjectType: 'INTERNAL_CASE',
    businessObjectNo: '', businessObjectName: '', employeeEventType: 'DISCIPLINE_CLUE',
    factOccurredAt: new Date().toISOString().slice(0, 16), factSummary: '', impactLevel: 'L2',
    resultSummary: '', evidenceNote: '', decisionOutcome: 'UPHELD', authorityReference: '',
    decidedAt: new Date().toISOString().slice(0, 16), impactType: 'POINT_ADJUSTMENT',
    instructionId: '', receiptType: 'P015_POINT_LEDGER', externalReference: '',
    externalOccurredAt: new Date().toISOString().slice(0, 16), appealRequested: true,
  })
}
function evidence(form: Form) {
  return { note: form.evidenceNote.trim(), recordedAt: new Date().toISOString() }
}
function createBody(form: Form) {
  return {
    businessDate: form.businessDate, subject: form.subject.trim(), reason: form.reason.trim(),
    affectedEmployeeId: form.affectedEmployeeId.trim(), sourceFactKey: form.sourceFactKey.trim(),
    businessObjectType: form.businessObjectType, businessObjectNo: form.businessObjectNo.trim(),
    businessObjectName: form.businessObjectName.trim(), employeeEventType: form.employeeEventType,
    factOccurredAt: instant(form.factOccurredAt), factSummary: form.factSummary.trim(),
    impactLevel: form.impactLevel, evidence: evidence(form),
  }
}
function payload(form: Form, code: string): Record<string, unknown> {
  const authority = { authorityReference: form.authorityReference.trim(), decidedAt: instant(form.decidedAt) }
  const values: Record<string, Record<string, unknown>> = {
    RECORD_DECISION: authority,
    RECORD_IMPACT: { impactType: form.impactType, authorityReference: form.authorityReference.trim() },
    RECORD_RECEIPT: {
      instructionId: form.instructionId.trim() || null, receiptType: form.receiptType,
      externalReference: form.externalReference.trim(), externalOccurredAt: instant(form.externalOccurredAt),
    },
    SUBMIT_APPEAL: { appealRequested: form.appealRequested },
    REVIEW_APPEAL: { decisionOutcome: form.decisionOutcome, ...authority },
    VERIFY_REMEDIATION: { authorityReference: form.authorityReference.trim() },
  }
  return values[code] ?? {}
}
function actionBody(form: Form, item: DisciplineCase, candidate: P014Action) {
  return {
    expectedVersion: item.versionNo, resultSummary: form.resultSummary.trim() || null,
    evidence: evidence(form), ...payload(form, candidate.code),
  }
}
function createLoad(context: Context) {
  return async (): Promise<void> => {
    const allowed = context.session.can('p014.discipline.read')
      || context.session.can('p014.discipline.monitor')
    if (!allowed) return
    await context.operations.runResource(context.resourceKey, request =>
      listProcessRecords<DisciplineCase>(context.session, COLLECTION, request))
  }
}
function createCreate(context: Context, load: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = createBody(context.form)
    const result = await context.operations.runAction(
      context.createKey,
      request => createProcessRecord<DisciplineCase, typeof body>(
        context.session, COLLECTION, 'p014-create', body, request,
      ),
      '纪律案件已创建。',
    )
    if (result.ok) await load()
  }
}
function createPerform(context: Context, load: () => Promise<void>) {
  return async (item: DisciplineCase, candidate: P014Action): Promise<void> => {
    const key = `P014:action:${item.id}:${candidate.code}`
    const body = actionBody(context.form, item, candidate)
    const result = await context.operations.runAction(
      key,
      request => executeProcessAction<DisciplineCase, typeof body>(
        context.session, COLLECTION, item.id, candidate.code,
        `p014-${candidate.code.toLowerCase()}`, body, request,
      ),
      `${candidate.label}已完成。`,
    )
    if (result.ok) await load()
  }
}
function availableActions(context: Context, item: DisciplineCase): P014Action[] {
  if (context.props.mode === 'tech' || !item.currentNodeCode) return []
  const self = item.affectedEmployeeId === context.session.session?.employeeId
  const selfActions = ['SUBMIT_STATEMENT', 'CONFIRM_SERVICE', 'SUBMIT_APPEAL']
  return (ACTIONS[item.currentNodeCode] ?? []).filter(candidate => {
    if (!context.session.can(candidate.permission)) return false
    return selfActions.includes(candidate.code) ? self : !self
  })
}

export function useP014Discipline(props: P014Props) {
  const session = usePortalSessionStore()
  const operations = useProcessOperation()
  const form = createForm()
  const resourceKey = `P014:discipline:${props.portal.code}:${props.mode}`
  const createKey = `P014:create:${props.portal.code}:${props.mode}`
  const context = { props, session, operations, form, resourceKey, createKey }
  const listState = computed(() => operations.resourceState<DisciplineCase[]>(resourceKey))
  const records = computed(() => listState.value.data ?? [])
  const createState = computed(() => operations.actionState(createKey))
  const canRead = computed(() => session.can('p014.discipline.read') || session.can('p014.discipline.monitor'))
  const load = createLoad(context)
  const create = createCreate(context, load)
  const perform = createPerform(context, load)
  watchEffect(() => { if (!form.affectedEmployeeId) form.affectedEmployeeId = session.session?.employeeId ?? '' })
  onMounted(() => { if (canRead.value) void load() })
  return {
    ...toRefs(form), records, listState, createState, canRead,
    canCreate: computed(() => session.can('p014.discipline.manage') || session.can('p014.discipline.appeal')),
    isTech: computed(() => props.mode === 'tech'), businessObjectOptions, employeeEventOptions,
    impactLevelOptions, decisionOptions, impactTypeOptions, receiptTypeOptions,
    load, create, perform, actions: (item: DisciplineCase) => availableActions(context, item),
    actionState: (item: DisciplineCase, candidate: P014Action): ProcessState =>
      operations.actionState(`P014:action:${item.id}:${candidate.code}`),
  }
}
