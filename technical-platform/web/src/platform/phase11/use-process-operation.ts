import { reactive } from 'vue'
import type { UnwrapNestedRefs } from 'vue'
import {
  failedProcessState,
  idleProcessState,
  loadingProcessState,
  successProcessState,
} from './process-state'
import type { ProcessState } from './process-state'

type StateRegistry = UnwrapNestedRefs<Record<string, ProcessState>>

function current(registry: StateRegistry, key: string): ProcessState {
  registry[key] ??= idleProcessState()
  return registry[key]
}

export function useProcessOperation() {
  const resources = reactive<Record<string, ProcessState>>({})
  const actions = reactive<Record<string, ProcessState>>({})

  async function execute<T>(
    registry: StateRegistry,
    key: string,
    operation: () => Promise<T>,
    successMessage = '',
  ): Promise<T | undefined> {
    registry[key] = loadingProcessState()
    try {
      const result = await operation()
      registry[key] = successProcessState(successMessage)
      return result
    } catch (cause) {
      registry[key] = failedProcessState(cause)
      return undefined
    }
  }

  return {
    resources,
    actions,
    resourceState: (key: string) => current(resources, key),
    actionState: (key: string) => current(actions, key),
    runResource: <T>(key: string, operation: () => Promise<T>) => execute(resources, key, operation),
    runAction: <T>(key: string, operation: () => Promise<T>, successMessage = '') =>
      execute(actions, key, operation, successMessage),
    clearAction: (key: string) => { actions[key] = idleProcessState() },
  }
}
