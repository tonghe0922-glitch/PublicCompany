// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { AsyncState } from '@sgj/platform-ui'

import type { P006ActionCandidate, P006ActionCode, P006ActionCommand, P006MeetingRecord } from './contracts'
import P006MeetingActionPanel from './P006MeetingActionPanel.vue'
import P006MeetingCreateForm from './P006MeetingCreateForm.vue'
import P006MeetingEvidencePanel from './P006MeetingEvidencePanel.vue'
import P006MeetingRecordList from './P006MeetingRecordList.vue'

function record(overrides: Partial<P006MeetingRecord> = {}): P006MeetingRecord {
  return {
    id: 'meeting-1', tenantId: 'tenant-1', businessNo: 'P006-2026-0001',
    workflowInstanceId: 'workflow-1', workflowInstanceNo: 'WF-1', currentNodeCode: 'S07',
    status: 'MINUTES_CONFIRMED', versionNo: 7, businessDate: '2026-08-13', subject: '月度运营会',
    reason: '根据服务端会议记录处理', priority: '普通', ownerCenterId: 'center-1',
    ownerEmployeeId: 'employee-1', plannedStartAt: '2026-08-14T01:00:00Z', startAt: '2026-08-14T01:00:00Z',
    resultSummary: '已确认纪要', officialSubject: '月度运营协调', officialContent: '权威正文',
    venueChannel: '一号会议室', visibilityLevel: '内部', items: [], updatedAt: '2026-08-13T05:00:00Z',
    ...overrides,
  }
}

describe('P006 process components', () => {
  it('keeps create disabled without caller permission and emits only a typed server command', async () => {
    const blocked = mount(P006MeetingCreateForm, { props: { allowed: false, busy: false } })
    expect(blocked.get('[data-submit-create]').attributes('disabled')).toBeDefined()
    await blocked.get('[data-submit-create]').trigger('click')
    expect(blocked.emitted('submit')).toBeUndefined()

    const wrapper = mount(P006MeetingCreateForm, { props: { allowed: true, busy: false } })
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2099-08-14T09:00')
    const submit = wrapper.get('[data-submit-create]')
    expect(submit.attributes('disabled')).toBeUndefined()
    await submit.trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      subject: '月度运营协调会', officialSubject: '月度运营协调', officialContent: '会议权威正文',
    })
  })

  it('does not throw or emit a create command for blank required fields or an invalid date', async () => {
    const wrapper = mount(P006MeetingCreateForm, { props: { allowed: true, busy: false } })
    const button = wrapper.get('[data-submit-create]')
    expect(button.attributes('disabled')).toBeDefined()
    await expect(button.trigger('click')).resolves.toBeUndefined()
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('请完整填写会议必填字段')
  })

  it.each([
    [{ kind: 'timeout', status: 408, title: '创建超时', userMessage: '创建结果未知', nextAction: '重试' }, '创建结果未知'],
    [{ kind: 'transport', title: '网络中断', userMessage: '创建结果未知', nextAction: '重试' }, '创建结果未知'],
    [{ kind: 'server', status: 503, title: '服务不可用', userMessage: '服务暂不可用', nextAction: '重试' }, '服务暂不可用'],
    [{ kind: 'unknown', title: '创建失败', userMessage: '创建结果无法确认', nextAction: '重试' }, '创建结果无法确认'],
  ] as const)('allows retry only for an uncertain creation result %#', async (error, expectedText) => {
    const creationState: AsyncState<P006MeetingRecord> = { phase: 'error', requestId: 'create-error', error }
    const wrapper = mount(P006MeetingCreateForm, { props: { allowed: true, busy: false, creationState } })
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    expect(wrapper.get('[data-create-error]').text()).toContain(expectedText)
    const submit = wrapper.get('[data-submit-create]')
    expect(submit.attributes('disabled')).toBeDefined()
    await submit.trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.get('[data-create-error] button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it.each([
    { kind: 'forbidden', status: 403, title: '无权创建', userMessage: '后端拒绝创建', nextAction: '返回' },
    { kind: 'conflict', status: 409, title: '创建冲突', userMessage: '服务端事实已变化', nextAction: '刷新' },
  ] as const)('projects a deterministic creation rejection without retry %#', (error) => {
    const creationState: AsyncState<P006MeetingRecord> = { phase: 'error', requestId: 'create-terminal', error }
    const wrapper = mount(P006MeetingCreateForm, { props: { allowed: true, busy: false, creationState } })
    expect(wrapper.get('[data-create-error]').text()).toContain(error.userMessage)
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('retry')).toBeUndefined()
  })

  it('starts a new payload only after correcting a backend validation rejection', async () => {
    const wrapper = mount(P006MeetingCreateForm, { props: { allowed: true, busy: false } })
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    await wrapper.setProps({
      creationState: {
        phase: 'error', requestId: 'create-validation',
        error: { kind: 'validation', status: 422, title: '字段校验失败', userMessage: '请修正会议主题', nextAction: '修正后重试' },
      },
    })
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会（修正版）')
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('retry')).toBeUndefined()
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ subject: '月度运营协调会（修正版）' })
  })

  it('normalizes a contradictory creation status and kind without exposing caller text', async () => {
    const creationState: AsyncState<P006MeetingRecord> = {
      phase: 'error',
      requestId: 'create-contradictory',
      error: { kind: 'forbidden', status: 409, title: '伪权限标题', userMessage: '伪权限文案', nextAction: '重试' },
    }
    const wrapper = mount(P006MeetingCreateForm, { props: { allowed: true, busy: false, creationState } })
    await wrapper.get('[data-field="subject"] input').setValue('月度运营协调会')
    await wrapper.get('[data-field="reason"] textarea').setValue('根据服务端业务事实发起会议')
    await wrapper.get('[data-field="official-subject"] input').setValue('月度运营协调')
    await wrapper.get('[data-field="official-content"] textarea').setValue('会议权威正文')
    await wrapper.get('[data-field="start-at"] input').setValue('2027-08-14T09:00')
    expect(wrapper.get('[data-create-error]').text()).toContain('无法确认错误类型')
    expect(wrapper.text()).not.toContain('伪权限文案')
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    expect(wrapper.get('[data-submit-create]').attributes('disabled')).toBeDefined()
  })

  it('shows owner-dependent action as blocked and never emits it', async () => {
    const candidates: P006ActionCandidate[] = [{
      code: 'GENERATE_ACTIONS', label: '生成行动项', authority: 'ux-candidate', blocked: true,
      blockedCode: 'DIRECTORY_CONTRACT_REQUIRED',
    }]
    const wrapper = mount(P006MeetingActionPanel, { props: { meeting: record(), candidates, busy: false } })
    expect(wrapper.text()).toContain('BLOCKED_BY_CONTRACT')
    const button = wrapper.get('[data-action-code="GENERATE_ACTIONS"]')
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('emits an allowed action with only server version and caller-entered evidence', async () => {
    const candidates: P006ActionCandidate[] = [{ code: 'SUBMIT_EXECUTION', label: '提交执行', authority: 'ux-candidate', blocked: false }]
    const wrapper = mount(P006MeetingActionPanel, {
      props: { meeting: record({ currentNodeCode: 'S08', versionNo: 8 }), candidates, busy: false },
    })
    await wrapper.get('[data-action-reason] textarea').setValue('按纪要执行')
    await wrapper.get('[data-action-evidence] textarea').setValue('不可变证据摘要')
    await wrapper.get('[data-action-code="SUBMIT_EXECUTION"]').trigger('click')
    const emitted = wrapper.emitted<[P006ActionCode, P006ActionCommand]>('action')
    const [code, command] = emitted?.[0] ?? []
    expect(code).toBe('SUBMIT_EXECUTION')
    expect(command).toMatchObject({ expectedVersion: 8, reason: '按纪要执行' })
    expect(command?.evidence).toMatchObject({ note: '不可变证据摘要' })
  })

  it('suppresses duplicate ordinary actions once caller busy is projected', async () => {
    const candidates: P006ActionCandidate[] = [{ code: 'SUBMIT', label: '提交', authority: 'ux-candidate', blocked: false }]
    const wrapper = mount(P006MeetingActionPanel, { props: { meeting: record({ currentNodeCode: 'S01' }), candidates, busy: false } })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await wrapper.setProps({ busy: true })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it.each([
    [{ kind: 'forbidden', status: 403, title: '无权操作', userMessage: '后端拒绝', nextAction: '返回' }, '后端拒绝'],
    [{ kind: 'conflict', status: 409, title: '版本冲突', userMessage: '请刷新', nextAction: '刷新' }, '请刷新'],
    [{ kind: 'timeout', status: 408, title: '请求超时', userMessage: '请重试', nextAction: '重试' }, '请重试'],
  ] as const)('fails closed for backend error projection %#', async (error, expectedText) => {
    const candidates: P006ActionCandidate[] = [{ code: 'SUBMIT', label: '提交', authority: 'ux-candidate', blocked: false }]
    const actionState: AsyncState<P006MeetingRecord> = { phase: 'error', error, requestId: 'action-1' }
    const wrapper = mount(P006MeetingActionPanel, { props: { meeting: record({ currentNodeCode: 'S01' }), candidates, busy: false, actionState } })
    expect(wrapper.text()).toContain(expectedText)
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('treats contradictory status/kind as generic fail-closed projection', () => {
    const candidates: P006ActionCandidate[] = [{ code: 'SUBMIT', label: '提交', authority: 'ux-candidate', blocked: false }]
    const actionState: AsyncState<P006MeetingRecord> = {
      phase: 'error', requestId: 'action-contradictory',
      error: { kind: 'forbidden', status: 409, title: '伪权限标题', userMessage: '伪权限文案', nextAction: '未知' },
    }
    const wrapper = mount(P006MeetingActionPanel, { props: { meeting: record(), candidates, busy: false, actionState } })
    expect(wrapper.text()).toContain('无法确认错误类型')
    expect(wrapper.text()).not.toContain('伪权限文案')
  })

  it.each([
    { kind: 'forbidden', status: 418, title: '伪权限-418', userMessage: '伪权限文案-418', nextAction: '返回' },
    { kind: 'forbidden', title: '伪权限-无状态', userMessage: '伪权限文案-无状态', nextAction: '返回' },
    { kind: 'timeout', status: 503, title: '伪超时', userMessage: '伪超时文案', nextAction: '重试' },
  ] as const)('normalizes unknown or unsafe status-kind pairs instead of trusting caller text %#', async (error) => {
    const candidates: P006ActionCandidate[] = [{ code: 'SUBMIT', label: '提交', authority: 'ux-candidate', blocked: false }]
    const actionState: AsyncState<P006MeetingRecord> = { phase: 'error', error, requestId: 'action-opaque' }
    const wrapper = mount(P006MeetingActionPanel, { props: { meeting: record(), candidates, busy: false, actionState } })
    expect(wrapper.text()).toContain('无法确认错误类型')
    expect(wrapper.text()).not.toContain(error.userMessage)
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it.each([
    'RETURN', 'REJECT', 'REWORK', 'CONFIRM_MINUTES', 'SUBMIT_EXECUTION', 'ARCHIVE',
  ] as const)('does not emit %s when its required material is blank', async (code) => {
    const candidates: P006ActionCandidate[] = [{ code, label: code, authority: 'ux-candidate', blocked: false }]
    const wrapper = mount(P006MeetingActionPanel, { props: { meeting: record({ currentNodeCode: 'S06' }), candidates, busy: false } })
    const button = wrapper.get(`[data-action-code="${code}"]`)
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.text()).toContain('请补充当前动作必需材料')
  })

  it('projects the same server record in desktop and mobile views', () => {
    const wrapper = mount(P006MeetingRecordList, { props: { records: [record()], state: { phase: 'success', data: [record()] } } })
    expect(wrapper.get('table').text()).toContain('P006-2026-0001')
    expect(wrapper.get('[data-mobile-row="meeting-1"]').text()).toContain('P006-2026-0001')
  })

  it('renders server evidence fields without exposing an owner-directory input', () => {
    const wrapper = mount(P006MeetingEvidencePanel, { props: { meeting: record({ items: [{
      id: 'item-1', fieldCode: 'execution_evidence', itemSeq: 1, itemKey: 'E-1', itemName: '执行证据',
      value: { digest: 'SECRET-DIGEST', detail: 'SECRET-DETAIL', stack: 'SECRET-STACK' }, createdAt: '2026-08-13T04:00:00Z',
    }] }) } })
    expect(wrapper.text()).toContain('执行证据')
    expect(wrapper.find('[name="ownerEmployeeId"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('SECRET')
    expect(wrapper.html()).not.toContain('SECRET')
  })
})
