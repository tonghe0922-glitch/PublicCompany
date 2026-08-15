import { computed, onMounted, reactive, toRefs, watchEffect } from 'vue'
import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { createProcessRecord, executeProcessAction, listProcessRecords } from '../process-client'
import { processCommandActor } from '../process-command-journal'
import type { ProcessState } from '../process-state'
import { useProcessOperation } from '../use-process-operation'

export interface P012Props { portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }
interface ExecutionFact { id: string; executionType: string; effectiveDate: string }
export interface PromotionRecord {
  id: string; businessNo: string; currentNodeCode: string | null; status: string
  versionNo: number; subject: string; ownerEmployeeId: string; targetPositionCode: string
  plannedEffectiveDate: string; score1000: number | null; executions: ExecutionFact[]; availableActions: ServerAction[]
}
interface ServerAction { code: string; labelCode: string; taskId: string | null; expectedVersion: number }
export interface P012Action { code: string; label: string }
type Session = ReturnType<typeof usePortalSessionStore>
type Operations = ReturnType<typeof useProcessOperation>
type Form = ReturnType<typeof createForm>
interface Context {
  props: P012Props; session: Session; operations: Operations; form: Form
  resourceKey: string; createKey: string
}

const COLLECTION = '/api/v1/processes/P012/promotion-requests'
const employmentOptions = [
  { value: 'FULL_TIME', label: '正式员工' },
  { value: 'CONTRACT', label: '合同员工' },
] as const
const probationOptions = [
  { value: 'PASS', label: '通过' },
  { value: 'ROLLBACK', label: '回退' },
] as const
const ACTION_PRESENTATION: Record<string, P012Action> = {
  SUBMIT: action('SUBMIT', '提交申请或提名'), CHECK_ELIGIBILITY: action('CHECK_ELIGIBILITY', '完成资格与冻结审查'),
  RECORD_ASSESSMENT: action('RECORD_ASSESSMENT', '登记千分制评估'), VERIFY_VACANCY_BUDGET: action('VERIFY_VACANCY_BUDGET', '核验岗位空缺与预算'),
  COMPLETE_REVIEW: action('COMPLETE_REVIEW', '完成独立竞聘评审'), APPROVE: action('APPROVE', '审批'),
  COMPLETE_NOTICE: action('COMPLETE_NOTICE', '完成公示与告知'), RECORD_APPOINTMENT: action('RECORD_APPOINTMENT', '登记任命与薪资权威回执'),
  CONFIRM_APPOINTMENT: action('CONFIRM_APPOINTMENT', '员工确认任命'), COMPLETE_PROBATION: action('COMPLETE_PROBATION', '完成验证期'),
  MAKE_EFFECTIVE: action('MAKE_EFFECTIVE', '正式生效'), ROLL_BACK: action('ROLL_BACK', '登记回退安排'),
}

function action(code: string, label: string): P012Action {
  return { code, label }
}
function createForm() {
  return reactive({
    businessDate: new Date().toISOString().slice(0, 10), subject: '', reason: '',
    ownerEmployeeId: '', employmentType: 'FULL_TIME', headcountNo: '', periodOrCourseNo: '',
    targetPositionCode: '', plannedEffectiveDate: '', score1000: '',
    eligibilityConfirmed: false, freezeClear: false, vacancyConfirmed: false,
    budgetVerificationReference: '', reviewPassed: false, approved: false,
    salaryConfirmationReference: '', externalReference: '', probationResult: 'PASS',
    actualEffectiveDate: '', resultSummary: '', evidenceNote: '',
  })
}
function evidence(form: Form) {
  return { note: form.evidenceNote.trim(), recordedAt: new Date().toISOString() }
}
function createBody(form: Form) {
  return {
    businessDate: form.businessDate, subject: form.subject.trim(),
    reason: form.reason.trim() || null, ownerEmployeeId: form.ownerEmployeeId.trim(),
    employmentType: form.employmentType, headcountNo: form.headcountNo.trim() || null,
    periodOrCourseNo: form.periodOrCourseNo.trim(),
    targetPositionCode: form.targetPositionCode.trim(),
    plannedEffectiveDate: form.plannedEffectiveDate, evidence: evidence(form),
  }
}
function payload(form: Form, code: string): Record<string, unknown> {
  const values: Record<string, Record<string, unknown>> = {
    CHECK_ELIGIBILITY: { eligibilityConfirmed: form.eligibilityConfirmed, freezeClear: form.freezeClear },
    RECORD_ASSESSMENT: { score1000: Number(form.score1000) },
    VERIFY_VACANCY_BUDGET: {
      vacancyConfirmed: form.vacancyConfirmed,
      budgetVerificationReference: form.budgetVerificationReference.trim(),
    },
    COMPLETE_REVIEW: { reviewPassed: form.reviewPassed },
    APPROVE: { approved: form.approved },
    RECORD_APPOINTMENT: {
      salaryConfirmationReference: form.salaryConfirmationReference.trim(),
      externalReference: form.externalReference.trim(), actualEffectiveDate: form.actualEffectiveDate,
    },
    COMPLETE_PROBATION: { probationResult: form.probationResult },
    MAKE_EFFECTIVE: { externalReference: form.externalReference.trim(), actualEffectiveDate: form.actualEffectiveDate },
    ROLL_BACK: { externalReference: form.externalReference.trim(), actualEffectiveDate: form.actualEffectiveDate },
  }
  return values[code] ?? {}
}
function actionBody(form: Form, item: PromotionRecord, candidate: P012Action) {
  return {
    expectedVersion: item.versionNo, resultSummary: form.resultSummary.trim() || null,
    evidence: evidence(form), ...payload(form, candidate.code),
  }
}
function createLoad(context: Context) {
  return async (): Promise<void> => {
    const allowed = context.session.can('p012.promotion.read')
      || context.session.can('p012.promotion.monitor')
    if (!allowed) return
    await context.operations.runResource(context.resourceKey, request =>
      listProcessRecords<PromotionRecord>(context.session, COLLECTION, request))
  }
}
function createCreate(context: Context, load: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = createBody(context.form)
    const result = await context.operations.runCommand(
      {
        stateKey: context.createKey,
        recordLockKey: `P012:record:create:${context.props.portal.code}:${context.props.mode}`,
        operationKey: 'P012:create', actor: processCommandActor(context.session), payload: body,
      },
      request => createProcessRecord<PromotionRecord, typeof body>(
        context.session, COLLECTION, request.idempotencyKey, body, request,
      ),
      '晋升申请已创建。',
    )
    if (result.ok) await load()
  }
}
function createPerform(context: Context, load: () => Promise<void>) {
  return async (item: PromotionRecord, candidate: P012Action): Promise<void> => {
    const key = `P012:action:${item.id}:${candidate.code}`
    const body = actionBody(context.form, item, candidate)
    const result = await context.operations.runCommand(
      {
        stateKey: key, recordLockKey: `P012:record:${item.id}`,
        operationKey: `P012:record:${item.id}:${candidate.code}`,
        actor: processCommandActor(context.session), payload: body,
      },
      request => executeProcessAction<PromotionRecord, typeof body>(
        context.session, COLLECTION, item.id, candidate.code,
        request.idempotencyKey, body, request,
      ),
      `${candidate.label}已完成。`,
    )
    if (result.ok) await load()
  }
}
function availableActions(item: PromotionRecord): P012Action[] {
  return item.availableActions.flatMap(candidate => ACTION_PRESENTATION[candidate.code] ?? [])
}

export function useP012Promotion(props: P012Props) {
  const session = usePortalSessionStore()
  const operations = useProcessOperation()
  const form = createForm()
  const resourceKey = `P012:promotions:${props.portal.code}:${props.mode}`
  const createKey = `P012:create:${props.portal.code}:${props.mode}`
  const context = { props, session, operations, form, resourceKey, createKey }
  const listState = computed(() => operations.resourceState<PromotionRecord[]>(resourceKey))
  const records = computed(() => listState.value.data ?? [])
  const createState = computed(() => operations.actionState(createKey))
  const canRead = computed(() => session.can('p012.promotion.read') || session.can('p012.promotion.monitor'))
  const load = createLoad(context)
  const create = createCreate(context, load)
  const perform = createPerform(context, load)
  watchEffect(() => { if (!form.ownerEmployeeId) form.ownerEmployeeId = session.session?.employeeId ?? '' })
  onMounted(() => { if (canRead.value) void load() })
  return {
    ...toRefs(form), records, listState, createState, canRead,
    canCreate: computed(() => session.can('p012.promotion.read') || session.can('p012.promotion.manage')),
    isTech: computed(() => props.mode === 'tech'), employmentOptions, probationOptions,
    load, create, perform, actions: (item: PromotionRecord) => availableActions(item),
    actionState: (item: PromotionRecord, candidate: P012Action): ProcessState =>
      operations.actionState(`P012:action:${item.id}:${candidate.code}`),
    recordPending: (item: PromotionRecord) =>
      operations.recordPending(processCommandActor(session), `P012:record:${item.id}`),
  }
}
