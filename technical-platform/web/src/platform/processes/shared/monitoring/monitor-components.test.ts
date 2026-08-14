// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { MonitorProjectionData, MonitorProjectionResource } from '../../../../contracts'
import type { AsyncState } from '../async/async-state'
import MonitorPanel from './MonitorPanel.vue'
import MonitorStatusTable from './MonitorStatusTable.vue'

const forbiddenValues = [
  'SUBJECT_SECRET',
  'CONTENT_SECRET',
  'REASON_SECRET',
  'RESULT_SECRET',
  'AMOUNT_SECRET',
  'ACTUAL_SECRET',
  'OWNER_SECRET',
  'RECIPIENT_SECRET',
  'EVIDENCE_SECRET',
  'DETAIL_SECRET',
  'STACK_SECRET',
] as const

function data(): MonitorProjectionData {
  const p004 = {
      recordId: 'p004-record-1',
      businessNo: 'P004-2026-0001',
      processCode: 'P004' as const,
      currentNodeCode: 'S04',
      status: 'RUNNING',
      versionNo: 3,
      updatedAt: '2026-08-14T08:00:00Z',
      approvedCount: 999,
      subject: forbiddenValues[0],
      content: forbiddenValues[1],
      reason: forbiddenValues[2],
      resultSummary: forbiddenValues[3],
      amount: forbiddenValues[4],
      actualAmount: forbiddenValues[5],
      ownerEmployeeId: forbiddenValues[6],
      recipient: forbiddenValues[7],
      evidence: forbiddenValues[8],
      detail: forbiddenValues[9],
      stack: forbiddenValues[10],
  }
  return {
    p004: [p004],
    p005: [{
      recordId: 'p005-record-1',
      businessNo: 'P005-2026-0001',
      processCode: 'P005',
      currentNodeCode: 'S05',
      status: 'APPROVED',
      versionNo: 5,
      updatedAt: '2026-08-14T09:00:00Z',
      approvedCount: 2,
    }],
  }
}

function state(phase: AsyncState<MonitorProjectionData>['phase']): AsyncState<MonitorProjectionData> {
  if (phase === 'success') return { phase, data: data(), requestId: 'monitor-1' }
  if (phase === 'partial') {
    return {
      phase,
      data: { p004: data().p004, p005: [] },
      error: { kind: 'server', title: '部分失败', userMessage: 'P005暂不可用', nextAction: '刷新监控事实' },
      missingResources: ['P005'],
      requestId: 'monitor-1',
    }
  }
  if (phase === 'error') {
    return {
      phase,
      error: { kind: 'server', title: '加载失败', userMessage: '请稍后重试', nextAction: '刷新监控事实' },
      requestId: 'monitor-1',
    }
  }
  if (phase === 'empty') return { phase, data: { p004: [], p005: [] }, requestId: 'monitor-1' }
  return { phase, requestId: 'monitor-1' }
}

describe('Phase10 monitoring composites', () => {
  it.each(['idle', 'loading', 'empty', 'partial', 'error', 'success'] as const)(
    'projects the %s state through the shared async boundary',
    (phase) => {
      const wrapper = mount(MonitorStatusTable, { props: { state: state(phase) } })
      expect(wrapper.get('[data-state]').attributes('data-state')).toBe(phase)
      expect(wrapper.findAll('button[data-monitor-business-action]')).toHaveLength(0)
      if (phase === 'partial') expect(wrapper.text()).toContain('P004-2026-0001')
    },
  )

  it('renders only the projection allowlist from the single state.data authority on desktop and mobile', () => {
    const wrapper = mount(MonitorStatusTable, { props: { state: state('success') } })
    expect(wrapper.text()).toContain('P004-2026-0001')
    expect(wrapper.text()).toContain('P005-2026-0001')
    expect(wrapper.findAll('[data-monitor-process="P004"] [data-mobile-row]')).toHaveLength(1)
    expect(wrapper.findAll('[data-monitor-process="P005"] [data-mobile-row]')).toHaveLength(1)
    expect(wrapper.get('[data-monitor-process="P004"]').text()).not.toContain('999')
    expect(wrapper.get('[data-monitor-process="P005"]').text()).toContain('2')
    const serialized = [
      wrapper.text(),
      wrapper.html(),
      ...wrapper.findAll('*').flatMap(node => Object.values(node.attributes())),
    ].join('\n')
    for (const secret of forbiddenValues) expect(serialized).not.toContain(secret)
  })

  it('exposes only the technical refresh action and consumes the typed resource state', async () => {
    const refresh = vi.fn().mockResolvedValue(data())
    const resource: MonitorProjectionResource = {
      state: ref(state('success')),
      refresh,
      cancel: vi.fn(),
    }
    const wrapper = mount(MonitorPanel, { props: { resource } })
    await wrapper.get('[data-monitor-refresh]').trigger('click')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('P004-2026-0001')
    expect(wrapper.find('[data-action-code]').exists()).toBe(false)
    expect(wrapper.find('[data-create]').exists()).toBe(false)
  })
})
