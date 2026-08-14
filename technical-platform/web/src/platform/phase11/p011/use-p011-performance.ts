import { computed, onMounted, reactive, toRefs } from 'vue'
import { usePortalSessionStore } from '../../../session'
import type { PortalDefinition } from '../../portal-config'
import { createProcessRecord, executeProcessAction, listProcessRecords } from '../process-client'
import { isPending } from '../process-state'
import { useProcessOperation } from '../use-process-operation'

export interface P011Props { portal: PortalDefinition; mode: 'employee' | 'center' | 'tech' }
interface Fact { id: string; scoreType?: string; score1000?: number }
export interface Cycle {
  id: string; businessNo: string; currentNodeCode: string | null; status: string
  versionNo: number; subject: string; ownerEmployeeId: string; score1000: number | null
  appealStatus: string | null; scores: Fact[]
}
export interface P011Action { code: string; label: string; permission: string }
type Session = ReturnType<typeof usePortalSessionStore>
type Operations = ReturnType<typeof useProcessOperation>
type Form = ReturnType<typeof createForm>
interface Context {
  props: P011Props; session: Session; operations: Operations; form: Form
  resourceKey: string; createKey: string
}

const COLLECTION = '/api/v1/processes/P011/performance-cycles'
const executionOptions = [
  { value: 'DEVELOPMENT_PLAN', label: '发展计划' },
  { value: 'PERFORMANCE_IMPROVEMENT', label: '绩效改进' },
  { value: 'EXTERNAL_HR_REFERENCE', label: '外部人事引用' },
] as const
const ACTIONS: Record<string, P011Action[]> = {
  S01: [action('SET_TARGET', '制定目标', 'p011.performance.manage')],
  S02: [action('CONFIRM_TARGET', '员工确认', 'p011.performance.read')],
  S03: [action('RECORD_COACHING', '记录辅导', 'p011.performance.manage')],
  S04: [action('COLLECT_AUTHORITY_DATA', '归集权威数据', 'p011.performance.manage')],
  S05: [
    action('SUBMIT_SELF_EVALUATION', '提交员工自评', 'p011.performance.evaluate'),
    action('SUBMIT_SUPERVISOR_EVALUATION', '提交主管评价', 'p011.performance.evaluate'),
  ],
  S06: [action('CALCULATE_SCORE', '计算千分制得分', 'p011.performance.manage')],
  S07: [action('CALIBRATE', '独立校准', 'p011.performance.calibrate')],
  S08: [action('CONFIRM_FEEDBACK', '确认反馈', 'p011.performance.read')],
  S09: [
    action('RESOLVE_APPEAL', '复核申诉', 'p011.performance.appeal'),
    action('NO_APPEAL', '确认无申诉', 'p011.performance.appeal'),
  ],
  S10: [action('EXECUTE_EFFECT', '登记影响执行', 'p011.performance.execute')],
  S11: [action('ARCHIVE', '归档', 'p011.performance.manage')],
}

function action(code: string, label: string, permission: string): P011Action {
  return { code, label, permission }
}
function createForm() {
  return reactive({
    businessDate: new Date().toISOString().slice(0, 10), subject: '', reason: '',
    ownerEmployeeId: '', contentVersion: '2026-H2', periodOrCourseNo: '2026-H2',
    score1000: '', appealRaised: false, executionType: 'DEVELOPMENT_PLAN',
    externalReference: '', resultSummary: '', evidenceNote: '',
  })
}
function evidence(form: Form) {
  return { note: form.evidenceNote.trim(), recordedAt: new Date().toISOString() }
}
function createBody(form: Form) {
  return {
    businessDate: form.businessDate, subject: form.subject.trim(),
    reason: form.reason.trim() || null, ownerEmployeeId: form.ownerEmployeeId.trim(),
    contentVersion: form.contentVersion.trim(), periodOrCourseNo: form.periodOrCourseNo.trim(),
    evidence: evidence(form),
  }
}
function actionBody(form: Form, item: Cycle, candidate: P011Action) {
  const scored = ['SUBMIT_SELF_EVALUATION', 'SUBMIT_SUPERVISOR_EVALUATION', 'CALIBRATE']
    .includes(candidate.code)
  return {
    expectedVersion: item.versionNo, score1000: scored ? Number(form.score1000) : null,
    appealRaised: candidate.code === 'CONFIRM_FEEDBACK' ? form.appealRaised : null,
    executionType: candidate.code === 'EXECUTE_EFFECT' ? form.executionType : null,
    externalReference: candidate.code === 'EXECUTE_EFFECT' ? form.externalReference.trim() : null,
    resultSummary: form.resultSummary.trim() || null, evidence: evidence(form),
  }
}
function createLoad(context: Context) {
  return async (): Promise<void> => {
    if (!context.session.can('p011.performance.read')
      && !context.session.can('p011.performance.monitor')) return
    await context.operations.runResource(context.resourceKey, request =>
      listProcessRecords<Cycle>(context.session, COLLECTION, request))
  }
}
function createCreate(context: Context, load: () => Promise<void>) {
  return async (): Promise<void> => {
    const body = createBody(context.form)
    const result = await context.operations.runAction(
      context.createKey,
      request => createProcessRecord<Cycle, typeof body>(
        context.session, COLLECTION, 'p011-create', body, request,
      ),
      '绩效周期已创建。',
    )
    if (result.ok) await load()
  }
}
function createPerform(context: Context, load: () => Promise<void>) {
  return async (item: Cycle, candidate: P011Action): Promise<void> => {
    const key = `P011:action:${item.id}:${candidate.code}`
    const body = actionBody(context.form, item, candidate)
    const result = await context.operations.runAction(
      key,
      request => executeProcessAction<Cycle, typeof body>(
        context.session, COLLECTION, item.id, candidate.code,
        `p011-${candidate.code.toLowerCase()}`, body, request,
      ),
      `${candidate.label}已完成。`,
    )
    if (result.ok) await load()
  }
}
function availableActions(context: Context, item: Cycle): P011Action[] {
  if (context.props.mode === 'tech' || !item.currentNodeCode) return []
  return (ACTIONS[item.currentNodeCode] ?? [])
    .filter(candidate => context.session.can(candidate.permission))
}

export function useP011Performance(props: P011Props) {
  const session = usePortalSessionStore()
  const operations = useProcessOperation()
  const form = createForm()
  const resourceKey = `P011:cycles:${props.portal.code}:${props.mode}`
  const createKey = `P011:create:${props.portal.code}:${props.mode}`
  const context = { props, session, operations, form, resourceKey, createKey }
  const listState = computed(() => operations.resourceState<Cycle[]>(resourceKey))
  const records = computed(() => listState.value.data ?? [])
  const createState = computed(() => operations.actionState(createKey))
  const canRead = computed(() => session.can('p011.performance.read')
    || session.can('p011.performance.monitor'))
  const load = createLoad(context)
  const create = createCreate(context, load)
  const perform = createPerform(context, load)
  onMounted(() => { if (canRead.value) void load() })
  return {
    session, ...toRefs(form), records, listState, createState, canRead,
    isCenter: computed(() => props.mode === 'center'),
    isTech: computed(() => props.mode === 'tech'),
    executionOptions, load, create, perform,
    actions: (item: Cycle) => availableActions(context, item),
    actionState: (item: Cycle, candidate: P011Action) =>
      operations.actionState(`P011:action:${item.id}:${candidate.code}`),
    actionPending: (item: Cycle, candidate: P011Action) => isPending(
      operations.actionState(`P011:action:${item.id}:${candidate.code}`),
    ),
  }
}
