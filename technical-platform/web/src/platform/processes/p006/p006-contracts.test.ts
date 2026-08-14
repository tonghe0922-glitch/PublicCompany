import { describe, expect, it } from 'vitest'

import * as P006Public from './index'
import { P006_ACTIONS_BY_NODE, type P006MeetingRecord } from './contracts'
import { selectP006ActionCandidates } from './selectors'

const meeting: P006MeetingRecord = {
  id: 'meeting-1',
  tenantId: 'tenant-1',
  businessNo: 'P006-2026-0001',
  workflowInstanceId: 'workflow-1',
  workflowInstanceNo: 'WF-1',
  currentNodeCode: 'S01',
  status: 'DRAFT',
  versionNo: 1,
  businessDate: '2026-08-13',
  subject: '运营协调会',
  reason: '协调景区运营事项',
  priority: '普通',
  ownerCenterId: 'center-1',
  ownerEmployeeId: 'employee-authority',
  plannedStartAt: '2026-08-14T01:00:00Z',
  startAt: '2026-08-14T01:00:00Z',
  resultSummary: null,
  officialSubject: null,
  officialContent: null,
  venueChannel: null,
  visibilityLevel: '内部',
  items: [],
  updatedAt: '2026-08-13T01:00:00Z',
}

describe('P006 process contract', () => {
  it('keeps internal action maps and service factories out of the process public index', () => {
    expect(Object.keys(P006Public)).not.toEqual(expect.arrayContaining([
      'P006_ACTIONS_BY_NODE',
      'createP006PortalService',
      'createP006Service',
    ]))
  })

  it('matches the server S01-S11 action authority exactly', () => {
    expect(P006_ACTIONS_BY_NODE).toEqual({
      S01: ['SUBMIT', 'WITHDRAW'],
      S02: ['ACCEPT', 'RETURN', 'REJECT'],
      S03: ['PUBLISH', 'RETURN', 'REJECT'],
      S04: ['RECORD_ATTENDANCE'],
      S05: ['CONVENE'],
      S06: ['CONFIRM_MINUTES', 'RETURN'],
      S07: ['GENERATE_ACTIONS'],
      S08: ['SUBMIT_EXECUTION'],
      S09: ['ACCEPT_RESULT', 'REWORK'],
      S10: ['ACKNOWLEDGE_OVERDUE'],
      S11: ['ARCHIVE'],
    })
  })

  it('treats node and caller permission as UX candidates, not backend authority', () => {
    const candidates = selectP006ActionCandidates(meeting, (permission) => permission === 'p006.meeting.create')
    expect(candidates.map((candidate) => candidate.code)).toEqual(['SUBMIT', 'WITHDRAW'])
    expect(candidates.every((candidate) => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('does not expose an invented server allowedActions authority', () => {
    const candidates = selectP006ActionCandidates({ ...meeting, currentNodeCode: 'S02' }, () => true)
    expect(candidates.map((candidate) => candidate.code)).toEqual(['ACCEPT', 'RETURN', 'REJECT'])
    expect(candidates.every((candidate) => candidate.authority === 'ux-candidate')).toBe(true)
  })

  it('marks action-owner generation BLOCKED when the directory contract is absent', () => {
    const [candidate] = selectP006ActionCandidates(
      { ...meeting, currentNodeCode: 'S07' },
      () => true,
    )
    expect(candidate).toMatchObject({
      code: 'GENERATE_ACTIONS',
      blocked: true,
      blockedCode: 'DIRECTORY_CONTRACT_REQUIRED',
    })
  })
})
