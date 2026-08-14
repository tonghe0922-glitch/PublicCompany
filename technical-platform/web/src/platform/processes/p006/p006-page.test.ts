// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P006MeetingRecord } from './contracts'

const harness = vi.hoisted(() => ({ process: undefined as unknown as Record<string, unknown>, meetings: [] as P006MeetingRecord[] }))

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>()
  const { ref } = await import('vue')
  const meeting: P006MeetingRecord = {
    id: 'meeting-1', tenantId: 'tenant-1', businessNo: 'P006-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-1', currentNodeCode: 'S07', status: 'MINUTES_CONFIRMED', versionNo: 7,
    businessDate: '2026-08-13', subject: '月度运营会', reason: '服务端事实', priority: '普通',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', plannedStartAt: '2026-08-14T01:00:00Z',
    startAt: '2026-08-14T01:00:00Z', resultSummary: null, officialSubject: '运营会', officialContent: '正文',
    venueChannel: null, visibilityLevel: '内部', items: [], updatedAt: '2026-08-13T05:00:00Z',
  }
  const secondMeeting = { ...meeting, id: 'meeting-2', businessNo: 'P006-2026-0002', currentNodeCode: 'S01' as const, versionNo: 11, subject: '第二条会议' }
  harness.meetings = [meeting, secondMeeting]
  const recordsState = ref<AsyncState<readonly P006MeetingRecord[]>>({ phase: 'success', data: harness.meetings, requestId: 'resource-1' })
  const creationState = ref<AsyncState<P006MeetingRecord>>({ phase: 'idle' })
  const actionState = ref<AsyncState<P006MeetingRecord>>({ phase: 'idle' })
  const refresh = vi.fn(() => Promise.resolve(harness.meetings))
  const performAction = vi.fn(() => Promise.resolve(undefined))
  harness.process = {
    records: { state: recordsState }, creation: { state: creationState }, action: { state: actionState },
    can: vi.fn(() => true), canRead: vi.fn(() => true), canCreate: vi.fn(() => true),
    canCorrectCreation: vi.fn(() => creationState.value.phase === 'error'
      && creationState.value.error?.status === 422
      && creationState.value.error.kind === 'validation'),
    canRetryCreation: vi.fn(() => {
      if (creationState.value.phase !== 'error' || !creationState.value.error) return false
      const { kind, status } = creationState.value.error
      if (status === undefined) return kind === 'transport' || kind === 'unknown'
      return (status === 408 && kind === 'timeout') || (status >= 500 && kind === 'server')
    }),
    refresh, createMeeting: vi.fn(), performAction,
  }
  return { ...actual, useP006Meeting: () => harness.process }
})

import pageSource from '../../pages/P006MeetingPage.vue?raw'
import P006MeetingPage from '../../pages/P006MeetingPage.vue'

type ProcessHarness = {
  records: { state: { value: AsyncState<readonly P006MeetingRecord[]> } }
  creation: { state: { value: AsyncState<P006MeetingRecord> } }
  action: { state: { value: AsyncState<P006MeetingRecord> } }
  refresh: Mock<() => Promise<readonly P006MeetingRecord[]>>
  createMeeting: Mock<(input: unknown, key: string) => Promise<P006MeetingRecord | undefined>>
  performAction: Mock<(id: string, code: string, command: unknown, key: string) => Promise<P006MeetingRecord | undefined>>
  canRead: Mock<() => boolean>
  canCreate: Mock<() => boolean>
  canCorrectCreation: Mock<() => boolean>
  canRetryCreation: Mock<() => boolean>
}

function processHarness(): ProcessHarness {
  return harness.process as unknown as ProcessHarness
}

beforeEach(() => {
  const process = processHarness()
  process.records.state.value = { phase: 'success', data: harness.meetings, requestId: 'resource-reset' }
  process.creation.state.value = { phase: 'idle' }
  process.action.state.value = { phase: 'idle' }
  process.refresh.mockClear()
  process.createMeeting.mockReset().mockResolvedValue(undefined)
  process.performAction.mockReset().mockResolvedValue(undefined)
})

describe('P006 thin page contract', () => {
  it('assembles only the process public index and public UI packages', () => {
    expect(pageSource).toContain("from '../processes/p006'")
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/p006\//)
    expect(pageSource).not.toContain('usePortalSessionStore')
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
  })

  it('contains no raw interactive controls after process composition', () => {
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
  })

  it('keeps serialization and permission literals out of the thin page', () => {
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/p006\.meeting\.(read|monitor|create)/)
    expect(pageSource).toContain('process.canRead()')
    expect(pageSource).toContain('process.canCreate()')
  })

  it('mounts the thin page, loads records, blocks S07, and emits an ordinary action once with caller idempotency', async () => {
    const process = processHarness()
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }, mode: 'employee' },
    })
    await nextTick()
    expect(process.refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.get('table').text()).toContain('P006-2026-0001')
    expect(wrapper.get('[data-mobile-row="meeting-1"]').text()).toContain('P006-2026-0001')
    await wrapper.get('[data-action-code="GENERATE_ACTIONS"]').trigger('click')
    expect(process.performAction).not.toHaveBeenCalled()

    process.records.state.value = { phase: 'success', data: [{ ...harness.meetings[0]!, currentNodeCode: 'S01' }], requestId: 'resource-s01' }
    await nextTick()
    const submit = wrapper.get('[data-action-code="SUBMIT"]')
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = { phase: 'loading', requestId: 'action-1' }
      return new Promise<P006MeetingRecord | undefined>(() => undefined)
    })
    await submit.trigger('click')
    await submit.trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(1)
    const call = process.performAction.mock.calls[0]
    expect(call?.[0]).toBe('meeting-1')
    expect(call?.[1]).toBe('SUBMIT')
    expect(call?.[3]).toMatch(/^p006-submit-[0-9a-f-]+$/)
  })

  it('selects the second server record and uses its id/version for the action', async () => {
    const process = processHarness()
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'center', runtimeCode: 'center', title: '中心端', description: '', homeTitle: '', homeFocus: [] }, mode: 'center' },
    })
    await nextTick()
    await wrapper.get('[data-select-record="meeting-2"]').trigger('click')
    expect(wrapper.text()).toContain('第二条会议')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    const call = process.performAction.mock.calls[0]
    expect(call?.[0]).toBe('meeting-2')
    expect(call?.[2]).toMatchObject({ expectedVersion: 11 })
  })

  it('reuses an action idempotency key after timeout, rotates it after success, and isolates another record', async () => {
    const process = processHarness()
    process.records.state.value = { phase: 'success', data: [{ ...harness.meetings[0]!, currentNodeCode: 'S01' }, harness.meetings[1]!], requestId: 'resource-actions' }
    process.performAction
      .mockImplementationOnce(() => {
        process.action.state.value = { phase: 'error', requestId: 'action-timeout', error: { kind: 'timeout', status: 408, title: '超时', userMessage: '结果未知', nextAction: '重试' } }
        return Promise.resolve(undefined)
      })
      .mockImplementationOnce(() => {
        process.action.state.value = { phase: 'success', requestId: 'action-success', data: harness.meetings[0]! }
        return Promise.resolve(harness.meetings[0])
      })
      .mockResolvedValueOnce(harness.meetings[0])
      .mockResolvedValueOnce(harness.meetings[1])
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'center', runtimeCode: 'center', title: '中心端', description: '', homeTitle: '', homeFocus: [] }, mode: 'center' },
    })
    await nextTick()
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-action-error] button').trigger('click')
    await nextTick()
    await wrapper.get('[data-action-code="WITHDRAW"]').trigger('click')
    await wrapper.get('[data-select-record="meeting-2"]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    const keys = process.performAction.mock.calls.map(call => call[3])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
    expect(keys[3]).not.toBe(keys[2])
  })

  it('projects create timeout, retries with the same key, and rotates it after success', async () => {
    const process = processHarness()
    process.createMeeting
      .mockImplementationOnce(() => {
        process.creation.state.value = { phase: 'error', requestId: 'create-timeout', error: { kind: 'transport', title: '网络中断', userMessage: '结果未知', nextAction: '重试' } }
        return Promise.resolve(undefined)
      })
      .mockImplementationOnce(() => {
        process.creation.state.value = { phase: 'success', requestId: 'create-success', data: harness.meetings[0]! }
        return Promise.resolve(harness.meetings[0])
      })
      .mockResolvedValueOnce(harness.meetings[0])
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }, mode: 'employee' },
    })
    await nextTick()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    const create = wrapper.get('[data-submit-create]')
    await create.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-create-error]').text()).toContain('结果未知')
    expect(create.attributes('disabled')).toBeDefined()
    await create.trigger('click')
    expect(process.createMeeting).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-create-error] button').trigger('click')
    await nextTick()
    await create.trigger('click')
    const keys = process.createMeeting.mock.calls.map(call => call[1])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('shows backend create 403, blocks ordinary submit, and never replays the rejected intent', async () => {
    const process = processHarness()
    process.createMeeting
      .mockImplementationOnce(() => {
        process.creation.state.value = { phase: 'error', requestId: 'create-forbidden', error: { kind: 'forbidden', status: 403, title: '无权创建', userMessage: '后端拒绝创建会议', nextAction: '重试' } }
        return Promise.resolve(undefined)
      })
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }, mode: 'employee' },
    })
    await nextTick()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    const create = wrapper.get('[data-submit-create]')
    await create.trigger('click')
    await nextTick()
    expect(wrapper.get('[data-create-error]').text()).toContain('后端拒绝创建会议')
    expect(create.attributes('disabled')).toBeDefined()
    await create.trigger('click')
    expect(process.createMeeting).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
  })

  it('uses a corrected validation payload and a new idempotency key instead of replaying the old intent', async () => {
    const process = processHarness()
    process.createMeeting
      .mockImplementationOnce(() => {
        process.creation.state.value = { phase: 'error', requestId: 'create-validation', error: { kind: 'validation', status: 422, title: '字段校验失败', userMessage: '请修正会议主题', nextAction: '修正后重试' } }
        return Promise.resolve(undefined)
      })
      .mockImplementationOnce(() => {
        process.creation.state.value = { phase: 'success', requestId: 'create-corrected', data: harness.meetings[0]! }
        return Promise.resolve(harness.meetings[0])
      })
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }, mode: 'employee' },
    })
    await nextTick()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会（修正版）')
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-submit-create]').trigger('click')
    const first = process.createMeeting.mock.calls[0]
    const corrected = process.createMeeting.mock.calls[1]
    expect(first?.[0]).toMatchObject({ subject: '月度运营协调会' })
    expect(corrected?.[0]).toMatchObject({ subject: '月度运营协调会（修正版）' })
    expect(corrected?.[1]).not.toBe(first?.[1])
  })

  it('shows create conflict without replaying the stale pending intent', async () => {
    const process = processHarness()
    process.createMeeting.mockImplementationOnce(() => {
      process.creation.state.value = { phase: 'error', requestId: 'create-conflict', error: { kind: 'conflict', status: 409, title: '创建冲突', userMessage: '服务端事实已变化', nextAction: '刷新' } }
      return Promise.resolve(undefined)
    })
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }, mode: 'employee' },
    })
    await nextTick()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-create-error]').text()).toContain('服务端事实已变化')
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    expect(process.createMeeting).toHaveBeenCalledTimes(1)
  })

  it('fails closed for a contradictory creation status and kind', async () => {
    const process = processHarness()
    process.createMeeting.mockImplementationOnce(() => {
      process.creation.state.value = { phase: 'error', requestId: 'create-opaque', error: { kind: 'forbidden', status: 409, title: '伪权限标题', userMessage: '伪权限文案', nextAction: '重试' } }
      return Promise.resolve(undefined)
    })
    const wrapper = mount(P006MeetingPage, {
      props: { portal: { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }, mode: 'employee' },
    })
    await nextTick()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-create-error]').text()).toContain('无法确认错误类型')
    expect(wrapper.text()).not.toContain('伪权限文案')
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
  })
})
