import { ApiClientError } from '../../api'

export type ProcessPhase =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'partial'
  | 'error'
  | 'cancelled'
export type ProcessFailureKind = 'none' | 'no-permission' | 'conflict' | 'partial' | 'error'

export interface ProcessState<T = unknown> {
  phase: ProcessPhase
  failure: ProcessFailureKind
  message: string
  data?: T
  errorCode?: string
  traceId?: string
  requestId?: string
  updatedAt?: string
  missingResources?: readonly string[]
  retryable: boolean
}

export function idleProcessState<T>(): ProcessState<T> {
  return {
    phase: 'idle',
    failure: 'none',
    message: '',
    retryable: false,
  }
}

export function loadingProcessState<T>(requestId?: string): ProcessState<T> {
  return {
    phase: 'loading',
    failure: 'none',
    message: '',
    requestId,
    retryable: false,
  }
}

export function successProcessState<T>(
  message = '',
  data?: T,
  requestId?: string,
): ProcessState<T> {
  return {
    phase: 'success',
    failure: 'none',
    message,
    data,
    requestId,
    updatedAt: new Date().toISOString(),
    retryable: false,
  }
}

export function emptyProcessState<T>(data: T, requestId: string): ProcessState<T> {
  return {
    phase: 'empty',
    failure: 'none',
    message: '',
    data,
    requestId,
    updatedAt: new Date().toISOString(),
    retryable: false,
  }
}

export function partialProcessState<T = unknown>(
  message: string,
  data?: T,
  missingResources: readonly string[] = [],
  requestId?: string,
): ProcessState<T> {
  return {
    phase: 'partial',
    failure: 'partial',
    message,
    data,
    missingResources,
    requestId,
    updatedAt: new Date().toISOString(),
    retryable: true,
  }
}

export function cancelledProcessState<T>(requestId: string): ProcessState<T> {
  return {
    phase: 'cancelled',
    failure: 'none',
    message: '请求已取消。',
    requestId,
    retryable: false,
  }
}

export function failedProcessState<T>(cause: unknown, requestId?: string): ProcessState<T> {
  if (cause instanceof ApiClientError) {
    const failure = cause.status === 403
      ? 'no-permission'
      : cause.status === 409
        ? 'conflict'
        : 'error'

    return {
      phase: 'error',
      failure,
      message: cause.message,
      errorCode: cause.code,
      traceId: cause.requestId,
      requestId,
      retryable: cause.retryable || cause.status === 409,
    }
  }

  return {
    phase: 'error',
    failure: 'error',
    message: cause instanceof Error ? cause.message : '操作失败，请稍后重试。',
    requestId,
    retryable: false,
  }
}

export function isPending(state: ProcessState<unknown> | undefined): boolean {
  return state?.phase === 'loading'
}
