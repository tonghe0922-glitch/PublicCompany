<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import { useProcessOperation } from '../phase11/use-process-operation'
import type { PortalDefinition } from '../portal-config'

type Mode = 'employee' | 'center' | 'tech'

interface Fact {
  id: string
  scoreType?: string
  score1000?: number
  eventType?: string
  executionType?: string
  createdAt?: string
}

interface Cycle {
  id: string
  businessNo: string
  currentNodeCode: string | null
  status: string
  versionNo: number
  subject: string
  ownerEmployeeId: string
  contentVersion: string
  periodOrCourseNo: string
  score1000: number | null
  appealStatus: string | null
  scores: Fact[]
  events: Fact[]
  effects: Fact[]
}

interface Action {
  code: string
  label: string
  permission: string
}

const COLLECTION = '/api/v1/processes/P011/performance-cycles'
const props = defineProps<{ portal: PortalDefinition; mode: Mode }>()
const session = usePortalSessionStore()
const operations = useProcessOperation()
const records = ref<Cycle[]>([])
const businessDate = ref(new Date().toISOString().slice(0, 10))
const subject = ref('')
const reason = ref('')
const ownerEmployeeId = ref('')
const contentVersion = ref('2026-H2')
const periodOrCourseNo = ref('2026-H2')
const score1000 = ref('')
const appealRaised = ref(false)
const executionType = ref('DEVELOPMENT_PLAN')
const externalReference = ref('')
const resultSummary = ref('')
const evidenceNote = ref('')

const isCenter = computed(() => props.mode === 'center')
const isTech = computed(() => props.mode === 'tech')
const canRead = computed(
  () => session.can('p011.performance.read') || session.can('p011.performance.monitor'),
)
const listState = computed(() => operations.resourceState('cycles'))
const createState = computed(() => operations.actionState('create'))

const executionOptions = [
  { value: 'DEVELOPMENT_PLAN', label: '发展计划' },
  { value: 'PERFORMANCE_IMPROVEMENT', label: '绩效改进' },
  { value: 'EXTERNAL_HR_REFERENCE', label: '外部人事引用' },
] as const

const ACTIONS: Record<string, Action[]> = {
  S01: [{ code: 'SET_TARGET', label: '制定目标', permission: 'p011.performance.manage' }],
  S02: [{ code: 'CONFIRM_TARGET', label: '员工确认', permission: 'p011.performance.read' }],
  S03: [{ code: 'RECORD_COACHING', label: '记录辅导', permission: 'p011.performance.manage' }],
  S04: [{ code: 'COLLECT_AUTHORITY_DATA', label: '归集权威数据', permission: 'p011.performance.manage' }],
  S05: [
    { code: 'SUBMIT_SELF_EVALUATION', label: '提交员工自评', permission: 'p011.performance.evaluate' },
    { code: 'SUBMIT_SUPERVISOR_EVALUATION', label: '提交主管评价', permission: 'p011.performance.evaluate' },
  ],
  S06: [{ code: 'CALCULATE_SCORE', label: '计算千分制得分', permission: 'p011.performance.manage' }],
  S07: [{ code: 'CALIBRATE', label: '独立校准', permission: 'p011.performance.calibrate' }],
  S08: [{ code: 'CONFIRM_FEEDBACK', label: '确认反馈', permission: 'p011.performance.read' }],
  S09: [
    { code: 'RESOLVE_APPEAL', label: '复核申诉', permission: 'p011.performance.appeal' },
    { code: 'NO_APPEAL', label: '确认无申诉', permission: 'p011.performance.appeal' },
  ],
  S10: [{ code: 'EXECUTE_EFFECT', label: '登记影响执行', permission: 'p011.performance.execute' }],
  S11: [{ code: 'ARCHIVE', label: '归档', permission: 'p011.performance.manage' }],
}

function evidence() {
  return { note: evidenceNote.value.trim(), recordedAt: new Date().toISOString() }
}

async function load(): Promise<void> {
  const result = await operations.runResource('cycles', () =>
    listProcessRecords<Cycle>(session, COLLECTION))
  if (result) records.value = result
}

async function create(): Promise<void> {
  const body = {
    businessDate: businessDate.value,
    subject: subject.value.trim(),
    reason: reason.value.trim() || null,
    ownerEmployeeId: ownerEmployeeId.value.trim(),
    contentVersion: contentVersion.value.trim(),
    periodOrCourseNo: periodOrCourseNo.value.trim(),
    evidence: evidence(),
  }
  const created = await operations.runAction(
    'create',
    () => createProcessRecord<Cycle, typeof body>(session, COLLECTION, 'p011-create', body),
    '绩效周期已创建。',
  )
  if (created) await load()
}

function actionBody(item: Cycle, action: Action) {
  const scored = ['SUBMIT_SELF_EVALUATION', 'SUBMIT_SUPERVISOR_EVALUATION', 'CALIBRATE']
    .includes(action.code)
  return {
    expectedVersion: item.versionNo,
    score1000: scored ? Number(score1000.value) : null,
    appealRaised: action.code === 'CONFIRM_FEEDBACK' ? appealRaised.value : null,
    executionType: action.code === 'EXECUTE_EFFECT' ? executionType.value : null,
    externalReference: action.code === 'EXECUTE_EFFECT' ? externalReference.value.trim() : null,
    resultSummary: resultSummary.value.trim() || null,
    evidence: evidence(),
  }
}

async function perform(item: Cycle, action: Action): Promise<void> {
  const operationKey = `${item.id}:${action.code}`
  const moved = await operations.runAction(
    operationKey,
    () => executeProcessAction<Cycle, ReturnType<typeof actionBody>>(
      session,
      COLLECTION,
      item.id,
      action.code,
      `p011-${action.code.toLowerCase()}`,
      actionBody(item, action),
    ),
    `${action.label}已完成。`,
  )
  if (moved) await load()
}

function actions(item: Cycle): Action[] {
  if (isTech.value || !item.currentNodeCode) return []
  return (ACTIONS[item.currentNodeCode] ?? [])
    .filter((action) => session.can(action.permission))
}

function actionPending(item: Cycle, action: Action): boolean {
  return isPending(operations.actions[`${item.id}:${action.code}`])
}

onMounted(() => {
  if (canRead.value) void load()
})
</script>

<template>
  <SgjListPageTemplate
    data-testid="p011-page"
    :title="isTech ? '绩效流程元数据监控' : isCenter ? '绩效评价、校准与执行' : '我的绩效周期'"
    :description="isTech ? '技术端仅显示流程元数据，不能评价或校准。' : '评价、计算、校准和执行分别保存为不可变事实。'"
  >
    <template #actions>
      <SgjButton
        variant="secondary"
        :disabled="!canRead"
        :loading="isPending(listState)"
        @click="load"
      >刷新</SgjButton>
    </template>

    <SgjNoPermission v-if="!canRead" />

    <template v-else>
      <SgjCard v-if="isCenter">
        <template #header><h2>建立绩效目标</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="subject" label="绩效周期主题" placeholder="绩效周期主题" required />
          <SgjInput v-model="ownerEmployeeId" label="员工 ID" placeholder="员工 ID" required />
          <SgjDateTime v-model="businessDate" label="业务日期" required />
          <SgjInput v-model="contentVersion" label="内容版本" placeholder="内容版本" required />
          <SgjInput v-model="periodOrCourseNo" label="周期编号" placeholder="周期编号" required />
          <SgjTextarea v-model="reason" label="原因" placeholder="原因" />
          <SgjTextarea v-model="evidenceNote" label="不可变证据" placeholder="不可变证据" required />
        </div>
        <template #footer>
          <SgjButton
            :disabled="!session.can('p011.performance.manage')"
            :loading="isPending(createState)"
            @click="create"
          >创建周期</SgjButton>
        </template>
      </SgjCard>

      <SgjCard v-if="!isTech">
        <template #header><h2>节点输入</h2></template>
        <div class="phase11-form-grid">
          <SgjInput v-model="score1000" label="千分制分数" placeholder="千分制分数" type="number" min="0" max="1000" />
          <SgjCheckbox v-model="appealRaised" label="提出申诉" />
          <SgjSelect v-model="executionType" label="执行类型" :options="executionOptions" />
          <SgjInput v-model="externalReference" label="外部执行引用" placeholder="外部执行引用" />
          <SgjInput v-model="resultSummary" label="结果摘要" placeholder="结果摘要" />
          <SgjTextarea v-model="evidenceNote" label="节点证据" placeholder="节点证据" />
        </div>
      </SgjCard>

      <SgjLoading v-if="isPending(listState) && records.length === 0" />
      <SgjNoPermission
        v-else-if="listState.failure === 'no-permission'"
        :description="listState.message"
      />
      <SgjError
        v-else-if="listState.failure === 'error'"
        title="绩效记录加载失败"
        :description="listState.message"
        :error-code="listState.errorCode"
        :trace-id="listState.traceId"
      >
        <template #actions><SgjButton @click="load">重试</SgjButton></template>
      </SgjError>
      <SgjConflict
        v-else-if="listState.failure === 'conflict'"
        :description="listState.message"
      >
        <template #actions><SgjButton @click="load">刷新最新事实</SgjButton></template>
      </SgjConflict>
      <SgjEmpty v-else-if="records.length === 0" title="暂无绩效周期" />

      <div v-else class="phase11-records">
        <SgjRecordCard
          v-for="item in records"
          :key="item.id"
          class="record"
          :title="`${item.businessNo} · ${item.subject}`"
          :subtitle="`${item.currentNodeCode ?? 'END'} · v${item.versionNo}`"
          :data-cycle-id="item.id"
        >
          <template #status><SgjStatusChip>{{ item.status }}</SgjStatusChip></template>
          <template v-if="!isTech">
            <p>最终投影：{{ item.score1000 ?? '未形成' }}；申诉：{{ item.appealStatus ?? '未确认' }}</p>
            <ul>
              <li v-for="fact in item.scores" :key="fact.id">
                {{ fact.scoreType }}：{{ fact.score1000 }}
              </li>
            </ul>
          </template>
          <p v-else>员工、分数、申诉、证据和执行结果均已屏蔽。</p>
          <template #actions>
            <SgjButton
              v-for="action in actions(item)"
              :key="action.code"
              :data-action="action.code"
              :loading="actionPending(item, action)"
              @click="perform(item, action)"
            >{{ action.label }}</SgjButton>
          </template>
        </SgjRecordCard>
      </div>

      <SgjError
        v-if="createState.failure === 'error'"
        title="创建绩效周期失败"
        :description="createState.message"
        :error-code="createState.errorCode"
        :trace-id="createState.traceId"
      />
      <SgjConflict
        v-if="createState.failure === 'conflict'"
        :description="createState.message"
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
