import { describe, expect, it } from 'vitest'

import type { UiError } from '@sgj/platform-ui'

import {
  P009_ACTIONS_BY_NODE,
  P009_PERMISSIONS,
  classifyP009Error,
  type P009OvertimeRecord,
} from './contracts'
import { selectP009ActionCandidates } from './selectors'

const overtime: P009OvertimeRecord = {
  id: 'overtime-1', tenantId: 'tenant-1', businessNo: 'P009-2026-0001', workflowInstanceId: 'workflow-1',
  workflowInstanceNo: 'WF-P009-1', currentNodeCode: 'S01', status: '事前申请/紧急事实登记', versionNo: 1,
  businessDate: '2026-08-14', subject: '员工加班事实申请', reason: '按照实际任务安排提交加班事实与审批申请',
  ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '工作日加班', emergency: false,
  durationHours: 2, startAt: '2026-08-15T10:00:00Z', endAt: '2026-08-15T12:00:00Z',
  actualStartAt: null, actualEndAt: null, actualAttendanceSummary: null, resultSummary: null,
  schemeType: null, receiptReference: null, actualAmount: null,
  items: [{ id: 'item-1', fieldCode: 'labor_attendance_fact', itemSeq: 1, itemName: '劳动事实', value: { digest: 'server' }, createdAt: '2026-08-14T02:00:00Z' }],
  updatedAt: '2026-08-14T03:00:00Z',
}

describe('P009 overtime contract', () => {
  it('matches the server S01-S09 action map without invented allowedActions', () => {
    expect(P009_ACTIONS_BY_NODE).toEqual({
      S01: ['SUBMIT', 'WITHDRAW'], S02: ['VALIDATE', 'RETURN'], S03: ['APPROVE', 'REJECT'],
      S04: ['RECORD_FACT'], S05: ['ACCEPT_RESULT', 'REWORK'], S06: ['HR_CONFIRM', 'HR_RETURN'],
      S07: ['CONFIRM_SCHEME'], S08: ['RECORD_RECEIPT'], S09: ['ARCHIVE'],
    })
    expect(overtime).not.toHaveProperty('allowedActions')
  })

  it('keeps the complete server record and item projection typed without reveal state', () => {
    expect(Object.keys(overtime).sort()).toEqual([
      'actualAmount', 'actualAttendanceSummary', 'actualEndAt', 'actualStartAt', 'attendanceType', 'businessDate',
      'businessNo', 'currentNodeCode', 'durationHours', 'emergency', 'endAt', 'id', 'items', 'ownerCenterId',
      'ownerEmployeeId', 'reason', 'receiptReference', 'resultSummary', 'schemeType', 'startAt', 'status', 'subject',
      'tenantId', 'updatedAt', 'versionNo', 'workflowInstanceId', 'workflowInstanceNo',
    ].sort())
    expect(overtime.items[0]).toEqual({
      id: 'item-1', fieldCode: 'labor_attendance_fact', itemSeq: 1, itemName: '劳动事实',
      value: { digest: 'server' }, createdAt: '2026-08-14T02:00:00Z',
    })
    expect(overtime).not.toHaveProperty('revealed')
    expect(overtime).not.toHaveProperty('stepUpSatisfied')
    expect(overtime).not.toHaveProperty('revealTicket')
  })

  it('centralizes submit, read, manage, review, HR and monitor permission codes', () => {
    expect(P009_PERMISSIONS).toEqual({
      submit: 'p009.overtime.submit', read: 'p009.overtime.read', manage: 'p009.overtime.manage',
      review: 'p009.overtime.review', hr: 'p009.overtime.hr', monitor: 'p009.overtime.monitor',
    })
  })

  it.each([
    ['S01', P009_PERMISSIONS.submit, ['SUBMIT', 'WITHDRAW']],
    ['S07', P009_PERMISSIONS.submit, ['CONFIRM_SCHEME']],
    ['S03', P009_PERMISSIONS.review, ['APPROVE', 'REJECT']],
    ['S05', P009_PERMISSIONS.review, ['ACCEPT_RESULT', 'REWORK']],
    ['S06', P009_PERMISSIONS.hr, ['HR_CONFIRM', 'HR_RETURN']],
    ['S08', P009_PERMISSIONS.hr, ['RECORD_RECEIPT']],
    ['S02', P009_PERMISSIONS.manage, ['VALIDATE', 'RETURN']],
    ['S04', P009_PERMISSIONS.manage, ['RECORD_FACT']],
    ['S09', P009_PERMISSIONS.manage, ['ARCHIVE']],
  ] as const)('projects node %s only for its typed caller permission', (node, permission, expected) => {
    const candidates = selectP009ActionCandidates(
      { ...overtime, currentNodeCode: node },
      candidatePermission => candidatePermission === permission,
    )
    expect(candidates.map(candidate => candidate.code)).toEqual(expected)
    expect(candidates.every(candidate => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('returns zero candidates for a wrong caller permission or terminal node', () => {
    expect(selectP009ActionCandidates({ ...overtime, currentNodeCode: 'S06' }, () => false)).toEqual([])
    expect(selectP009ActionCandidates({ ...overtime, currentNodeCode: 'END' }, () => true)).toEqual([])
    expect(selectP009ActionCandidates({ ...overtime, currentNodeCode: null }, () => true)).toEqual([])
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
    expect(classifyP009Error(error)).toBe(expected)
  })
})
