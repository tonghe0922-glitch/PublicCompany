import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { mapApiError } from '../errors/map-api-error'
import type { AsyncActionContext, AsyncActionExecution } from './async-contracts'
import { idleState, type AsyncState } from './async-state'

export interface AsyncAction<TInput, TOutput> {
  state: Ref<AsyncState<TOutput>>
  execute: (input: TInput, execution: AsyncActionExecution) => Promise<TOutput | undefined>
  cancel: () => void
}

function useAsyncAction<TInput, TOutput>(
  runner: (context: AsyncActionContext<TInput>) => Promise<TOutput>,
): AsyncAction<TInput, TOutput> {
  const state = ref<AsyncState<TOutput>>(idleState<TOutput>()) as Ref<AsyncState<TOutput>>
  let sequence = 0
  let active: AbortController | undefined

  function cancel(): void {
    active?.abort()
    active = undefined
    if (state.value.phase === 'loading') {
      state.value = { phase: 'cancelled', requestId: state.value.requestId }
    }
  }

  async function execute(input: TInput, execution: AsyncActionExecution): Promise<TOutput | undefined> {
    if (!execution.idempotencyKey.trim()) throw new Error('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    if (state.value.phase === 'loading') return undefined
    const controller = new AbortController()
    active = controller
    const requestId = `action-${++sequence}`
    state.value = { phase: 'loading', requestId }
    try {
      const data = await runner({ input, idempotencyKey: execution.idempotencyKey, signal: controller.signal, requestId })
      if (controller.signal.aborted || active !== controller) return undefined
      state.value = { phase: 'success', data, requestId, updatedAt: new Date().toISOString() }
      return data
    } catch (cause) {
      if (controller.signal.aborted || active !== controller) return undefined
      state.value = { phase: 'error', error: mapApiError(cause), requestId }
      return undefined
    } finally {
      if (active === controller) active = undefined
    }
  }

  if (getCurrentScope()) onScopeDispose(cancel)
  return { state, execute, cancel }
}

export default useAsyncAction
