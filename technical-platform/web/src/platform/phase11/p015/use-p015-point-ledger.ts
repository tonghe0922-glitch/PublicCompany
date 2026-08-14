import { computed, onMounted, reactive, toRefs, watchEffect } from 'vue'
import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { createProcessRecord, executeProcessAction, idempotencyKey, listProcessRecords } from '../process-client'
import type { ProcessState } from '../process-state'
import { useProcessOperation } from '../use-process-operation'

export interface P015Props { portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }
interface RankRule { rankCode: string; minBalance: number; maxBalance: number | null }
export interface Rule {
  rule: {
    id: string; ruleCode: string; versionNo: number; pointKind: string; eventType: string
    unitPoints: number; minPoints: number; maxPoints: number; manualReviewThreshold: number
  }
  status: string; effectiveFrom: string; effectiveTo: string | null; ranks: RankRule[]
}
interface Posting { postedPoints: number; postingMode: string; riskGrade: string }
interface Balance { effectiveBalance: number; rankCode: string }
export interface PointTransaction {
  id: string; businessNo: string; currentNodeCode: string; status: string; versionNo: number
  subject: string; affectedEmployeeId: string | null; sourceFactKey: string | null
  pointKind: string; ruleCode: string; ruleVersionNo: number; quantity: number
  calculatedPoints: number; cappedPoints: number; riskGrade: string
  posting: Posting | null; balance: Balance | null
}
export interface P015Action { code: string; label: string; permission: string }
type Session = ReturnType<typeof usePortalSessionStore>
type Operations = ReturnType<typeof useProcessOperation>
type Form = ReturnType<typeof createForm>
interface Context {
  props: P015Props; session: Session; operations: Operations; form: Form
  transactionKey: string; ruleKey: string; createTransactionKey: string; createRuleKey: string
}

const TRANSACTIONS = '/api/v1/processes/P015/point-transactions'
const RULES = '/api/v1/processes/P015/point-rules'
const pointKindOptions = [{ value: 'GROWTH', label: '成长积分' }, { value: 'HONOR', label: '荣誉积分' }] as const
const ACTIONS: Record<string, P015Action[]> = {
  S01: [action('REGISTER_EVENT', '登记业务事件', 'p015.points.manage')],
  S02: [action('VALIDATE_SOURCE', '校验人员与来源', 'p015.points.manage')],
  S03: [action('CHECK_DUPLICATE', '检查异常与重复', 'p015.points.manage')],
  S04: [action('MATCH_RULE', '匹配已发布规则', 'p015.points.manage')],
  S05: [action('CALCULATE_CAP', '确认计算与封顶', 'p015.points.manage')],
  S06: [action('CLASSIFY_RISK', '完成人工风险分类', 'p015.points.review')],
  S07: [action('POST_LEDGER', '写入不可变积分事实', 'p015.points.review')],
  S08: [action('CONFIRM_NOTICE', '确认积分通知', 'p015.points.read')],
  S09: [action('SUBMIT_ADJUSTMENT', '提交调整选择', 'p015.points.adjust'), action('REVIEW_ADJUSTMENT', '独立复核调整', 'p015.points.adjust')],
  S10: [action('RECALCULATE_BALANCE', '复算余额与等级', 'p015.points.manage')],
}

function action(code: string, label: string, permission: string): P015Action {
  return { code, label, permission }
}
function instant(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
function createForm() {
  return reactive({
    affectedEmployeeId: '', sourceFactKey: '', subject: '', reason: '', pointKind: 'GROWTH',
    quantity: '1', businessObjectNo: '', businessObjectName: '', employeeEventType: 'SERVICE',
    factSummary: '', evidenceNote: '', resultSummary: '', adjustmentRequested: false,
    adjustmentPoints: '0', adjustmentReason: '', adjustmentApproved: false, ruleCode: '',
    ruleVersionNo: '1', ruleEventType: 'SERVICE', unitPoints: '1', minPoints: '0',
    maxPoints: '1', reviewThreshold: '1', effectiveFrom: new Date().toISOString().slice(0, 16),
    effectiveTo: '', rankCode: 'BASE', rankMin: '0', rankMax: '',
  })
}
function evidence(form: Form) {
  return { note: form.evidenceNote.trim(), recordedAt: new Date().toISOString() }
}
function transactionBody(form: Form) {
  return {
    businessDate: new Date().toISOString().slice(0, 10), subject: form.subject.trim(),
    reason: form.reason.trim(), affectedEmployeeId: form.affectedEmployeeId.trim(),
    sourceFactKey: form.sourceFactKey.trim(), pointKind: form.pointKind,
    quantity: Number(form.quantity), businessObjectType: 'SERVICE_CASE',
    businessObjectNo: form.businessObjectNo.trim(), businessObjectName: form.businessObjectName.trim(),
    employeeEventType: form.employeeEventType, factOccurredAt: new Date().toISOString(),
    factSummary: form.factSummary.trim(), expiresAt: null, evidence: evidence(form),
  }
}
function ruleBody(form: Form) {
  return {
    ruleCode: form.ruleCode.trim(), versionNo: Number(form.ruleVersionNo),
    pointKind: form.pointKind, eventType: form.ruleEventType.trim(),
    unitPoints: Number(form.unitPoints), minPoints: Number(form.minPoints),
    maxPoints: Number(form.maxPoints), manualReviewThreshold: Number(form.reviewThreshold),
    effectiveFrom: instant(form.effectiveFrom), effectiveTo: instant(form.effectiveTo),
    ranks: [{ rankCode: form.rankCode.trim(), minBalance: Number(form.rankMin),
      maxBalance: form.rankMax.trim() ? Number(form.rankMax) : null }],
  }
}
function actionBody(form: Form, item: PointTransaction, candidate: P015Action) {
  const submits = candidate.code === 'SUBMIT_ADJUSTMENT'
  return {
    expectedVersion: item.versionNo,
    adjustmentRequested: submits ? form.adjustmentRequested : null,
    adjustmentPoints: submits && form.adjustmentRequested ? Number(form.adjustmentPoints) : null,
    adjustmentReason: submits && form.adjustmentRequested ? form.adjustmentReason.trim() : null,
    adjustmentApproved: candidate.code === 'REVIEW_ADJUSTMENT' ? form.adjustmentApproved : null,
    resultSummary: form.resultSummary.trim() || null, evidence: evidence(form),
  }
}
function loadTransactions(context: Context) {
  return async (): Promise<void> => {
    const allowed = context.session.can('p015.points.read') || context.session.can('p015.points.monitor')
    if (!allowed) return
    await context.operations.runResource(context.transactionKey, request =>
      listProcessRecords<PointTransaction>(context.session, TRANSACTIONS, request))
  }
}
function loadRules(context: Context) {
  return async (): Promise<void> => {
    if (context.props.mode !== 'tech' && !context.session.can('p015.points.manage')) return
    await context.operations.runResource(context.ruleKey, request =>
      listProcessRecords<Rule>(context.session, RULES, request))
  }
}
function createTransaction(context: Context, reload: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = transactionBody(context.form)
    const result = await context.operations.runAction(
      context.createTransactionKey,
      request => createProcessRecord<PointTransaction, typeof body>(
        context.session, TRANSACTIONS, 'p015-create', body, request,
      ),
      '积分业务已创建。',
    )
    if (result.ok) await reload()
  }
}
function createRule(context: Context, reload: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = ruleBody(context.form)
    const result = await context.operations.runAction(
      context.createRuleKey,
      request => createProcessRecord<Rule, typeof body>(
        context.session, RULES, 'p015-rule', body, request,
      ),
      '规则草稿已保存。',
    )
    if (result.ok) await reload()
  }
}
function publishRule(context: Context, reload: () => Promise<void>) {
  return async (rule: Rule): Promise<void> => {
    const key = `P015:publish:${rule.rule.id}`
    const result = await context.operations.runAction(
      key,
      request => context.session.request<Rule>(`${RULES}/${rule.rule.id}/publish`, {
        method: 'POST', idempotencyKey: idempotencyKey('p015-publish'), signal: request.signal,
      }),
      '规则版本已发布。',
    )
    if (result.ok) await reload()
  }
}
function performAction(context: Context, reload: () => Promise<void>) {
  return async (item: PointTransaction, candidate: P015Action): Promise<void> => {
    const key = `P015:action:${item.id}:${candidate.code}`
    const body = actionBody(context.form, item, candidate)
    const result = await context.operations.runAction(
      key,
      request => executeProcessAction<PointTransaction, typeof body>(
        context.session, TRANSACTIONS, item.id, candidate.code,
        `p015-${candidate.code.toLowerCase()}`, body, request,
      ),
      `${candidate.label}已完成。`,
    )
    if (result.ok) await reload()
  }
}
function availableActions(context: Context, item: PointTransaction): P015Action[] {
  if (context.props.mode === 'tech') return []
  const self = item.affectedEmployeeId === context.session.session?.employeeId
  return (ACTIONS[item.currentNodeCode] ?? []).filter(candidate => {
    if (!context.session.can(candidate.permission)) return false
    const selfAction = ['CONFIRM_NOTICE', 'SUBMIT_ADJUSTMENT'].includes(candidate.code)
    return selfAction ? self : !self
  })
}

export function useP015PointLedger(props: P015Props) {
  const session = usePortalSessionStore()
  const operations = useProcessOperation()
  const form = createForm()
  const context: Context = {
    props, session, operations, form,
    transactionKey: `P015:transactions:${props.portal.code}:${props.mode}`,
    ruleKey: `P015:rules:${props.portal.code}:${props.mode}`,
    createTransactionKey: `P015:create-transaction:${props.portal.code}:${props.mode}`,
    createRuleKey: `P015:create-rule:${props.portal.code}:${props.mode}`,
  }
  const transactionState = computed(() => operations.resourceState<PointTransaction[]>(context.transactionKey))
  const ruleState = computed(() => operations.resourceState<Rule[]>(context.ruleKey))
  const reloadTransactions = loadTransactions(context)
  const reloadRules = loadRules(context)
  const load = async () => { await Promise.all([reloadTransactions(), reloadRules()]) }
  watchEffect(() => { if (!form.affectedEmployeeId) form.affectedEmployeeId = session.session?.employeeId ?? '' })
  onMounted(() => { void load() })
  return {
    ...toRefs(form), records: computed(() => transactionState.value.data ?? []),
    rules: computed(() => ruleState.value.data ?? []), transactionState, ruleState,
    createTransactionState: computed(() => operations.actionState(context.createTransactionKey)),
    createRuleState: computed(() => operations.actionState(context.createRuleKey)),
    partialFailure: computed(() => (transactionState.value.failure !== 'none') !== (ruleState.value.failure !== 'none')),
    isTech: computed(() => props.mode === 'tech'), canRead: computed(() => session.can('p015.points.read') || session.can('p015.points.monitor')),
    canManage: computed(() => session.can('p015.points.manage')), pointKindOptions, load,
    loadTransactions: reloadTransactions, createTransaction: createTransaction(context, reloadTransactions),
    createRule: createRule(context, reloadRules), publish: publishRule(context, reloadRules),
    perform: performAction(context, reloadTransactions), actions: (item: PointTransaction) => availableActions(context, item),
    actionState: (item: PointTransaction, candidate: P015Action): ProcessState => operations.actionState(`P015:action:${item.id}:${candidate.code}`),
    publishState: (rule: Rule): ProcessState => operations.actionState(`P015:publish:${rule.rule.id}`),
  }
}
