import { describe, expect, it } from 'vitest'

import * as P007Public from './index'
import { P007_ACTIONS_BY_NODE, P007_PERMISSIONS, type P007ScheduleRecord } from './contracts'
import { selectP007ActionCandidates } from './selectors'

const schedule: P007ScheduleRecord = {
  id: 'shift-1', tenantId: 'tenant-1', businessNo: 'P007-2026-0001', workflowInstanceId: 'workflow-1',
  workflowInstanceNo: 'WF-P007-1', currentNodeCode: 'S01', status: 'DRAFT', versionNo: 1,
  businessDate: '2026-08-13', subject: '景区运营排班', reason: '依据服务端业务量制定排班',
  ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '排班', changeAction: '制定',
  changeReason: '依据服务端业务量制定正式排班', contentVersion: 'SAFE-V1', durationHours: 8,
  startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', periodOrCourseNo: 'P007-WEEK-1',
  actualAttendanceSummary: null, resultSummary: null, items: [], updatedAt: '2026-08-13T01:00:00Z',
}

describe('P007 schedule contract', () => {
  it('keeps internal action maps and service factories out of the process public index', () => {
    expect(Object.keys(P007Public)).not.toEqual(expect.arrayContaining([
      'P007_ACTIONS_BY_NODE',
      'createP007PortalService',
      'createP007Service',
    ]))
  })

  it('matches the server S01-S09 action map without invented allowedActions', () => {
    expect(P007_ACTIONS_BY_NODE).toEqual({
      S01: ['SUBMIT_DEMAND', 'WITHDRAW'], S02: ['MATCH_TEMPLATE', 'RETURN'],
      S03: ['VALIDATE', 'RETURN'], S04: ['PUBLISH', 'RETURN'], S05: ['CONFIRM'],
      S06: ['REQUEST_CHANGE', 'NO_CHANGE'], S07: ['APPROVE', 'REJECT'], S08: ['LINK'], S09: ['CLOSE_DAY'],
    })
    expect(schedule).not.toHaveProperty('allowedActions')
  })

  it('centralizes read, monitor, manage, change and review permission codes', () => {
    expect(P007_PERMISSIONS).toEqual({
      read: 'p007.schedule.read', monitor: 'p007.schedule.monitor', manage: 'p007.schedule.manage',
      change: 'p007.schedule.change', review: 'p007.schedule.review',
    })
  })

  it('treats node and caller permission only as UX candidates', () => {
    const candidates = selectP007ActionCandidates(schedule, permission => permission === P007_PERMISSIONS.manage)
    expect(candidates.map(candidate => candidate.code)).toEqual(['SUBMIT_DEMAND', 'WITHDRAW'])
    expect(candidates.every(candidate => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('blocks REQUEST_CHANGE because the substitute directory contract is absent', () => {
    const candidates = selectP007ActionCandidates(
      { ...schedule, currentNodeCode: 'S06' },
      permission => permission === P007_PERMISSIONS.change,
    )
    expect(candidates).toEqual([
      { code: 'REQUEST_CHANGE', label: '申请换班/替班', authority: 'ux-candidate', blocked: true, blockedCode: 'DIRECTORY_CONTRACT_REQUIRED' },
      { code: 'NO_CHANGE', label: '无需变更', authority: 'ux-candidate', blocked: false },
    ])
  })

  it.each([
    ['S05', P007_PERMISSIONS.change, ['CONFIRM']],
    ['S07', P007_PERMISSIONS.review, ['APPROVE', 'REJECT']],
    ['S08', P007_PERMISSIONS.manage, ['LINK']],
    ['S09', P007_PERMISSIONS.manage, ['CLOSE_DAY']],
  ] as const)('uses the typed caller permission for node %s', (node, permission, expected) => {
    const candidates = selectP007ActionCandidates(
      { ...schedule, currentNodeCode: node },
      candidatePermission => candidatePermission === permission,
    )
    expect(candidates.map(candidate => candidate.code)).toEqual(expected)
    expect(candidates.every(candidate => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('returns no UX candidates when the caller permission does not match the node', () => {
    expect(selectP007ActionCandidates({ ...schedule, currentNodeCode: 'S07' }, () => false)).toEqual([])
    expect(selectP007ActionCandidates({ ...schedule, currentNodeCode: 'S05' }, permission => permission === P007_PERMISSIONS.manage)).toEqual([])
  })
})
