import { useAsyncAction, useAsyncResource } from '@sgj/platform-ui'

import {
  P007_PERMISSIONS,
  type P007ActionCode, type P007ActionCommand,
  type P007ScheduleRecord, type P007Service,
} from './contracts'
import { createP007PortalService } from './service'

export interface UseP007ScheduleOptions {
  service?: P007Service
  mode: 'employee' | 'center' | 'tech'
}

function useP007Action(service: P007Service) {
  return useAsyncAction<{ id: string; code: P007ActionCode; command: P007ActionCommand }, P007ScheduleRecord>(
    ({ input, idempotencyKey, signal }) => service.performAction(input.id, input.code, input.command, { idempotencyKey, signal }),
  )
}

export function useP007Schedule(options: UseP007ScheduleOptions) {
  const service = options.service ?? createP007PortalService()
  const records = useAsyncResource<readonly P007ScheduleRecord[]>(
    ({ signal }) => service.list(options.mode, { signal }),
  )
  const action = useP007Action(service)

  async function performAction(id: string, code: P007ActionCode, command: P007ActionCommand, idempotencyKey: string) {
    const result = await action.execute({ id, code, command }, { idempotencyKey })
    if (result != null || (action.state.value.phase === 'error' && action.state.value.error?.kind === 'conflict')) await records.execute()
    return result
  }

  return {
    records, action, can: (permission: string) => service.can(permission),
    canRead: () => service.can(P007_PERMISSIONS.read) || service.can(P007_PERMISSIONS.monitor),
    canManage: () => service.can(P007_PERMISSIONS.manage),
    refresh: records.execute, performAction,
  }
}
