import { describe, expect, it, vi } from 'vitest'

import type {
  P009CreateOvertimeInput,
  P009OvertimeRecord,
  P009Transport,
} from './contracts'
import { createP009Service } from './service'
import { useP009Overtime } from './useP009Overtime'

function record(overrides: Partial<P009OvertimeRecord> = {}): P009OvertimeRecord {
  return {
    id: 'overtime-1', tenantId: 'tenant-1', businessNo: 'P009-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P009-1', currentNodeCode: 'S01', status: '事前申请/紧急事实登记', versionNo: 1,
    businessDate: '2026-08-14', subject: '员工加班事实申请', reason: '按照实际任务安排提交加班事实与审批申请',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', attendanceType: '工作日加班', emergency: false,
    durationHours: 2, startAt: '2026-08-15T10:00:00Z', endAt: '2026-08-15T12:00:00Z',
    actualStartAt: null, actualEndAt: null, actualAttendanceSummary: null, resultSummary: null,
    schemeType: null, receiptReference: null, actualAmount: null,
    items: [{ id: 'item-1', fieldCode: 'labor_attendance_fact', itemSeq: 1, itemName: '劳动事实', value: { digest: 'server' }, createdAt: '2026-08-14T02:00:00Z' }],
    updatedAt: '2026-08-14T03:00:00Z', ...overrides,
  }
}

function createInput(): P009CreateOvertimeInput {
  return {
    businessDate: '2026-08-14', subject: '员工加班事实申请', reason: '按照实际任务安排提交加班事实与审批申请',
    attendanceType: '工作日加班', emergency: false, startAt: '2026-08-15T10:00:00Z',
    endAt: '2026-08-15T12:00:00Z', emergencyEvidence: null,
  }
}

describe('P009 service and composable', () => {
  it('uses exact list and get URLs and forwards AbortSignal', async () => {
    const request = vi.fn().mockResolvedValueOnce([record()]).mockResolvedValueOnce(record())
    const service = createP009Service({ request } as P009Transport)
    const listSignal = new AbortController().signal
    const getSignal = new AbortController().signal
    const listed = await service.list('employee', { signal: listSignal })
    const detail = await service.get('overtime-1', { signal: getSignal })
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P009/overtime-requests', { signal: listSignal })
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/processes/P009/overtime-requests/overtime-1', { signal: getSignal })
    expect(listed[0]).toEqual(record())
    expect(detail.items[0]).toMatchObject({ itemSeq: 1, value: { digest: 'server' } })
  })

  it('creates self-owned overtime with caller idempotency and complete input', async () => {
    const request = vi.fn().mockResolvedValue(record())
    const service = createP009Service({ request } as P009Transport)
    const signal = new AbortController().signal
    await service.create(createInput(), { idempotencyKey: 'p009-create-1', signal })
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P009/overtime-requests', {
      method: 'POST', body: createInput(), idempotencyKey: 'p009-create-1', signal,
    })
  })

  it('rejects blank caller idempotency before create or action transport', async () => {
    const request = vi.fn()
    const service = createP009Service({ request } as P009Transport)
    const signal = new AbortController().signal
    await expect(service.create(createInput(), { idempotencyKey: ' ', signal })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    await expect(service.performAction('overtime-1', 'SUBMIT', { expectedVersion: 1 }, {
      idempotencyKey: '', signal,
    })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    expect(request).not.toHaveBeenCalled()
  })

  it('forwards expectedVersion, compensation receipt fields and caller idempotency to exact action URL', async () => {
    const request = vi.fn().mockResolvedValue(record({ currentNodeCode: 'S09', status: '归档', versionNo: 9 }))
    const signal = new AbortController().signal
    const service = createP009Service({ request } as P009Transport)
    const command = {
      expectedVersion: 8, externalReference: 'PAY-EXT-009', externallyDeterminedAmount: 125.5,
      evidence: { note: '外部薪酬回执', recordedAt: '2026-08-14T04:00:00Z' },
    }
    await service.performAction('overtime-1', 'RECORD_RECEIPT', command, { idempotencyKey: 'p009-receipt-1', signal })
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P009/overtime-requests/overtime-1/actions/RECORD_RECEIPT', {
      method: 'POST', body: command, idempotencyKey: 'p009-receipt-1', signal,
    })
  })

  it('maps every server record field and item without fabricating reveal authority', async () => {
    const source = record({ schemeType: 'PAYROLL', receiptReference: 'PAY-EXT-009', actualAmount: 125.5 })
    const service = createP009Service({ request: vi.fn().mockResolvedValue(source) } as P009Transport)
    const result = await service.get('overtime-1', { signal: new AbortController().signal })
    expect(result).toEqual(source)
    expect(result).not.toHaveProperty('revealed')
    expect(result).not.toHaveProperty('stepUpSatisfied')
    expect(result).not.toHaveProperty('allowedActions')
  })

  it.each([[403, 'forbidden'], [409, 'conflict'], [408, 'timeout']] as const)(
    'keeps backend %s as the final typed action error', async (status, kind) => {
      const service = createP009Service({ request: vi.fn().mockRejectedValue({ status }) } as P009Transport)
      const process = useP009Overtime({ service, mode: 'employee' })
      await process.performAction('overtime-1', 'SUBMIT', { expectedVersion: 1 }, `idem-${status}`)
      expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind, status } })
    },
  )

  it('keeps records, creation and action states independent without global busy', async () => {
    const resolvers: Array<(value: unknown) => void> = []
    const request = vi.fn(() => {
      if (resolvers.length >= 2) return Promise.resolve([])
      return new Promise(resolve => resolvers.push(resolve))
    })
    const process = useP009Overtime({ service: createP009Service({ request } as P009Transport), mode: 'employee' })
    const refresh = process.refresh()
    const creation = process.createOvertime(createInput(), 'p009-create-independent')
    expect(process.records.state.value.phase).toBe('loading')
    expect(process.creation.state.value.phase).toBe('loading')
    expect(process.action.state.value.phase).toBe('idle')
    resolvers[0]?.([])
    resolvers[1]?.(record())
    await Promise.all([refresh, creation])
  })

  it('suppresses repeat action and refreshes server facts after success', async () => {
    let resolveAction!: (value: P009OvertimeRecord) => void
    const actionResult = new Promise<P009OvertimeRecord>(resolve => { resolveAction = resolve })
    const request = vi.fn().mockResolvedValueOnce([record()]).mockReturnValueOnce(actionResult)
      .mockResolvedValueOnce([record({ businessNo: 'P009-LATEST', currentNodeCode: 'S02', versionNo: 2 })])
    const process = useP009Overtime({ service: createP009Service({ request } as P009Transport), mode: 'employee' })
    await process.refresh()
    const first = process.performAction('overtime-1', 'SUBMIT', { expectedVersion: 1 }, 'same-key')
    const repeated = await process.performAction('overtime-1', 'SUBMIT', { expectedVersion: 1 }, 'different-key')
    expect(repeated).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(2)
    resolveAction(record({ currentNodeCode: 'S02', versionNo: 2 }))
    await first
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P009-LATEST', versionNo: 2 }] })
  })

  it('aborts stale record loads and keeps only latest server facts', async () => {
    const resolvers: Array<(value: readonly P009OvertimeRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const service = createP009Service({
      request: vi.fn((_path: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal)
        return new Promise<readonly P009OvertimeRecord[]>(resolve => resolvers.push(resolve))
      }),
    } as P009Transport)
    const process = useP009Overtime({ service, mode: 'employee' })
    const stale = process.refresh()
    const latest = process.refresh()
    expect(signals[0]?.aborted).toBe(true)
    resolvers[1]?.([record({ businessNo: 'P009-LATEST', versionNo: 4 })])
    resolvers[0]?.([record({ businessNo: 'P009-STALE', versionNo: 1 })])
    await Promise.all([stale, latest])
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P009-LATEST', versionNo: 4 }] })
  })

  it('on 409 refreshes and cannot let an older list overwrite the new version', async () => {
    const listResolvers: Array<(value: readonly P009OvertimeRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const request = vi.fn((_path: string, options?: { method?: string; signal?: AbortSignal }) => {
      if (options?.method === 'POST') return Promise.reject(Object.assign(new Error('conflict'), { status: 409 }))
      if (options?.signal) signals.push(options.signal)
      return new Promise<readonly P009OvertimeRecord[]>(resolve => listResolvers.push(resolve))
    })
    const process = useP009Overtime({ service: createP009Service({ request } as P009Transport), mode: 'center' })
    const stale = process.refresh()
    const action = process.performAction('overtime-1', 'VALIDATE', { expectedVersion: 1 }, 'conflict-key')
    await vi.waitFor(() => expect(listResolvers).toHaveLength(2))
    expect(signals[0]?.aborted).toBe(true)
    listResolvers[1]?.([record({ businessNo: 'P009-REFRESHED', versionNo: 5 })])
    listResolvers[0]?.([record({ businessNo: 'P009-OLD', versionNo: 1 })])
    await Promise.all([stale, action])
    expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind: 'conflict', status: 409 } })
    expect(process.records.state.value).toMatchObject({ phase: 'success', data: [{ businessNo: 'P009-REFRESHED', versionNo: 5 }] })
  })
})
