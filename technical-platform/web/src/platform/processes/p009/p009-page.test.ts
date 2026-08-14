// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P009OvertimeRecord } from './contracts'
import type { PortalDefinition } from '../../portal-config'

const harness = vi.hoisted(() => ({ process: undefined as unknown as Record<string, unknown>, records: [] as P009OvertimeRecord[] }))

vi.mock('../../../session', () => ({
  usePortalSessionStore: () => ({ can: () => true, request: vi.fn().mockResolvedValue([]) }),
}))

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>()
  const { ref } = await import('vue')
  const record: P009OvertimeRecord = {
    id: 'overtime-1', tenantId: 'tenant-1', businessNo: 'P009-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P009-1', currentNodeCode: 'S01', status: '事前申请', versionNo: 1,
    businessDate: '2026-08-14', subject: '员工加班事实申请', reason: '实际任务安排', ownerCenterId: 'center-1',
    ownerEmployeeId: 'employee-1', attendanceType: '工作日加班', emergency: false, durationHours: 2,
    startAt: '2026-08-15T10:00:00Z', endAt: '2026-08-15T12:00:00Z', actualStartAt: null, actualEndAt: null,
    actualAttendanceSummary: null, resultSummary: null, schemeType: null, receiptReference: null, actualAmount: null,
    items: [], updatedAt: '2026-08-14T03:00:00Z',
  }
  harness.records = [record, { ...record, id: 'overtime-2', businessNo: 'P009-2026-0002', versionNo: 5, subject: '第二条加班' }]
  const recordsState = ref<AsyncState<readonly P009OvertimeRecord[]>>({ phase: 'success', data: harness.records, requestId: 'records-1' })
  const creationState = ref<AsyncState<P009OvertimeRecord>>({ phase: 'idle' })
  const actionState = ref<AsyncState<P009OvertimeRecord>>({ phase: 'idle' })
  harness.process = {
    records: { state: recordsState }, creation: { state: creationState }, action: { state: actionState },
    can: vi.fn(() => true), canRead: vi.fn(() => true), canCreate: vi.fn(() => true),
    refresh: vi.fn(() => Promise.resolve(harness.records)), createOvertime: vi.fn(() => Promise.resolve(undefined)),
    performAction: vi.fn(() => Promise.resolve(undefined)),
  }
  return { ...actual, useP009Overtime: () => harness.process }
})

import pageSource from '../../pages/P009OvertimePage.vue?raw'
import P009OvertimePage from '../../pages/P009OvertimePage.vue'

type ProcessHarness = {
  records: { state: { value: AsyncState<readonly P009OvertimeRecord[]> } }
  creation: { state: { value: AsyncState<P009OvertimeRecord> } }
  action: { state: { value: AsyncState<P009OvertimeRecord> } }
  refresh: Mock<() => Promise<readonly P009OvertimeRecord[]>>
  createOvertime: Mock<(input: unknown, key: string) => Promise<P009OvertimeRecord | undefined>>
  performAction: Mock<(id: string, code: string, command: unknown, key: string) => Promise<P009OvertimeRecord | undefined>>
}

function processHarness(): ProcessHarness { return harness.process as unknown as ProcessHarness }
const portal: PortalDefinition = { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }

async function fillCreate(wrapper: ReturnType<typeof mount<typeof P009OvertimePage>>, subject = '员工加班事实申请'): Promise<void> {
  await wrapper.get('[data-field="business-date"] input').setValue('2026-08-14')
  await wrapper.get('[data-field="subject"] input').setValue(subject)
  await wrapper.get('[data-field="reason"] textarea').setValue('按照实际任务安排提交加班事实与审批申请')
  await wrapper.get('[data-field="attendance-type"] input').setValue('工作日加班')
  await wrapper.get('[data-field="start-at"] input').setValue('2026-08-15T18:00')
  await wrapper.get('[data-field="end-at"] input').setValue('2026-08-15T20:00')
}

beforeEach(() => {
  if (harness.process == null) {
    const record: P009OvertimeRecord = {
      id: 'overtime-1', tenantId: 'tenant-1', businessNo: 'P009-2026-0001', workflowInstanceId: 'workflow-1',
      workflowInstanceNo: 'WF-P009-1', currentNodeCode: 'S01', status: '事前申请', versionNo: 1,
      businessDate: '2026-08-14', subject: '员工加班事实申请', reason: '实际任务安排', ownerCenterId: 'center-1',
      ownerEmployeeId: 'employee-1', attendanceType: '工作日加班', emergency: false, durationHours: 2,
      startAt: '2026-08-15T10:00:00Z', endAt: '2026-08-15T12:00:00Z', actualStartAt: null, actualEndAt: null,
      actualAttendanceSummary: null, resultSummary: null, schemeType: null, receiptReference: null, actualAmount: null,
      items: [], updatedAt: '2026-08-14T03:00:00Z',
    }
    harness.records = [record, { ...record, id: 'overtime-2', businessNo: 'P009-2026-0002', versionNo: 5, subject: '第二条加班' }]
    harness.process = {
      records: { state: ref<AsyncState<readonly P009OvertimeRecord[]>>({ phase: 'success', data: harness.records }) },
      creation: { state: ref<AsyncState<P009OvertimeRecord>>({ phase: 'idle' }) },
      action: { state: ref<AsyncState<P009OvertimeRecord>>({ phase: 'idle' }) },
      can: vi.fn(() => true), canRead: vi.fn(() => true), canCreate: vi.fn(() => true),
      refresh: vi.fn(() => Promise.resolve(harness.records)), createOvertime: vi.fn(), performAction: vi.fn(),
    }
  }
  const process = processHarness()
  process.records.state.value = { phase: 'success', data: harness.records, requestId: 'records-reset' }
  process.creation.state.value = { phase: 'idle' }
  process.action.state.value = { phase: 'idle' }
  process.refresh.mockReset().mockResolvedValue(harness.records)
  process.createOvertime.mockReset().mockResolvedValue(undefined)
  process.performAction.mockReset().mockResolvedValue(undefined)
})

describe('P009 thin page contract', () => {
  it('assembles only the p009 public index and public UI packages', () => {
    expect(pageSource).toContain("from '../processes/p009'")
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/p009\//)
    expect(pageSource).not.toContain('usePortalSessionStore')
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/p009\.overtime\.(submit|read|manage|review|hr|monitor)/)
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
  })

  it('loads server records and suppresses a duplicate create while busy', async () => {
    const process = processHarness()
    process.createOvertime.mockImplementationOnce(() => {
      process.creation.state.value = { phase: 'loading', requestId: 'create-pending' }
      return new Promise<P009OvertimeRecord | undefined>(() => undefined)
    })
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    expect(process.refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.get('table').text()).toContain('P009-2026-0001')
    await fillCreate(wrapper)
    await wrapper.get('[data-submit-create]').trigger('click')
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(process.createOvertime).toHaveBeenCalledTimes(1)
    expect(process.createOvertime.mock.calls[0]?.[1]).toMatch(/^p009-create-[0-9a-f-]+$/)
  })

  it('selects another server record and isolates its version and action key', async () => {
    const process = processHarness()
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'center' } })
    await nextTick()
    await wrapper.get('[data-select-record="overtime-2"]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(process.performAction.mock.calls[0]?.[0]).toBe('overtime-2')
    expect(process.performAction.mock.calls[0]?.[2]).toMatchObject({ expectedVersion: 5 })
    expect(process.performAction.mock.calls[0]?.[3]).toMatch(/^p009-submit-[0-9a-f-]+$/)
  })

  it('retries timeout with the same action key and rotates after success and record change', async () => {
    const process = processHarness()
    process.performAction
      .mockImplementationOnce(() => { process.action.state.value = { phase: 'error', requestId: 'timeout-1', error: { kind: 'timeout', status: 408, title: '超时', userMessage: '结果未知', nextAction: '重试' } }; return Promise.resolve(undefined) })
      .mockImplementationOnce(() => { process.action.state.value = { phase: 'success', requestId: 'success-1', data: harness.records[0]! }; return Promise.resolve(harness.records[0]) })
      .mockResolvedValueOnce(harness.records[1])
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-action-error] button').trigger('click')
    await wrapper.get('[data-select-record="overtime-2"]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    const keys = process.performAction.mock.calls.map(call => call[3])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('refreshes 409 facts and uses the latest version with a new key without replaying 403', async () => {
    const process = processHarness()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = { phase: 'error', requestId: 'conflict-1', error: { kind: 'conflict', status: 409, title: '冲突', userMessage: '刷新事实', nextAction: '刷新' } }
      return Promise.resolve(undefined)
    })
    process.refresh.mockImplementation(() => {
      process.records.state.value = { phase: 'success', data: [{ ...harness.records[0]!, versionNo: 9 }, harness.records[1]!], requestId: 'latest' }
      return Promise.resolve(process.records.state.value.data ?? [])
    })
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    const firstKey = process.performAction.mock.calls[0]?.[3]
    await nextTick()
    await wrapper.get('[data-refresh-facts]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(process.performAction.mock.calls[1]?.[2]).toMatchObject({ expectedVersion: 9 })
    expect(process.performAction.mock.calls[1]?.[3]).not.toBe(firstKey)

    process.action.state.value = { phase: 'error', requestId: 'forbidden-1', error: { kind: 'forbidden', status: 403, title: '无权', userMessage: '后端拒绝', nextAction: '返回' } }
    await nextTick()
    await wrapper.get('[data-refresh-facts]').trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(2)
  })

  it.each([
    { kind: 'timeout', status: 408, title: '创建超时', userMessage: '创建结果未知', nextAction: '重试' },
    { kind: 'transport', title: '网络中断', userMessage: '创建结果未知', nextAction: '重试' },
    { kind: 'server', status: 503, title: '服务失败', userMessage: '创建结果未知', nextAction: '重试' },
    { kind: 'unknown', title: '结果未知', userMessage: '创建结果未知', nextAction: '重试' },
  ] as const)('retries uncertain create with the same key and rotates after success %#', async (error) => {
    const process = processHarness()
    process.createOvertime
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'error', requestId: 'create-uncertain', error }; return Promise.resolve(undefined) })
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'success', requestId: 'create-success', data: harness.records[0]! }; return Promise.resolve(harness.records[0]) })
      .mockResolvedValueOnce(harness.records[0])
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'employee' } })
    await nextTick();await fillCreate(wrapper)
    await wrapper.get('[data-submit-create]').trigger('click');await nextTick()
    await wrapper.get('[data-create-error] button').trigger('click');await nextTick()
    await wrapper.get('[data-submit-create]').trigger('click')
    const keys = process.createOvertime.mock.calls.map(call => call[1])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('uses corrected validation material and a new create key', async () => {
    const process = processHarness()
    process.createOvertime
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'error', requestId: 'create-validation', error: { kind: 'validation', status: 422, title: '字段错误', userMessage: '修正主题', nextAction: '修正' } }; return Promise.resolve(undefined) })
      .mockResolvedValueOnce(harness.records[0])
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'employee' } })
    await nextTick();await fillCreate(wrapper)
    await wrapper.get('[data-submit-create]').trigger('click');await nextTick()
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(process.createOvertime).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-field="subject"] input').setValue('员工加班事实申请（修正版）')
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(process.createOvertime.mock.calls[1]?.[0]).toMatchObject({ subject: '员工加班事实申请（修正版）' })
    expect(process.createOvertime.mock.calls[1]?.[1]).not.toBe(process.createOvertime.mock.calls[0]?.[1])
  })

  it('keeps tech metadata-only and never exposes local sensitive reveal controls', async () => {
    const wrapper = mount(P009OvertimePage, { props: { portal, mode: 'tech' } })
    await nextTick()
    expect(wrapper.find('[data-action-code]').exists()).toBe(false)
    expect(wrapper.find('[data-submit-create]').exists()).toBe(false)
    expect(wrapper.find('[data-reveal-sensitive]').exists()).toBe(false)
    expect(wrapper.get('[data-sensitive-contract-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
  })
})
