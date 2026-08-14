// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P008ActionCandidate, P008ActionCode, P008ActionCommand, P008LeaveRecord, P008QuotaEntry } from './contracts'
import P008LeaveActionPanel from './P008LeaveActionPanel.vue'
import P008LeaveCreateForm from './P008LeaveCreateForm.vue'
import P008LeaveQuotaPanel from './P008LeaveQuotaPanel.vue'
import P008LeaveRecordList from './P008LeaveRecordList.vue'

function leave(overrides: Partial<P008LeaveRecord> = {}): P008LeaveRecord {
  return {
    id: 'leave-1', tenantId: 'tenant-1', businessNo: 'P008-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P008-1', currentNodeCode: 'S01', status: '请假申请', versionNo: 1,
    businessDate: '2026-08-13', subject: '员工年度休假申请', reason: '按照年度计划申请休假并完成工作安排',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '年假', changeAction: 'APPLY',
    changeReason: '按照年度计划申请休假并完成工作安排', durationHours: 8,
    startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', handoverAgentId: null,
    quotaAccountId: 'ANNUAL', quotaAmount: 8, actualEndAt: null, actualAttendanceSummary: null,
    items: [{ id: 'item-1', fieldCode: 'handover_items', itemSeq: 1, itemName: '交接事项', value: { detail: 'SECRET-DETAIL', stack: 'SECRET-STACK' }, createdAt: '2026-08-13T02:00:00Z' }],
    updatedAt: '2026-08-13T03:00:00Z', ...overrides,
  }
}

function quota(overrides: Partial<P008QuotaEntry> = {}): P008QuotaEntry {
  return {
    id: 'quota-1', employeeId: 'employee-1', ownerCenterId: 'center-1', quotaAccountId: 'ANNUAL',
    leaveRequestId: 'leave-1', entryType: 'RESERVE', availableDelta: -8, reservedDelta: 8, consumedDelta: 0,
    availableAfter: 72, reservedAfter: 8, consumedAfter: 0, reason: '额度预占', createdAt: '2026-08-13T04:00:00Z', ...overrides,
  }
}

function candidate(code: P008ActionCode): P008ActionCandidate {
  return { code, label: code, authority: 'ux-candidate' }
}

describe('P008 process components', () => {
  it('submits a valid null-handover create command and keeps the directory selector visibly blocked', async () => {
    const wrapper = mount(P008LeaveCreateForm, { props: { allowed: true, busy: false } })
    expect(wrapper.get('[data-handover-directory-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
    expect(wrapper.find('[name="handoverAgentId"]').exists()).toBe(false)
    expect(wrapper.find('[data-handover-option]').exists()).toBe(false)
    await wrapper.get('[data-handover-blocked]').trigger('click')
    expect(wrapper.emitted('handover')).toBeUndefined()
    await wrapper.get('[data-field="business-date"] input').setValue('2026-08-13')
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请')
    await wrapper.get('[data-field="reason"] textarea').setValue('按照年度计划申请休假并完成工作安排')
    await wrapper.get('[data-field="attendance-type"] input').setValue('年假')
    await wrapper.get('[data-field="quota-account"] input').setValue('ANNUAL')
    await wrapper.get('[data-field="start-at"] input').setValue('2026-08-14T09:00')
    await wrapper.get('[data-field="end-at"] input').setValue('2026-08-14T17:00')
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ handoverAgentId: null, subject: '员工年度休假申请' })
  })

  it('never emits an invalid create command', async () => {
    const wrapper = mount(P008LeaveCreateForm, { props: { allowed: true, busy: false } })
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeDefined()
  })

  it('starts a new valid create lifecycle only after a 422 field correction', async () => {
    const wrapper = mount(P008LeaveCreateForm, { props: { allowed: true, busy: false } })
    await wrapper.get('[data-field="business-date"] input').setValue('2026-08-13')
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请')
    await wrapper.get('[data-field="reason"] textarea').setValue('按照年度计划申请休假并完成工作安排')
    await wrapper.get('[data-field="attendance-type"] input').setValue('年假')
    await wrapper.get('[data-field="quota-account"] input').setValue('ANNUAL')
    await wrapper.get('[data-field="start-at"] input').setValue('2026-08-14T09:00')
    await wrapper.get('[data-field="end-at"] input').setValue('2026-08-14T17:00')
    await wrapper.setProps({ creationState: {
      phase: 'error', requestId: 'create-validation',
      error: { kind: 'validation', status: 422, title: '字段错误', userMessage: '请修正主题', nextAction: '修正后重试' },
    } })
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.get('[data-field="subject"] input').setValue('员工年度休假申请（修正版）')
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ subject: '员工年度休假申请（修正版）' })
  })

  it.each([
    { kind: 'forbidden', status: 403, title: '无权创建', userMessage: '后端拒绝', nextAction: '返回' },
    { kind: 'conflict', status: 409, title: '创建冲突', userMessage: '服务端事实变化', nextAction: '刷新' },
    { kind: 'forbidden', status: 409, title: '伪权限', userMessage: 'SECRET-CREATE-DETAIL', nextAction: '重试' },
  ] as const)('never exposes retry or ordinary submit for deterministic/opaque create error %#', async (error) => {
    const creationState: AsyncState<P008LeaveRecord> = { phase: 'error', requestId: 'create-terminal', error }
    const wrapper = mount(P008LeaveCreateForm, { props: { allowed: true, busy: false, creationState } })
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('retry')).toBeUndefined()
    if (error.status === 409 && error.kind === 'forbidden') expect(wrapper.html()).not.toContain('SECRET-CREATE-DETAIL')
  })

  it('uses AsyncState.data as the only desktop, mobile and navigation record truth', () => {
    const current = leave({ id: 'leave-current', businessNo: 'P008-CURRENT' })
    const stale = leave({ id: 'leave-stale', businessNo: 'P008-STALE' })
    const state: AsyncState<readonly P008LeaveRecord[]> = { phase: 'success', data: [current], requestId: 'records-current' }
    const wrapper = mount(P008LeaveRecordList, { props: { records: [stale], state, selectedId: current.id } })
    expect(wrapper.text()).toContain('P008-CURRENT')
    expect(wrapper.html()).not.toContain('P008-STALE')
    expect(wrapper.get('[data-mobile-row="leave-current"]').text()).toContain('P008-CURRENT')
    expect(wrapper.find('[data-select-record="leave-stale"]').exists()).toBe(false)
  })

  it('selects a second server record from the same authoritative state', async () => {
    const records = [leave(), leave({ id: 'leave-2', businessNo: 'P008-2026-0002', versionNo: 5 })]
    const wrapper = mount(P008LeaveRecordList, {
      props: { records: [], state: { phase: 'success', data: records }, selectedId: 'leave-1' },
    })
    await wrapper.get('[data-select-record="leave-2"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['leave-2'])
  })

  it.each([
    [{ phase: 'loading', requestId: 'quota-loading' }, '正在加载'],
    [{ phase: 'empty', data: [], requestId: 'quota-empty' }, '暂无'],
    [{ phase: 'partial', data: [quota()], missingResources: ['quota-summary'], requestId: 'quota-partial' }, '部分'],
    [{ phase: 'error', requestId: 'quota-error', error: { kind: 'server', status: 503, title: '额度失败', userMessage: '额度暂不可用', nextAction: '稍后重试' } }, '额度暂不可用'],
  ] as const)('projects quota state independently %#', (state, expected) => {
    const wrapper = mount(P008LeaveQuotaPanel, { props: { state } })
    expect(wrapper.text()).toContain(expected)
  })

  it('renders quota server facts without leaking arbitrary reason or value objects', () => {
    const state: AsyncState<readonly P008QuotaEntry[]> = { phase: 'success', data: [quota({ reason: 'SECRET-QUOTA-REASON' })] }
    const wrapper = mount(P008LeaveQuotaPanel, { props: { state } })
    expect(wrapper.text()).toContain('72')
    expect(wrapper.html()).not.toContain('SECRET-QUOTA-REASON')
  })

  it('emits typed required material with the current server version', async () => {
    const wrapper = mount(P008LeaveActionPanel, { props: { leave: leave({ currentNodeCode: 'S04', versionNo: 7 }), candidates: [candidate('REJECT')], busy: false } })
    await wrapper.get('[data-action-reason] textarea').setValue('审批材料不完整')
    await wrapper.get('[data-action-evidence] textarea').setValue('审批证据摘要')
    await wrapper.get('[data-action-code="REJECT"]').trigger('click')
    const emitted = wrapper.emitted<[P008ActionCode, P008ActionCommand]>('action')?.[0]
    expect(emitted?.[0]).toBe('REJECT')
    expect(emitted?.[1]).toMatchObject({ expectedVersion: 7, reason: '审批材料不完整', evidence: { note: '审批证据摘要' } })
  })

  it('does not emit actions whose typed material is blank', async () => {
    const wrapper = mount(P008LeaveActionPanel, { props: { leave: leave({ currentNodeCode: 'S04' }), candidates: [candidate('REJECT')], busy: false } })
    await wrapper.get('[data-action-code="REJECT"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.get('[data-action-code="REJECT"]').attributes('disabled')).toBeDefined()
  })

  it.each([
    [{ kind: 'forbidden', status: 403, title: '无权操作', userMessage: '后端拒绝', nextAction: '返回' }, false],
    [{ kind: 'conflict', status: 409, title: '版本冲突', userMessage: '请刷新事实', nextAction: '刷新' }, false],
    [{ kind: 'timeout', status: 408, title: '请求超时', userMessage: '结果未知', nextAction: '重试' }, true],
  ] as const)('fails closed for typed backend error %#', async (error, retryable) => {
    const actionState: AsyncState<P008LeaveRecord> = { phase: 'error', requestId: 'action-error', error }
    const wrapper = mount(P008LeaveActionPanel, { props: { leave: leave(), candidates: [candidate('SUBMIT')], busy: false, actionState } })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.find('[data-action-error] button').exists()).toBe(retryable)
  })

  it('normalizes contradictory status and kind without exposing caller detail or retry', () => {
    const actionState: AsyncState<P008LeaveRecord> = {
      phase: 'error', requestId: 'action-opaque',
      error: { kind: 'forbidden', status: 409, title: '伪权限标题', userMessage: 'SECRET-DETAIL', nextAction: '重试' },
    }
    const wrapper = mount(P008LeaveActionPanel, { props: { leave: leave(), candidates: [candidate('SUBMIT')], busy: false, actionState } })
    expect(wrapper.text()).toContain('无法确认错误类型')
    expect(wrapper.html()).not.toContain('SECRET-DETAIL')
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
  })

  it('suppresses a duplicate ordinary action after caller busy is projected', async () => {
    const wrapper = mount(P008LeaveActionPanel, { props: { leave: leave(), candidates: [candidate('SUBMIT')], busy: false } })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await wrapper.setProps({ busy: true })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
