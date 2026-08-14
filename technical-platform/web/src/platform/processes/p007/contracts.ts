export type P007NodeCode = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06' | 'S07' | 'S08' | 'S09' | 'END'

export type P007ActionCode =
  | 'SUBMIT_DEMAND' | 'WITHDRAW' | 'MATCH_TEMPLATE' | 'RETURN' | 'VALIDATE' | 'PUBLISH'
  | 'CONFIRM' | 'REQUEST_CHANGE' | 'NO_CHANGE' | 'APPROVE' | 'REJECT' | 'LINK' | 'CLOSE_DAY'

export const P007_PERMISSIONS = {
  read: 'p007.schedule.read', monitor: 'p007.schedule.monitor', manage: 'p007.schedule.manage',
  change: 'p007.schedule.change', review: 'p007.schedule.review',
} as const

export const P007_ACTIONS_BY_NODE: Readonly<Record<Exclude<P007NodeCode, 'END'>, readonly P007ActionCode[]>> = {
  S01: ['SUBMIT_DEMAND', 'WITHDRAW'], S02: ['MATCH_TEMPLATE', 'RETURN'],
  S03: ['VALIDATE', 'RETURN'], S04: ['PUBLISH', 'RETURN'], S05: ['CONFIRM'],
  S06: ['REQUEST_CHANGE', 'NO_CHANGE'], S07: ['APPROVE', 'REJECT'], S08: ['LINK'], S09: ['CLOSE_DAY'],
}

export interface P007ScheduleItem {
  id: string
  fieldCode: string
  itemSeq: number
  itemName: string
  value: unknown
  createdAt: string
}

export interface P007ScheduleRecord {
  id: string
  tenantId: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: P007NodeCode | null
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
  contentVersion: string
  durationHours: number
  startAt: string
  endAt: string
  periodOrCourseNo: string
  actualAttendanceSummary: string | null
  resultSummary: string | null
  items: readonly P007ScheduleItem[]
  updatedAt: string
}

export interface P007ActionCommand {
  expectedVersion: number
  reason?: string | null
  resultSummary?: string | null
  actualAttendanceSummary?: string | null
  proposedStartAt?: string | null
  proposedEndAt?: string | null
  substituteEmployeeId?: string | null
  handoverItems?: readonly string[] | null
  evidence?: { note: string; recordedAt: string } | null
}

export interface P007RequestOptions<TBody = unknown> {
  method?: 'GET' | 'POST'
  body?: TBody
  idempotencyKey?: string
  signal?: AbortSignal
}

export interface P007Transport {
  request<TResponse, TBody = unknown>(path: string, options?: P007RequestOptions<TBody>): Promise<TResponse>
  can?(permission: string): boolean
}

export interface P007RequestContext { signal: AbortSignal }
export interface P007CommandContext extends P007RequestContext { idempotencyKey: string }

export interface P007Service {
  can(permission: string): boolean
  list(mode: 'employee' | 'center' | 'tech', context: P007RequestContext): Promise<readonly P007ScheduleRecord[]>
  get(id: string, context: P007RequestContext): Promise<P007ScheduleRecord>
  performAction(id: string, action: P007ActionCode, command: P007ActionCommand, context: P007CommandContext): Promise<P007ScheduleRecord>
}

export interface P007ActionCandidate {
  code: P007ActionCode
  label: string
  authority: 'ux-candidate'
  blocked: boolean
  blockedCode?: 'DIRECTORY_CONTRACT_REQUIRED'
}
