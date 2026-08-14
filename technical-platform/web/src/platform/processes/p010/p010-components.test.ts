// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { AsyncState, UiError } from '@sgj/platform-ui'

import type { P010ActionCandidate, P010ActionCode, P010ActionCommand, P010LearningRecord } from './contracts'
import P010LearningActionPanel from './P010LearningActionPanel.vue'
import P010LearningCreateForm from './P010LearningCreateForm.vue'
import P010LearningRecordList from './P010LearningRecordList.vue'
import P010QualificationPanel from './P010QualificationPanel.vue'

function learning(overrides: Partial<P010LearningRecord> = {}): P010LearningRecord {
  return {
    id: 'learning-1', tenantId: 'tenant-1', businessNo: 'P010-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P010-1', currentNodeCode: 'S01', status: 'Version publication', versionNo: 1,
    businessDate: '2026-08-14', subject: '高风险作业资格课程', reason: '岗位风险矩阵要求资格持续有效',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', courseVersionId: 'SAFETY-V1',
    contentVersion: '2026.08', courseTeamName: '安全作业学院', periodOrCourseNo: 'SAFE-001',
    learnerProfile: '高风险岗位作业人员', completionRate: 0, score1000: 886,
    practicalResult: 'SECRET-PRACTICAL', qualificationEffectiveDate: '2026-08-15',
    qualificationExpireDate: '2027-08-14',
    events: [{
      id: 'event-1', eventSeq: 1, eventType: 'ASSIGNMENT_CREATED',
      evidence: { value: 'SECRET-EVIDENCE', detail: 'SECRET-DETAIL', stack: 'SECRET-STACK' },
      actorEmployeeId: 'manager-1', createdAt: '2026-08-14T02:00:00Z',
    }],
    updatedAt: '2026-08-14T03:00:00Z', ...overrides,
  }
}

function candidate(code: P010ActionCode): P010ActionCandidate {
  return { code, label: code, authority: 'ux-candidate' }
}

async function fillEvidence(wrapper: ReturnType<typeof mount<typeof P010LearningActionPanel>>): Promise<void> {
  await wrapper.get('[data-action-evidence] textarea').setValue('不可变服务端动作证据摘要')
}

describe('P010 process components', () => {
  it('shows the owner directory contract block without any create or UUID channel', () => {
    const wrapper = mount(P010LearningCreateForm)
    expect(wrapper.get('[data-owner-directory-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
    expect(wrapper.text()).toContain('人员目录')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('[data-submit-create]').exists()).toBe(false)
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.html()).not.toContain('ownerEmployeeId')
  })

  it('uses AsyncState.data as the only desktop, mobile and navigation record truth', () => {
    const current = learning({ id: 'learning-current', businessNo: 'P010-CURRENT' })
    const stale = learning({ id: 'learning-stale', businessNo: 'P010-STALE' })
    const state: AsyncState<readonly P010LearningRecord[]> = { phase: 'success', data: [current], requestId: 'records-current' }
    const wrapper = mount(P010LearningRecordList, { props: { records: [stale], state, selectedId: current.id } })
    expect(wrapper.text()).toContain('P010-CURRENT')
    expect(wrapper.html()).not.toContain('P010-STALE')
    expect(wrapper.get('[data-mobile-row="learning-current"]').text()).toContain('P010-CURRENT')
    expect(wrapper.find('[data-select-record="learning-stale"]').exists()).toBe(false)
  })

  it('selects a second server record from the same authoritative state', async () => {
    const records = [learning(), learning({ id: 'learning-2', businessNo: 'P010-2026-0002', versionNo: 5 })]
    const wrapper = mount(P010LearningRecordList, {
      props: { records: [], state: { phase: 'success', data: records }, selectedId: 'learning-1' },
    })
    await wrapper.get('[data-select-record="learning-2"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['learning-2'])
  })

  it('masks score, practical and qualification facts without leaking event evidence', () => {
    const record = learning({ score1000: 912, practicalResult: 'SECRET-PRACTICAL' })
    const wrapper = mount(P010QualificationPanel, { props: { learning: record } })
    expect(wrapper.get('[data-sensitive-contract-blocked]').text()).toContain('BLOCKED_BY_CONTRACT')
    for (const secret of ['912', 'SECRET-PRACTICAL', '2026-08-15', '2027-08-14', 'SECRET-EVIDENCE', 'SECRET-DETAIL', 'SECRET-STACK']) {
      expect(wrapper.text()).not.toContain(secret)
      expect(wrapper.html()).not.toContain(secret)
      expect(Object.values(wrapper.attributes())).not.toContain(secret)
    }
    expect(wrapper.find('[data-reveal-sensitive]').exists()).toBe(false)
    expect(wrapper.html()).not.toContain('stepUpSatisfied')
  })

  it.each([
    ['PUBLISH', ['evidence']], ['ASSIGN', ['evidence']], ['COMPLETE_LEARNING', ['evidence']],
    ['SUBMIT_EXAM', ['score1000', 'evidence']], ['RECORD_PRACTICAL', ['practicalResult', 'evidence']],
    ['CERTIFY', ['evidence']], ['ACTIVATE', ['effectiveDate', 'expireDate', 'evidence']],
    ['LINK_PERMISSION', ['evidence']], ['SCHEDULE_RECERTIFICATION', ['recertificationDate', 'evidence']],
    ['ARCHIVE', ['evidence']],
  ] as const)('keeps %s disabled while required material %j is blank', async (code, requiredFields) => {
    expect(requiredFields.length).toBeGreaterThan(0)
    const wrapper = mount(P010LearningActionPanel, {
      props: { learning: learning(), candidates: [candidate(code)], busy: false },
    })
    await wrapper.get(`[data-action-code="${code}"]`).trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.get(`[data-action-code="${code}"]`).attributes('disabled')).toBeDefined()
  })

  it('emits a bounded exam score and evidence with the server version', async () => {
    const wrapper = mount(P010LearningActionPanel, {
      props: { learning: learning({ currentNodeCode: 'S04', versionNo: 4 }), candidates: [candidate('SUBMIT_EXAM')], busy: false },
    })
    await wrapper.get('[data-score-1000] input').setValue('886')
    await fillEvidence(wrapper)
    await wrapper.get('[data-action-code="SUBMIT_EXAM"]').trigger('click')
    const emitted = wrapper.emitted<[P010ActionCode, P010ActionCommand]>('action')?.[0]
    expect(emitted?.[0]).toBe('SUBMIT_EXAM')
    expect(emitted?.[1]).toMatchObject({ expectedVersion: 4, score1000: 886, evidence: { note: '不可变服务端动作证据摘要' } })
  })

  it('rejects an out-of-range exam score without emitting', async () => {
    const wrapper = mount(P010LearningActionPanel, {
      props: { learning: learning(), candidates: [candidate('SUBMIT_EXAM')], busy: false },
    })
    await wrapper.get('[data-score-1000] input').setValue('1001')
    await fillEvidence(wrapper)
    await wrapper.get('[data-action-code="SUBMIT_EXAM"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
  })

  it('emits practical, activation and recertification facts only after typed validation', async () => {
    const practical = mount(P010LearningActionPanel, {
      props: { learning: learning({ versionNo: 5 }), candidates: [candidate('RECORD_PRACTICAL')], busy: false },
    })
    await practical.get('[data-practical-result] textarea').setValue('PASS:现场操作已验证')
    await fillEvidence(practical)
    await practical.get('[data-action-code="RECORD_PRACTICAL"]').trigger('click')
    expect(practical.emitted('action')?.[0]?.[1]).toMatchObject({ expectedVersion: 5, practicalResult: 'PASS:现场操作已验证' })

    const activate = mount(P010LearningActionPanel, {
      props: { learning: learning({ versionNo: 7 }), candidates: [candidate('ACTIVATE')], busy: false },
    })
    await activate.get('[data-effective-date] input').setValue('2026-08-15')
    await activate.get('[data-expire-date] input').setValue('2027-08-14')
    await fillEvidence(activate)
    await activate.get('[data-action-code="ACTIVATE"]').trigger('click')
    expect(activate.emitted('action')?.[0]?.[1]).toMatchObject({ expectedVersion: 7, effectiveDate: '2026-08-15', expireDate: '2027-08-14' })

    const recertify = mount(P010LearningActionPanel, {
      props: { learning: learning({ versionNo: 9 }), candidates: [candidate('SCHEDULE_RECERTIFICATION')], busy: false },
    })
    await recertify.get('[data-recertification-date] input').setValue('2027-08-01')
    await fillEvidence(recertify)
    await recertify.get('[data-action-code="SCHEDULE_RECERTIFICATION"]').trigger('click')
    expect(recertify.emitted('action')?.[0]?.[1]).toMatchObject({ expectedVersion: 9, recertificationDate: '2027-08-01' })
  })

  it.each([
    [{ kind: 'forbidden', status: 403, title: '无权操作', userMessage: '后端拒绝', nextAction: '返回' }, false],
    [{ kind: 'conflict', status: 409, title: '版本冲突', userMessage: '请刷新事实', nextAction: '刷新' }, false],
    [{ kind: 'timeout', status: 408, title: '请求超时', userMessage: '结果未知', nextAction: '重试' }, true],
  ] as const)('fails closed for typed backend error %#', async (error, retryable) => {
    const actionState: AsyncState<P010LearningRecord> = { phase: 'error', requestId: 'action-error', error }
    const wrapper = mount(P010LearningActionPanel, {
      props: { learning: learning(), candidates: [candidate('PUBLISH')], busy: false, actionState },
    })
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    expect(wrapper.emitted('action')).toBeUndefined()
    expect(wrapper.find('[data-action-error] button').exists()).toBe(retryable)
  })

  it('normalizes contradictory status-kind without exposing unsafe fields', () => {
    const error: UiError & { detail: string } = {
      kind: 'forbidden', status: 409, title: 'SECRET-TITLE', userMessage: 'SECRET-DETAIL',
      nextAction: 'SECRET-NEXT', detail: 'SECRET-STACK',
    }
    const actionState: AsyncState<P010LearningRecord> = { phase: 'error', requestId: 'opaque', error }
    const wrapper = mount(P010LearningActionPanel, {
      props: { learning: learning(), candidates: [candidate('PUBLISH')], busy: false, actionState },
    })
    expect(wrapper.text()).toContain('无法确认错误类型')
    for (const secret of ['SECRET-TITLE', 'SECRET-DETAIL', 'SECRET-NEXT', 'SECRET-STACK']) expect(wrapper.html()).not.toContain(secret)
    expect(wrapper.find('[data-action-error] button').exists()).toBe(false)
  })

  it('suppresses a duplicate ordinary action after caller busy is projected', async () => {
    const wrapper = mount(P010LearningActionPanel, {
      props: { learning: learning(), candidates: [candidate('PUBLISH')], busy: false },
    })
    await fillEvidence(wrapper)
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    await wrapper.setProps({ busy: true })
    await wrapper.get('[data-action-code="PUBLISH"]').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
