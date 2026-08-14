import { useAsyncAction, useAsyncResource } from '@sgj/platform-ui'

import {
  P010_PERMISSIONS,
  type P010ActionCode,
  type P010ActionCommand,
  type P010LearningRecord,
  type P010Service,
} from './contracts'
import { createP010PortalService } from './service'

export interface UseP010LearningOptions {
  service?: P010Service
  mode: 'employee' | 'center' | 'tech'
}

function useP010Action(service: P010Service) {
  return useAsyncAction<{ id: string; code: P010ActionCode; command: P010ActionCommand }, P010LearningRecord>(
    ({ input, idempotencyKey, signal }) => service.performAction(input.id, input.code, input.command, {
      idempotencyKey, signal,
    }),
  )
}

export function useP010Learning(options: UseP010LearningOptions) {
  const service = options.service ?? createP010PortalService()
  const records = useAsyncResource<readonly P010LearningRecord[]>(({ signal }) => service.list(options.mode, { signal }))
  const action = useP010Action(service)

  async function refresh() {
    return records.execute()
  }

  async function performAction(
    id: string,
    code: P010ActionCode,
    command: P010ActionCommand,
    idempotencyKey: string,
  ) {
    const result = await action.execute({ id, code, command }, { idempotencyKey })
    if (result != null || (action.state.value.phase === 'error' && action.state.value.error?.kind === 'conflict')) {
      await refresh()
    }
    return result
  }

  return {
    records, action,
    can: (permission: string) => service.can(permission),
    canRead: () => service.can(P010_PERMISSIONS.read) || service.can(P010_PERMISSIONS.monitor),
    refresh, performAction,
  }
}
