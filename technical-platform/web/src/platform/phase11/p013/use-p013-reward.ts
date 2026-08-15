import { computed, onMounted, reactive, toRefs, watchEffect } from 'vue'
import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { createProcessRecord, executeProcessAction, listProcessRecords } from '../process-client'
import { processCommandActor } from '../process-command-journal'
import type { ProcessState } from '../process-state'
import { useProcessOperation } from '../use-process-operation'

export interface P013Props { portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }
interface Impact { id: string; impactType: string; authorityReference: string }
export interface RewardCase {
  id: string; businessNo: string; currentNodeCode: string | null; status: string
  versionNo: number; subject: string; sourceFactKey: string; employeeEventType: string
  impactLevel: string; recommendedRewardLevel: string | null; approvedRewardLevel: string | null
  impacts: Impact[]; receipts: unknown[]; availableActions: ServerAction[]
}
interface ServerAction { code: string; labelCode: string; taskId: string | null; expectedVersion: number }
export interface P013Action { code: string; label: string }
type Session = ReturnType<typeof usePortalSessionStore>
type Operations = ReturnType<typeof useProcessOperation>
type Form = ReturnType<typeof createForm>
interface Context {
  props: P013Props; session: Session; operations: Operations; form: Form
  resourceKey: string; createKey: string
}

const COLLECTION = '/api/v1/processes/P013/reward-cases'
const eventTypeOptions = [
  { value: 'SERVICE_CONTRIBUTION', label: '服务贡献' },
  { value: 'INNOVATION', label: '创新贡献' },
  { value: 'EMERGENCY_RESPONSE', label: '应急响应' },
] as const
const impactLevelOptions = ['HIGH', 'MEDIUM', 'LOW'].map(value => ({ value, label: value }))
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
const ACTION_PRESENTATION: Record<string, P013Action> = {
  RECORD_CONTRIBUTION: action('RECORD_CONTRIBUTION', '确认贡献事实'), VERIFY_EVIDENCE: action('VERIFY_EVIDENCE', '完成证据核验'),
  RECOMMEND_LEVEL: action('RECOMMEND_LEVEL', '提交奖励等级建议'), APPROVE: action('APPROVE', '独立审批奖励等级'),
  CHECK_DUPLICATE: action('CHECK_DUPLICATE', '独立复核重复奖励'), RECORD_IMPACT: action('RECORD_IMPACT', '登记影响指令'),
  COMPLETE_IMPACTS: action('COMPLETE_IMPACTS', '完成影响指令登记'), CONFIRM_NOTICE: action('CONFIRM_NOTICE', '员工确认奖励告知'),
  RECORD_RECEIPT: action('RECORD_RECEIPT', '登记权威执行回执'), COMPLETE_RECEIPTS: action('COMPLETE_RECEIPTS', '完成全部回执核验'),
  ARCHIVE: action('ARCHIVE', '归档奖励案例'),
}

function action(code: string, label: string): P013Action {
  return { code, label }
}
function instant(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
function createForm() {
  return reactive({
    businessDate: new Date().toISOString().slice(0, 10), subject: '', reason: '',
    ownerEmployeeId: '', sourceFactKey: '', employeeEventType: 'SERVICE_CONTRIBUTION',
    factOccurredAt: new Date().toISOString().slice(0, 16), factSummary: '',
    impactLevel: 'HIGH', rewardLevel: 'GOLD', impactType: 'HONOR_POINTS',
    requestedPoints: '', approvedAmount: '', authorityReference: '', instructionId: '',
    receiptType: 'P015_POINT_LEDGER', externalReference: '',
    externalOccurredAt: new Date().toISOString().slice(0, 16),
    resultSummary: '', evidenceNote: '',
  })
}
function evidence(form: Form) {
  return { note: form.evidenceNote.trim(), recordedAt: new Date().toISOString() }
}
function createBody(form: Form) {
  return {
    businessDate: form.businessDate, subject: form.subject.trim(),
    reason: form.reason.trim() || null, ownerEmployeeId: form.ownerEmployeeId.trim(),
    sourceFactKey: form.sourceFactKey.trim(), employeeEventType: form.employeeEventType,
    factOccurredAt: instant(form.factOccurredAt), factSummary: form.factSummary.trim(),
    impactLevel: form.impactLevel, evidence: evidence(form),
  }
}
function payload(form: Form, code: string): Record<string, unknown> {
  const optionalNumber = (value: string) => value.trim() ? Number(value) : null
  const values: Record<string, Record<string, unknown>> = {
    RECOMMEND_LEVEL: { rewardLevel: form.rewardLevel.trim() },
    APPROVE: { rewardLevel: form.rewardLevel.trim() },
    RECORD_IMPACT: {
      impactType: form.impactType, requestedPoints: optionalNumber(form.requestedPoints),
      approvedAmount: optionalNumber(form.approvedAmount),
      authorityReference: form.authorityReference.trim(),
    },
    RECORD_RECEIPT: {
      instructionId: form.instructionId.trim() || null, receiptType: form.receiptType,
      externalReference: form.externalReference.trim(),
      externalOccurredAt: instant(form.externalOccurredAt),
    },
  }
  return values[code] ?? {}
}
function actionBody(form: Form, item: RewardCase, candidate: P013Action) {
  return {
    expectedVersion: item.versionNo, resultSummary: form.resultSummary.trim() || null,
    evidence: evidence(form), ...payload(form, candidate.code),
  }
}
function createLoad(context: Context) {
  return async (): Promise<void> => {
    const allowed = context.session.can('p013.reward.read') || context.session.can('p013.reward.monitor')
    if (!allowed) return
    await context.operations.runResource(context.resourceKey, request =>
      listProcessRecords<RewardCase>(context.session, COLLECTION, request))
  }
}
function createCreate(context: Context, load: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = createBody(context.form)
    const result = await context.operations.runCommand(
      {
        stateKey: context.createKey,
        recordLockKey: `P013:record:create:${context.props.portal.code}:${context.props.mode}`,
        operationKey: 'P013:create', actor: processCommandActor(context.session), payload: body,
      },
      request => createProcessRecord<RewardCase, typeof body>(
        context.session, COLLECTION, request.idempotencyKey, body, request,
      ),
      '奖励案例已创建。',
    )
    if (result.ok) await load()
  }
}
function createPerform(context: Context, load: () => Promise<void>) {
  return async (item: RewardCase, candidate: P013Action): Promise<void> => {
    const key = `P013:action:${item.id}:${candidate.code}`
    const body = actionBody(context.form, item, candidate)
    const result = await context.operations.runCommand(
      {
        stateKey: key, recordLockKey: `P013:record:${item.id}`,
        operationKey: `P013:record:${item.id}:${candidate.code}`,
        actor: processCommandActor(context.session), payload: body,
      },
      request => executeProcessAction<RewardCase, typeof body>(
        context.session, COLLECTION, item.id, candidate.code,
        request.idempotencyKey, body, request,
      ),
      `${candidate.label}已完成。`,
    )
    if (result.ok) await load()
  }
}
function availableActions(item: RewardCase): P013Action[] {
  return item.availableActions.flatMap(candidate => ACTION_PRESENTATION[candidate.code] ?? [])
}

export function useP013Reward(props: P013Props) {
  const session = usePortalSessionStore()
  const operations = useProcessOperation()
  const form = createForm()
  const resourceKey = `P013:rewards:${props.portal.code}:${props.mode}`
  const createKey = `P013:create:${props.portal.code}:${props.mode}`
  const context = { props, session, operations, form, resourceKey, createKey }
  const listState = computed(() => operations.resourceState<RewardCase[]>(resourceKey))
  const records = computed(() => listState.value.data ?? [])
  const createState = computed(() => operations.actionState(createKey))
  const canRead = computed(() => session.can('p013.reward.read') || session.can('p013.reward.monitor'))
  const load = createLoad(context)
  const create = createCreate(context, load)
  const perform = createPerform(context, load)
  watchEffect(() => { if (!form.ownerEmployeeId) form.ownerEmployeeId = session.session?.employeeId ?? '' })
  onMounted(() => { if (canRead.value) void load() })
  return {
    ...toRefs(form), records, listState, createState, canRead,
    canCreate: computed(() => session.can('p013.reward.manage')),
    isTech: computed(() => props.mode === 'tech'), eventTypeOptions, impactLevelOptions,
    impactTypeOptions, receiptTypeOptions, load, create, perform,
    actions: (item: RewardCase) => availableActions(item),
    actionState: (item: RewardCase, candidate: P013Action): ProcessState =>
      operations.actionState(`P013:action:${item.id}:${candidate.code}`),
    recordPending: (item: RewardCase) =>
      operations.recordPending(processCommandActor(session), `P013:record:${item.id}`),
  }
}
