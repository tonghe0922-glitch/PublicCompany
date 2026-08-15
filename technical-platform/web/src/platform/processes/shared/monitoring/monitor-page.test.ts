// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AttendanceWorkflowMonitorFeature,
  MonitorPanel,
  PhaseWorkflowMonitorFeature,
  ProcessMetadataMonitorFeature,
} from '@sgj/platform-ui'

import registry from '../../../../../../../docs/implementation/ui/UI_COMPONENT_REGISTRY.json'
import type { MonitorProjectionResource, MonitorProjectionState } from '../../../../contracts'
import type { PortalDefinition } from '../../../portal-config'
import attendancePlan from '../../../pages/Phase10AttendanceMonitorPage.ui-plan.json'
import attendancePageSource from '../../../pages/Phase10AttendanceMonitorPage.vue?raw'
import sharedIndexSource from '../index.ts?raw'

const harness = vi.hoisted(() => ({
  permissions: new Set<string>(),
  permissionRevision: undefined as unknown as { value: number },
  refresh: vi.fn(),
  state: undefined as unknown as { value: MonitorProjectionState },
  p008Refresh: vi.fn(),
  p009Refresh: vi.fn(),
  p008State: undefined as unknown as { value: AttendanceResourceState },
  p009State: undefined as unknown as { value: AttendanceResourceState },
  p008Use: vi.fn(),
  p009Use: vi.fn(),
}))

vi.mock('../../../../session', () => ({
  usePortalSessionStore: () => ({
    can: (permission: string) => {
      void harness.permissionRevision.value
      return harness.permissions.has(permission)
    },
    request: vi.fn(() => { throw new Error('PAGE_MUST_NOT_USE_SESSION_REQUEST') }),
  }),
}))

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>()
  return {
    ...actual,
    useMonitorProjection: () => ({
      state: harness.state,
      refresh: harness.refresh,
      cancel: vi.fn(),
    } satisfies MonitorProjectionResource),
  }
})

vi.mock('../../p008/useP008Leave', () => ({
  useP008Leave: (options: { mode: string }) => {
    harness.p008Use(options)
    return { records: { state: harness.p008State }, refresh: harness.p008Refresh }
  },
}))

vi.mock('../../p009/useP009Overtime', () => ({
  useP009Overtime: (options: { mode: string }) => {
    harness.p009Use(options)
    return { records: { state: harness.p009State }, refresh: harness.p009Refresh }
  },
}))

import pageSource from '../../../pages/Phase10TechMonitorPage.vue?raw'
import Phase10TechMonitorPage from '../../../pages/Phase10TechMonitorPage.vue'
import hubSource from './PhaseWorkflowMonitorFeature.vue?raw'
import genericSource from './ProcessMetadataMonitorFeature.vue?raw'

const portal: PortalDefinition = {
  code: 'tech',
  runtimeCode: 'admin',
  title: '技术后台端',
  description: '',
  homeTitle: '',
  homeFocus: [],
}

interface AttendanceProjection {
  businessNo: string
  currentNodeCode: string
  status: string
  subject?: string
  employeeName?: string
  amount?: number
  evidence?: string
}

type AttendanceResourceState =
  | { phase: 'success'; data: readonly AttendanceProjection[]; requestId: string }
  | { phase: 'empty'; data: readonly AttendanceProjection[]; requestId: string }
  | { phase: 'error'; error: { kind: 'forbidden'; status: 403; title: string; userMessage: string; nextAction: string }; requestId: string }

function attendanceSuccess(code: 'P008' | 'P009'): AttendanceResourceState {
  return {
    phase: 'success',
    data: [{
      businessNo: `${code}-2026-0001`,
      currentNodeCode: 'S04',
      status: 'RUNNING',
      subject: `${code}_SUBJECT_SECRET`,
      employeeName: `${code}_EMPLOYEE_SECRET`,
      amount: 8800,
      evidence: `${code}_EVIDENCE_SECRET`,
    }],
    requestId: `${code.toLowerCase()}-success`,
  }
}

function attendanceData(state: AttendanceResourceState): readonly AttendanceProjection[] | undefined {
  return 'data' in state ? state.data : undefined
}

function monitorState(phase: 'success' | 'partial' | 'error'): MonitorProjectionState {
  const p004 = [{
    recordId: 'p004-1', businessNo: 'P004-2026-0001', processCode: 'P004' as const,
    currentNodeCode: 'S04', status: 'RUNNING', versionNo: 3, updatedAt: '2026-08-14T08:00:00Z',
    subject: 'SUBJECT_SECRET', detail: 'DETAIL_SECRET', stack: 'STACK_SECRET',
  }]
  const data = { p004, p005: [] }
  if (phase === 'success') return { phase, data, requestId: 'monitor-success' }
  const error = {
    kind: 'server' as const,
    title: '监控资源暂不可用',
    userMessage: '请刷新监控事实',
    nextAction: '刷新',
  }
  if (phase === 'partial') return { phase, data, error, missingResources: ['P005'], requestId: 'monitor-partial' }
  return { phase, error, requestId: 'monitor-error' }
}

beforeEach(() => {
  harness.permissions.clear()
  harness.permissionRevision = ref(0)
  harness.state = ref<MonitorProjectionState>(monitorState('success'))
  harness.refresh.mockReset().mockResolvedValue(harness.state.value.data)
  harness.p008State = ref<AttendanceResourceState>(attendanceSuccess('P008'))
  harness.p009State = ref<AttendanceResourceState>(attendanceSuccess('P009'))
  harness.p008Refresh.mockReset().mockResolvedValue(attendanceData(harness.p008State.value))
  harness.p009Refresh.mockReset().mockResolvedValue(attendanceData(harness.p009State.value))
  harness.p008Use.mockReset()
  harness.p009Use.mockReset()
})

describe('Phase10 attendance workflow monitor contract', () => {
  it('keeps the route page a public-alias thin shell without permission or request authority', () => {
    expect(attendancePageSource).toContain("from '@sgj/platform-ui'")
    expect(attendancePageSource).toContain('AttendanceWorkflowMonitorFeature')
    expect(attendancePageSource).toMatch(/defineProps<\{\s*portal\s*:\s*PortalDefinition\s*\}>/u)
    expect(attendancePageSource).not.toMatch(/session\.(?:can|request)|usePortalSessionStore|\/api\//u)
    expect(attendancePageSource).not.toMatch(/P00[89].*Page\.vue|useP00[89]|computed\s*\(|\bref\s*\(/u)
    expect(attendancePageSource).not.toMatch(/from ['"](?:\.\.\/)+processes\/shared\//u)
  })

  it('requires the feature public export, access contract, registry entry and debt-free page plan', () => {
    expect(sharedIndexSource).toContain(
      "export { default as AttendanceWorkflowMonitorFeature } from './monitoring/AttendanceWorkflowMonitorFeature.vue'",
    )
    const entry = registry.components.find(component => component.id === 'platform.attendance-workflow-monitor-feature')
    expect(entry).toMatchObject({
      status: 'existing-stable',
      public: true,
      public_import: '@sgj/platform-ui',
      implementation_path: 'technical-platform/web/src/platform/processes/shared/monitoring/AttendanceWorkflowMonitorFeature.vue',
      export_name: 'AttendanceWorkflowMonitorFeature',
    })
    expect(entry?.required_tests).toContain(
      'technical-platform/web/src/platform/processes/shared/monitoring/monitor-page.test.ts',
    )
    expect(attendancePlan.gaps).toEqual([])
    expect(attendancePlan.field_component_map.some(
      item => item.component_id === 'platform.attendance-workflow-monitor-feature',
    )).toBe(true)
  })

  it.each([
    { label: 'P008 only', permissions: ['p008.leave.monitor'], visible: ['P008'], hidden: ['P009'] },
    { label: 'P009 only', permissions: ['p009.overtime.monitor'], visible: ['P009'], hidden: ['P008'] },
    { label: 'both', permissions: ['p008.leave.monitor', 'p009.overtime.monitor'], visible: ['P008', 'P009'], hidden: [] },
    { label: 'neither', permissions: [], visible: [], hidden: ['P008', 'P009'] },
  ])('mounts only authorized attendance projections: $label', async ({ permissions, visible, hidden }) => {
    permissions.forEach(permission => harness.permissions.add(permission))
    const wrapper = mount(AttendanceWorkflowMonitorFeature, { props: { portal } })
    await nextTick()
    visible.forEach(code => expect(wrapper.find(`[data-attendance-process="${code}"]`).exists()).toBe(true))
    hidden.forEach(code => expect(wrapper.find(`[data-attendance-process="${code}"]`).exists()).toBe(false))
    expect(harness.p008Refresh).toHaveBeenCalledTimes(visible.includes('P008') ? 1 : 0)
    expect(harness.p009Refresh).toHaveBeenCalledTimes(visible.includes('P009') ? 1 : 0)
    expect(harness.p008Use).toHaveBeenCalledWith({ mode: 'tech' })
    expect(harness.p009Use).toHaveBeenCalledWith({ mode: 'tech' })
    const serialized = [wrapper.text(), wrapper.html(), ...wrapper.findAll('*').flatMap(node => Object.values(node.attributes()))].join('\n')
    expect(serialized).not.toMatch(/SUBJECT_SECRET|EMPLOYEE_SECRET|8800|EVIDENCE_SECRET/u)
    expect(wrapper.find('[data-action]').exists()).toBe(false)
    expect(wrapper.find('[data-business-mutation]').exists()).toBe(false)
  })

  it('reacts to attendance permission changes without remounting or refreshing a denied process', async () => {
    const wrapper = mount(AttendanceWorkflowMonitorFeature, { props: { portal } })
    expect(wrapper.find('[data-attendance-process="P008"]').exists()).toBe(false)
    expect(harness.p008Refresh).not.toHaveBeenCalled()
    harness.permissions.add('p008.leave.monitor')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-attendance-process="P008"]').exists()).toBe(true)
    expect(harness.p008Refresh).toHaveBeenCalledTimes(1)
    harness.permissions.delete('p008.leave.monitor')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-attendance-process="P008"]').exists()).toBe(false)
    expect(harness.p008Refresh).toHaveBeenCalledTimes(1)
  })

  it('projects backend 403 and empty states without sensitive attendance facts', async () => {
    harness.permissions.add('p008.leave.monitor')
    harness.permissions.add('p009.overtime.monitor')
    harness.p008State.value = {
      phase: 'error',
      error: { kind: 'forbidden', status: 403, title: '无权读取P008', userMessage: 'P008监控拒绝', nextAction: '返回' },
      requestId: 'p008-forbidden',
    }
    harness.p009State.value = { phase: 'empty', data: [], requestId: 'p009-empty' }
    const wrapper = mount(AttendanceWorkflowMonitorFeature, { props: { portal } })
    await nextTick()
    expect(wrapper.text()).toContain('P008监控拒绝')
    expect(wrapper.text()).toContain('暂无 P009 考勤监控记录')
    expect(wrapper.text()).not.toMatch(/subject|employee|amount|evidence/iu)
  })
})

describe('Phase10 technical workflow monitor thin page', () => {
  it('assembles and executes the typed monitoring public index without business pages or mutation', async () => {
    expect(MonitorPanel).toBeDefined()
    expect(ProcessMetadataMonitorFeature).toBeDefined()
    expect(pageSource).toContain("from '../processes/shared/monitoring'")
    expect(pageSource).toContain('PhaseWorkflowMonitorFeature')
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/shared\/monitoring\//)
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/\bunknown\b|raw DTO/i)
    expect(pageSource).not.toContain('P004GenericRequestPage')
    expect(pageSource).not.toContain('P005NoticePage')
    expect(pageSource).not.toMatch(/import\s+\w+Page\s+from/u)
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
    expect(hubSource).toContain('ProcessMetadataMonitorFeature')
    expect(hubSource).not.toMatch(/import\s+\w+Page\s+from|<\w+Page\b/u)
    expect(hubSource).not.toMatch(/defineComponent|\bh\(|data-action|createCase|perform\s*\(/u)
    expect(hubSource).not.toMatch(/\uFFFD|宸ヤ綔娴|鎶€鏈|鍏冩暟/u)
    const projection = genericSource.match(/interface\s+ProcessMetadataMonitorRecord\s*\{(?<body>[\s\S]*?)\}/u)?.groups?.body ?? ''
    const fields = [...projection.matchAll(/(?:readonly\s+)?([A-Za-z][A-Za-z0-9]*)\s*:/gu)]
      .map(match => match[1])
      .sort()
    expect(fields).toEqual(['businessNo', 'currentNodeCode', 'status'])
    expect(genericSource).not.toMatch(/data-action|createCase|perform\s*\(|affectedEmployee|amount|invoice|evidence|subject/iu)
    harness.permissions.add('p006.meeting.monitor')
    const monitor = {
      state: harness.state,
      refresh: harness.refresh,
      cancel: vi.fn(),
    } satisfies MonitorProjectionResource
    const hub = mount(PhaseWorkflowMonitorFeature, {
      props: { portal, monitor },
      global: { stubs: childStubs() },
    })
    expect(hub.find('[data-stub-process="P006"]').exists()).toBe(true)
    expect(hub.find('[data-business-mutation]').exists()).toBe(false)

    const load = vi.fn().mockResolvedValue(undefined)
    const generic = mount(ProcessMetadataMonitorFeature, {
      props: {
        processCode: 'P006',
        phase: 'success',
        load,
        records: [{ businessNo: 'P006-2026-0001', currentNodeCode: 'S04', status: 'RUNNING' }],
      },
    })
    expect(generic.text()).toContain('P006-2026-0001')
    expect(generic.text()).toContain('S04')
    expect(generic.text()).toContain('RUNNING')
    expect(generic.find('[data-action]').exists()).toBe(false)
    await generic.get('button').trigger('click')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it.each(['success', 'partial', 'error'] as const)(
    'refreshes initially and projects the typed %s state without forbidden fields',
    (phase) => {
      harness.permissions.add('p004.request.read')
      harness.permissionRevision.value += 1
      harness.state.value = monitorState(phase)
      const wrapper = mount(Phase10TechMonitorPage, { props: { portal }, global: { stubs: childStubs() } })
      expect(harness.refresh).toHaveBeenCalledTimes(1)
      expect(wrapper.get('[data-testid="phase09-tech-workflow-monitor"]')).toBeDefined()
      expect(wrapper.get('[data-state]').attributes('data-state')).toBe(phase)
      const serialized = [wrapper.text(), wrapper.html(), ...wrapper.findAll('*').flatMap(node => Object.values(node.attributes()))].join('\n')
      expect(serialized).not.toMatch(/SUBJECT_SECRET|DETAIL_SECRET|STACK_SECRET/)
      expect(wrapper.find('[data-business-mutation]').exists()).toBe(false)
    },
  )

  it.each([
    { label: 'P014 only', permissions: ['p014.discipline.monitor'], visible: ['P014'], hidden: ['P016'] },
    { label: 'P016 only', permissions: ['p016.welfare.monitor'], visible: ['P016'], hidden: ['P014'] },
    { label: 'P014 plus P016', permissions: ['p014.discipline.monitor', 'p016.welfare.monitor'], visible: ['P014', 'P016'], hidden: [] },
    { label: 'P016 execute only', permissions: ['p016.welfare.execute'], visible: [], hidden: ['P014', 'P016'] },
  ])('projects monitor sections by least privilege: $label', ({ permissions, visible, hidden }) => {
    permissions.forEach(permission => harness.permissions.add(permission))
    const wrapper = mount(Phase10TechMonitorPage, { props: { portal }, global: { stubs: childStubs() } })
    visible.forEach(code => expect(wrapper.find(`[data-stub-process="${code}"]`).exists()).toBe(true))
    hidden.forEach(code => expect(wrapper.find(`[data-stub-process="${code}"]`).exists()).toBe(false))
    expect(wrapper.find('[data-business-mutation]').exists()).toBe(false)
  })

  it('reacts to old monitor permission changes without remounting the page', async () => {
    const wrapper = mount(Phase10TechMonitorPage, { props: { portal }, global: { stubs: childStubs() } })
    expect(wrapper.find('[data-stub-process="P006"]').exists()).toBe(false)
    expect(wrapper.find('[data-stub-process="P007"]').exists()).toBe(false)
    harness.permissions.add('p006.meeting.monitor')
    harness.permissions.add('p007.schedule.monitor')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-stub-process="P006"]').exists()).toBe(true)
    expect(wrapper.find('[data-stub-process="P007"]').exists()).toBe(true)
    harness.permissions.delete('p006.meeting.monitor')
    harness.permissions.delete('p007.schedule.monitor')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-stub-process="P006"]').exists()).toBe(false)
    expect(wrapper.find('[data-stub-process="P007"]').exists()).toBe(false)
  })

  it('requests P004/P005 monitor facts only while either read or monitor permission is present', async () => {
    harness.permissions.add('p006.meeting.monitor')
    const wrapper = mount(Phase10TechMonitorPage, { props: { portal }, global: { stubs: childStubs() } })
    expect(wrapper.find('[data-monitor-refresh]').exists()).toBe(false)
    expect(harness.refresh).not.toHaveBeenCalled()
    harness.permissions.add('p004.request.read')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-monitor-refresh]').exists()).toBe(true)
    expect(harness.refresh).toHaveBeenCalledTimes(1)
    harness.permissions.add('p005.notice.monitor')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(harness.refresh).toHaveBeenCalledTimes(2)
    harness.permissions.delete('p004.request.read')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-monitor-refresh]').exists()).toBe(true)
    expect(harness.refresh).toHaveBeenCalledTimes(3)
    harness.permissions.delete('p005.notice.monitor')
    harness.permissionRevision.value += 1
    await nextTick()
    expect(wrapper.find('[data-monitor-refresh]').exists()).toBe(false)
    expect(harness.refresh).toHaveBeenCalledTimes(3)
  })
})

function childStubs(): Record<string, object> {
  return {
    ProcessMetadataMonitorFeature: {
      props: ['processCode'],
      template: '<section :data-stub-process="processCode" />',
    },
    ...Object.fromEntries([
      'P006MeetingPage', 'P007SchedulePage', 'P010LearningPage', 'P011PerformancePage',
      'P012PromotionPage', 'P013RewardPage', 'P014DisciplinePage',
      'P011PerformanceFeature',
      'P012PromotionFeature', 'P013RewardFeature', 'P014DisciplineFeature', 'P016CareMonitorFeature',
    ]
      .map(name => [name, { template: `<section data-stub-process="${name.slice(0, 4)}" />` }]),
    ),
  }
}
