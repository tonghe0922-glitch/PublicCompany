import { usePortalSessionStore } from '../../../session'

import type {
  P007ActionCode, P007ActionCommand, P007CommandContext,
  P007ScheduleRecord, P007Service, P007Transport,
} from './contracts'

const rootPath = '/api/v1/processes/P007'
const changesPath = `${rootPath}/shift-changes`
const schedulesPath = `${rootPath}/schedules`

function commandKey(value: string): string {
  const key = value.trim()
  if (!key) throw new Error('CALLER_IDEMPOTENCY_KEY_REQUIRED')
  return key
}

function mapSchedule(record: P007ScheduleRecord): P007ScheduleRecord {
  return {
    id: record.id, tenantId: record.tenantId, businessNo: record.businessNo,
    workflowInstanceId: record.workflowInstanceId, workflowInstanceNo: record.workflowInstanceNo,
    currentNodeCode: record.currentNodeCode, status: record.status, versionNo: record.versionNo,
    businessDate: record.businessDate, subject: record.subject, reason: record.reason,
    ownerCenterId: record.ownerCenterId, ownerEmployeeId: record.ownerEmployeeId,
    attendanceType: record.attendanceType, changeAction: record.changeAction, changeReason: record.changeReason,
    contentVersion: record.contentVersion, durationHours: record.durationHours, startAt: record.startAt, endAt: record.endAt,
    periodOrCourseNo: record.periodOrCourseNo, actualAttendanceSummary: record.actualAttendanceSummary,
    resultSummary: record.resultSummary,
    items: record.items.map(item => ({
      id: item.id, fieldCode: item.fieldCode, itemSeq: item.itemSeq, itemName: item.itemName,
      value: item.value, createdAt: item.createdAt,
    })),
    updatedAt: record.updatedAt,
  }
}

export function createP007Service(transport: P007Transport): P007Service {
  return {
    can: permission => transport.can?.(permission) ?? false,
    async list(mode, context) {
      const records = await transport.request<readonly P007ScheduleRecord[]>(mode === 'employee' ? schedulesPath : changesPath, {
        signal: context.signal,
      })
      return records.map(mapSchedule)
    },
    async get(id, context) {
      const record = await transport.request<P007ScheduleRecord>(`${changesPath}/${encodeURIComponent(id)}`, { signal: context.signal })
      return mapSchedule(record)
    },
    async performAction(id: string, action: P007ActionCode, command: P007ActionCommand, context: P007CommandContext) {
      if (action === 'REQUEST_CHANGE') throw new Error('DIRECTORY_CONTRACT_REQUIRED')
      const record = await transport.request<P007ScheduleRecord, P007ActionCommand>(
        `${changesPath}/${encodeURIComponent(id)}/actions/${action}`,
        { method: 'POST', body: command, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal },
      )
      return mapSchedule(record)
    },
  }
}

export function createP007PortalService(): P007Service {
  return createP007Service(usePortalSessionStore())
}
