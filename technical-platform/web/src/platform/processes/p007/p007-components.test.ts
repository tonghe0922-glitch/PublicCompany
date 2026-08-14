// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P007ActionCandidate, P007ActionCode, P007ActionCommand, P007ScheduleRecord } from './contracts'
import P007ScheduleActionPanel from './P007ScheduleActionPanel.vue'
import P007ScheduleRecordList from './P007ScheduleRecordList.vue'
import P007ShiftCreateForm from './P007ShiftCreateForm.vue'
import P007ShiftDetails from './P007ShiftDetails.vue'

function record(overrides: Partial<P007ScheduleRecord> = {}): P007ScheduleRecord {
  return {
    id: 'shift-1', tenantId: 'tenant-1', businessNo: 'P007-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P007-1', currentNodeCode: 'S06', status: 'CHANGE_PENDING', versionNo: 7,
    businessDate: '2026-08-13', subject: '景区运营排班', reason: '依据服务端业务量制定排班',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '排班', changeAction: '制定',
    changeReason: '依据服务端业务量制定正式排班', contentVersion: 'SAFE-V1', durationHours: 8,
    startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', periodOrCourseNo: 'P007-WEEK-1',
    actualAttendanceSummary: null, resultSummary: null, items: [], updatedAt: '2026-08-13T03:00:00Z',
    ...overrides,
  }
}

describe('P007 process components', () => {
  it('keeps owner-directory creation visibly blocked with no editable identifier or submit emission', async () => {
    const wrapper = mount(P007ShiftCreateForm)
    expect(wrapper.text()).toContain('BLOCKED_BY_CONTRACT')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    const button = wrapper.get('[data-create-blocked]')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('projects the same server records on desktop/mobile and emits a typed second-record selection', async () => {
    const first = record()
    const second = record({ id: 'shift-2', businessNo: 'P007-2026-0002', subject: '第二条排班', versionNo: 11 })
    const state: AsyncState<readonly P007ScheduleRecord[]> = { phase: 'success', data: [first, second], requestId: 'records-1' }
    const wrapper = mount(P007ScheduleRecordList, { props: { records: [first, second], state, selectedId: first.id } })
    expect(wrapper.get('table').text()).toContain('P007-2026-0002')
    expect(wrapper.get('[data-mobile-row="shift-2"]').text()).toContain('P007-2026-0002')
    await wrapper.get('[data-select-record="shift-2"]').trigger('click')
    expect(wrapper.emitted('select')).toEqual([['shift-2']])
  })

  it('uses state.data as the only record truth when the records prop is stale', () => {
    const stale = record({ id: 'stale', businessNo: 'STALE-RECORD', subject: '过期记录' })
    const staleSecond = record({ id: 'stale-2', businessNo: 'STALE-SECOND', subject: '第二条过期记录' })
    const current = record({ id: 'current', businessNo: 'CURRENT-RECORD', subject: '权威记录' })
    const state: AsyncState<readonly P007ScheduleRecord[]> = { phase: 'success', data: [current], requestId: 'records-current' }
    const wrapper = mount(P007ScheduleRecordList, { props: { records: [stale, staleSecond], state, selectedId: current.id } })
    expect(wrapper.text()).toContain('CURRENT-RECORD')
    expect(wrapper.html()).not.toContain('STALE-RECORD')
    expect(wrapper.html()).not.toContain('STALE-SECOND')
    expect(wrapper.find('[data-select-record="stale"]').exists()).toBe(false)
    expect(wrapper.get('[data-mobile-row="current"]').text()).toContain('CURRENT-RECORD')
  })

  it('renders only whitelisted record and item metadata without value/detail/stack leakage', () => {
    const wrapper = mount(P007ShiftDetails, { props: { schedule: record({ items: [{
      id: 'item-1', fieldCode: 'before_snapshot', itemSeq: 1, itemName: '变更前快照',
      value: { secret: 'SECRET-VALUE', detail: 'SECRET-DETAIL', stack: 'SECRET-STACK' }, createdAt: '2026-08-13T02:00:00Z',
    }] }) } })
    expect(wrapper.text()).toContain('变更前快照')
    expect(wrapper.text()).not.toContain('SECRET')
    expect(wrapper.html()).not.toContain('SECRET')
  })

  it('keeps REQUEST_CHANGE visible and blocked while NO_CHANGE emits the server version', async () => {
    const candidates: P007ActionCandidate[] = [
      { code: 'REQUEST_CHANGE', label: '申请换班/替班', authority: 'ux-candidate', blocked: true, blockedCode: 'DIRECTORY_CONTRACT_REQUIRED' },
      { code: 'NO_CHANGE', label: '无需变更', authority: 'ux-candidate', blocked: false },
    ]
    const wrapper = mount(P007ScheduleActionPanel, { props: { schedule: record(), candidates, busy: false } })
    const blocked = wrapper.get('[data-action-code="REQUEST_CHANGE"]')
    expect(blocked.attributes('disabled')).toBeDefined()
    await blocked.trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    await wrapper.get('[data-action-code="NO_CHANGE"]').trigger('click')
    const emitted = wrapper.emitted<[P007ActionCode, P007ActionCommand]>('action')
    expect(emitted?.[0]).toEqual(['NO_CHANGE', expect.objectContaining({ expectedVersion: 7 })])
  })

  it('suppresses a duplicate ordinary action after caller busy is projected', async () => {
    const candidates: P007ActionCandidate[] = [{ code: 'SUBMIT_DEMAND', label: '提交需求', authority: 'ux-candidate', blocked: false }]
    const wrapper = mount(P007ScheduleActionPanel, { props: { schedule: record({ currentNodeCode: 'S01' }), candidates, busy: false } })
    await wrapper.get('[data-action-code="SUBMIT_DEMAND"]').trigger('click')
    await wrapper.setProps({ busy: true })
    await wrapper.get('[data-action-code="SUBMIT_DEMAND"]').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it.each([
    [{ kind: 'forbidden', status: 403, title: '无权操作', userMessage: '后端拒绝', nextAction: '返回' }, false],
    [{ kind: 'conflict', status: 409, title: '版本冲突', userMessage: '刷新服务端事实', nextAction: '刷新' }, false],
    [{ kind: 'timeout', status: 408, title: '请求超时', userMessage: '结果未知', nextAction: '重试' }, true],
  ] as const)('fails closed for backend error projection %#', async (error, retryable) => {
    const candidates: P007ActionCandidate[] = [{ code: 'SUBMIT_DEMAND', label: '提交需求', authority: 'ux-candidate', blocked: false }]
    const actionState: AsyncState<P007ScheduleRecord> = { phase: 'error', requestId: 'action-error', error }
    const wrapper = mount(P007ScheduleActionPanel, { props: { schedule: record({ currentNodeCode: 'S01' }), candidates, busy: false, actionState } })
    expect(wrapper.text()).toContain(error.userMessage)
    await wrapper.get('[data-action-code="SUBMIT_DEMAND"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    const retry = wrapper.find('[data-action-error] button')
    expect(retry.exists()).toBe(retryable)
    if (retryable) {
      await retry.trigger('click')
      expect(wrapper.emitted('retry')).toHaveLength(1)
    } else {
      expect(wrapper.emitted('retry')).toBeUndefined()
    }
  })

  it('normalizes contradictory status and kind without exposing caller text or retry', async () => {
    const candidates: P007ActionCandidate[] = [{ code: 'SUBMIT_DEMAND', label: '提交需求', authority: 'ux-candidate', blocked: false }]
    const actionState: AsyncState<P007ScheduleRecord> = {
      phase: 'error', requestId: 'action-opaque',
      error: { kind: 'forbidden', status: 409, title: '伪权限标题', userMessage: '伪权限文案', nextAction: '重试' },
    }
    const wrapper = mount(P007ScheduleActionPanel, { props: { schedule: record(), candidates, busy: false, actionState } })
    expect(wrapper.text()).toContain('无法确认错误类型')
    expect(wrapper.text()).not.toContain('伪权限文案')
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
    await wrapper.get('[data-action-code="SUBMIT_DEMAND"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it.each([
    ['CONFIRM', 'evidence'], ['REJECT', 'reason'], ['LINK', 'evidence'], ['CLOSE_DAY', 'attendance'],
  ] as const)('does not emit %s when required %s material is blank', async (code, material) => {
    const candidates: P007ActionCandidate[] = [{ code, label: code, authority: 'ux-candidate', blocked: false }]
    const wrapper = mount(P007ScheduleActionPanel, { props: { schedule: record({ currentNodeCode: 'S09' }), candidates, busy: false } })
    const button = wrapper.get(`[data-action-code="${code}"]`)
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.text()).toContain(material === 'reason' ? '原因' : material === 'attendance' ? '考勤' : '证据')
  })
})
