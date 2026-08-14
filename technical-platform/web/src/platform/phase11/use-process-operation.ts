import { getCurrentScope, onScopeDispose, reactive } from 'vue'
import type { UnwrapNestedRefs } from 'vue'
import {
  cancelledProcessState, emptyProcessState, failedProcessState, idleProcessState,
  loadingProcessState, successProcessState,
} from './process-state'
import type { ProcessState } from './process-state'

export interface ProcessOperationContext { signal: AbortSignal; requestId: string }
export type ProcessOperationResult<T> =
  | { ok: true; data: T; state: ProcessState<T> }
  | { ok: false; outcome: 'cancelled' | 'failed' | 'in-flight'; state: ProcessState<T> }
interface ActiveOperation { controller: AbortController; requestId: string }
type StateRegistry = UnwrapNestedRefs<Record<string, ProcessState<unknown>>>
interface OperationRegistry {
  states: StateRegistry
  active: Map<string, ActiveOperation>
  sequences: Map<string, number>
}

function createRegistry(): OperationRegistry {
  return {
    states: reactive<Record<string, ProcessState<unknown>>>({}),
    active: new Map(),
    sequences: new Map(),
  }
}
function current<T>(registry: OperationRegistry, key: string): ProcessState<T> {
  registry.states[key] ??= idleProcessState()
  return registry.states[key] as ProcessState<T>
}
function nextRequestId(registry: OperationRegistry, key: string): string {
  const sequence = (registry.sequences.get(key) ?? 0) + 1
  registry.sequences.set(key, sequence)
  return `${key}:${sequence}`
}
function begin(registry: OperationRegistry, key: string, abortExisting: boolean): ActiveOperation {
  if (abortExisting) registry.active.get(key)?.controller.abort()
  const active = { controller: new AbortController(), requestId: nextRequestId(registry, key) }
  registry.active.set(key, active)
  registry.states[key] = loadingProcessState(active.requestId)
  return active
}
function isCurrent(registry: OperationRegistry, key: string, active: ActiveOperation): boolean {
  return !active.controller.signal.aborted && registry.active.get(key) === active
}
function cancelledResult<T>(requestId: string): ProcessOperationResult<T> {
  return { ok: false, outcome: 'cancelled', state: cancelledProcessState<T>(requestId) }
}
function isEmpty(value: unknown): boolean {
  return value == null || (Array.isArray(value) && value.length === 0)
}
async function runResource<T>(
  registry: OperationRegistry,
  key: string,
  operation: (context: ProcessOperationContext) => Promise<T>,
): Promise<ProcessOperationResult<T>> {
  const active = begin(registry, key, true)
  try {
    const data = await operation({ signal: active.controller.signal, requestId: active.requestId })
    if (!isCurrent(registry, key, active)) return cancelledResult<T>(active.requestId)
    const state = isEmpty(data)
      ? emptyProcessState(data, active.requestId)
      : successProcessState('', data, active.requestId)
    registry.states[key] = state
    return { ok: true, data, state }
  } catch (cause) {
    if (!isCurrent(registry, key, active)) return cancelledResult<T>(active.requestId)
    const state = failedProcessState<T>(cause, active.requestId)
    registry.states[key] = state
    return { ok: false, outcome: 'failed', state }
  } finally {
    if (registry.active.get(key) === active) registry.active.delete(key)
  }
}
async function runAction<T>(
  registry: OperationRegistry,
  key: string,
  operation: (context: ProcessOperationContext) => Promise<T>,
  successMessage: string,
): Promise<ProcessOperationResult<T>> {
  const existing = registry.active.get(key)
  if (existing && !existing.controller.signal.aborted) {
    return { ok: false, outcome: 'in-flight', state: current<T>(registry, key) }
  }
  const active = begin(registry, key, false)
  try {
    const data = await operation({ signal: active.controller.signal, requestId: active.requestId })
    if (!isCurrent(registry, key, active)) return cancelledResult<T>(active.requestId)
    const state = successProcessState(successMessage, data, active.requestId)
    registry.states[key] = state
    return { ok: true, data, state }
  } catch (cause) {
    if (!isCurrent(registry, key, active)) return cancelledResult<T>(active.requestId)
    const state = failedProcessState<T>(cause, active.requestId)
    registry.states[key] = state
    return { ok: false, outcome: 'failed', state }
  } finally {
    if (registry.active.get(key) === active) registry.active.delete(key)
  }
}
function cancelRegistry(registry: OperationRegistry): void {
  for (const [key, active] of registry.active) {
    active.controller.abort()
    if (current(registry, key).phase === 'loading') {
      registry.states[key] = cancelledProcessState(active.requestId)
    }
  }
  registry.active.clear()
}

export function useProcessOperation() {
  const resources = createRegistry()
  const actions = createRegistry()
  const cancelAll = () => {
    cancelRegistry(resources)
    cancelRegistry(actions)
  }
  if (getCurrentScope()) onScopeDispose(cancelAll)
  return {
    resources: resources.states,
    actions: actions.states,
    resourceState: <T>(key: string) => current<T>(resources, key),
    actionState: <T>(key: string) => current<T>(actions, key),
    runResource: <T>(key: string, operation: (context: ProcessOperationContext) => Promise<T>) =>
      runResource(resources, key, operation),
    runAction: <T>(key: string, operation: (context: ProcessOperationContext) => Promise<T>, message = '') =>
      runAction(actions, key, operation, message),
    clearAction: (key: string) => { actions.states[key] = idleProcessState() },
    cancelAll,
  }
}
