import { usePortalSessionStore } from '../../../session'

import type {
  P006ActionCode,
  P006ActionCommand,
  P006CommandContext,
  P006CreateMeetingInput,
  P006MeetingRecord,
  P006RequestContext,
  P006Service,
  P006Transport,
} from './contracts'

const meetingsPath = '/api/v1/processes/P006/meetings'

function commandKey(value: string): string {
  const key = value.trim()
  if (!key) throw new Error('CALLER_IDEMPOTENCY_KEY_REQUIRED')
  return key
}

function mapMeeting(record: P006MeetingRecord): P006MeetingRecord {
  return {
    id: record.id,
    tenantId: record.tenantId,
    businessNo: record.businessNo,
    workflowInstanceId: record.workflowInstanceId,
    workflowInstanceNo: record.workflowInstanceNo,
    currentNodeCode: record.currentNodeCode,
    status: record.status,
    versionNo: record.versionNo,
    businessDate: record.businessDate,
    subject: record.subject,
    reason: record.reason,
    priority: record.priority,
    ownerCenterId: record.ownerCenterId,
    ownerEmployeeId: record.ownerEmployeeId,
    plannedStartAt: record.plannedStartAt,
    startAt: record.startAt,
    resultSummary: record.resultSummary,
    officialSubject: record.officialSubject,
    officialContent: record.officialContent,
    venueChannel: record.venueChannel,
    visibilityLevel: record.visibilityLevel,
    items: record.items.map((item) => ({
      id: item.id,
      fieldCode: item.fieldCode,
      itemSeq: item.itemSeq,
      itemKey: item.itemKey,
      itemName: item.itemName,
      value: item.value,
      createdAt: item.createdAt,
    })),
    updatedAt: record.updatedAt,
  }
}

export function createP006Service(transport: P006Transport): P006Service {
  return {
    can(permission: string) {
      return transport.can?.(permission) ?? false
    },
    async list(_mode: 'employee' | 'center' | 'tech', context: P006RequestContext) {
      const records = await transport.request<readonly P006MeetingRecord[]>(meetingsPath, { signal: context.signal })
      return records.map(mapMeeting)
    },
    async get(id: string, context: P006RequestContext) {
      const record = await transport.request<P006MeetingRecord>(`${meetingsPath}/${encodeURIComponent(id)}`, { signal: context.signal })
      return mapMeeting(record)
    },
    async create(input: P006CreateMeetingInput, context: P006CommandContext) {
      const record = await transport.request<P006MeetingRecord, P006CreateMeetingInput>(meetingsPath, {
        method: 'POST', body: input, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal,
      })
      return mapMeeting(record)
    },
    async performAction(id: string, action: P006ActionCode, command: P006ActionCommand, context: P006CommandContext) {
      if (action === 'GENERATE_ACTIONS') throw new Error('DIRECTORY_CONTRACT_REQUIRED')
      const record = await transport.request<P006MeetingRecord, P006ActionCommand>(`${meetingsPath}/${encodeURIComponent(id)}/actions/${action}`, {
        method: 'POST', body: command, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal,
      })
      return mapMeeting(record)
    },
  }
}

export function createP006PortalService(): P006Service {
  return createP006Service(usePortalSessionStore())
}
