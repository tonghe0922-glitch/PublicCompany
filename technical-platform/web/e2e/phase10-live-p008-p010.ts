import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import {
  actionBody,
  centerA,
  courseVersionId,
  employeeId,
  getJson,
  learningAction,
  managerId,
  postJson,
  privateLeave,
  privateOvertime,
  recordAction,
  rejectedPost,
  verifyCrossCenterIsolation,
  type LearningAggregate,
  type RecordAggregate,
} from './phase10-live-support'

export interface WorkforceFlows {
  leave: RecordAggregate
  overtime: RecordAggregate
  learning: LearningAggregate
}

export async function runWorkforceFlows(
  request: APIRequestContext,
  employeeToken: string,
  managerToken: string,
  certifierToken: string,
  outToken: string,
): Promise<WorkforceFlows> {
  let leave = await postJson<RecordAggregate>(
    request,
    employeeToken,
    '/api/v1/processes/P008/leaves',
    {
      subject: 'P008 live leave',
      reason: privateLeave,
      ownerCenterId: centerA,
      attendanceType: 'ANNUAL_LEAVE',
      quotaAccountId: 'ANNUAL-2031',
      quotaAmount: 1,
      startAt: '2031-03-10T01:00:00Z',
      endAt: '2031-03-10T09:00:00Z',
      handoverAgentId: managerId,
      knownImpact: 'P008 live impact',
    },
  )
  const reserveKey = `p008-reserve-${randomUUID()}`
  const reserveVersion = leave.record.versionNo
  leave = await recordAction(
    request,
    managerToken,
    'P008',
    'leaves',
    leave,
    'RESERVE_QUOTA',
    {},
    reserveKey,
  )
  const reserveReplay = await postJson<RecordAggregate>(
    request,
    managerToken,
    `/api/v1/processes/P008/leaves/${leave.record.id}/actions/RESERVE_QUOTA`,
    actionBody(reserveVersion),
    reserveKey,
  )
  expect(reserveReplay.record.versionNo).toBe(leave.record.versionNo)
  leave = await recordAction(request, employeeToken, 'P008', 'leaves', leave, 'CONFIRM_HANDOVER')
  leave = await recordAction(request, managerToken, 'P008', 'leaves', leave, 'APPROVE_LEAVE')
  leave = await recordAction(request, managerToken, 'P008', 'leaves', leave, 'COMMIT_QUOTA')
  leave = await recordAction(request, managerToken, 'P008', 'leaves', leave, 'MARK_ATTENDANCE')
  leave = await recordAction(request, employeeToken, 'P008', 'leaves', leave, 'START_LEAVE', {
    actualAt: '2031-03-10T01:00:00Z',
  })
  leave = await recordAction(request, employeeToken, 'P008', 'leaves', leave, 'RETURN_TO_WORK', {
    actualAt: '2031-03-10T08:30:00Z',
  })
  leave = await recordAction(request, managerToken, 'P008', 'leaves', leave, 'ADJUST_QUOTA', {
    adjustmentAmount: -0.5,
  })
  leave = await recordAction(request, managerToken, 'P008', 'leaves', leave, 'CLOSE_DAY')
  expect(leave.record.currentNodeCode).toBe('END')
  const leaveLedger = await getJson<Array<{ entryType: string }>>(
    request,
    employeeToken,
    '/api/v1/processes/P008/quota-ledger',
  )
  expect(leaveLedger.map((entry) => entry.entryType)).toEqual(['RESERVE', 'DEDUCT', 'ADJUST'])
  await verifyCrossCenterIsolation(
    request,
    outToken,
    '/api/v1/processes/P008/leaves',
    `/api/v1/processes/P008/leaves/${leave.record.id}`,
  )

  let overtime = await postJson<RecordAggregate>(
    request,
    employeeToken,
    '/api/v1/processes/P009/overtime-requests',
    {
      subject: 'P009 live overtime',
      reason: privateOvertime,
      ownerCenterId: centerA,
      attendanceType: 'OVERTIME',
      startAt: '2031-04-10T10:00:00Z',
      endAt: '2031-04-10T12:00:00Z',
      emergencyFact: false,
    },
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'VALIDATE_NECESSITY',
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'APPROVE_OVERTIME',
  )
  overtime = await recordAction(
    request,
    employeeToken,
    'P009',
    'overtime-requests',
    overtime,
    'RECORD_ACTUAL_FACT',
    {
      actualStartAt: '2031-04-10T10:00:00Z',
      actualEndAt: '2031-04-10T12:00:00Z',
      attendanceSummary: 'P009 actual attendance from live E2E',
    },
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'ACCEPT_RESULT',
    { resultSummary: 'P009 result accepted by center' },
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'HR_REVIEW',
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'SET_COMPENSATION_PLAN',
    { compensationPlan: 'WAGE', wageAmount: 128.5 },
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'ACK_PAYROLL_RECEIPT',
    { payrollReference: 'P009-PAYROLL-203104' },
  )
  overtime = await recordAction(
    request,
    managerToken,
    'P009',
    'overtime-requests',
    overtime,
    'ARCHIVE',
  )
  expect(overtime.record.currentNodeCode).toBe('END')
  await verifyCrossCenterIsolation(
    request,
    outToken,
    '/api/v1/processes/P009/overtime-requests',
    `/api/v1/processes/P009/overtime-requests/${overtime.record.id}`,
  )

  let learning = await postJson<LearningAggregate>(
    request,
    managerToken,
    '/api/v1/processes/P010/assignments',
    {
      subject: 'P010 live qualification',
      reason: '真实学习、考试、实操、认证与权限联动',
      ownerCenterId: centerA,
      ownerEmployeeId: employeeId,
      contentVersion: 'V2031.05',
      courseTeamName: 'PHASE-10 E2E course team',
      courseVersionId,
      learnerProfile: 'P010 employee live profile',
      periodOrCourseNo: 'P010-203105',
      riskLevel: 'HIGH',
      plannedStartAt: '2031-05-01T01:00:00Z',
      plannedFinishAt: '2031-05-31T09:00:00Z',
    },
  )
  learning = await learningAction(request, managerToken, learning, 'PUBLISH_CONTENT')
  learning = await learningAction(request, managerToken, learning, 'ASSIGN_BY_RISK')
  learning = await postJson<LearningAggregate>(
    request,
    employeeToken,
    `/api/v1/processes/P010/assignments/${learning.record.id}/learning-progress`,
    { completionRate: 100, note: 'P010 learning complete' },
  )
  learning = await postJson<LearningAggregate>(
    request,
    employeeToken,
    `/api/v1/processes/P010/assignments/${learning.record.id}/exam`,
    { score1000: 900, note: 'P010 exam passed' },
  )
  learning = await postJson<LearningAggregate>(
    request,
    employeeToken,
    `/api/v1/processes/P010/assignments/${learning.record.id}/practical`,
    { result: '通过', note: 'P010 practical passed' },
  )
  await rejectedPost(
    request,
    managerToken,
    `/api/v1/processes/P010/assignments/${learning.record.id}/actions/CERTIFY`,
    { expectedVersion: learning.record.versionNo, note: 'P010 self-certification must fail closed' },
    403,
  )
  learning = await learningAction(request, certifierToken, learning, 'CERTIFY')
  learning = await learningAction(request, managerToken, learning, 'ACTIVATE_QUALIFICATION', {
    effectiveDate: '2031-05-10',
    expireDate: '2032-05-09',
  })
  learning = await learningAction(request, managerToken, learning, 'LINK_PERMISSIONS')
  learning = await learningAction(request, managerToken, learning, 'COMPLETE_RETRAINING_CHECK')
  learning = await learningAction(request, managerToken, learning, 'ARCHIVE')
  expect(learning.record.currentNodeCode).toBe('END')
  expect(learning.evidence.length).toBeGreaterThanOrEqual(6)
  await verifyCrossCenterIsolation(
    request,
    outToken,
    '/api/v1/processes/P010/assignments',
    `/api/v1/processes/P010/assignments/${learning.record.id}`,
  )

  return { leave, overtime, learning }
}
