import { describe, expect, it } from 'vitest'

import type { UiError } from '@sgj/platform-ui'

import {
  P008_ACTIONS_BY_NODE,
  P008_PERMISSIONS,
  classifyP008Error,
  type P008LeaveRecord,
} from './contracts'
import { selectP008ActionCandidates } from './selectors'

const leave: P008LeaveRecord = {
  id: 'leave-1', tenantId: 'tenant-1', businessNo: 'P008-2026-0001', workflowInstanceId: 'workflow-1',
  workflowInstanceNo: 'WF-P008-1', currentNodeCode: 'S01', status: '请假申请', versionNo: 1,
  businessDate: '2026-08-13', subject: '员工年度休假申请', reason: '按照年度计划申请休假并完成工作安排',
  ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '年假', changeAction: 'APPLY',
  changeReason: '按照年度计划申请休假并完成工作安排', durationHours: 8,
  startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', handoverAgentId: null,
  quotaAccountId: 'ANNUAL', quotaAmount: 8, actualEndAt: null, actualAttendanceSummary: null,
  items: [], updatedAt: '2026-08-13T01:00:00Z',
}

describe('P008 leave contract', () => {
  it('matches the server S01-S10 action map without invented allowedActions', () => {
    expect(P008_ACTIONS_BY_NODE).toEqual({
      S01: ['SUBMIT', 'WITHDRAW'], S02: ['RESERVE', 'RETURN'], S03: ['CONFIRM_HANDOVER', 'RETURN'],
      S04: ['APPROVE', 'REJECT'], S05: ['DEDUCT', 'RELEASE'], S06: ['MARK_ATTENDANCE'],
      S07: ['START_LEAVE'], S08: ['RETURN', 'EARLY_RETURN', 'CHANGE'], S09: ['ADJUST'], S10: ['CLOSE_DAY'],
    })
    expect(leave).not.toHaveProperty('allowedActions')
  })

  it('centralizes submit, read, manage, review and monitor permission codes', () => {
    expect(P008_PERMISSIONS).toEqual({
      submit: 'p008.leave.submit', read: 'p008.leave.read', manage: 'p008.leave.manage',
      review: 'p008.leave.review', monitor: 'p008.leave.monitor',
    })
  })

  it.each([
    ['S01', P008_PERMISSIONS.submit, ['SUBMIT', 'WITHDRAW']],
    ['S03', P008_PERMISSIONS.submit, ['CONFIRM_HANDOVER', 'RETURN']],
    ['S08', P008_PERMISSIONS.submit, ['RETURN', 'EARLY_RETURN', 'CHANGE']],
    ['S04', P008_PERMISSIONS.review, ['APPROVE', 'REJECT']],
    ['S02', P008_PERMISSIONS.manage, ['RESERVE', 'RETURN']],
    ['S05', P008_PERMISSIONS.manage, ['DEDUCT', 'RELEASE']],
    ['S06', P008_PERMISSIONS.manage, ['MARK_ATTENDANCE']],
    ['S07', P008_PERMISSIONS.manage, ['START_LEAVE']],
    ['S09', P008_PERMISSIONS.manage, ['ADJUST']],
    ['S10', P008_PERMISSIONS.manage, ['CLOSE_DAY']],
  ] as const)('projects node %s only for its typed caller permission', (node, permission, expected) => {
    const candidates = selectP008ActionCandidates(
      { ...leave, currentNodeCode: node },
      candidatePermission => candidatePermission === permission,
    )
    expect(candidates.map(candidate => candidate.code)).toEqual(expected)
    expect(candidates.every(candidate => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('returns zero candidates for a wrong caller permission or terminal node', () => {
    expect(selectP008ActionCandidates({ ...leave, currentNodeCode: 'S04' }, () => false)).toEqual([])
    expect(selectP008ActionCandidates({ ...leave, currentNodeCode: 'END' }, () => true)).toEqual([])
    expect(selectP008ActionCandidates({ ...leave, currentNodeCode: null }, () => true)).toEqual([])
  })

  it.each([
    [{ status: 408, kind: 'timeout' }, 'retryable'],
    [{ status: 503, kind: 'server' }, 'retryable'],
    [{ kind: 'transport' }, 'retryable'],
    [{ kind: 'unknown' }, 'retryable'],
    [{ status: 409, kind: 'conflict' }, 'conflict'],
    [{ status: 403, kind: 'forbidden' }, 'terminal'],
    [{ status: 422, kind: 'validation' }, 'validation'],
    [{ status: 409, kind: 'forbidden' }, 'opaque'],
    [{ status: 503, kind: 'timeout' }, 'opaque'],
    [{ status: 418, kind: 'forbidden' }, 'opaque'],
    [{ kind: 'forbidden' }, 'opaque'],
  ] as const)('classifies typed error %# fail-closed', (partial, expected) => {
    const error = {
      title: '安全错误', userMessage: '安全提示', nextAction: '返回',
      ...partial,
    } as UiError
    expect(classifyP008Error(error)).toBe(expected)
  })
})
