export type MonitorProcessCode = 'P004' | 'P005'

export type MonitorErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'rate-limit'
  | 'timeout'
  | 'transport'
  | 'server'
  | 'unknown'

export interface MonitorFieldError {
  readonly field: string
  readonly message: string
}

export interface MonitorError {
  readonly kind: MonitorErrorKind
  readonly title: string
  readonly userMessage: string
  readonly nextAction: string
  readonly status?: number
  readonly code?: string
  readonly requestId?: string
  readonly fieldErrors?: readonly MonitorFieldError[]
  readonly expectedVersion?: number
  readonly currentVersion?: number
}

export type MonitorProjectionPhase = 'idle' | 'loading' | 'success' | 'empty' | 'partial' | 'error' | 'cancelled'

export interface MonitorProjectionState {
  readonly phase: MonitorProjectionPhase
  readonly data?: MonitorProjectionData
  readonly error?: MonitorError
  readonly updatedAt?: string
  readonly requestId?: string
  readonly missingResources?: readonly string[]
}

export interface MonitorProjection {
  recordId: string
  businessNo: string
  processCode: MonitorProcessCode
  currentNodeCode: string
  status: string
  versionNo: number
  updatedAt: string
  approvedCount?: number
}

export interface MonitorProjectionData {
  p004: readonly MonitorProjection[]
  p005: readonly MonitorProjection[]
}

export interface MonitorRequestContext {
  signal: AbortSignal
}

export interface MonitorRequestOptions {
  signal?: AbortSignal
}

export interface MonitorTransport {
  request<TResponse>(path: string, options?: MonitorRequestOptions): Promise<TResponse>
}

export interface MonitorService {
  listP004(context: MonitorRequestContext): Promise<readonly MonitorProjection[]>
  listP005(context: MonitorRequestContext): Promise<readonly MonitorProjection[]>
}

export interface MonitorProjectionResource {
  state: Readonly<{ value: MonitorProjectionState }>
  refresh: () => Promise<MonitorProjectionData | undefined>
  cancel: () => void
}
