export type UiErrorKind = 'unauthorized' | 'forbidden' | 'not-found' | 'conflict' | 'validation' | 'rate-limit' | 'timeout' | 'transport' | 'server' | 'unknown'

export interface UiFieldError {
  field: string
  message: string
}

export interface UiError {
  kind: UiErrorKind
  title: string
  userMessage: string
  nextAction: string
  status?: number
  code?: string
  requestId?: string
  fieldErrors?: readonly UiFieldError[]
  expectedVersion?: number
  currentVersion?: number
}
