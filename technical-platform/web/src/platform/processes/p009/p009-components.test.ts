// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { AsyncState, UiError } from '@sgj/platform-ui'

import type { P009ActionCandidate, P009ActionCode, P009ActionCommand, P009OvertimeRecord } from './contracts'
import P009OvertimeActionPanel from './P009OvertimeActionPanel.vue'
import P009OvertimeCompensationPanel from './P009OvertimeCompensationPanel.vue'
import P009OvertimeCreateForm from './P009OvertimeCreateForm.vue'
import P009OvertimeRecordList from './P009OvertimeRecordList.vue'

function overtime(overrides: Partial<P009OvertimeRecord> = {}): P009OvertimeRecord {
  return {
    id: 'overtime-1', tenantId: 'tenant-1', businessNo: 'P009-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P009-1', currentNodeCode: 'S01', status: '事前申请', versionNo: 1,
    businessDate: '2026-08-14', subject: '员工加班事实申请', reason: '按照实际任务安排提交加班事实与审批申请',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '工作日加班', emergency: false,
    durationHours: 2, startAt: '2026-08-15T10:00:00Z', endAt: '2026-08-15T12:00:00Z',
    actualStartAt: null, actualEndAt: null, actualAttendanceSummary: null, resultSummary: null,
    schemeType: null, receiptReference: null, actualAmount: null,
    items: [{ id: 'item-1', fieldCode: 'receipt', itemSeq: 1, itemName: '回执', value: { detail: 'SECRET-DETAIL', stack: 'SECRET-STACK' }, createdAt: '2026-08-14T02:00:00Z' }],
    updatedAt: '2026-08-14T03:00:00Z', ...overrides,
  }
}

function candidate(code: P009ActionCode): P009ActionCandidate {
  return { code, label: code, authority: 'ux-candidate' }
}

async function fillCreate(wrapper: ReturnType<typeof mount<typeof P009OvertimeCreateForm>>, emergency = false): Promise<void> {
  await wrapper.get('[data-field="business-date"] input').setValue('2026-08-14')
  await wrapper.get('[data-field="subject"] input').setValue('员工加班事实申请')
  await wrapper.get('[data-field="reason"] textarea').setValue('按照实际任务安排提交加班事实与审批申请')
  await wrapper.get('[data-field="attendance-type"] input').setValue('工作日加班')
  await wrapper.get('[data-field="start-at"] input').setValue('2026-08-15T18:00')
  await wrapper.get('[data-field="end-at"] input').setValue('2026-08-15T20:00')
  if (emergency) {
    await wrapper.get('[data-field="emergency"] input').setValue(true)
    await wrapper.get('[data-field="emergency-evidence"] textarea').setValue('紧急事实登记不可变证据摘要')
  }
}

describe('P009 process components', () => {
  it('submits the complete validated self-owned create contract', async () => {
    const wrapper = mount(P009OvertimeCreateForm, { props: { allowed: true, busy: false } })
    await fillCreate(wrapper, true)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      subject: '员工加班事实申请', emergency: true,
      emergencyEvidence: { note: '紧急事实登记不可变证据摘要' },
    })
  })

  it('never emits invalid normal or emergency create material', async () => {
    const wrapper = mount(P009OvertimeCreateForm, { props: { allowed: true, busy: false } })
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await fillCreate(wrapper)
    await wrapper.get('[data-field="emergency"] input').setValue(true)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('starts a new valid create lifecycle only after a 422 field correction', async () => {
    const wrapper = mount(P009OvertimeCreateForm, { props: { allowed: true, busy: false } })
    await fillCreate(wrapper)
    await wrapper.setProps({ creationState: {
      phase: 'error', requestId: 'create-validation',
      error: { kind: 'validation', status: 422, title: '字段错误', userMessage: '请修正主题', nextAction: '修正后重试' },
    } })
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    await wrapper.get('[data-field="subject"] input').setValue('员工加班事实申请（修正版）')
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ subject: '员工加班事实申请（修正版）' })
  })

  it.each([
    { kind: 'forbidden', status: 403, title: '无权创建', userMessage: '后端拒绝', nextAction: '返回' },
    { kind: 'conflict', status: 409, title: '创建冲突', userMessage: '服务端事实变化', nextAction: '刷新' },
    { kind: 'forbidden', status: 409, title: 'SECRET-TITLE', userMessage: 'SECRET-DETAIL', nextAction: 'SECRET-NEXT' },
  ] as const)('never exposes retry or ordinary submit for deterministic/opaque create error %#', async (error) => {
    const state: AsyncState<P009OvertimeRecord> = { phase: 'error', requestId: 'create-terminal', error }
    const wrapper = mount(P009OvertimeCreateForm, { props: { allowed: true, busy: false, creationState: state } })
    expect(wrapper.find('[data-create-error] button').exists()).toBe(false)
    await wrapper.get('[data-submit-create]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('retry')).toBeUndefined()
    if (error.status === 409 && error.kind === 'forbidden') expect(wrapper.html()).not.toContain('SECRET-DETAIL')
  })

  it('uses AsyncState.data as the only desktop, mobile and navigation record truth', () => {
    const current = overtime({ id: 'overtime-current', businessNo: 'P009-CURRENT' })
    const stale = overtime({ id: 'overtime-stale', businessNo: 'P009-STALE' })
    const state: AsyncState<readonly P009OvertimeRecord[]> = { phase: 'success', data: [current], requestId: 'records-current' }
    const wrapper = mount(P009OvertimeRecordList, { props: { records: [stale], state, selectedId: current.id } })
    expect(wrapper.text()).toContain('P009-CURRENT')
    expect(wrapper.html()).not.toContain('P009-STALE')
    expect(wrapper.get('[data-mobile-row="overtime-current"]').text()).toContain('P009-CURRENT')
    expect(wrapper.find('[data-select-record="overtime-stale"]').exists()).toBe(false)
  })

  it('selects a second server record from the same authoritative state', async () => {
    const records = [overtime(), overtime({ id: 'overtime-2', businessNo: 'P009-2026-0002', versionNo: 5 })]
    const wrapper = mount(P009OvertimeRecordList, {
      props: { records: [], state: { phase: 'success', data: records }, selectedId: 'overtime-1' },
    })
    await wrapper.get('[data-select-record="overtime-2"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['overtime-2'])
  })

  it('masks compensation and receipt facts without local reveal authority or arbitrary item values', () => {
    const record = overtime({ schemeType: 'PAYROLL', receiptReference: 'SECRET-RECEIPT-009', actualAmount: 125.5 })
    const wrapper = mount(P009OvertimeCompensationPanel, { props: { overtime: record } })
    expect(wrapper.get('[data-sensitive-contract-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
    for (const secret of ['SECRET-RECEIPT-009', '125.5', 'SECRET-DETAIL', 'SECRET-STACK']) {
      expect(wrapper.text()).not.toContain(secret)
      expect(wrapper.html()).not.toContain(secret)
      expect(Object.values(wrapper.attributes())).not.toContain(secret)
    }
    expect(wrapper.find('[data-reveal-sensitive]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('stepUpSatisfied')
  })

  it.each([
    ['RETURN', ['reason']], ['REJECT', ['reason']], ['RECORD_FACT', ['actualStartAt', 'actualEndAt', 'actualAttendanceSummary', 'evidence']],
    ['ACCEPT_RESULT', ['resultSummary']], ['REWORK', ['reason', 'resultSummary']], ['HR_CONFIRM', ['schemeType', 'evidence']],
    ['HR_RETURN', ['reason', 'evidence']], ['CONFIRM_SCHEME', ['evidence']],
    ['RECORD_RECEIPT', ['externalReference', 'externallyDeterminedAmount', 'evidence']], ['ARCHIVE', ['evidence']],
  ] as const)('keeps %s disabled while required material %j is blank', async (code, _requiredFields) => {
    expect(_requiredFields.length).toBeGreaterThan(0)
    const wrapper = mount(P009OvertimeActionPanel, {
      props: { overtime: overtime({ currentNodeCode: 'S08', schemeType: 'PAYROLL' }), candidates: [candidate(code)], busy: false },
    })
    await wrapper.get(`[data-action-code="${code}"]`).trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.get(`[data-action-code="${code}"]`).attributes('disabled')).toBeDefined()
  })

  it('emits a complete typed RECORD_FACT command with the server version', async () => {
    const wrapper = mount(P009OvertimeActionPanel, {
      props: { overtime: overtime({ currentNodeCode: 'S04', versionNo: 7 }), candidates: [candidate('RECORD_FACT')], busy: false },
    })
    await wrapper.get('[data-actual-start-at] input').setValue('2026-08-15T18:00')
    await wrapper.get('[data-actual-end-at] input').setValue('2026-08-15T20:00')
    await wrapper.get('[data-actual-attendance-summary] textarea').setValue('真实劳动与考勤事实摘要')
    await wrapper.get('[data-action-evidence] textarea').setValue('不可变劳动事实证据')
    await wrapper.get('[data-action-code="RECORD_FACT"]').trigger('click')
    const emitted = wrapper.emitted<[P009ActionCode, P009ActionCommand]>('action')?.[0]
    expect(emitted?.[0]).toBe('RECORD_FACT')
    expect(emitted?.[1]).toMatchObject({ expectedVersion: 7, actualAttendanceSummary: '真实劳动与考勤事实摘要', evidence: { note: '不可变劳动事实证据' } })
  })

  it('emits a typed payroll receipt without revealing returned receipt facts', async () => {
    const wrapper = mount(P009OvertimeActionPanel, {
      props: { overtime: overtime({ currentNodeCode: 'S08', versionNo: 8, schemeType: 'PAYROLL' }), candidates: [candidate('RECORD_RECEIPT')], busy: false },
    })
    await wrapper.get('[data-external-reference] input').setValue('PAY-EXT-009')
    await wrapper.get('[data-external-amount] input').setValue('125.50')
    await wrapper.get('[data-action-evidence] textarea').setValue('外部薪酬回执证据')
    await wrapper.get('[data-action-code="RECORD_RECEIPT"]').trigger('click')
    expect(wrapper.emitted('action')?.[0]?.[1]).toMatchObject({ expectedVersion: 8, externalReference: 'PAY-EXT-009', externallyDeterminedAmount: 125.5 })
  })

  it.each([
    [{ kind: 'forbidden', status: 403, title: '无权操作', userMessage: '后端拒绝', nextAction: '返回' }, false],
    [{ kind: 'conflict', status: 409, title: '版本冲突', userMessage: '请刷新事实', nextAction: '刷新' }, false],
    [{ kind: 'timeout', status: 408, title: '请求超时', userMessage: '结果未知', nextAction: '重试' }, true],
  ] as const)('fails closed for typed backend error %#', async (error, retryable) => {
    const actionState: AsyncState<P009OvertimeRecord> = { phase: 'error', requestId: 'action-error', error }
    const wrapper = mount(P009OvertimeActionPanel, { props: { overtime: overtime(), candidates: [candidate('SUBMIT')], busy: false, actionState } })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.find('[data-action-error] button').exists()).toBe(retryable)
  })

  it('normalizes contradictory status-kind without exposing detail, stack, title or nextAction', () => {
    const error: UiError & { detail: string } = {
      kind: 'forbidden', status: 409, title: 'SECRET-TITLE', userMessage: 'SECRET-DETAIL',
      nextAction: 'SECRET-NEXT', detail: 'SECRET-STACK',
    }
    const actionState: AsyncState<P009OvertimeRecord> = {
      phase: 'error', requestId: 'action-opaque',
      error,
    }
    const wrapper = mount(P009OvertimeActionPanel, { props: { overtime: overtime(), candidates: [candidate('SUBMIT')], busy: false, actionState } })
    expect(wrapper.text()).toContain('无法确认错误类型')
    for (const secret of ['SECRET-TITLE', 'SECRET-DETAIL', 'SECRET-NEXT', 'SECRET-STACK']) expect(wrapper.html()).not.toContain(secret)
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
  })

  it('suppresses a duplicate ordinary action after caller busy is projected', async () => {
    const wrapper = mount(P009OvertimeActionPanel, { props: { overtime: overtime(), candidates: [candidate('SUBMIT')], busy: false } })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    await wrapper.setProps({ busy: true })
    await wrapper.get('[data-action-code="SUBMIT"]').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
