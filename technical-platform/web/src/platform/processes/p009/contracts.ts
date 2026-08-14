import type { UiError } from '@sgj/platform-ui'

export type P009NodeCode = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'END'

export type P009ActionCode =
  | 'SUBMIT' | 'WITHDRAW' | 'VALIDATE' | 'RETURN' | 'APPROVE' | 'REJECT' | 'RECORD_FACT'
  | 'ACCEPT_RESULT' | 'REWORK' | 'HR_CONFIRM' | 'HR_RETURN' | 'CONFIRM_SCHEME'
  | 'RECORD_RECEIPT' | 'ARCHIVE'

export const P009_PERMISSIONS = {
  submit: 'p009.overtime.submit', read: 'p009.overtime.read', manage: 'p009.overtime.manage',
  review: 'p009.overtime.review', hr: 'p009.overtime.hr', monitor: 'p009.overtime.monitor',
} as const

export const P009_ACTIONS_BY_NODE: Readonly<Record<Exclude<P009NodeCode, 'END'>, readonly P009ActionCode[]>> = {
  S01: ['SUBMIT', 'WITHDRAW'], S02: ['VALIDATE', 'RETURN'], S03: ['APPROVE', 'REJECT'],
  S04: ['RECORD_FACT'], S05: ['ACCEPT_RESULT', 'REWORK'], S06: ['HR_CONFIRM', 'HR_RETURN'],
  S07: ['CONFIRM_SCHEME'], S08: ['RECORD_RECEIPT'], S09: ['ARCHIVE'],
}

export type P009ErrorMode = 'retryable' | 'conflict' | 'validation' | 'terminal' | 'opaque'

const statusKinds = {
  401: 'unauthorized', 403: 'forbidden', 404: 'not-found', 408: 'timeout',
  409: 'conflict', 422: 'validation', 429: 'rate-limit',
} as const satisfies Readonly<Record<number, UiError['kind']>>
const consistentModes: Readonly<Partial<Record<number, P009ErrorMode>>> = {
  408: 'retryable', 409: 'conflict', 422: 'validation',
}

export function classifyP009Error(error: UiError | undefined): P009ErrorMode | undefined {
  if (!error) return undefined
  if (error.status === undefined) {
    return error.kind === 'transport' || error.kind === 'unknown' ? 'retryable' : 'opaque'
  }
  if (error.status >= 500) return error.kind === 'server' ? 'retryable' : 'opaque'
  const expected = statusKinds[error.status as keyof typeof statusKinds]
  if (expected !== error.kind) return 'opaque'
  return consistentModes[error.status] ?? 'terminal'
}

export interface P009OvertimeItem {
  id: string
  fieldCode: string
  itemSeq: number
  itemName: string
  value: unknown
  createdAt: string
}

export interface P009OvertimeRecord {
  id: string
  tenantId: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: P009NodeCode | null
  status: string
  versionNo: number
  businessDate: string
  subject: string
  reason: string | null
  ownerCenterId: string
  ownerEmployeeId: string
  attendanceType: string
  emergency: boolean
  durationHours: number
  startAt: string
  endAt: string
  actualStartAt: string | null
  actualEndAt: string | null
  actualAttendanceSummary: string | null
  resultSummary: string | null
  schemeType: string | null
  receiptReference: string | null
  actualAmount: number | null
  items: readonly P009OvertimeItem[]
  updatedAt: string
}

export interface P009Evidence { note: string; recordedAt: string }

export interface P009CreateOvertimeInput {
  businessDate: string
  subject: string
  reason: string
  attendanceType: string
  emergency: boolean
  startAt: string
  endAt: string
  emergencyEvidence: P009Evidence | null
}

export interface P009ActionCommand {
  expectedVersion: number
  reason?: string | null
  resultSummary?: string | null
  actualAttendanceSummary?: string | null
  actualStartAt?: string | null
  actualEndAt?: string | null
  schemeType?: string | null
  externalReference?: string | null
  externallyDeterminedAmount?: number | null
  evidence?: P009Evidence | null
}

export interface P009RequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST'
  body?: TBody
  idempotencyKey?: string
  signal?: AbortSignal
}

export interface P009Transport {
  request<TResponse, TBody = unknown>(path: string, options?: P009RequestOptions<TBody>): Promise<TResponse>
  can?(permission: string): boolean
}

export interface P009RequestContext { signal: AbortSignal }
export interface P009CommandContext extends P009RequestContext { idempotencyKey: string }

export interface P009Service {
  can(permission: string): boolean
  list(mode: 'employee' | 'center' | 'tech', context: P009RequestContext): Promise<readonly P009OvertimeRecord[]>
  get(id: string, context: P009RequestContext): Promise<P009OvertimeRecord>
  create(input: P009CreateOvertimeInput, context: P009CommandContext): Promise<P009OvertimeRecord>
  performAction(id: string, action: P009ActionCode, command: P009ActionCommand, context: P009CommandContext): Promise<P009OvertimeRecord>
}

export interface P009ActionCandidate {
  code: P009ActionCode
  label: string
  authority: 'ux-candidate'
}
