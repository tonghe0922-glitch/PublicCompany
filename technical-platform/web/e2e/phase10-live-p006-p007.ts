import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import {
  actionBody,
  centerA,
  employeeId,
  managerId,
  meetingAction,
  postJson,
  privateMeeting,
  recordAction,
  rejectedPost,
  verifyCrossCenterIsolation,
  type MeetingAggregate,
  type RecordAggregate,
} from './phase10-live-support'

export interface CollaborationFlows {
  meeting: MeetingAggregate
  shift: RecordAggregate
}

export async function runCollaborationFlows(
  request: APIRequestContext,
  employeeToken: string,
  managerToken: string,
  outToken: string,
): Promise<CollaborationFlows> {
  const meetingCreateKey = `p006-create-${randomUUID()}`
  const meetingPayload = {
    officialSubject: 'P006 live meeting',
    officialType: 'OPERATIONS_REVIEW',
    officialContent: privateMeeting,
    attendanceType: 'ONSITE',
    visibilityLevel: '内部',
    venueChannel: 'P006 E2E room',
    ownerCenterId: centerA,
    businessDate: '2031-01-10',
    startAt: '2031-01-10T09:00:00Z',
    participantEmployeeIds: [employeeId],
    agendaItems: ['核验 PHASE-10 真实闭环'],
  }
  let meeting = await postJson<MeetingAggregate>(
    request,
    managerToken,
    '/api/v1/processes/P006/meetings',
    meetingPayload,
    meetingCreateKey,
  )
  const meetingReplay = await postJson<MeetingAggregate>(
    request,
    managerToken,
    '/api/v1/processes/P006/meetings',
    meetingPayload,
    meetingCreateKey,
  )
  expect(meetingReplay.meeting.id).toBe(meeting.meeting.id)
  expect(meetingReplay.meeting.versionNo).toBe(meeting.meeting.versionNo)
  await rejectedPost(
    request,
    employeeToken,
    `/api/v1/processes/P006/meetings/${meeting.meeting.id}/actions/CONFIRM_MATERIALS`,
    actionBody(meeting.meeting.versionNo),
    403,
  )
  await rejectedPost(
    request,
    managerToken,
    `/api/v1/processes/P006/meetings/${meeting.meeting.id}/actions/CONFIRM_MATERIALS`,
    actionBody(meeting.meeting.versionNo + 7),
    409,
  )
  meeting = await meetingAction(request, managerToken, meeting, 'CONFIRM_MATERIALS')
  meeting = await meetingAction(request, managerToken, meeting, 'PUBLISH_MEETING')
  meeting = await meetingAction(request, employeeToken, meeting, 'ATTEND')
  meeting = await meetingAction(request, managerToken, meeting, 'COMPLETE_MEETING')
  meeting = await meetingAction(request, managerToken, meeting, 'CONFIRM_MINUTES', {
    minutesText: 'PHASE-10 live meeting minutes',
  })
  meeting = await meetingAction(request, managerToken, meeting, 'GENERATE_ACTION_ITEMS', {
    actionItems: [{
      title: '提交 PHASE-10 闭环证据',
      ownerEmployeeId: employeeId,
      dueAt: '2031-01-15T12:00:00Z',
    }],
  })
  const actionItem = meeting.items.find((item) => item.fieldCode === 'ACTION_ITEM')
  expect(actionItem).toBeTruthy()
  if (!actionItem) throw new Error('P006 action item was not persisted')
  meeting = await meetingAction(request, employeeToken, meeting, 'SUBMIT_ACTION_EVIDENCE', {
    actionEvidence: { [actionItem.id]: 'P006 evidence from live E2E' },
  })
  meeting = await meetingAction(request, managerToken, meeting, 'ACCEPT_ACTIONS')
  meeting = await meetingAction(request, managerToken, meeting, 'RESOLVE_OVERDUE')
  meeting = await meetingAction(request, managerToken, meeting, 'ARCHIVE')
  expect(meeting.meeting.currentNodeCode).toBe('END')
  await verifyCrossCenterIsolation(
    request,
    outToken,
    '/api/v1/processes/P006/meetings',
    `/api/v1/processes/P006/meetings/${meeting.meeting.id}`,
  )

  let shift = await postJson<RecordAggregate>(
    request,
    managerToken,
    '/api/v1/processes/P007/shift-changes',
    {
      subject: 'P007 live schedule',
      reason: '真实排班与换班闭环',
      ownerCenterId: centerA,
      targetEmployeeId: employeeId,
      changeAction: 'SCHEDULE',
      changeReason: 'PHASE-10 live gate',
      templateCode: 'P007-E2E-TEMPLATE',
      periodOrCourseNo: '2031-02-10-DAY',
      startAt: '2031-02-10T01:00:00Z',
      endAt: '2031-02-10T09:00:00Z',
    },
  )
  shift = await recordAction(request, managerToken, 'P007', 'shift-changes', shift, 'MATCH_TEMPLATE')
  shift = await recordAction(request, managerToken, 'P007', 'shift-changes', shift, 'VALIDATE_SHIFT')
  shift = await recordAction(request, managerToken, 'P007', 'shift-changes', shift, 'PUBLISH_SCHEDULE')
  shift = await recordAction(request, employeeToken, 'P007', 'shift-changes', shift, 'CONFIRM_SCHEDULE')
  shift = await recordAction(
    request,
    employeeToken,
    'P007',
    'shift-changes',
    shift,
    'SUBMIT_SHIFT_CHANGE',
    { replacementEmployeeId: managerId },
  )
  shift = await recordAction(request, managerToken, 'P007', 'shift-changes', shift, 'APPROVE_CHANGE')
  shift = await recordAction(request, managerToken, 'P007', 'shift-changes', shift, 'LINK_DEPENDENCIES')
  shift = await recordAction(request, managerToken, 'P007', 'shift-changes', shift, 'CLOSE_DAY')
  expect(shift.record.currentNodeCode).toBe('END')
  await verifyCrossCenterIsolation(
    request,
    outToken,
    '/api/v1/processes/P007/schedules',
    `/api/v1/processes/P007/shift-changes/${shift.record.id}`,
  )

  return { meeting, shift }
}
