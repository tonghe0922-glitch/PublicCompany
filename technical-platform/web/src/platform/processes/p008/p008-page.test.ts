// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P008LeaveRecord, P008QuotaEntry } from './contracts'
import type { PortalDefinition } from '../../portal-config'

const harness = vi.hoisted(() => ({ process: undefined as unknown as Record<string, unknown>, records: [] as P008LeaveRecord[] }))

vi.mock('../../../session', () => ({
  usePortalSessionStore: () => ({ can: () => true, request: vi.fn().mockResolvedValue([]) }),
}))

vi.mock('./index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./index')>()
  const { ref } = await import('vue')
  const record: P008LeaveRecord = {
    id: 'leave-1', tenantId: 'tenant-1', businessNo: 'P008-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P008-1', currentNodeCode: 'S01', status: '请假申请', versionNo: 1,
    businessDate: '2026-08-13', subject: '员工年度休假申请', reason: '年度计划', ownerCenterId: 'center-1',
    ownerEmployeeId: 'employee-1', attendanceType: '年假', changeAction: 'APPLY', changeReason: '年度计划',
    durationHours: 8, startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', handoverAgentId: null,
    quotaAccountId: 'ANNUAL', quotaAmount: 8, actualEndAt: null, actualAttendanceSummary: null, items: [], updatedAt: '2026-08-13T03:00:00Z',
  }
  harness.records = [record, { ...record, id: 'leave-2', businessNo: 'P008-2026-0002', versionNo: 5, subject: '第二条请假', currentNodeCode: 'S01' }]
  const recordsState = ref<AsyncState<readonly P008LeaveRecord[]>>({ phase: 'success', data: harness.records, requestId: 'records-1' })
  const quotaState = ref<AsyncState<readonly P008QuotaEntry[]>>({ phase: 'empty', data: [], requestId: 'quota-1' })
  const creationState = ref<AsyncState<P008LeaveRecord>>({ phase: 'idle' })
  const actionState = ref<AsyncState<P008LeaveRecord>>({ phase: 'idle' })
  const refresh = vi.fn(() => Promise.resolve(harness.records))
  const createLeave = vi.fn(() => Promise.resolve(undefined))
  const performAction = vi.fn(() => Promise.resolve(undefined))
  harness.process = {
    records: { state: recordsState }, quota: { state: quotaState }, creation: { state: creationState }, action: { state: actionState },
    can: vi.fn(() => true), canRead: vi.fn(() => true), canCreate: vi.fn(() => true), refresh, createLeave, performAction,
  }
  return { ...actual, useP008Leave: () => harness.process }
})

import pageSource from '../../pages/P008LeavePage.vue?raw'
import P008LeavePage from '../../pages/P008LeavePage.vue'

type ProcessHarness = {
  records: { state: { value: AsyncState<readonly P008LeaveRecord[]> } }
  quota: { state: { value: AsyncState<readonly P008QuotaEntry[]> } }
  creation: { state: { value: AsyncState<P008LeaveRecord> } }
  action: { state: { value: AsyncState<P008LeaveRecord> } }
  refresh: Mock<() => Promise<readonly P008LeaveRecord[]>>
  createLeave: Mock<(input: unknown, key: string) => Promise<P008LeaveRecord | undefined>>
  performAction: Mock<(id: string, code: string, command: unknown, key: string) => Promise<P008LeaveRecord | undefined>>
  canRead: Mock<() => boolean>
  canCreate: Mock<() => boolean>
}

function processHarness(): ProcessHarness { return harness.process as unknown as ProcessHarness }
const portal: PortalDefinition = { code: 'employee', runtimeCode: 'employee', title: '员工端', description: '', homeTitle: '', homeFocus: [] }

beforeEach(() => {
  if (harness.process == null) {
    const record: P008LeaveRecord = {
      id: 'leave-1', tenantId: 'tenant-1', businessNo: 'P008-2026-0001', workflowInstanceId: 'workflow-1',
      workflowInstanceNo: 'WF-P008-1', currentNodeCode: 'S01', status: '请假申请', versionNo: 1,
      businessDate: '2026-08-13', subject: '员工年度休假申请', reason: '年度计划', ownerCenterId: 'center-1',
      ownerEmployeeId: 'employee-1', attendanceType: '年假', changeAction: 'APPLY', changeReason: '年度计划',
      durationHours: 8, startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', handoverAgentId: null,
      quotaAccountId: 'ANNUAL', quotaAmount: 8, actualEndAt: null, actualAttendanceSummary: null, items: [], updatedAt: '2026-08-13T03:00:00Z',
    }
    harness.records = [record, { ...record, id: 'leave-2', businessNo: 'P008-2026-0002', versionNo: 5, subject: '第二条请假' }]
    harness.process = {
      records: { state: ref<AsyncState<readonly P008LeaveRecord[]>>({ phase: 'success', data: harness.records }) },
      quota: { state: ref<AsyncState<readonly P008QuotaEntry[]>>({ phase: 'empty', data: [] }) },
      creation: { state: ref<AsyncState<P008LeaveRecord>>({ phase: 'idle' }) },
      action: { state: ref<AsyncState<P008LeaveRecord>>({ phase: 'idle' }) },
      can: vi.fn(() => true), canRead: vi.fn(() => true), canCreate: vi.fn(() => true),
      refresh: vi.fn(() => Promise.resolve(harness.records)), createLeave: vi.fn(), performAction: vi.fn(),
    }
  }
  const process = processHarness()
  process.records.state.value = { phase: 'success', data: harness.records, requestId: 'records-reset' }
  process.quota.state.value = { phase: 'empty', data: [], requestId: 'quota-reset' }
  process.creation.state.value = { phase: 'idle' }
  process.action.state.value = { phase: 'idle' }
  process.refresh.mockClear()
  process.createLeave.mockReset().mockResolvedValue(undefined)
  process.performAction.mockReset().mockResolvedValue(undefined)
})

describe('P008 thin page contract', () => {
  it('assembles only the p008 public index and public UI packages', () => {
    expect(pageSource).toContain("from '../processes/p008'")
    expect(pageSource).not.toMatch(/from ['"][^'"]*processes\/p008\//)
    expect(pageSource).not.toContain('usePortalSessionStore')
    expect(pageSource).not.toContain('session.request')
    expect(pageSource).not.toContain('/api/')
    expect(pageSource).not.toContain('JSON.stringify')
    expect(pageSource).not.toMatch(/p008\.leave\.(submit|read|manage|review|monitor)/)
    expect(pageSource).not.toMatch(/<(button|input|select|textarea)\b/)
  })

  it('loads independent record and quota facts and submits a null-handover create intent once', async () => {
    const process = processHarness()
    process.createLeave.mockImplementationOnce(() => {
      process.creation.state.value = { phase: 'loading', requestId: 'create-pending' }
      return new Promise<P008LeaveRecord | undefined>(() => undefined)
    })
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    expect(process.refresh).toHaveBeenCalledTimes(1)
    expect(wrapper.get('table').text()).toContain('P008-2026-0001')
    expect(wrapper.get('[data-handover-directory-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
    await wrapper.get('[data-field="business-date"] input').setValue('2026-08-13')
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请')
    await wrapper.get('[data-field="reason"] textarea').setValue('按照年度计划申请休假并完成工作安排')
    await wrapper.get('[data-field="attendance-type"] input').setValue('年假')
    await wrapper.get('[data-field="quota-account"] input').setValue('ANNUAL')
    await wrapper.get('[data-field="start-at"] input').setValue('2026-08-14T09:00')
    await wrapper.get('[data-field="end-at"] input').setValue('2026-08-14T17:00')
    const submit = wrapper.get('[data-submit-create]')
    await submit.trigger('click')
    await submit.trigger('click')
    expect(process.createLeave).toHaveBeenCalledTimes(1)
    expect(process.createLeave.mock.calls[0]?.[0]).toMatchObject({ handoverAgentId: null })
    expect(process.createLeave.mock.calls[0]?.[1]).toMatch(/^p008-create-[0-9a-f-]+$/)
  })

  it('selects another server record and uses its id and version with an isolated key', async () => {
    const process = processHarness()
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'center' } })
    await nextTick()
    await wrapper.get('[data-select-record="leave-2"]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(process.performAction.mock.calls[0]?.[0]).toBe('leave-2')
    expect(process.performAction.mock.calls[0]?.[2]).toMatchObject({ expectedVersion: 5 })
    expect(process.performAction.mock.calls[0]?.[3]).toMatch(/^p008-submit-[0-9a-f-]+$/)
  })

  it('retries timeout with the same key and rotates on success, new action and new record', async () => {
    const process = processHarness()
    process.performAction
      .mockImplementationOnce(() => { process.action.state.value = { phase: 'error', requestId: 'timeout-1', error: { kind: 'timeout', status: 408, title: '超时', userMessage: '结果未知', nextAction: '重试' } }; return Promise.resolve(undefined) })
      .mockImplementationOnce(() => { process.action.state.value = { phase: 'success', requestId: 'success-1', data: harness.records[0]! }; return Promise.resolve(harness.records[0]) })
      .mockResolvedValueOnce(harness.records[0])
      .mockResolvedValueOnce(harness.records[1])
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-action-error] button').trigger('click')
    await nextTick()
    process.records.state.value = { phase: 'success', data: [{ ...harness.records[0]!, currentNodeCode: 'S02' }, harness.records[1]!], requestId: 'records-next-action' }
    await nextTick()
    await wrapper.get('[data-action-code="RESERVE"]').trigger('click')
    await wrapper.get('[data-select-record="leave-2"]').trigger('click')
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    const keys = process.performAction.mock.calls.map(call => call[3])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
    expect(keys[3]).not.toBe(keys[2])
  })

  it('shows 409 only for its record, refreshes facts, and then uses the latest version with a new key', async () => {
    const process = processHarness()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = { phase: 'error', requestId: 'conflict-1', error: { kind: 'conflict', status: 409, title: '版本冲突', userMessage: '请刷新服务端事实', nextAction: '刷新' } }
      return Promise.resolve(undefined)
    })
    process.refresh.mockImplementation(() => {
      process.records.state.value = { phase: 'success', data: [{ ...harness.records[0]!, versionNo: 9 }, harness.records[1]!], requestId: 'records-latest' }
      return Promise.resolve(process.records.state.value.data ?? [])
    })
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await nextTick()
    const firstKey = process.performAction.mock.calls[0]?.[3]
    expect(wrapper.get('[data-action-error]').text()).toContain('请刷新服务端事实')
    await wrapper.get('[data-select-record="leave-2"]').trigger('click')
    expect(wrapper.find('[data-action-error]').exists()).toBe(false)
    await wrapper.get('[data-select-record="leave-1"]').trigger('click')
    await wrapper.get('[data-refresh-facts]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-action-error]').exists()).toBe(false)
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(process.performAction.mock.calls[1]?.[2]).toMatchObject({ expectedVersion: 9 })
    expect(process.performAction.mock.calls[1]?.[3]).not.toBe(firstKey)
  })

  it('keeps backend 403 terminal and contradictory status-kind generic without replay', async () => {
    const process = processHarness()
    process.performAction.mockImplementationOnce(() => {
      process.action.state.value = { phase: 'error', requestId: 'forbidden-1', error: { kind: 'forbidden', status: 403, title: '无权', userMessage: '后端拒绝', nextAction: '返回' } }
      return Promise.resolve(undefined)
    })
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
    await wrapper.get('[data-refresh-facts]').trigger('click')
    expect(process.performAction).toHaveBeenCalledTimes(1)

    process.action.state.value = { phase: 'error', requestId: 'opaque-1', error: { kind: 'forbidden', status: 409, title: '伪权限', userMessage: 'SECRET-DETAIL', nextAction: '重试' } }
    await nextTick()
    expect(wrapper.text()).toContain('无法确认错误类型')
    expect(wrapper.html()).not.toContain('SECRET-DETAIL')
  })

  it.each([
    { kind: 'timeout', status: 408, title: '创建超时', userMessage: '创建结果未知', nextAction: '重试' },
    { kind: 'transport', title: '网络中断', userMessage: '创建结果未知', nextAction: '重试' },
    { kind: 'server', status: 503, title: '服务失败', userMessage: '创建结果未知', nextAction: '重试' },
    { kind: 'unknown', title: '结果未知', userMessage: '创建结果未知', nextAction: '重试' },
  ] as const)('retries an uncertain create result with the same key then rotates after success %#', async (error) => {
    const process = processHarness()
    process.createLeave
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'error', requestId: 'create-uncertain', error }; return Promise.resolve(undefined) })
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'success', requestId: 'create-success', data: harness.records[0]! }; return Promise.resolve(harness.records[0]) })
      .mockResolvedValueOnce(harness.records[0])
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-field="business-date"] input').setValue('2026-08-13')
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请')
    await wrapper.get('[data-field="reason"] textarea').setValue('按照年度计划申请休假并完成工作安排')
    await wrapper.get('[data-field="attendance-type"] input').setValue('年假')
    await wrapper.get('[data-field="quota-account"] input').setValue('ANNUAL')
    await wrapper.get('[data-field="start-at"] input').setValue('2026-08-14T09:00')
    await wrapper.get('[data-field="end-at"] input').setValue('2026-08-14T17:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    await nextTick()
    await wrapper.get('[data-create-error] button').trigger('click')
    await nextTick()
    await wrapper.get('[data-submit-create]').trigger('click')
    const keys = process.createLeave.mock.calls.map(call => call[1])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('uses a corrected validation payload and a new create key', async () => {
    const process = processHarness()
    process.createLeave
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'error', requestId: 'create-validation', error: { kind: 'validation', status: 422, title: '字段错误', userMessage: '请修正主题', nextAction: '修正后重试' } }; return Promise.resolve(undefined) })
      .mockImplementationOnce(() => { process.creation.state.value = { phase: 'success', requestId: 'create-corrected', data: harness.records[0]! }; return Promise.resolve(harness.records[0]) })
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-field="business-date"] input').setValue('2026-08-13')
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请')
    await wrapper.get('[data-field="reason"] textarea').setValue('按照年度计划申请休假并完成工作安排')
    await wrapper.get('[data-field="attendance-type"] input').setValue('年假')
    await wrapper.get('[data-field="quota-account"] input').setValue('ANNUAL')
    await wrapper.get('[data-field="start-at"] input').setValue('2026-08-14T09:00')
    await wrapper.get('[data-field="end-at"] input').setValue('2026-08-14T17:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(process.createLeave).toHaveBeenCalledTimes(1)
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请（修正版）')
    await wrapper.get('[data-submit-create]').trigger('click')
    const calls = process.createLeave.mock.calls
    expect(calls[1]?.[0]).toMatchObject({ subject: '员工年度休假申请（修正版）' })
    expect(calls[1]?.[1]).not.toBe(calls[0]?.[1])
  })

  it.each([
    { kind: 'forbidden', status: 403, title: '无权创建', userMessage: '后端拒绝', nextAction: '返回' },
    { kind: 'conflict', status: 409, title: '创建冲突', userMessage: '服务端事实变化', nextAction: '刷新' },
    { kind: 'forbidden', status: 409, title: 'SECRET-TITLE', userMessage: 'SECRET-DETAIL', nextAction: 'SECRET-NEXT' },
  ] as const)('never replays deterministic or opaque create error %#', async (error) => {
    const process = processHarness()
    process.createLeave.mockImplementationOnce(() => { process.creation.state.value = { phase: 'error', requestId: 'create-terminal', error }; return Promise.resolve(undefined) })
    const wrapper = mount(P008LeavePage, { props: { portal, mode: 'employee' } })
    await nextTick()
    await wrapper.get('[data-field="business-date"] input').setValue('2026-08-13')
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请')
    await wrapper.get('[data-field="reason"] textarea').setValue('按照年度计划申请休假并完成工作安排')
    await wrapper.get('[data-field="attendance-type"] input').setValue('年假')
    await wrapper.get('[data-field="quota-account"] input').setValue('ANNUAL')
    await wrapper.get('[data-field="start-at"] input').setValue('2026-08-14T09:00')
    await wrapper.get('[data-field="end-at"] input').setValue('2026-08-14T17:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    await nextTick()
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(process.createLeave).toHaveBeenCalledTimes(1)
    if (error.status === 409 && error.kind === 'forbidden') {
      expect(wrapper.html()).not.toContain('SECRET-TITLE')
      expect(wrapper.html()).not.toContain('SECRET-DETAIL')
      expect(wrapper.html()).not.toContain('SECRET-NEXT')
    }
  })
})
