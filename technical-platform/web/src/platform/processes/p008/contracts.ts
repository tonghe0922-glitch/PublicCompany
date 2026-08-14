import type { UiError } from '@sgj/platform-ui'

export type P008NodeCode = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'S10' | 'END'

export type P008ActionCode =
  | 'SUBMIT' | 'WITHDRAW' | 'RESERVE' | 'RETURN' | 'CONFIRM_HANDOVER' | 'APPROVE' | 'REJECT'
  | 'DEDUCT' | 'RELEASE' | 'MARK_ATTENDANCE' | 'START_LEAVE' | 'EARLY_RETURN' | 'CHANGE'
  | 'ADJUST' | 'CLOSE_DAY'

export const P008_PERMISSIONS = {
  submit: 'p008.leave.submit', read: 'p008.leave.read', manage: 'p008.leave.manage',
  review: 'p008.leave.review', monitor: 'p008.leave.monitor',
} as const

export const P008_ACTIONS_BY_NODE: Readonly<Record<Exclude<P008NodeCode, 'END'>, readonly P008ActionCode[]>> = {
  S01: ['SUBMIT', 'WITHDRAW'], S02: ['RESERVE', 'RETURN'], S03: ['CONFIRM_HANDOVER', 'RETURN'],
  S04: ['APPROVE', 'REJECT'], S05: ['DEDUCT', 'RELEASE'], S06: ['MARK_ATTENDANCE'],
  S07: ['START_LEAVE'], S08: ['RETURN', 'EARLY_RETURN', 'CHANGE'], S09: ['ADJUST'], S10: ['CLOSE_DAY'],
}

export type P008ErrorMode = 'retryable' | 'conflict' | 'validation' | 'terminal' | 'opaque'

const statusKinds = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 408: 'timeout',
  409: 'conflict', 422: 'validation', 429: 'rate-limit',
} as const satisfies Readonly<Record<number, UiError['kind']>>
const consistentModes: Readonly<Partial<Record<number, P008ErrorMode>>> = {
  408: 'retryable', 409: 'conflict', 422: 'validation',
}

export function classifyP008Error(error: UiError | undefined): P008ErrorMode | undefined {
  if (!error) return undefined
  if (error.status === undefined) {
    return error.kind === 'transport' || error.kind === 'unknown' ? 'retryable' : 'opaque'
  }
  if (error.status >= 500) return error.kind === 'server' ? 'retryable' : 'opaque'
  const expected = statusKinds[error.status as keyof typeof statusKinds]
  if (expected !== error.kind) return 'opaque'
  return consistentModes[error.status] ?? 'terminal'
}

export interface P008LeaveItem {
  id: string
  fieldCode: string
  itemSeq: number
  itemName: string
  value: unknown
  createdAt: string
}

export interface P008LeaveRecord {
  id: string
  tenantId: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: P008NodeCode | null
  status: string
  versionNo: number
  businessDate: string
  subject: string
  reason: string | null
  ownerCenterId: string
  ownerEmployeeId: string
  attendanceType: string
  changeAction: string
  changeReason: string | null
  durationHours: number
  startAt: string
  endAt: string
  handoverAgentId: string | null
  quotaAccountId: string | null
  quotaAmount: number
  actualEndAt: string | null
  actualAttendanceSummary: string | null
  items: readonly P008LeaveItem[]
  updatedAt: string
}

export interface P008QuotaEntry {
  id: string
  employeeId: string
  ownerCenterId: string
  quotaAccountId: string | null
  leaveRequestId: string | null
  entryType: string
  availableDelta: number
  reservedDelta: number
  consumedDelta: number
  availableAfter: number
  reservedAfter: number
  consumedAfter: number
  reason: string | null
  createdAt: string
}

export interface P008CreateLeaveInput {
  businessDate: string
  subject: string
  reason: string
  attendanceType: string
  quotaAccountId: string
  handoverAgentId: null
  startAt: string
  endAt: string
}

export interface P008ActionCommand {
  expectedVersion: number
  reason?: string | null
  resultSummary?: string | null
  actualAttendanceSummary?: string | null
  actualEndAt?: string | null
  handoverItems?: readonly string[] | null
  evidence?: { note: string; recordedAt: string } | null
}

export interface P008RequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST'
  body?: TBody
  idempotencyKey?: string
  signal?: AbortSignal
}

export interface P008Transport {
  request<TResponse, TBody = unknown>(path: string, options?: P008RequestOptions<TBody>): Promise<TResponse>
  can?(permission: string): boolean
}

export interface P008RequestContext { signal: AbortSignal }
export interface P008CommandContext extends P008RequestContext { idempotencyKey: string }

export interface P008Service {
  can(permission: string): boolean
  list(mode: 'employee' | 'center' | 'tech', context: P008RequestContext): Promise<readonly P008LeaveRecord[]>
  get(id: string, context: P008RequestContext): Promise<P008LeaveRecord>
  quotaLedger(mode: 'employee' | 'center' | 'tech', context: P008RequestContext): Promise<readonly P008QuotaEntry[]>
  create(input: P008CreateLeaveInput, context: P008CommandContext): Promise<P008LeaveRecord>
  performAction(id: string, action: P008ActionCode, command: P008ActionCommand, context: P008CommandContext): Promise<P008LeaveRecord>
}

export interface P008ActionCandidate {
  code: P008ActionCode
  label: string
  authority: 'ux-candidate'
}
