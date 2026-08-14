import type { AsyncState } from '../async/async-state'

export interface AllowedAction {
  code: string
  label: string
  tone: 'primary' | 'secondary' | 'danger'
  requiresReason?: boolean
  requiresStepUp?: boolean
  permission: string
}

export type ActionStateMap = Readonly<Record<string, AsyncState<unknown> | undefined>>
