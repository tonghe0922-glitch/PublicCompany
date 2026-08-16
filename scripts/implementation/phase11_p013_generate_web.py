from pathlib import Path


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.strip() + "\n", encoding="utf-8")


write(
    "technical-platform/web/src/platform/phase11/shared/usePhase11CaseBoard.ts",
    r'''
import { computed, onMounted, reactive, ref, type Ref } from 'vue'
import { usePortalSessionStore } from '../../../session'
import {
  idempotencyKey,
  useAsyncActionState,
  type AsyncActionState,
  type PortalSessionStore,
} from '../../phase10/shared'
import type { Phase11Action, Phase11Portal, Phase11Record } from '../types'

export type Phase11CaseFieldKind = 'text' | 'number' | 'date' | 'datetime-local' | 'textarea'

export interface Phase11CaseField {
  key: string
  label: string
  kind: Phase11CaseFieldKind
  required?: boolean
  centerOnly?: boolean
  placeholder?: string
  min?: string
  max?: string
  step?: string
}

export interface Phase11CaseColumn {
  key: string
  label: string
  source: 'record' | 'details'
}

export interface Phase11CaseBoardConfig {
  processCode: string
  endpoint: string
  createPermission: string
  titles: Readonly<Record<Phase11Portal, string>>
  descriptions: Readonly<Record<Phase11Portal, string>>
  fields: readonly Phase11CaseField[]
  columns: readonly Phase11CaseColumn[]
  actions: Readonly<Record<string, readonly Phase11Action[]>>
  initialValues: Readonly<Record<string, string>>
  buildCreateBody: (
    values: Readonly<Record<string, string>>,
    ownerCenterId: string,
    ownerEmployeeId: string,
  ) => Readonly<Record<string, unknown>>
}

interface ActionForm {
  summary: string
  reason: string
  decision: string
  financeReferenceId: string
  receiptReference: string
}

interface BoardContext {
  session: PortalSessionStore
  rows: Ref<Phase11Record[]>
  createForm: Record<string, string>
  actionForm: ActionForm
  state: AsyncActionState
  portal: Phase11Portal
  config: Phase11CaseBoardConfig
}

function actionDefaults(): ActionForm {
  return {
    summary: '',
    reason: '',
    decision: '',
    financeReferenceId: '',
    receiptReference: '',
  }
}

function loadData(context: BoardContext): Promise<void> {
  return context.session.request<Phase11Record[]>(context.config.endpoint)
    .then((records) => { context.rows.value = records })
}

function createCase(context: BoardContext): () => Promise<void> {
  return () => context.state.run(async () => {
    const active = context.session.session
    if (!active?.orgId) throw new Error('缺少中心身份')
    const owner = context.portal === 'employee'
      ? active.employeeId
      : context.createForm.ownerEmployeeId?.trim()
    if (!owner) throw new Error('缺少奖励对象员工')
    const body = context.config.buildCreateBody(context.createForm, active.orgId, owner)
    await context.session.request(context.config.endpoint, {
      method: 'POST',
      idempotencyKey: idempotencyKey(context.config.processCode, 'create'),
      body,
    })
    context.state.feedback.value = `${context.config.processCode} 事项已创建并进入服务端工作流`
    Object.assign(context.createForm, context.config.initialValues)
    await loadData(context)
  })
}

function actOnCase(context: BoardContext) {
  return (record: Phase11Record, action: Phase11Action) => context.state.run(async () => {
    await context.session.request(`${context.config.endpoint}/${record.id}/actions/${action.code}`, {
      method: 'POST',
      idempotencyKey: idempotencyKey(context.config.processCode, action.code.toLowerCase()),
      body: {
        expectedVersion: record.versionNo,
        summary: context.actionForm.summary.trim() || null,
        reason: context.actionForm.reason.trim() || null,
        decision: context.actionForm.decision.trim() || null,
        financeReferenceId: context.actionForm.financeReferenceId.trim() || null,
        receiptReference: context.actionForm.receiptReference.trim() || null,
      },
    })
    context.state.feedback.value = `${record.businessNo} 已执行 ${action.label}`
    Object.assign(context.actionForm, actionDefaults())
    await loadData(context)
  })
}

export function usePhase11CaseBoard(
  portal: Phase11Portal,
  config: Phase11CaseBoardConfig,
) {
  const context: BoardContext = {
    session: usePortalSessionStore(),
    rows: ref<Phase11Record[]>([]),
    createForm: reactive({ ...config.initialValues }),
    actionForm: reactive(actionDefaults()),
    state: useAsyncActionState(),
    portal,
    config,
  }
  const load = () => context.state.run(() => loadData(context))
  const open = computed(() => context.rows.value.filter((row) => row.currentNodeCode !== 'END').length)
  onMounted(() => void load())
  return {
    rows: context.rows,
    createForm: context.createForm,
    actionForm: context.actionForm,
    total: computed(() => context.rows.value.length),
    open,
    closed: computed(() => context.rows.value.length - open.value),
    ...context.state,
    load,
    create: createCase(context),
    act: actOnCase(context),
    canAct: (action: Phase11Action) => context.session.can(action.permission),
    actionsFor: (record: Phase11Record) => config.actions[record.currentNodeCode] ?? [],
    canCreate: computed(() => context.session.can(config.createPermission)),
  }
}
''',
)

write(
    "technical-platform/web/src/platform/phase11/shared/Phase11CaseBoard.vue",
    r'''
<script setup lang="ts">
import { computed } from 'vue'
import {
  SgjButton,
  SgjCard,
  SgjDashboardPageTemplate,
  SgjInput,
  SgjKpiCard,
  SgjStatusChip,
  SgjTable,
  SgjTextarea,
} from '../../../design-system'
import { statusTone } from '../../phase10/shared'
import type { Phase11Portal, Phase11Record } from '../types'
import {
  usePhase11CaseBoard,
  type Phase11CaseBoardConfig,
  type Phase11CaseColumn,
  type Phase11CaseField,
} from './usePhase11CaseBoard'

const props = defineProps<{
  portal: Phase11Portal
  config: Phase11CaseBoardConfig
}>()

const {
  rows, createForm, actionForm, total, open, closed, busy, feedback, failed,
  load, create, act, canAct, actionsFor, canCreate,
} = usePhase11CaseBoard(props.portal, props.config)

const title = computed(() => props.config.titles[props.portal])
const description = computed(() => props.config.descriptions[props.portal])
const visibleFields = computed(() => props.config.fields.filter(
  (field) => !field.centerOnly || props.portal === 'center',
))

function detail(record: Phase11Record, key: string): string {
  const value = record.details?.[key]
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function cell(record: Phase11Record, column: Phase11CaseColumn): string | number {
  if (column.source === 'details') return detail(record, column.key)
  const value = record[column.key as keyof Phase11Record]
  if (value === null || value === undefined || value === '') return '-'
  return typeof value === 'number' ? value : String(value)
}

function inputType(field: Phase11CaseField): string {
  return field.kind === 'textarea' ? 'text' : field.kind
}
</script>

<template>
  <SgjDashboardPageTemplate :title="title" :description="description">
    <template #actions>
      <SgjButton variant="secondary" :loading="busy" @click="load">刷新权威事实</SgjButton>
    </template>

    <template #kpis>
      <SgjKpiCard label="事项总数" :value="total" unit="个" definition="当前数据权限范围内的服务端事项" />
      <SgjKpiCard label="进行中" :value="open" unit="个" definition="工作流节点尚未到 END" tone="danger" />
      <SgjKpiCard label="已关闭" :value="closed" unit="个" definition="服务端工作流已完成并归档" tone="neutral" />
    </template>

    <p v-if="feedback" class="case-board__feedback" :class="{ 'case-board__feedback--error': failed }">
      {{ feedback }}
    </p>

    <SgjCard v-if="portal !== 'tech' && canCreate" class="case-board__panel">
      <template #header><h2>登记服务端事项</h2></template>
      <div class="case-board__form">
        <template v-for="field in visibleFields" :key="field.key">
          <SgjTextarea
            v-if="field.kind === 'textarea'"
            v-model="createForm[field.key]"
            :label="field.label"
            :required="field.required"
            :placeholder="field.placeholder"
          />
          <SgjInput
            v-else
            v-model="createForm[field.key]"
            :label="field.label"
            :type="inputType(field)"
            :required="field.required"
            :placeholder="field.placeholder"
            :min="field.min"
            :max="field.max"
            :step="field.step"
          />
        </template>
      </div>
      <template #footer>
        <SgjButton :loading="busy" @click="create">创建并提交首节点</SgjButton>
      </template>
    </SgjCard>

    <SgjCard class="case-board__panel">
      <template #header><h2>权威流程事实</h2></template>
      <SgjTable
        :empty="rows.length === 0"
        :column-count="config.columns.length + 3"
        empty-text="暂无符合当前权限范围的事项"
      >
        <template #head>
          <tr>
            <th>业务单号</th><th>状态/节点</th><th>版本</th>
            <th v-for="column in config.columns" :key="column.key">{{ column.label }}</th>
          </tr>
        </template>
        <template #body>
          <tr v-for="record in rows" :key="record.id">
            <td>{{ record.businessNo }}</td>
            <td>
              <SgjStatusChip :tone="statusTone(record.status)">{{ record.status }}</SgjStatusChip>
              <small>{{ record.currentNodeCode }}</small>
            </td>
            <td>{{ record.versionNo }}</td>
            <td v-for="column in config.columns" :key="`${record.id}-${column.key}`">
              {{ cell(record, column) }}
            </td>
          </tr>
        </template>
      </SgjTable>
    </SgjCard>

    <template v-if="portal !== 'tech'" #aside>
      <SgjCard class="case-board__panel">
        <template #header><h2>当前节点处理</h2></template>
        <SgjTextarea v-model="actionForm.summary" label="处理摘要与事实依据" />
        <SgjTextarea v-model="actionForm.reason" label="工作流意见/原因" />
        <SgjTextarea v-model="actionForm.decision" label="审批或复核决定" />
        <SgjInput v-model="actionForm.financeReferenceId" label="权威财务事实 ID" />
        <SgjInput v-model="actionForm.receiptReference" label="回执编号" />
        <div v-for="record in rows" :key="`action-${record.id}`" class="case-board__actions">
          <strong>{{ record.businessNo }} · {{ record.currentNodeCode }}</strong>
          <SgjButton
            v-for="action in actionsFor(record).filter(canAct)"
            :key="action.code"
            :variant="action.tone ?? 'primary'"
            :loading="busy"
            @click="act(record, action)"
          >{{ action.label }}</SgjButton>
        </div>
      </SgjCard>
    </template>
  </SgjDashboardPageTemplate>
</template>

<style scoped>
.case-board__panel { margin-bottom: 16px; }
.case-board__form { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
.case-board__feedback { padding: 12px 14px; border: 1px solid var(--sgj-border); border-radius: 10px; }
.case-board__feedback--error { font-weight: 700; }
.case-board__actions { display: grid; gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--sgj-border); }
small { display: block; margin-top: 4px; }
</style>
''',
)

write(
    "technical-platform/web/src/platform/phase11/p013/p013-config.ts",
    r'''
import type { Phase11CaseBoardConfig } from '../shared/usePhase11CaseBoard'

function required(values: Readonly<Record<string, string>>, key: string, label: string): string {
  const value = values[key]?.trim()
  if (!value) throw new Error(`${label}不能为空`)
  return value
}

function integer(values: Readonly<Record<string, string>>, key: string, label: string): number {
  const value = Number(required(values, key, label))
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}必须是非负整数`)
  return value
}

function money(values: Readonly<Record<string, string>>, key: string, label: string): number {
  const value = Number(required(values, key, label))
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label}必须是非负金额`)
  return value
}

export const P013_REWARD_CONFIG: Phase11CaseBoardConfig = {
  processCode: 'P013',
  endpoint: '/api/v1/processes/P013/rewards',
  createPermission: 'p013.reward.create',
  titles: {
    employee: '我的奖励与认可',
    center: '奖励与认可工作台',
    tech: '奖励流程运行监控',
  },
  descriptions: {
    employee: '查看本人贡献事实、审批、执行与回执进度；所有奖励影响来自服务端权威事实。',
    center: '核验证据、形成奖励建议、完成审批，并在财务与积分事实满足后执行奖励。',
    tech: '仅查看节点、版本和运行元数据，不参与奖励结论或影响执行。',
  },
  initialValues: {
    subject: '',
    ownerEmployeeId: '',
    sourceFactKey: '',
    periodNo: '2026-Q3',
    contentVersion: 'P013-CONTENT-V1',
    factOccurredAt: '',
    impactEffectiveDate: '',
    impactLevel: 'CENTER',
    pointsDelta: '0',
    benefitAmount: '0',
    compGradeImpact: '',
    reason: '',
    factSummary: '',
  },
  fields: [
    { key: 'subject', label: '奖励主题', kind: 'text', required: true },
    { key: 'ownerEmployeeId', label: '奖励对象员工 ID', kind: 'text', required: true, centerOnly: true },
    { key: 'sourceFactKey', label: '贡献事实唯一键', kind: 'text', required: true },
    { key: 'periodNo', label: '奖励周期', kind: 'text', required: true },
    { key: 'contentVersion', label: '规则/内容版本', kind: 'text', required: true },
    { key: 'factOccurredAt', label: '贡献发生时间', kind: 'datetime-local', required: true },
    { key: 'impactEffectiveDate', label: '奖励影响日期', kind: 'date' },
    { key: 'impactLevel', label: '奖励影响级别', kind: 'text', required: true },
    { key: 'pointsDelta', label: '奖励积分', kind: 'number', required: true, min: '0', step: '1' },
    { key: 'benefitAmount', label: '奖励金额', kind: 'number', required: true, min: '0', step: '0.01' },
    { key: 'compGradeImpact', label: '职级/荣誉影响', kind: 'text' },
    { key: 'reason', label: '奖励原因', kind: 'textarea', required: true },
    { key: 'factSummary', label: '贡献事实与证据摘要', kind: 'textarea', required: true },
  ],
  columns: [
    { key: 'subject', label: '主题', source: 'record' },
    { key: 'sourceFactKey', label: '事实键', source: 'details' },
    { key: 'benefitAmount', label: '金额', source: 'details' },
    { key: 'pointsDelta', label: '积分', source: 'details' },
    { key: 'pointEffectId', label: '积分影响事实', source: 'details' },
    { key: 'financeReferenceId', label: '财务事实', source: 'details' },
  ],
  actions: {
    S02: [{ code: 'VERIFY_EVIDENCE', label: '完成证据核验', permission: 'p013.reward.review', needsSummary: true }],
    S03: [{ code: 'RECOMMEND_REWARD', label: '提交奖励建议', permission: 'p013.reward.review', needsSummary: true }],
    S04: [{ code: 'APPROVE_REWARD', label: '批准奖励', permission: 'p013.reward.review', needsSummary: true }],
    S05: [{ code: 'CHECK_DUPLICATE_IMPACT', label: '校验重复影响', permission: 'p013.reward.review', needsSummary: true }],
    S06: [{ code: 'EXECUTE_REWARD', label: '执行奖励', permission: 'p013.reward.execute', needsSummary: true }],
    S07: [{ code: 'NOTIFY_EMPLOYEE', label: '完成员工告知', permission: 'p013.reward.execute', needsSummary: true }],
    S08: [{ code: 'RECORD_RECEIPTS', label: '登记执行回执', permission: 'p013.reward.execute', needsSummary: true }],
    S09: [{ code: 'ARCHIVE', label: '归档关闭', permission: 'p013.reward.execute', needsSummary: true }],
  },
  buildCreateBody(values, ownerCenterId, ownerEmployeeId) {
    const factOccurredAt = required(values, 'factOccurredAt', '贡献发生时间')
    return {
      subject: required(values, 'subject', '奖励主题'),
      reason: required(values, 'reason', '奖励原因'),
      priority: 'NORMAL',
      riskLevel: 'NORMAL',
      ownerCenterId,
      ownerEmployeeId,
      businessDate: new Date().toISOString().slice(0, 10),
      factOccurredAt: new Date(factOccurredAt).toISOString(),
      factSummary: required(values, 'factSummary', '贡献事实摘要'),
      contentVersion: required(values, 'contentVersion', '内容版本'),
      periodNo: required(values, 'periodNo', '奖励周期'),
      sourceFactKey: required(values, 'sourceFactKey', '贡献事实唯一键'),
      employeeEventType: 'P013_REWARD',
      impactLevel: required(values, 'impactLevel', '奖励影响级别'),
      impactEffectiveDate: values.impactEffectiveDate?.trim() || null,
      pointsDelta: integer(values, 'pointsDelta', '奖励积分'),
      benefitAmount: money(values, 'benefitAmount', '奖励金额'),
      compGradeImpact: values.compGradeImpact?.trim() || null,
    }
  },
}
''',
)

write(
    "technical-platform/web/src/platform/phase11/p013/P013RewardWorkspace.vue",
    r'''
<script setup lang="ts">
import type { Phase11Portal } from '../types'
import Phase11CaseBoard from '../shared/Phase11CaseBoard.vue'
import { P013_REWARD_CONFIG } from './p013-config'

defineProps<{ portal: Phase11Portal }>()
</script>

<template>
  <Phase11CaseBoard :portal="portal" :config="P013_REWARD_CONFIG" />
</template>
''',
)

for portal, component in (
    ("Employee", "employee"),
    ("Center", "center"),
    ("Tech", "tech"),
):
    write(
        f"technical-platform/web/src/platform/pages/phase11/P013{portal}Page.vue",
        f'''
<script setup lang="ts">
import P013RewardWorkspace from '../../phase11/p013/P013RewardWorkspace.vue'
</script>
<template><P013RewardWorkspace portal="{component}" /></template>
''',
    )

router_path = Path("technical-platform/web/src/router/portal-route-specs.ts")
router = router_path.read_text(encoding="utf-8")
imports = """import P013CenterPage from '../platform/pages/phase11/P013CenterPage.vue'\nimport P013EmployeePage from '../platform/pages/phase11/P013EmployeePage.vue'\nimport P013TechPage from '../platform/pages/phase11/P013TechPage.vue'\n"""
if "P013CenterPage" not in router:
    router = router.replace(
        "import P012TechPage from '../platform/pages/phase11/P012TechPage.vue'\n",
        "import P012TechPage from '../platform/pages/phase11/P012TechPage.vue'\n" + imports,
    )
spec = r'''
const P013_ROUTE_SPECS: readonly PortalRouteSpec[] = [
  {
    portal: 'employee', path: '/employee/08/07/02', name: 'p013-reward-self',
    component: P013EmployeePage,
    permissionsAny: ['p013.reward.create', 'p013.reward.read'],
  },
  {
    portal: 'center', path: '/center/10/10/02', name: 'p013-reward-management',
    component: P013CenterPage,
    permissionsAny: ['p013.reward.create', 'p013.reward.review', 'p013.reward.execute'],
  },
  {
    portal: 'tech', path: '/tech/06/06/01', name: 'p013-reward-monitor',
    component: P013TechPage, permission: 'p013.reward.monitor',
  },
]

'''
if "const P013_ROUTE_SPECS" not in router:
    router = router.replace("const PHASE10_TECH_ROUTE_SPECS", spec + "const PHASE10_TECH_ROUTE_SPECS")
if "...P013_ROUTE_SPECS" not in router:
    router = router.replace("  ...P012_ROUTE_SPECS,\n]", "  ...P012_ROUTE_SPECS,\n  ...P013_ROUTE_SPECS,\n]")
router_path.write_text(router, encoding="utf-8")

write(
    "technical-platform/web/src/router/p013-router.test.ts",
    r'''
import { createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { PORTALS } from '../platform/portal-config'
import { createPortalRouter, type PortalRouterSession } from './portal-router'

class P013Session implements PortalRouterSession {
  authenticated = true
  permissions = new Set<string>()
  restore(): Promise<boolean> { return Promise.resolve(true) }
  can(permission: string): boolean { return this.permissions.has(permission) }
}

function routerFor(portal: typeof PORTALS.employee, permission: string) {
  const session = new P013Session()
  session.permissions.add(permission)
  return createPortalRouter(portal, session, createMemoryHistory())
}

describe('PHASE-11 P013 frozen routes', () => {
  it('binds employee center and tech pages to exact C0 coordinates', async () => {
    const employee = routerFor(PORTALS.employee, 'p013.reward.read')
    await employee.push('/employee/08/07/02')
    expect(employee.currentRoute.value.name).toBe('p013-reward-self')

    const center = routerFor(PORTALS.center, 'p013.reward.review')
    await center.push('/center/10/10/02')
    expect(center.currentRoute.value.name).toBe('p013-reward-management')

    const tech = routerFor(PORTALS.tech, 'p013.reward.monitor')
    await tech.push('/tech/06/06/01')
    expect(tech.currentRoute.value.name).toBe('p013-reward-monitor')
  })

  it('denies technical reward metadata without monitor permission', async () => {
    const router = createPortalRouter(PORTALS.tech, new P013Session(), createMemoryHistory())
    await router.push('/tech/06/06/01')
    expect(router.currentRoute.value.name).toBe('forbidden')
  })
})
''',
)
