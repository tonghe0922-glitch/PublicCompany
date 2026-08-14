import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { mapApiError } from '../errors/map-api-error'
import type { AsyncRequestContext } from './async-contracts'
import { idleState, type AsyncState } from './async-state'

export interface AsyncResource<T> {
  state: Ref<AsyncState<T>>
  execute: () => Promise<T | undefined>
  cancel: () => void
}

function defaultIsEmpty<T>(data: T): boolean {
  if (data == null) return true
  return Array.isArray(data) && data.length === 0
}

function useAsyncResource<T>(
  loader: (context: AsyncRequestContext) => Promise<T>,
  options: { isEmpty?: (value: T) => boolean } = {},
): AsyncResource<T> {
  const state = ref<AsyncState<T>>(idleState<T>()) as Ref<AsyncState<T>>
  let sequence = 0
  let active: AbortController | undefined

  function isStale(controller: AbortController): boolean {
    return controller.signal.aborted || active !== controller
  }

  function cancel(): void {
    active?.abort()
    active = undefined
    if (state.value.phase === 'loading') {
      state.value = { phase: 'cancelled', requestId: state.value.requestId }
    }
  }

  async function execute(): Promise<T | undefined> {
    active?.abort()
    const controller = new AbortController()
    active = controller
    const requestId = `resource-${++sequence}`
    state.value = { phase: 'loading', requestId }
    try {
      const data = await loader({ signal: controller.signal, requestId })
      if (isStale(controller)) return undefined
      const isEmpty = options.isEmpty ? options.isEmpty(data) : defaultIsEmpty(data)
      state.value = { phase: isEmpty ? 'empty' : 'success', data, requestId, updatedAt: new Date().toISOString() }
      return data
    } catch (cause) {
      if (isStale(controller)) return undefined
      state.value = { phase: 'error', error: mapApiError(cause), requestId }
      return undefined
    } finally {
      if (active === controller) active = undefined
    }
  }

  if (getCurrentScope()) onScopeDispose(cancel)
  return { state, execute, cancel }
}

export default useAsyncResource
