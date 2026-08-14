import type { UiError } from '../errors/ui-error'

export type AsyncPhase = 'idle' | 'loading' | 'success' | 'empty' | 'partial' | 'error' | 'cancelled'

export interface AsyncState<T> {
  phase: AsyncPhase
  data?: T
  error?: UiError
  updatedAt?: string
  requestId?: string
  missingResources?: readonly string[]
}

export function idleState<T>(): AsyncState<T> {
  return { phase: 'idle' }
}
