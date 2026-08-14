import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'

import type {
  MonitorProjectionData,
  MonitorProjectionResource,
  MonitorService,
} from '../../../../contracts'
import { type AsyncState, idleState } from '../async/async-state'
import { mapApiError } from '../errors/map-api-error'
import { createMonitorPortalService } from './monitor-service'

type ProjectionResult = PromiseSettledResult<readonly import('../../../../contracts').MonitorProjection[]>

function stateFromResults(
  p004: ProjectionResult,
  p005: ProjectionResult,
  requestId: string,
): AsyncState<MonitorProjectionData> {
  const missingResources = [p004.status === 'rejected' ? 'P004' : null, p005.status === 'rejected' ? 'P005' : null]
    .filter((value): value is string => value !== null)
  if (p004.status === 'rejected' && p005.status === 'rejected') {
    return { phase: 'error', error: mapApiError(p004.reason), requestId, missingResources }
  }
  const data = {
    p004: p004.status === 'fulfilled' ? p004.value : [],
    p005: p005.status === 'fulfilled' ? p005.value : [],
  }
  const rejected = p004.status === 'rejected' ? p004 : p005.status === 'rejected' ? p005 : undefined
  return rejected
    ? { phase: 'partial', data, error: mapApiError(rejected.reason), requestId, missingResources, updatedAt: new Date().toISOString() }
    : { phase: 'success', data, requestId, updatedAt: new Date().toISOString() }
}

export function useMonitorProjection(service: MonitorService = createMonitorPortalService()): MonitorProjectionResource {
  const state = ref<AsyncState<MonitorProjectionData>>(idleState()) as Ref<AsyncState<MonitorProjectionData>>
  let sequence = 0
  let active: AbortController | undefined
  const stale = (controller: AbortController) => controller.signal.aborted || active !== controller

  function cancel(): void {
    active?.abort()
    active = undefined
    if (state.value.phase === 'loading') state.value = { phase: 'cancelled', requestId: state.value.requestId }
  }

  async function refresh(): Promise<MonitorProjectionData | undefined> {
    active?.abort()
    const controller = new AbortController()
    active = controller
    const requestId = `monitor-${++sequence}`
    state.value = { phase: 'loading', requestId }
    const [p004, p005] = await Promise.allSettled([
      service.listP004({ signal: controller.signal }),
      service.listP005({ signal: controller.signal }),
    ])
    if (stale(controller)) return undefined
    state.value = stateFromResults(p004, p005, requestId)
    active = undefined
    return state.value.data
  }

  if (getCurrentScope()) onScopeDispose(cancel)
  return { state, refresh, cancel }
}
