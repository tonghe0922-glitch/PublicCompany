import type { UiError } from '@sgj/platform-ui'

export type P010NodeCode =
  | 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'S10' | 'END'

export type P010ActionCode =
  | 'PUBLISH' | 'ASSIGN' | 'COMPLETE_LEARNING' | 'SUBMIT_EXAM' | 'RECORD_PRACTICAL'
  | 'CERTIFY' | 'ACTIVATE' | 'LINK_PERMISSION' | 'SCHEDULE_RECERTIFICATION' | 'ARCHIVE'

export const P010_PERMISSIONS = {
  read: 'p010.learning.read', complete: 'p010.learning.complete', exam: 'p010.learning.exam',
  manage: 'p010.learning.manage', certify: 'p010.learning.certify', link: 'p010.learning.link',
  monitor: 'p010.learning.monitor',
} as const

export const P010_ACTIONS_BY_NODE: Readonly<Record<Exclude<P010NodeCode, 'END'>, readonly P010ActionCode[]>> = {
  S01: ['PUBLISH'], S02: ['ASSIGN'], S03: ['COMPLETE_LEARNING'], S04: ['SUBMIT_EXAM'],
  S05: ['RECORD_PRACTICAL'], S06: ['CERTIFY'], S07: ['ACTIVATE'], S08: ['LINK_PERMISSION'],
  S09: ['SCHEDULE_RECERTIFICATION'], S10: ['ARCHIVE'],
}

export type P010ErrorMode = 'retryable' | 'conflict' | 'validation' | 'terminal' | 'opaque'

const statusKinds = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 408: 'timeout',
  409: 'conflict', 422: 'validation', 429: 'rate-limit',
} as const satisfies Readonly<Record<number, UiError['kind']>>
const consistentModes: Readonly<Partial<Record<number, P010ErrorMode>>> = {
  408: 'retryable', 409: 'conflict', 422: 'validation',
}

export function classifyP010Error(error: UiError | undefined): P010ErrorMode | undefined {
  if (!error) return undefined
  if (error.status === undefined) {
    return error.kind === 'transport' || error.kind === 'unknown' ? 'retryable' : 'opaque'
  }
  if (error.status >= 500) return error.kind === 'server' ? 'retryable' : 'opaque'
  const expected = statusKinds[error.status as keyof typeof statusKinds]
  if (expected !== error.kind) return 'opaque'
  return consistentModes[error.status] ?? 'terminal'
}

export interface P010LearningEvent {
  id: string
  eventSeq: number
  eventType: string
  evidence: unknown
  actorEmployeeId: string
  createdAt: string
}

export interface P010LearningRecord {
  id: string
  tenantId: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: P010NodeCode | null
  status: string
  versionNo: number
  businessDate: string
  subject: string
  reason: string | null
  ownerCenterId: string
  ownerEmployeeId: string
  courseVersionId: string
  contentVersion: string
  courseTeamName: string
  periodOrCourseNo: string
  learnerProfile: string | null
  completionRate: number
  score1000: number | null
  practicalResult: string | null
  qualificationEffectiveDate: string | null
  qualificationExpireDate: string | null
  events: readonly P010LearningEvent[]
  updatedAt: string
}

export interface P010Evidence { note: string; recordedAt: string }

export interface P010ActionCommand {
  expectedVersion: number
  score1000?: number | null
  practicalResult?: string | null
  effectiveDate?: string | null
  expireDate?: string | null
  recertificationDate?: string | null
  resultSummary?: string | null
  evidence?: P010Evidence | null
}

export interface P010RequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST'
  body?: TBody
  idempotencyKey?: string
  signal?: AbortSignal
}

export interface P010Transport {
  request<TResponse, TBody = unknown>(path: string, options?: P010RequestOptions<TBody>): Promise<TResponse>
  can?(permission: string): boolean
}

export interface P010RequestContext { signal: AbortSignal }
export interface P010CommandContext extends P010RequestContext { idempotencyKey: string }

export interface P010Service {
  can(permission: string): boolean
  list(mode: 'employee' | 'center' | 'tech', context: P010RequestContext): Promise<readonly P010LearningRecord[]>
  get(id: string, context: P010RequestContext): Promise<P010LearningRecord>
  performAction(
    id: string,
    action: P010ActionCode,
    command: P010ActionCommand,
    context: P010CommandContext,
  ): Promise<P010LearningRecord>
}

export interface P010ActionCandidate {
  code: P010ActionCode
  label: string
  authority: 'ux-candidate'
}
