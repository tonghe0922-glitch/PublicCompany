import { usePortalSessionStore } from '../../../session'

import type {
  P009ActionCode,
  P009ActionCommand,
  P009CommandContext,
  P009CreateOvertimeInput,
  P009OvertimeRecord,
  P009Service,
  P009Transport,
} from './contracts'

const requestsPath = '/api/v1/processes/P009/overtime-requests'

function commandKey(value: string): string {
  const key = value.trim()
  if (!key) throw new Error('CALLER_IDEMPOTENCY_KEY_REQUIRED')
  return key
}

function mapOvertime(record: P009OvertimeRecord): P009OvertimeRecord {
  return {
    id: record.id, tenantId: record.tenantId, businessNo: record.businessNo,
    workflowInstanceId: record.workflowInstanceId, workflowInstanceNo: record.workflowInstanceNo,
    currentNodeCode: record.currentNodeCode, status: record.status, versionNo: record.versionNo,
    businessDate: record.businessDate, subject: record.subject, reason: record.reason,
    ownerCenterId: record.ownerCenterId, ownerEmployeeId: record.ownerEmployeeId,
    attendanceType: record.attendanceType, emergency: record.emergency, durationHours: record.durationHours,
    startAt: record.startAt, endAt: record.endAt, actualStartAt: record.actualStartAt, actualEndAt: record.actualEndAt,
    actualAttendanceSummary: record.actualAttendanceSummary, resultSummary: record.resultSummary,
    schemeType: record.schemeType, receiptReference: record.receiptReference, actualAmount: record.actualAmount,
    items: record.items.map(item => ({
      id: item.id, fieldCode: item.fieldCode, itemSeq: item.itemSeq,
      itemName: item.itemName, value: item.value, createdAt: item.createdAt,
    })),
    updatedAt: record.updatedAt,
  }
}

export function createP009Service(transport: P009Transport): P009Service {
  return {
    can: permission => transport.can?.(permission) ?? false,
    async list(_mode, context) {
      const records = await transport.request<readonly P009OvertimeRecord[]>(requestsPath, { signal: context.signal })
      return records.map(mapOvertime)
    },
    async get(id, context) {
      const record = await transport.request<P009OvertimeRecord>(`${requestsPath}/${encodeURIComponent(id)}`, { signal: context.signal })
      return mapOvertime(record)
    },
    async create(input, context) {
      const record = await transport.request<P009OvertimeRecord, P009CreateOvertimeInput>(requestsPath, {
        method: 'POST', body: input, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal,
      })
      return mapOvertime(record)
    },
    async performAction(id: string, action: P009ActionCode, command: P009ActionCommand, context: P009CommandContext) {
      const record = await transport.request<P009OvertimeRecord, P009ActionCommand>(
        `${requestsPath}/${encodeURIComponent(id)}/actions/${action}`,
        { method: 'POST', body: command, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal },
      )
      return mapOvertime(record)
    },
  }
}

export function createP009PortalService(): P009Service {
  return createP009Service(usePortalSessionStore())
}
