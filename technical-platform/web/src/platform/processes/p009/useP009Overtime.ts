import { useAsyncAction, useAsyncResource } from '@sgj/platform-ui'

import {
  P009_PERMISSIONS,
  type P009ActionCode,
  type P009ActionCommand,
  type P009CreateOvertimeInput,
  type P009OvertimeRecord,
  type P009Service,
} from './contracts'
import { createP009PortalService } from './service'

export interface UseP009OvertimeOptions {
  service?: P009Service
  mode: 'employee' | 'center' | 'tech'
}

function useP009Action(service: P009Service) {
  return useAsyncAction<{ id: string; code: P009ActionCode; command: P009ActionCommand }, P009OvertimeRecord>(
    ({ input, idempotencyKey, signal }) => service.performAction(input.id, input.code, input.command, { idempotencyKey, signal }),
  )
}

export function useP009Overtime(options: UseP009OvertimeOptions) {
  const service = options.service ?? createP009PortalService()
  const records = useAsyncResource<readonly P009OvertimeRecord[]>(({ signal }) => service.list(options.mode, { signal }))
  const creation = useAsyncAction<P009CreateOvertimeInput, P009OvertimeRecord>(
    ({ input, idempotencyKey, signal }) => service.create(input, { idempotencyKey, signal }),
  )
  const action = useP009Action(service)

  async function refresh() {
    return records.execute()
  }

  async function createOvertime(input: P009CreateOvertimeInput, idempotencyKey: string) {
    const result = await creation.execute(input, { idempotencyKey })
    if (result != null) await refresh()
    return result
  }

  async function performAction(id: string, code: P009ActionCode, command: P009ActionCommand, idempotencyKey: string) {
    const result = await action.execute({ id, code, command }, { idempotencyKey })
    if (result != null || (action.state.value.phase === 'error' && action.state.value.error?.kind === 'conflict')) await refresh()
    return result
  }

  return {
    records, creation, action,
    can: (permission: string) => service.can(permission),
    canRead: () => service.can(P009_PERMISSIONS.read) || service.can(P009_PERMISSIONS.monitor),
    canCreate: () => service.can(P009_PERMISSIONS.submit),
    refresh, createOvertime, performAction,
  }
}
