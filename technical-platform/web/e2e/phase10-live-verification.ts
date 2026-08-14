import { expect, type APIRequestContext, type Page } from '@playwright/test'
import {
  actionBody,
  getJson,
  privateLeave,
  privateMeeting,
  privateOvertime,
  rejectedPost,
  techBase,
  type LearningAggregate,
  type MeetingAggregate,
  type RecordAggregate,
} from './phase10-live-support'

export async function verifyTechProjection(
  request: APIRequestContext,
  techToken: string,
  meeting: MeetingAggregate,
  leave: RecordAggregate,
  overtime: RecordAggregate,
  learning: LearningAggregate,
): Promise<void> {
  const techMeeting = await getJson<MeetingAggregate>(
    request,
    techToken,
    `/api/v1/processes/P006/meetings/${meeting.meeting.id}`,
  )
  expect(techMeeting.meeting.officialSubject).toBeNull()
  expect(techMeeting.meeting.officialContent).toBeNull()
  expect(techMeeting.items).toEqual([])
  const techLeave = await getJson<RecordAggregate>(
    request,
    techToken,
    `/api/v1/processes/P008/leaves/${leave.record.id}`,
  )
  const techOvertime = await getJson<RecordAggregate>(
    request,
    techToken,
    `/api/v1/processes/P009/overtime-requests/${overtime.record.id}`,
  )
  const techLearning = await getJson<LearningAggregate>(
    request,
    techToken,
    `/api/v1/processes/P010/assignments/${learning.record.id}`,
  )
  expect(techLeave.record.subject).toBeNull()
  expect(techLeave.record.ownerEmployeeId).toBeNull()
  expect(techOvertime.record.subject).toBeNull()
  expect(techOvertime.record.ownerEmployeeId).toBeNull()
  expect(techLearning.record.subject).toBeNull()
  expect(techLearning.record.ownerEmployeeId).toBeNull()
  expect(techLearning.evidence).toEqual([])
  expect(JSON.stringify([techMeeting, techLeave, techOvertime, techLearning])).not.toContain(privateMeeting)
  expect(JSON.stringify([techMeeting, techLeave, techOvertime, techLearning])).not.toContain(privateLeave)
  expect(JSON.stringify([techMeeting, techLeave, techOvertime, techLearning])).not.toContain(privateOvertime)
  await rejectedPost(
    request,
    techToken,
    `/api/v1/processes/P006/meetings/${meeting.meeting.id}/actions/ARCHIVE`,
    actionBody(meeting.meeting.versionNo),
    403,
  )
}

export async function verifyTechUi(
  page: Page,
  meeting: MeetingAggregate,
  shift: RecordAggregate,
  leave: RecordAggregate,
  overtime: RecordAggregate,
  learning: LearningAggregate,
): Promise<void> {
  await page.goto(`${techBase}#/tech/05/03/01`)
  const sharedMonitor = page.getByTestId('phase09-tech-workflow-monitor')
  await expect(sharedMonitor).toContainText(meeting.meeting.businessNo)
  await expect(sharedMonitor).toContainText(shift.record.businessNo)
  await expect(sharedMonitor).not.toContainText(privateMeeting)
  await page.goto(`${techBase}#/tech/07/11/01`)
  const attendanceMonitor = page.getByTestId('phase10-tech-monitor')
  await expect(attendanceMonitor).toContainText(leave.record.businessNo)
  await expect(attendanceMonitor).toContainText(overtime.record.businessNo)
  await expect(attendanceMonitor).not.toContainText(privateLeave)
  await expect(attendanceMonitor).not.toContainText(privateOvertime)
  await page.goto(`${techBase}#/tech/03/03/09`)
  await expect(page.getByTestId('phase10-tech-monitor')).toContainText(learning.record.businessNo)
}
