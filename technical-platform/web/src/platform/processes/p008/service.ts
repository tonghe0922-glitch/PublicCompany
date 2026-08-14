import { usePortalSessionStore } from '../../../session'

import type {
  P008ActionCode,
  P008ActionCommand,
  P008CommandContext,
  P008CreateLeaveInput,
  P008LeaveRecord,
  P008QuotaEntry,
  P008Service,
  P008Transport,
} from './contracts'

const leavesPath = '/api/v1/processes/P008/leaves'
const quotaPath = '/api/v1/processes/P008/quota-ledger'

function commandKey(value: string): string {
  const key = value.trim()
  if (!key) throw new Error('CALLER_IDEMPOTENCY_KEY_REQUIRED')
  return key
}

function mapLeave(record: P008LeaveRecord): P008LeaveRecord {
  return {
    id: record.id, tenantId: record.tenantId, businessNo: record.businessNo,
    workflowInstanceId: record.workflowInstanceId, workflowInstanceNo: record.workflowInstanceNo,
    currentNodeCode: record.currentNodeCode, status: record.status, versionNo: record.versionNo,
    businessDate: record.businessDate, subject: record.subject, reason: record.reason,
    ownerCenterId: record.ownerCenterId, ownerEmployeeId: record.ownerEmployeeId,
    attendanceType: record.attendanceType, changeAction: record.changeAction, changeReason: record.changeReason,
    durationHours: record.durationHours, startAt: record.startAt, endAt: record.endAt,
    handoverAgentId: record.handoverAgentId, quotaAccountId: record.quotaAccountId, quotaAmount: record.quotaAmount,
    actualEndAt: record.actualEndAt, actualAttendanceSummary: record.actualAttendanceSummary,
    items: record.items.map(item => ({
      id: item.id, fieldCode: item.fieldCode, itemSeq: item.itemSeq,
      itemName: item.itemName, value: item.value, createdAt: item.createdAt,
    })),
    updatedAt: record.updatedAt,
  }
}

function mapQuota(entry: P008QuotaEntry): P008QuotaEntry {
  return {
    id: entry.id, employeeId: entry.employeeId, ownerCenterId: entry.ownerCenterId,
    quotaAccountId: entry.quotaAccountId, leaveRequestId: entry.leaveRequestId, entryType: entry.entryType,
    availableDelta: entry.availableDelta, reservedDelta: entry.reservedDelta, consumedDelta: entry.consumedDelta,
    availableAfter: entry.availableAfter, reservedAfter: entry.reservedAfter, consumedAfter: entry.consumedAfter,
    reason: entry.reason, createdAt: entry.createdAt,
  }
}

export function createP008Service(transport: P008Transport): P008Service {
  return {
    can: permission => transport.can?.(permission) ?? false,
    async list(_mode, context) {
      const records = await transport.request<readonly P008LeaveRecord[]>(leavesPath, { signal: context.signal })
      return records.map(mapLeave)
    },
    async get(id, context) {
      const record = await transport.request<P008LeaveRecord>(`${leavesPath}/${encodeURIComponent(id)}`, { signal: context.signal })
      return mapLeave(record)
    },
    async quotaLedger(_mode, context) {
      const entries = await transport.request<readonly P008QuotaEntry[]>(quotaPath, { signal: context.signal })
      return entries.map(mapQuota)
    },
    async create(input, context) {
      if (input.handoverAgentId !== null) throw new Error('DIRECTORY_CONTRACT_REQUIRED')
      const record = await transport.request<P008LeaveRecord, P008CreateLeaveInput>(leavesPath, {
        method: 'POST', body: input, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal,
      })
      return mapLeave(record)
    },
    async performAction(id: string, action: P008ActionCode, command: P008ActionCommand, context: P008CommandContext) {
      const record = await transport.request<P008LeaveRecord, P008ActionCommand>(
        `${leavesPath}/${encodeURIComponent(id)}/actions/${action}`,
        { method: 'POST', body: command, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal },
      )
      return mapLeave(record)
    },
  }
}

export function createP008PortalService(): P008Service {
  return createP008Service(usePortalSessionStore())
}
