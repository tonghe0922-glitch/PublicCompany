import { usePortalSessionStore } from '../../../session'

import type {
  P010ActionCode,
  P010ActionCommand,
  P010CommandContext,
  P010LearningRecord,
  P010Service,
  P010Transport,
} from './contracts'

const assignmentsPath = '/api/v1/processes/P010/learning-assignments'

function commandKey(value: string): string {
  const key = value.trim()
  if (!key) throw new Error('CALLER_IDEMPOTENCY_KEY_REQUIRED')
  return key
}

function mapLearning(record: P010LearningRecord): P010LearningRecord {
  return {
    id: record.id, tenantId: record.tenantId, businessNo: record.businessNo,
    workflowInstanceId: record.workflowInstanceId, workflowInstanceNo: record.workflowInstanceNo,
    currentNodeCode: record.currentNodeCode, status: record.status, versionNo: record.versionNo,
    businessDate: record.businessDate, subject: record.subject, reason: record.reason,
    ownerCenterId: record.ownerCenterId, ownerEmployeeId: record.ownerEmployeeId,
    courseVersionId: record.courseVersionId, contentVersion: record.contentVersion,
    courseTeamName: record.courseTeamName, periodOrCourseNo: record.periodOrCourseNo,
    learnerProfile: record.learnerProfile, completionRate: record.completionRate, score1000: record.score1000,
    practicalResult: record.practicalResult, qualificationEffectiveDate: record.qualificationEffectiveDate,
    qualificationExpireDate: record.qualificationExpireDate,
    events: record.events.map(event => ({
      id: event.id, eventSeq: event.eventSeq, eventType: event.eventType, evidence: event.evidence,
      actorEmployeeId: event.actorEmployeeId, createdAt: event.createdAt,
    })),
    updatedAt: record.updatedAt,
  }
}

export function createP010Service(transport: P010Transport): P010Service {
  return {
    can: permission => transport.can?.(permission) ?? false,
    async list(_mode, context) {
      const records = await transport.request<readonly P010LearningRecord[]>(assignmentsPath, { signal: context.signal })
      return records.map(mapLearning)
    },
    async get(id, context) {
      const record = await transport.request<P010LearningRecord>(
        `${assignmentsPath}/${encodeURIComponent(id)}`,
        { signal: context.signal },
      )
      return mapLearning(record)
    },
    async performAction(id: string, action: P010ActionCode, command: P010ActionCommand, context: P010CommandContext) {
      const record = await transport.request<P010LearningRecord, P010ActionCommand>(
        `${assignmentsPath}/${encodeURIComponent(id)}/actions/${action}`,
        { method: 'POST', body: command, idempotencyKey: commandKey(context.idempotencyKey), signal: context.signal },
      )
      return mapLearning(record)
    },
  }
}

export function createP010PortalService(): P010Service {
  return createP010Service(usePortalSessionStore())
}
