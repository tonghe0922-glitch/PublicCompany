// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P007ScheduleRecord } from './contracts'

const harness = vi.hoisted(() => ({ process: undefined as unknown as Record<string, unknown>, records: [] as P007ScheduleRecord[], modes: [] as string[] }))

vi.mock('../../../session', () => ({
  usePortalSessionStore: () => ({ can: () => true, request: vi.fn().mockResolvedValue([]) }),
}))

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>()
  const first: P007ScheduleRecord = {
    id: 'shift-1', tenantId: 'tenant-1', businessNo: 'P007-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-1', currentNodeCode: 'S06', status: 'CHANGE_PENDING', versionNo: 7,
    businessDate: '2026-08-13', subject: '景区运营排班', reason: '服务端事实', ownerCenterId: 'center-1',
    ownerEmployeeId: 'employee-1', attendanceType: '排班', changeAction: '制定', changeReason: '服务端变更原因',
    contentVersion: 'SAFE-V1', durationHours: 8, startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z',
    periodOrCourseNo: 'P007-WEEK-1', actualAttendanceSummary: null, resultSummary: null, items: [], updatedAt: '2026-08-13T03:00:00Z',
  }
  const second = { ...first, id: 'shift-2', businessNo: 'P007-2026-0002', currentNodeCode: 'S01' as const, versionNo: 11, subject: '第二条排班' }
  harness.records = [first, second]
  const recordsState = ref<AsyncState<readonly P007ScheduleRecord[]>>({ phase: 'success', data: harness.records, requestId: 'records-1' })
  const actionState = ref<AsyncState<P007ScheduleRecord>>({ phase: 'idle' })
  const refresh = vi.fn(() => Promise.resolve(harness.records))
  const performAction = vi.fn(() => Promise.resolve(undefined))
  harness.process = {
    records: { state: recordsState }, action: { state: actionState },
    can: vi.fn(() => true), canRead: vi.fn(() => true), canManage: vi.fn(() => true),
    refresh, performAction,
  }
  return {
    ...actual,
    useP007Schedule: (options: { mode: string }) => { harness.modes.push(options.mode); return harness.process },
  }
})

import pageSource from '../../pages/P007SchedulePage.vue?raw'
import P007SchedulePage from '../../pages/P007SchedulePage.vue'

type ProcessHarness = {
  records: { state: { value: AsyncState<readonly P007ScheduleRecord[]> } }
  action: { state: { value: AsyncState<P007ScheduleRecord> } }
  refresh: Mock<() => Promise<readonly P007ScheduleRecord[]>>
  performAction: Mock<(id: string, code: string, command: unknown, key: string) => Promise<P007ScheduleRecord | undefined>>
  canRead: Mock<() => boolean>
}

function processHarness(): ProcessHarness {
  return harness.process as unknown as ProcessHarness
}

function ensureProcessHarness(): void {
  if (harness.process != null) return
  const recordsState = ref<AsyncState<readonly P007ScheduleRecord[]>>({ phase: 'success', data: harness.records, requestId: 'records-fallback' })
  const actionState = ref<AsyncState<P007ScheduleRecord>>({ phase: 'idle' })
  harness.process = {
    records: { state: recordsState }, action: { state: actionState },
    can: vi.fn(() => true), canRead: vi.fn(() => true), canManage: vi.fn(() => true),
    refresh: vi.fn(() => Promise.resolve(harness.records)),
    performAction: vi.fn(() => Promise.resolve(undefined)),
  }
}

function portal(code: 'employee' | 'center' | 'tech') {
  return { code, runtimeCode: code === 'tech' ? 'admin' as const : code, title: `${code} portal`, description: '', homeTitle: '', homeFocus: [] }
}

beforeEach(() => {
  ensureProcessHarness()
  const process = processHarness()
  process.records.state.value = { phase: 'success', data: harness.records, requestId: 'records-reset' }
  process.action.state.value = { phase: 'idle' }
  process.refresh.mockClear()
  process.performAction.mockReset().mockResolvedValue(undefined)
  process.canRead.mockReturnValue(true)
  harness.modes.length = 0
})

describe('P007 thin schedule page', () => {
  it('assembles only the p007 public index and public UI packages', () => {
    expect(pageSource).toContain("from '../processes/p007'")
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/p007\//)
    expect(pageSource).not.toContain('usePortalSessionStore')
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/p007\.schedule\.(read|monitor|manage|change|review)/)
    expect(pageSource).not.toContain('P007ShiftPage')
  })

  it.each(['employee', 'center', 'tech'] as const)('passes authoritative mode %s and performs initial load', async (mode) => {
    const process = processHarness()
    const wrapper = mount(P007SchedulePage, { props: { portal: portal(mode), mode } })
    await nextTick()
    expect(harness.modes).toEqual([mode])
    expect(process.refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.get('table').text()).toContain('P007-2026-0001')
    expect(wrapper.get('[data-mobile-row="shift-1"]').text()).toContain('P007-2026-0001')
    if (mode === 'center') expect(wrapper.text()).toContain('BLOCKED_BY_CONTRACT')
    if (mode === 'tech') expect(wrapper.find('[data-action-code]').exists()).toBe(false)
  })

  it('keeps owner creation and REQUEST_CHANGE blocked with zero service action', async () => {
    const process = processHarness()
    const wrapper = mount(P007SchedulePage, { props: { portal: portal('center'), mode: 'center' } })
    await nextTick()
    const create = wrapper.get('[data-create-blocked]')
    expect(create.attributes('disabled')).toBeDefined()
    await create.trigger('click')
    await wrapper.get('[data-action-code="REQUEST_CHANGE"]').trigger('click')
    expect(process.performAction).not.toHaveBeenCalled()
  })

  it('suppresses repeat action and supplies a nonblank caller lifecycle key', async () => {
    const process = processHarness()
    const wrapper = mount(P007SchedulePage, { props: { portal: portal('center'), mode: 'center' } })
    await nextTick()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = { phase: 'loading', requestId: 'action-loading' }
      return new Promise<P007ScheduleRecord | undefined>(() => undefined)
    })
    const action = wrapper.get('[data-action-code="NO_CHANGE"]')
    await action.trigger('click')
    await action.trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(1)
    expect(process.performAction.mock.calls[0]?.[0]).toBe('shift-1')
    expect(process.performAction.mock.calls[0]?.[3]).toMatch(/^p007-no_change-[0-9a-f-]+$/)
  })

  it('selects the second server record and uses its id/version with an isolated pending key', async () => {
    const process = processHarness()
    process.performAction
      .mockImplementationOnce(() => {
        process.action.state.value = { phase: 'error', requestId: 'action-timeout', error: { kind: 'timeout', status: 408, title: '超时', userMessage: '结果未知', nextAction: '重试' } }
        return Promise.resolve(undefined)
      })
      .mockResolvedValueOnce(harness.records[1])
    const wrapper = mount(P007SchedulePage, { props: { portal: portal('center'), mode: 'center' } })
    await nextTick()
    await wrapper.get('[data-action-code="NO_CHANGE"]').trigger('click')
    const firstKey = process.performAction.mock.calls[0]?.[3]
    await wrapper.get('[data-select-record="shift-2"]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT_DEMAND"]').trigger('click')
    const secondCall = process.performAction.mock.calls[1]
    expect(secondCall?.[0]).toBe('shift-2')
    expect(secondCall?.[2]).toMatchObject({ expectedVersion: 11 })
    expect(secondCall?.[3]).not.toBe(firstKey)
  })

  it('retries an uncertain result with the same key, then explicitly acknowledges 409 and starts a new lifecycle', async () => {
    const process = processHarness()
    process.performAction
      .mockImplementationOnce(() => {
        process.action.state.value = { phase: 'error', requestId: 'timeout', error: { kind: 'timeout', status: 408, title: '超时', userMessage: '结果未知', nextAction: '重试' } }
        return Promise.resolve(undefined)
      })
      .mockImplementationOnce(() => {
        process.action.state.value = { phase: 'error', requestId: 'conflict', error: { kind: 'conflict', status: 409, title: '冲突', userMessage: '事实已刷新', nextAction: '刷新' } }
        return process.refresh().then(() => undefined)
      })
      .mockImplementationOnce((_id, _code, command) => {
        process.action.state.value = { phase: 'success', requestId: 'refreshed-success', data: { ...harness.records[0]!, versionNo: 12 } }
        expect(command).toMatchObject({ expectedVersion: 12 })
        return Promise.resolve({ ...harness.records[0]!, versionNo: 12 })
      })
    const wrapper = mount(P007SchedulePage, { props: { portal: portal('center'), mode: 'center' } })
    await nextTick()
    await wrapper.get('[data-action-code="NO_CHANGE"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-action-error] button').trigger('click')
    const keys = process.performAction.mock.calls.map(call => call[3])
    expect(keys[0]).toBe(keys[1])
    expect(process.refresh).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-action-error]').text()).toContain('事实已刷新')
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
    expect(wrapper.get('[data-action-code="NO_CHANGE"]').attributes('disabled')).toBeDefined()
    process.refresh.mockImplementationOnce(() => {
      process.records.state.value = { phase: 'success', data: [{ ...harness.records[0]!, versionNo: 12 }, harness.records[1]!], requestId: 'records-v12' }
      return Promise.resolve(process.records.state.value.data ?? [])
    })
    await wrapper.get('[data-refresh-facts]').trigger('click')
    expect(wrapper.find('[data-action-error]').exists()).toBe(false)
    expect(wrapper.get('[data-action-code="NO_CHANGE"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-action-code="NO_CHANGE"]').trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(3)
    expect(process.performAction.mock.calls[2]?.[0]).toBe('shift-1')
    expect(process.performAction.mock.calls[2]?.[3]).not.toBe(keys[1])
    expect(wrapper.find('[data-action-error]').exists()).toBe(false)
  })

  it('never replays a backend 403 when the caller refreshes server facts', async () => {
    const process = processHarness()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = { phase: 'error', requestId: 'forbidden', error: { kind: 'forbidden', status: 403, title: '无权操作', userMessage: '后端拒绝', nextAction: '返回' } }
      return Promise.resolve(undefined)
    })
    const wrapper = mount(P007SchedulePage, { props: { portal: portal('center'), mode: 'center' } })
    await nextTick()
    await wrapper.get('[data-action-code="NO_CHANGE"]').trigger('click')
    expect(wrapper.get('[data-action-error]').text()).toContain('后端拒绝')
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
    await wrapper.get('[data-refresh-facts]').trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(1)
  })
})
