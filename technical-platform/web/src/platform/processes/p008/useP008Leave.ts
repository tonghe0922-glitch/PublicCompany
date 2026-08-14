import { useAsyncAction, useAsyncResource } from '@sgj/platform-ui'

import {
  P008_PERMISSIONS,
  type P008ActionCode,
  type P008ActionCommand,
  type P008CreateLeaveInput,
  type P008LeaveRecord,
  type P008QuotaEntry,
  type P008Service,
} from './contracts'
import { createP008PortalService } from './service'

export interface UseP008LeaveOptions {
  service?: P008Service
  mode: 'employee' | 'center' | 'tech'
}

function useP008Action(service: P008Service) {
  return useAsyncAction<{ id: string; code: P008ActionCode; command: P008ActionCommand }, P008LeaveRecord>(
    ({ input, idempotencyKey, signal }) => service.performAction(input.id, input.code, input.command, { idempotencyKey, signal }),
  )
}

export function useP008Leave(options: UseP008LeaveOptions) {
  const service = options.service ?? createP008PortalService()
  const records = useAsyncResource<readonly P008LeaveRecord[]>(({ signal }) => service.list(options.mode, { signal }))
  const quota = useAsyncResource<readonly P008QuotaEntry[]>(({ signal }) => service.quotaLedger(options.mode, { signal }))
  const creation = useAsyncAction<P008CreateLeaveInput, P008LeaveRecord>(
    ({ input, idempotencyKey, signal }) => service.create(input, { idempotencyKey, signal }),
  )
  const action = useP008Action(service)

  async function refresh() {
    const [recordResult] = await Promise.all([records.execute(), quota.execute()])
    return recordResult
  }

  async function createLeave(input: P008CreateLeaveInput, idempotencyKey: string) {
    const result = await creation.execute(input, { idempotencyKey })
    if (result != null) await refresh()
    return result
  }

  async function performAction(id: string, code: P008ActionCode, command: P008ActionCommand, idempotencyKey: string) {
    const result = await action.execute({ id, code, command }, { idempotencyKey })
    if (result != null || (action.state.value.phase === 'error' && action.state.value.error?.kind === 'conflict')) await refresh()
    return result
  }

  return {
    records, quota, creation, action,
    can: (permission: string) => service.can(permission),
    canRead: () => service.can(P008_PERMISSIONS.read) || service.can(P008_PERMISSIONS.monitor),
    canCreate: () => service.can(P008_PERMISSIONS.submit),
    refresh, createLeave, performAction,
  }
}
