import { describe, expect, it, vi } from 'vitest'

import type { P007ScheduleRecord, P007Transport } from './contracts'
import { createP007Service } from './service'
import { useP007Schedule } from './useP007Schedule'

function record(overrides: Partial<P007ScheduleRecord> = {}): P007ScheduleRecord {
  return {
    id: 'shift-1', tenantId: 'tenant-1', businessNo: 'P007-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P007-1', currentNodeCode: 'S01', status: 'DRAFT', versionNo: 1,
    businessDate: '2026-08-13', subject: '景区运营排班', reason: '依据服务端业务量制定排班',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '排班', changeAction: '制定',
    changeReason: '依据服务端业务量制定正式排班', contentVersion: 'SAFE-V1', durationHours: 8,
    startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', periodOrCourseNo: 'P007-WEEK-1',
    actualAttendanceSummary: null, resultSummary: null,
    items: [{ id: 'item-1', fieldCode: 'before_snapshot', itemSeq: 1, itemName: '变更前快照', value: { digest: 'server' }, createdAt: '2026-08-13T02:00:00Z' }],
    updatedAt: '2026-08-13T03:00:00Z', ...overrides,
  }
}

describe('P007 service and composable', () => {
  it('does not expose create through the service or public composable without a directory contract', () => {
    const service = createP007Service({ request: vi.fn() } as P007Transport)
    const process = useP007Schedule({ service, mode: 'center' })
    expect(service).not.toHaveProperty('create')
    expect(process).not.toHaveProperty('createSchedule')
  })

  it('uses the authoritative list/get URLs and forwards AbortSignal', async () => {
    const request = vi.fn().mockResolvedValueOnce([record()]).mockResolvedValueOnce([record()]).mockResolvedValueOnce(record())
    const service = createP007Service({ request } as P007Transport)
    const employeeSignal = new AbortController().signal
    const centerSignal = new AbortController().signal
    const getSignal = new AbortController().signal
    await service.list('employee', { signal: employeeSignal })
    await service.list('center', { signal: centerSignal })
    const detail = await service.get('shift-1', { signal: getSignal })
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P007/schedules', { signal: employeeSignal })
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/processes/P007/shift-changes', { signal: centerSignal })
    expect(request).toHaveBeenNthCalledWith(3, '/api/v1/processes/P007/shift-changes/shift-1', { signal: getSignal })
    expect(detail).toEqual(record())
  })

  it('forwards caller idempotency and expectedVersion to the action endpoint', async () => {
    const request = vi.fn().mockResolvedValue(record({ status: 'SUBMITTED', versionNo: 2 }))
    const signal = new AbortController().signal
    const service = createP007Service({ request } as P007Transport)
    await service.performAction('shift-1', 'SUBMIT_DEMAND', { expectedVersion: 1, reason: '提交需求' }, {
      idempotencyKey: 'p007-submit-1', signal,
    })
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P007/shift-changes/shift-1/actions/SUBMIT_DEMAND', {
      method: 'POST', body: { expectedVersion: 1, reason: '提交需求' }, idempotencyKey: 'p007-submit-1', signal,
    })
  })

  it('rejects blank idempotency and REQUEST_CHANGE before transport', async () => {
    const request = vi.fn()
    const service = createP007Service({ request } as P007Transport)
    await expect(service.performAction('shift-1', 'SUBMIT_DEMAND', { expectedVersion: 1 }, {
      idempotencyKey: ' ', signal: new AbortController().signal,
    })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    await expect(service.performAction('shift-1', 'REQUEST_CHANGE', {
      expectedVersion: 1, proposedStartAt: '2026-08-15T01:00:00Z', proposedEndAt: '2026-08-15T09:00:00Z',
      substituteEmployeeId: 'employee-2', handoverItems: ['交接任务'],
    }, { idempotencyKey: 'p007-change-1', signal: new AbortController().signal })).rejects.toThrow('DIRECTORY_CONTRACT_REQUIRED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([[403, 'forbidden'], [409, 'conflict'], [408, 'timeout']] as const)(
    'keeps backend %s as the final typed action error', async (status, kind) => {
      const service = createP007Service({ request: vi.fn().mockRejectedValue({ status }) } as P007Transport)
      const process = useP007Schedule({ service, mode: 'center' })
      await process.performAction('shift-1', 'SUBMIT_DEMAND', { expectedVersion: 1 }, `idem-${status}`)
      expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind, status } })
    },
  )

  it('suppresses repeat action and refreshes only server-sourced facts', async () => {
    let resolveAction!: (value: P007ScheduleRecord) => void
    const actionResult = new Promise<P007ScheduleRecord>(resolve => { resolveAction = resolve })
    const request = vi.fn()
      .mockResolvedValueOnce([record()])
      .mockReturnValueOnce(actionResult)
      .mockResolvedValueOnce([record({ businessNo: 'P007-LATEST', status: 'SUBMITTED', versionNo: 2 })])
    const process = useP007Schedule({ service: createP007Service({ request } as P007Transport), mode: 'center' })
    await process.refresh()
    const first = process.performAction('shift-1', 'SUBMIT_DEMAND', { expectedVersion: 1 }, 'same-key')
    const repeated = await process.performAction('shift-1', 'SUBMIT_DEMAND', { expectedVersion: 1 }, 'different-key')
    expect(repeated).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(2)
    resolveAction(record({ status: 'SUBMITTED', versionNo: 2 }))
    await first
    expect(process.records.state.value).toMatchObject({
      phase: 'success', data: [{ businessNo: 'P007-LATEST', status: 'SUBMITTED', versionNo: 2 }],
    })
  })

  it('aborts a stale list and keeps the latest server version', async () => {
    const resolvers: Array<(value: readonly P007ScheduleRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const service = createP007Service({
      request: vi.fn((_path: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal)
        return new Promise<readonly P007ScheduleRecord[]>(resolve => resolvers.push(resolve))
      }),
    } as P007Transport)
    const process = useP007Schedule({ service, mode: 'employee' })
    const stale = process.refresh()
    const latest = process.refresh()
    expect(signals[0]?.aborted).toBe(true)
    resolvers[1]?.([record({ businessNo: 'P007-LATEST', versionNo: 4 })])
    resolvers[0]?.([record({ businessNo: 'P007-STALE', versionNo: 1 })])
    await Promise.all([stale, latest])
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P007-LATEST', versionNo: 4 }] })
  })

  it('on 409 refreshes and cannot let an older list overwrite the new version', async () => {
    const listResolvers: Array<(value: readonly P007ScheduleRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const request = vi.fn((_path: string, options?: { method?: string; signal?: AbortSignal }) => {
      if (options?.method === 'POST') return Promise.reject(Object.assign(new Error('conflict'), { status: 409 }))
      if (options?.signal) signals.push(options.signal)
      return new Promise<readonly P007ScheduleRecord[]>(resolve => listResolvers.push(resolve))
    })
    const process = useP007Schedule({ service: createP007Service({ request } as P007Transport), mode: 'center' })
    const stale = process.refresh()
    const action = process.performAction('shift-1', 'SUBMIT_DEMAND', { expectedVersion: 1 }, 'conflict-key')
    await vi.waitFor(() => expect(listResolvers).toHaveLength(2))
    expect(signals[0]?.aborted).toBe(true)
    listResolvers[1]?.([record({ businessNo: 'P007-REFRESHED', versionNo: 5 })])
    listResolvers[0]?.([record({ businessNo: 'P007-OLD', versionNo: 1 })])
    await Promise.all([stale, action])
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P007-REFRESHED', versionNo: 5 }] })
  })
})
