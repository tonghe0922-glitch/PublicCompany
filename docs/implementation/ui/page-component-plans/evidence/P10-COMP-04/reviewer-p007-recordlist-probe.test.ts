// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import P007ScheduleRecordList from '../../../../../technical-platform/web/src/platform/processes/p007/P007ScheduleRecordList.vue'
import type { P007ScheduleRecord } from '../../../../../technical-platform/web/src/platform/processes/p007/contracts'

function record(id: string, businessNo: string): P007ScheduleRecord {
  return {
    id, tenantId: 'tenant', businessNo, workflowInstanceId: 'workflow', workflowInstanceNo: 'WF',
    currentNodeCode: 'S01', status: 'DRAFT', versionNo: 1, businessDate: '2026-08-13',
    subject: businessNo, reason: null, ownerCenterId: 'center', ownerEmployeeId: 'employee',
    attendanceType: '排班', changeAction: '制定', changeReason: null, contentVersion: 'V1',
    durationHours: 8, startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z',
    periodOrCourseNo: 'P1', actualAttendanceSummary: null, resultSummary: null, items: [],
    updatedAt: '2026-08-13T01:00:00Z',
  }
}

describe('reviewer P007 record-list authority probe', () => {
  it('uses state.data as the sole record authority for both table and selectors', () => {
    const stale = record('stale', 'P007-STALE')
    const current = record('current', 'P007-CURRENT')
    const wrapper = mount(P007ScheduleRecordList, {
      props: {
        records: [stale, record('stale-2', 'P007-STALE-2')],
        state: { phase: 'success', data: [current], requestId: 'latest' },
        selectedId: current.id,
      },
    })
    expect(wrapper.text()).toContain('P007-CURRENT')
    expect(wrapper.text()).not.toContain('P007-STALE')
    expect(wrapper.find('[data-select-record="stale"]').exists()).toBe(false)
  })
})
