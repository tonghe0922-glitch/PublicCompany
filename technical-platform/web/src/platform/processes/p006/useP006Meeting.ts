import { useAsyncAction, useAsyncResource } from '@sgj/platform-ui'

import {
  P006_PERMISSIONS,
  classifyP006CreationError,
  type P006ActionCode,
  type P006ActionCommand,
  type P006CreateMeetingInput,
  type P006MeetingRecord,
  type P006Service,
} from './contracts'
import { createP006PortalService } from './service'

export interface UseP006MeetingOptions {
  service?: P006Service
  mode: 'employee' | 'center' | 'tech'
}

function canRead(service: P006Service): boolean {
  return service.can(P006_PERMISSIONS.read) || service.can(P006_PERMISSIONS.monitor)
}

function canCreate(service: P006Service): boolean {
  return service.can(P006_PERMISSIONS.create)
}

function canCorrectCreation(error: Parameters<typeof classifyP006CreationError>[0]): boolean {
  return classifyP006CreationError(error) === 'validation'
}

function canRetryCreation(error: Parameters<typeof classifyP006CreationError>[0]): boolean {
  return classifyP006CreationError(error) === 'retryable'
}

function useP006Action(service: P006Service) {
  return useAsyncAction<{
    id: string
    code: P006ActionCode
    command: P006ActionCommand
  }, P006MeetingRecord>(
    ({ input, idempotencyKey, signal }) => service.performAction(input.id, input.code, input.command, { idempotencyKey, signal }),
  )
}

export function useP006Meeting(options: UseP006MeetingOptions) {
  const service = options.service ?? createP006PortalService()
  const records = useAsyncResource<readonly P006MeetingRecord[]>(
    ({ signal }) => service.list(options.mode, { signal }),
  )
  const creation = useAsyncAction<P006CreateMeetingInput, P006MeetingRecord>(
    ({ input, idempotencyKey, signal }) => service.create(input, { idempotencyKey, signal }),
  )
  const action = useP006Action(service)
  async function createMeeting(input: P006CreateMeetingInput, idempotencyKey: string) {
    const result = await creation.execute(input, { idempotencyKey })
    if (result != null) await records.execute()
    return result
  }
  async function performAction(id: string, code: P006ActionCode, command: P006ActionCommand, idempotencyKey: string) {
    const result = await action.execute({ id, code, command }, { idempotencyKey })
    const actionState = action.state.value
    if (result != null || (actionState.phase === 'error' && actionState.error?.kind === 'conflict')) {
      await records.execute()
    }
    return result
  }
  return {
    records,
    creation,
    action,
    can: (permission: string) => service.can(permission),
    canRead: () => canRead(service),
    canCreate: () => canCreate(service),
    canCorrectCreation: () => canCorrectCreation(creation.state.value.error),
    canRetryCreation: () => canRetryCreation(creation.state.value.error),
    refresh: records.execute,
    createMeeting,
    performAction,
  }
}
