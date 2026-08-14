import { ApiClientError } from '../../api'

export type ProcessPhase = 'idle' | 'loading' | 'success' | 'error'
export type ProcessFailureKind = 'none' | 'no-permission' | 'conflict' | 'partial' | 'error'

export interface ProcessState {
  phase: ProcessPhase
  failure: ProcessFailureKind
  message: string
  errorCode?: string
  traceId?: string
  retryable: boolean
}

export function idleProcessState(): ProcessState {
  return {
    phase: 'idle',
    failure: 'none',
    message: '',
    retryable: false,
  }
}

export function loadingProcessState(): ProcessState {
  return {
    phase: 'loading',
    failure: 'none',
    message: '',
    retryable: false,
  }
}

export function successProcessState(message = ''): ProcessState {
  return {
    phase: 'success',
    failure: 'none',
    message,
    retryable: false,
  }
}

export function partialProcessState(message: string): ProcessState {
  return {
    phase: 'error',
    failure: 'partial',
    message,
    retryable: true,
  }
}

export function failedProcessState(cause: unknown): ProcessState {
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
      retryable: cause.retryable || cause.status === 409,
    }
  }

  return {
    phase: 'error',
    failure: 'error',
    message: cause instanceof Error ? cause.message : '操作失败，请稍后重试。',
    retryable: false,
  }
}

export function isPending(state: ProcessState | undefined): boolean {
  return state?.phase === 'loading'
}
