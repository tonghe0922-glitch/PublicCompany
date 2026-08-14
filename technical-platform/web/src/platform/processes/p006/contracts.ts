import type { UiError } from '@sgj/platform-ui'

export type P006NodeCode = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'S10' | 'S11' | 'END'

export type P006ActionCode =
  | 'SUBMIT' | 'WITHDRAW' | 'ACCEPT' | 'RETURN' | 'REJECT' | 'PUBLISH'
  | 'RECORD_ATTENDANCE' | 'CONVENE' | 'CONFIRM_MINUTES' | 'GENERATE_ACTIONS'
  | 'SUBMIT_EXECUTION' | 'ACCEPT_RESULT' | 'REWORK' | 'ACKNOWLEDGE_OVERDUE' | 'ARCHIVE'

export const P006_PERMISSIONS = {
  read: 'p006.meeting.read',
  monitor: 'p006.meeting.monitor',
  create: 'p006.meeting.create',
} as const

export type P006CreationErrorMode = 'retryable' | 'validation' | 'terminal' | 'opaque'

const P006_STATUS_KINDS = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 408: 'timeout',
  409: 'conflict', 422: 'validation', 429: 'rate-limit',
} as const satisfies Readonly<Record<number, UiError['kind']>>

export function classifyP006CreationError(error: UiError | undefined): P006CreationErrorMode | undefined {
  if (!error) return undefined
  if (error.status === undefined) {
    return error.kind === 'transport' || error.kind === 'unknown' ? 'retryable' : 'opaque'
  }
  if (error.status >= 500) return error.kind === 'server' ? 'retryable' : 'opaque'
  const expectedKind = P006_STATUS_KINDS[error.status as keyof typeof P006_STATUS_KINDS]
  if (expectedKind !== error.kind) return 'opaque'
  if (error.status === 408) return 'retryable'
  if (error.status === 422) return 'validation'
  return 'terminal'
}

export const P006_ACTIONS_BY_NODE: Readonly<Record<Exclude<P006NodeCode, 'END'>, readonly P006ActionCode[]>> = {
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
}

export interface P006MeetingItem {
  id: string
  fieldCode: string
  itemSeq: number
  itemKey: string
  itemName: string
  value: unknown
  createdAt: string
}

export interface P006MeetingRecord {
  id: string
  tenantId: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: P006NodeCode | null
  status: string
  versionNo: number
  businessDate: string
  subject: string
  reason: string | null
  priority: string
  ownerCenterId: string
  ownerEmployeeId: string
  plannedStartAt: string
  startAt: string
  resultSummary: string | null
  officialSubject: string | null
  officialContent: string | null
  venueChannel: string | null
  visibilityLevel: string
  items: readonly P006MeetingItem[]
  updatedAt: string
}

export interface P006CreateMeetingInput {
  businessDate: string
  subject: string
  reason: string
  priority: string
  startAt: string
  officialSubject: string
  officialContent: string
  venueChannel?: string | null
  visibilityLevel: string
}

export interface P006ActionItemInput {
  itemKey: string
  itemName: string
  ownerEmployeeId: string
  plannedStartAt: string
  plannedFinishAt: string
  acceptanceCriteria?: string | null
}

export interface P006ActionCommand {
  expectedVersion: number
  reason?: string | null
  resultSummary?: string | null
  actionItems?: readonly P006ActionItemInput[]
  evidence?: { note: string; recordedAt: string } | null
}

export interface P006RequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST'
  body?: TBody
  idempotencyKey?: string
  signal?: AbortSignal
}

export interface P006Transport {
  request<TResponse, TBody = unknown>(path: string, options?: P006RequestOptions<TBody>): Promise<TResponse>
  can?(permission: string): boolean
}

export interface P006RequestContext {
  signal: AbortSignal
}

export interface P006CommandContext extends P006RequestContext {
  idempotencyKey: string
}

export interface P006Service {
  can(permission: string): boolean
  list(mode: 'employee' | 'center' | 'tech', context: P006RequestContext): Promise<readonly P006MeetingRecord[]>
  get(id: string, context: P006RequestContext): Promise<P006MeetingRecord>
  create(input: P006CreateMeetingInput, context: P006CommandContext): Promise<P006MeetingRecord>
  performAction(id: string, action: P006ActionCode, command: P006ActionCommand, context: P006CommandContext): Promise<P006MeetingRecord>
}

export interface P006ActionCandidate {
  code: P006ActionCode
  label: string
  authority: 'ux-candidate'
  blocked: boolean
  blockedCode?: 'DIRECTORY_CONTRACT_REQUIRED'
}
