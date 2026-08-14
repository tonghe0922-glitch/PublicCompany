import { describe, expect, it } from 'vitest'

import type { UiError } from '@sgj/platform-ui'

import {
  P010_ACTIONS_BY_NODE,
  P010_PERMISSIONS,
  classifyP010Error,
  type P010LearningRecord,
} from './contracts'
import { selectP010ActionCandidates } from './selectors'

const learning: P010LearningRecord = {
  id: 'learning-1', tenantId: 'tenant-1', businessNo: 'P010-2026-0001', workflowInstanceId: 'workflow-1',
  workflowInstanceNo: 'WF-P010-1', currentNodeCode: 'S01', status: 'Version publication', versionNo: 1,
  businessDate: '2026-08-14', subject: '高风险作业资格课程', reason: '岗位风险矩阵要求资格持续有效',
  ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', courseVersionId: 'SAFETY-V1',
  contentVersion: '2026.08', courseTeamName: '安全作业学院', periodOrCourseNo: 'SAFE-001',
  learnerProfile: '高风险岗位作业人员', completionRate: 0, score1000: 886,
  practicalResult: 'PASS: server fact', qualificationEffectiveDate: '2026-08-15',
  qualificationExpireDate: '2027-08-14',
  events: [{
    id: 'event-1', eventSeq: 1, eventType: 'ASSIGNMENT_CREATED', evidence: { digest: 'server' },
    actorEmployeeId: 'manager-1', createdAt: '2026-08-14T02:00:00Z',
  }],
  updatedAt: '2026-08-14T03:00:00Z',
}

describe('P010 learning contract', () => {
  it('matches the server S01-S10 action map without invented allowedActions', () => {
    expect(P010_ACTIONS_BY_NODE).toEqual({
      S01: ['PUBLISH'], S02: ['ASSIGN'], S03: ['COMPLETE_LEARNING'], S04: ['SUBMIT_EXAM'],
      S05: ['RECORD_PRACTICAL'], S06: ['CERTIFY'], S07: ['ACTIVATE'], S08: ['LINK_PERMISSION'],
      S09: ['SCHEDULE_RECERTIFICATION'], S10: ['ARCHIVE'],
    })
    expect(learning).not.toHaveProperty('allowedActions')
  })

  it('keeps every server record and event field typed without reveal authority', () => {
    expect(Object.keys(learning).sort()).toEqual([
      'businessDate', 'businessNo', 'completionRate', 'contentVersion', 'courseTeamName', 'courseVersionId',
      'currentNodeCode', 'events', 'id', 'learnerProfile', 'ownerCenterId', 'ownerEmployeeId',
      'periodOrCourseNo', 'practicalResult', 'qualificationEffectiveDate', 'qualificationExpireDate', 'reason',
      'score1000', 'status', 'subject', 'tenantId', 'updatedAt', 'versionNo', 'workflowInstanceId',
      'workflowInstanceNo',
    ].sort())
    expect(learning.events[0]).toEqual({
      id: 'event-1', eventSeq: 1, eventType: 'ASSIGNMENT_CREATED', evidence: { digest: 'server' },
      actorEmployeeId: 'manager-1', createdAt: '2026-08-14T02:00:00Z',
    })
    expect(learning).not.toHaveProperty('revealed')
    expect(learning).not.toHaveProperty('stepUpSatisfied')
    expect(learning).not.toHaveProperty('revealTicket')
  })

  it('centralizes read, complete, exam, manage, certify, link and monitor permissions', () => {
    expect(P010_PERMISSIONS).toEqual({
      read: 'p010.learning.read', complete: 'p010.learning.complete', exam: 'p010.learning.exam',
      manage: 'p010.learning.manage', certify: 'p010.learning.certify', link: 'p010.learning.link',
      monitor: 'p010.learning.monitor',
    })
  })

  it.each([
    ['S01', P010_PERMISSIONS.manage, ['PUBLISH']],
    ['S02', P010_PERMISSIONS.manage, ['ASSIGN']],
    ['S03', P010_PERMISSIONS.complete, ['COMPLETE_LEARNING']],
    ['S04', P010_PERMISSIONS.exam, ['SUBMIT_EXAM']],
    ['S05', P010_PERMISSIONS.certify, ['RECORD_PRACTICAL']],
    ['S06', P010_PERMISSIONS.certify, ['CERTIFY']],
    ['S07', P010_PERMISSIONS.manage, ['ACTIVATE']],
    ['S08', P010_PERMISSIONS.link, ['LINK_PERMISSION']],
    ['S09', P010_PERMISSIONS.manage, ['SCHEDULE_RECERTIFICATION']],
    ['S10', P010_PERMISSIONS.manage, ['ARCHIVE']],
  ] as const)('projects node %s only for its typed caller permission', (node, permission, expected) => {
    const candidates = selectP010ActionCandidates(
      { ...learning, currentNodeCode: node },
      candidatePermission => candidatePermission === permission,
    )
    expect(candidates.map(candidate => candidate.code)).toEqual(expected)
    expect(candidates.every(candidate => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('returns zero candidates for a wrong caller permission or terminal node', () => {
    expect(selectP010ActionCandidates({ ...learning, currentNodeCode: 'S08' }, () => false)).toEqual([])
    expect(selectP010ActionCandidates({ ...learning, currentNodeCode: 'END' }, () => true)).toEqual([])
    expect(selectP010ActionCandidates({ ...learning, currentNodeCode: null }, () => true)).toEqual([])
  })

  it.each([
    [{ status: 408, kind: 'timeout' }, 'retryable'],
    [{ status: 503, kind: 'server' }, 'retryable'],
    [{ kind: 'transport' }, 'retryable'],
    [{ kind: 'unknown' }, 'retryable'],
    [{ status: 409, kind: 'conflict' }, 'conflict'],
    [{ status: 401, kind: 'unauthorized' }, 'terminal'],
    [{ status: 403, kind: 'forbidden' }, 'terminal'],
    [{ status: 404, kind: 'not-found' }, 'terminal'],
    [{ status: 422, kind: 'validation' }, 'validation'],
    [{ status: 429, kind: 'rate-limit' }, 'terminal'],
    [{ status: 409, kind: 'forbidden' }, 'opaque'],
    [{ status: 503, kind: 'timeout' }, 'opaque'],
    [{ status: 418, kind: 'forbidden' }, 'opaque'],
    [{ kind: 'forbidden' }, 'opaque'],
  ] as const)('classifies typed error %# fail-closed', (partial, expected) => {
    const error = { title: '安全错误', userMessage: '安全提示', nextAction: '返回', ...partial } as UiError
    expect(classifyP010Error(error)).toBe(expected)
  })
})
