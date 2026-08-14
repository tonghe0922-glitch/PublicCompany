import { describe, expect, it, vi } from 'vitest'

import type {
  P008CreateLeaveInput,
  P008LeaveRecord,
  P008QuotaEntry,
  P008Transport,
} from './contracts'
import { createP008Service } from './service'
import { useP008Leave } from './useP008Leave'

function record(overrides: Partial<P008LeaveRecord> = {}): P008LeaveRecord {
  return {
    id: 'leave-1', tenantId: 'tenant-1', businessNo: 'P008-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P008-1', currentNodeCode: 'S01', status: '请假申请', versionNo: 1,
    businessDate: '2026-08-13', subject: '员工年度休假申请', reason: '按照年度计划申请休假并完成工作安排',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '年假', changeAction: 'APPLY',
    changeReason: '按照年度计划申请休假并完成工作安排', durationHours: 8,
    startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z', handoverAgentId: null,
    quotaAccountId: 'ANNUAL', quotaAmount: 8, actualEndAt: null, actualAttendanceSummary: null,
    items: [{ id: 'item-1', fieldCode: 'handover_items', itemSeq: 1, itemName: '交接事项', value: { digest: 'server' }, createdAt: '2026-08-13T02:00:00Z' }],
    updatedAt: '2026-08-13T03:00:00Z', ...overrides,
  }
}

function quota(overrides: Partial<P008QuotaEntry> = {}): P008QuotaEntry {
  return {
    id: 'quota-1', employeeId: 'employee-1', ownerCenterId: 'center-1', quotaAccountId: 'ANNUAL',
    leaveRequestId: 'leave-1', entryType: 'RESERVE', availableDelta: -8, reservedDelta: 8, consumedDelta: 0,
    availableAfter: 72, reservedAfter: 8, consumedAfter: 0, reason: '额度预占', createdAt: '2026-08-13T04:00:00Z',
    ...overrides,
  }
}

function createInput(): P008CreateLeaveInput {
  return {
    businessDate: '2026-08-13', subject: '员工年度休假申请', reason: '按照年度计划申请休假并完成工作安排',
    attendanceType: '年假', quotaAccountId: 'ANNUAL', handoverAgentId: null,
    startAt: '2026-08-14T01:00:00Z', endAt: '2026-08-14T09:00:00Z',
  }
}

describe('P008 service and composable', () => {
  it('uses exact list, get and quota-ledger URLs and forwards AbortSignal', async () => {
    const request = vi.fn().mockResolvedValueOnce([record()]).mockResolvedValueOnce(record()).mockResolvedValueOnce([quota()])
    const service = createP008Service({ request } as P008Transport)
    const listSignal = new AbortController().signal
    const getSignal = new AbortController().signal
    const quotaSignal = new AbortController().signal
    const listed = await service.list('employee', { signal: listSignal })
    const detail = await service.get('leave-1', { signal: getSignal })
    const ledger = await service.quotaLedger('center', { signal: quotaSignal })
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P008/leaves', { signal: listSignal })
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/processes/P008/leaves/leave-1', { signal: getSignal })
    expect(request).toHaveBeenNthCalledWith(3, '/api/v1/processes/P008/quota-ledger', { signal: quotaSignal })
    expect(listed[0]).toEqual(record())
    expect(detail.items[0]).toMatchObject({ itemSeq: 1, value: { digest: 'server' } })
    expect(ledger[0]).toEqual(quota())
  })

  it('creates only the null handover path with caller idempotency and AbortSignal', async () => {
    const request = vi.fn().mockResolvedValue(record())
    const service = createP008Service({ request } as P008Transport)
    const signal = new AbortController().signal
    await service.create(createInput(), { idempotencyKey: 'p008-create-1', signal })
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P008/leaves', {
      method: 'POST', body: createInput(), idempotencyKey: 'p008-create-1', signal,
    })
  })

  it('rejects non-null handover and blank caller idempotency before transport', async () => {
    const request = vi.fn()
    const service = createP008Service({ request } as P008Transport)
    const unsafe = { ...createInput(), handoverAgentId: 'employee-2' } as unknown as P008CreateLeaveInput
    await expect(service.create(unsafe, {
      idempotencyKey: 'p008-create-unsafe', signal: new AbortController().signal,
    })).rejects.toThrow('DIRECTORY_CONTRACT_REQUIRED')
    await expect(service.create(createInput(), {
      idempotencyKey: ' ', signal: new AbortController().signal,
    })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    expect(request).not.toHaveBeenCalled()
  })

  it('forwards expectedVersion and caller idempotency to the exact action URL', async () => {
    const request = vi.fn().mockResolvedValue(record({ status: '额度预占', versionNo: 2 }))
    const signal = new AbortController().signal
    const service = createP008Service({ request } as P008Transport)
    await service.performAction('leave-1', 'RESERVE', { expectedVersion: 1, reason: '额度预占' }, {
      idempotencyKey: 'p008-reserve-1', signal,
    })
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P008/leaves/leave-1/actions/RESERVE', {
      method: 'POST', body: { expectedVersion: 1, reason: '额度预占' }, idempotencyKey: 'p008-reserve-1', signal,
    })
  })

  it.each([[403, 'forbidden'], [409, 'conflict'], [408, 'timeout']] as const)(
    'keeps backend %s as the final typed action error', async (status, kind) => {
      const service = createP008Service({ request: vi.fn().mockRejectedValue({ status }) } as P008Transport)
      const process = useP008Leave({ service, mode: 'employee' })
      await process.performAction('leave-1', 'SUBMIT', { expectedVersion: 1 }, `idem-${status}`)
      expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind, status } })
    },
  )

  it('keeps record, quota, creation and action states independent without global busy', async () => {
    const resolvers: Array<(value: unknown) => void> = []
    const request = vi.fn(() => {
      if (resolvers.length >= 3) return Promise.resolve([])
      return new Promise(resolve => resolvers.push(resolve))
    })
    const process = useP008Leave({ service: createP008Service({ request } as P008Transport), mode: 'employee' })
    const refresh = process.refresh()
    const creation = process.createLeave(createInput(), 'p008-create-independent')
    expect(process.records.state.value.phase).toBe('loading')
    expect(process.quota.state.value.phase).toBe('loading')
    expect(process.creation.state.value.phase).toBe('loading')
    expect(process.action.state.value.phase).toBe('idle')
    resolvers[0]?.([])
    resolvers[1]?.([])
    resolvers[2]?.(record())
    await Promise.all([refresh, creation])
  })

  it('suppresses repeat action and refreshes record and quota server facts', async () => {
    let resolveAction!: (value: P008LeaveRecord) => void
    const actionResult = new Promise<P008LeaveRecord>(resolve => { resolveAction = resolve })
    const request = vi.fn()
      .mockResolvedValueOnce([record()]).mockResolvedValueOnce([quota()])
      .mockReturnValueOnce(actionResult)
      .mockResolvedValueOnce([record({ businessNo: 'P008-LATEST', status: '额度预占', versionNo: 2 })])
      .mockResolvedValueOnce([quota({ availableAfter: 64, reservedAfter: 16 })])
    const process = useP008Leave({ service: createP008Service({ request } as P008Transport), mode: 'employee' })
    await process.refresh()
    const first = process.performAction('leave-1', 'RESERVE', { expectedVersion: 1 }, 'same-key')
    const repeated = await process.performAction('leave-1', 'RESERVE', { expectedVersion: 1 }, 'different-key')
    expect(repeated).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(3)
    resolveAction(record({ status: '额度预占', versionNo: 2 }))
    await first
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P008-LATEST', versionNo: 2 }] })
    expect(process.quota.state.value).toMatchObject({ phase: 'success', data: [{ availableAfter: 64, reservedAfter: 16 }] })
  })

  it('aborts stale record and quota loads and keeps only latest server facts', async () => {
    const recordResolvers: Array<(value: readonly P008LeaveRecord[]) => void> = []
    const quotaResolvers: Array<(value: readonly P008QuotaEntry[]) => void> = []
    const recordSignals: AbortSignal[] = []
    const quotaSignals: AbortSignal[] = []
    const service = createP008Service({
      request: vi.fn((path: string, options?: { signal?: AbortSignal }) => {
        if (path.endsWith('quota-ledger')) {
          if (options?.signal) quotaSignals.push(options.signal)
          return new Promise<readonly P008QuotaEntry[]>(resolve => quotaResolvers.push(resolve))
        }
        if (options?.signal) recordSignals.push(options.signal)
        return new Promise<readonly P008LeaveRecord[]>(resolve => recordResolvers.push(resolve))
      }),
    } as P008Transport)
    const process = useP008Leave({ service, mode: 'employee' })
    const stale = process.refresh()
    const latest = process.refresh()
    expect(recordSignals[0]?.aborted).toBe(true)
    expect(quotaSignals[0]?.aborted).toBe(true)
    recordResolvers[1]?.([record({ businessNo: 'P008-LATEST', versionNo: 4 })])
    quotaResolvers[1]?.([quota({ availableAfter: 60 })])
    recordResolvers[0]?.([record({ businessNo: 'P008-STALE', versionNo: 1 })])
    quotaResolvers[0]?.([quota({ availableAfter: 1 })])
    await Promise.all([stale, latest])
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P008-LATEST', versionNo: 4 }] })
    expect(process.quota.state.value).toMatchObject({ phase: 'success', data: [{ availableAfter: 60 }] })
  })

  it('on 409 refreshes and cannot let an older list overwrite the new version', async () => {
    const listResolvers: Array<(value: readonly P008LeaveRecord[]) => void> = []
    const quotaResolvers: Array<(value: readonly P008QuotaEntry[]) => void> = []
    const listSignals: AbortSignal[] = []
    const request = vi.fn((path: string, options?: { method?: string; signal?: AbortSignal }) => {
      if (options?.method === 'POST') return Promise.reject(Object.assign(new Error('conflict'), { status: 409 }))
      if (path.endsWith('quota-ledger')) return new Promise<readonly P008QuotaEntry[]>(resolve => quotaResolvers.push(resolve))
      if (options?.signal) listSignals.push(options.signal)
      return new Promise<readonly P008LeaveRecord[]>(resolve => listResolvers.push(resolve))
    })
    const process = useP008Leave({ service: createP008Service({ request } as P008Transport), mode: 'center' })
    const stale = process.refresh()
    const action = process.performAction('leave-1', 'RESERVE', { expectedVersion: 1 }, 'conflict-key')
    await vi.waitFor(() => expect(listResolvers).toHaveLength(2))
    expect(listSignals[0]?.aborted).toBe(true)
    listResolvers[1]?.([record({ businessNo: 'P008-REFRESHED', versionNo: 5 })])
    quotaResolvers[1]?.([quota({ availableAfter: 55 })])
    listResolvers[0]?.([record({ businessNo: 'P008-OLD', versionNo: 1 })])
    quotaResolvers[0]?.([quota({ availableAfter: 1 })])
    await Promise.all([stale, action])
    expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind: 'conflict', status: 409 } })
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P008-REFRESHED', versionNo: 5 }] })
    expect(process.quota.state.value).toMatchObject({ phase: 'success', data: [{ availableAfter: 55 }] })
  })
})
