// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MonitorProjectionResource, MonitorProjectionState } from '../../../../contracts'
import type { PortalDefinition } from '../../../portal-config'

const harness = vi.hoisted(() => ({
  permissions: new Set<string>(),
  permissionRevision: undefined as unknown as { value: number },
  refresh: vi.fn(),
  state: undefined as unknown as { value: MonitorProjectionState },
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

import pageSource from '../../../pages/Phase10TechMonitorPage.vue?raw'
import Phase10TechMonitorPage from '../../../pages/Phase10TechMonitorPage.vue'

const portal: PortalDefinition = {
  code: 'tech',
  runtimeCode: 'admin',
  title: '技术后台端',
  description: '',
  homeTitle: '',
  homeFocus: [],
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
})

describe('Phase10 technical workflow monitor thin page', () => {
  it('assembles the typed monitoring public index without raw transport or P004/P005 business pages', () => {
    expect(pageSource).toContain("from '../processes/shared/monitoring'")
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/shared\/monitoring\//)
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/\bunknown\b|raw DTO/i)
    expect(pageSource).not.toContain('P004GenericRequestPage')
    expect(pageSource).not.toContain('P005NoticePage')
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
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

  it('preserves only the old shared page process projections selected by their monitor permissions', () => {
    for (const permission of [
      'p006.meeting.monitor', 'p007.schedule.monitor', 'p010.learning.monitor', 'p011.performance.monitor',
      'p012.promotion.monitor', 'p013.reward.monitor', 'p014.discipline.monitor',
      'p008.leave.monitor', 'p009.overtime.monitor', 'p016.welfare.monitor',
    ]) harness.permissions.add(permission)
    const wrapper = mount(Phase10TechMonitorPage, { props: { portal }, global: { stubs: childStubs() } })
    for (const code of ['P006', 'P007', 'P010', 'P011', 'P012', 'P013', 'P014']) {
      expect(wrapper.find(`[data-stub-process="${code}"]`).exists()).toBe(true)
    }
    for (const code of ['P008', 'P009', 'P016']) expect(wrapper.find(`[data-stub-process="${code}"]`).exists()).toBe(false)
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
  return Object.fromEntries(
    ['P006MeetingPage', 'P007SchedulePage', 'P010LearningPage', 'P011PerformancePage', 'P012PromotionPage', 'P013RewardPage', 'P014DisciplinePage']
      .map(name => [name, { template: `<section data-stub-process="${name.slice(0, 4)}" />` }]),
  )
}
