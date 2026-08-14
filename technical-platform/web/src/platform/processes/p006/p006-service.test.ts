import { describe, expect, it, vi } from 'vitest'

import type { P006MeetingRecord, P006Transport } from './contracts'
import { createP006Service } from './service'
import { useP006Meeting } from './useP006Meeting'

function record(overrides: Partial<P006MeetingRecord> = {}): P006MeetingRecord {
  return {
    id: 'meeting-1',
    tenantId: 'tenant-1',
    businessNo: 'P006-2026-0001',
    workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-1',
    currentNodeCode: 'S01',
    status: 'DRAFT',
    versionNo: 1,
    businessDate: '2026-08-13',
    subject: '运营协调会',
    reason: '协调景区运营事项',
    priority: '普通',
    ownerCenterId: 'center-1',
    ownerEmployeeId: 'employee-authority',
    plannedStartAt: '2026-08-14T01:00:00Z',
    startAt: '2026-08-14T01:00:00Z',
    resultSummary: null,
    officialSubject: null,
    officialContent: null,
    venueChannel: null,
    visibilityLevel: '内部',
    items: [],
    updatedAt: '2026-08-13T01:00:00Z',
    ...overrides,
  }
}

describe('P006 service and composable', () => {
  it('centralizes URL/method and forwards caller idempotency/version facts', async () => {
    const request = vi.fn().mockResolvedValue(record({ versionNo: 2, status: 'SUBMITTED' }))
    const service = createP006Service({ request } as P006Transport)
    const signal = new AbortController().signal
    await service.performAction('meeting-1', 'SUBMIT', {
      expectedVersion: 1,
      reason: '提交审议',
    }, { idempotencyKey: 'p006-action-1', signal })
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P006/meetings/meeting-1/actions/SUBMIT', {
      method: 'POST',
      body: { expectedVersion: 1, reason: '提交审议' },
      idempotencyKey: 'p006-action-1',
      signal,
    })
  })

  it('maps every server record field and forwards AbortSignal for list and get', async () => {
    const serverRecord = record({
      ownerCenterId: 'center-authority',
      plannedStartAt: '2026-08-15T01:00:00Z',
      updatedAt: '2026-08-13T05:00:00Z',
      items: [{
        id: 'item-1', fieldCode: 'execution_evidence', itemSeq: 3, itemKey: 'E-3',
        itemName: '执行证据', value: { digest: 'sha256-authority' }, createdAt: '2026-08-13T04:00:00Z',
      }],
    })
    const request = vi.fn().mockResolvedValueOnce([serverRecord]).mockResolvedValueOnce(serverRecord)
    const service = createP006Service({ request } as P006Transport)
    const listSignal = new AbortController().signal
    const getSignal = new AbortController().signal
    const listed = await service.list('tech', { signal: listSignal })
    const detail = await service.get('meeting-1', { signal: getSignal })
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P006/meetings', { signal: listSignal })
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/processes/P006/meetings/meeting-1', { signal: getSignal })
    expect(listed[0]).toEqual(serverRecord)
    expect(detail).toEqual(serverRecord)
    expect(detail.items[0]).toMatchObject({ itemSeq: 3, itemKey: 'E-3', value: { digest: 'sha256-authority' } })
  })

  it('rejects blank idempotency and blocked action-owner payloads before transport', async () => {
    const request = vi.fn()
    const service = createP006Service({ request } as P006Transport)
    await expect(service.performAction('meeting-1', 'SUBMIT', { expectedVersion: 1 }, {
      idempotencyKey: ' ', signal: new AbortController().signal,
    })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    await expect(service.performAction('meeting-1', 'GENERATE_ACTIONS', {
      expectedVersion: 1,
      actionItems: [{ itemKey: 'A', itemName: '整改', ownerEmployeeId: '', plannedStartAt: '2026-08-14T01:00:00Z', plannedFinishAt: '2026-08-15T01:00:00Z' }],
    }, { idempotencyKey: 'p006-action-2', signal: new AbortController().signal })).rejects.toThrow('DIRECTORY_CONTRACT_REQUIRED')
    expect(request).not.toHaveBeenCalled()
  })

  it.each([
    [403, 'forbidden'],
    [409, 'conflict'],
    [408, 'timeout'],
  ] as const)('keeps backend %s as the final typed action error', async (status, kind) => {
    const service = createP006Service({ request: vi.fn().mockRejectedValue({ status }) } as P006Transport)
    const process = useP006Meeting({ service, mode: 'employee' })
    await process.performAction('meeting-1', 'SUBMIT', { expectedVersion: 1 }, `idem-${status}`)
    expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind, status } })
  })

  it('suppresses repeat click and refreshes from server-sourced business facts', async () => {
    let resolveAction!: (value: P006MeetingRecord) => void
    const actionResult = new Promise<P006MeetingRecord>((resolve) => { resolveAction = resolve })
    const request = vi.fn()
      .mockResolvedValueOnce([record()])
      .mockReturnValueOnce(actionResult)
      .mockResolvedValueOnce([record({ businessNo: 'P006-2026-0099', status: 'SUBMITTED', versionNo: 2 })])
    const process = useP006Meeting({ service: createP006Service({ request } as P006Transport), mode: 'employee' })
    await process.refresh()
    const first = process.performAction('meeting-1', 'SUBMIT', { expectedVersion: 1 }, 'same-action-key')
    const repeated = await process.performAction('meeting-1', 'SUBMIT', { expectedVersion: 1 }, 'another-key')
    expect(repeated).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(2)
    resolveAction(record({ status: 'SUBMITTED', versionNo: 2 }))
    await first
    expect(request).toHaveBeenCalledTimes(3)
    expect(process.records.state.value).toMatchObject({
      phase: 'success',
      data: [{ businessNo: 'P006-2026-0099', status: 'SUBMITTED', versionNo: 2 }],
    })
  })

  it('aborts a stale list and keeps only the latest server version', async () => {
    const resolvers: Array<(value: readonly P006MeetingRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const service = createP006Service({
      request: vi.fn((_path: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal)
        return new Promise<readonly P006MeetingRecord[]>((resolve) => resolvers.push(resolve))
      }),
    } as P006Transport)
    const process = useP006Meeting({ service, mode: 'employee' })
    const stale = process.refresh()
    const latest = process.refresh()
    expect(signals[0]?.aborted).toBe(true)
    resolvers[1]?.([record({ businessNo: 'P006-LATEST', status: 'SUBMITTED', versionNo: 4 })])
    resolvers[0]?.([record({ businessNo: 'P006-STALE', status: 'DRAFT', versionNo: 1 })])
    await Promise.all([stale, latest])
    expect(process.records.state.value).toMatchObject({
      phase: 'success', data: [{ businessNo: 'P006-LATEST', status: 'SUBMITTED', versionNo: 4 }],
    })
  })

  it('on 409 aborts an older refresh and cannot let its stale version replace the refreshed record', async () => {
    const listResolvers: Array<(value: readonly P006MeetingRecord[]) => void> = []
    const listSignals: AbortSignal[] = []
    const request = vi.fn((path: string, options?: { method?: string; signal?: AbortSignal }) => {
      if (options?.method === 'POST') return Promise.reject(Object.assign(new Error('version conflict'), { status: 409 }))
      expect(path).toBe('/api/v1/processes/P006/meetings')
      if (options?.signal) listSignals.push(options.signal)
      return new Promise<readonly P006MeetingRecord[]>((resolve) => listResolvers.push(resolve))
    })
    const process = useP006Meeting({ service: createP006Service({ request } as P006Transport), mode: 'employee' })
    const staleRefresh = process.refresh()
    const action = process.performAction('meeting-1', 'SUBMIT', { expectedVersion: 1 }, 'conflict-key')
    await vi.waitFor(() => expect(listResolvers).toHaveLength(2))
    expect(listSignals[0]?.aborted).toBe(true)
    listResolvers[1]?.([record({ businessNo: 'P006-REFRESHED', status: 'SUBMITTED', versionNo: 5 })])
    listResolvers[0]?.([record({ businessNo: 'P006-OLD', status: 'DRAFT', versionNo: 1 })])
    await Promise.all([staleRefresh, action])
    expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind: 'conflict', status: 409 } })
    expect(process.records.state.value).toMatchObject({
      phase: 'success', data: [{ businessNo: 'P006-REFRESHED', status: 'SUBMITTED', versionNo: 5 }],
    })
  })
})
