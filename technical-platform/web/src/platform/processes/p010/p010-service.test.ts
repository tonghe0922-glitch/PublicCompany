import { describe, expect, it, vi } from 'vitest'

import type { P010LearningRecord, P010Transport } from './contracts'
import { createP010Service } from './service'
import { useP010Learning } from './useP010Learning'

function record(overrides: Partial<P010LearningRecord> = {}): P010LearningRecord {
  return {
    id: 'learning-1', tenantId: 'tenant-1', businessNo: 'P010-2026-0001', workflowInstanceId: 'workflow-1',
    workflowInstanceNo: 'WF-P010-1', currentNodeCode: 'S01', status: 'Version publication', versionNo: 1,
    businessDate: '2026-08-14', subject: '高风险作业资格课程', reason: '岗位风险矩阵要求资格持续有效',
    ownerCenterId: 'center-1', ownerEmployeeId: 'employee-1', courseVersionId: 'SAFETY-V1',
    contentVersion: '2026.08', courseTeamName: '安全作业学院', periodOrCourseNo: 'SAFE-001',
    learnerProfile: '高风险岗位作业人员', completionRate: 0, score1000: 886,
    practicalResult: 'PASS: server fact', qualificationEffectiveDate: '2026-08-15',
    qualificationExpireDate: '2027-08-14',
    events: [{
      id: 'event-1', eventSeq: 1, eventType: 'ASSIGNMENT_CREATED', evidence: { digest: 'server' },
      actorEmployeeId: 'manager-1', createdAt: '2026-08-14T02:00:00Z',
    }],
    updatedAt: '2026-08-14T03:00:00Z', ...overrides,
  }
}

describe('P010 service and composable', () => {
  it('does not expose a create channel while the owner directory contract is missing', () => {
    const service = createP010Service({ request: vi.fn() } as P010Transport)
    const process = useP010Learning({ service, mode: 'center' })
    expect(service).not.toHaveProperty('create')
    expect(process).not.toHaveProperty('creation')
    expect(process).not.toHaveProperty('createLearning')
  })

  it('uses exact list and get URLs and forwards AbortSignal', async () => {
    const request = vi.fn().mockResolvedValueOnce([record()]).mockResolvedValueOnce(record())
    const service = createP010Service({ request } as P010Transport)
    const listSignal = new AbortController().signal
    const getSignal = new AbortController().signal
    const listed = await service.list('employee', { signal: listSignal })
    const detail = await service.get('learning-1', { signal: getSignal })
    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P010/learning-assignments', { signal: listSignal })
    expect(request).toHaveBeenNthCalledWith(2, '/api/v1/processes/P010/learning-assignments/learning-1', { signal: getSignal })
    expect(listed[0]).toEqual(record())
    expect(detail.events[0]).toMatchObject({ eventSeq: 1, evidence: { digest: 'server' } })
  })

  it('rejects blank caller idempotency before action transport', async () => {
    const request = vi.fn()
    const service = createP010Service({ request } as P010Transport)
    await expect(service.performAction('learning-1', 'PUBLISH', { expectedVersion: 1 }, {
      idempotencyKey: ' ', signal: new AbortController().signal,
    })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    expect(request).not.toHaveBeenCalled()
  })

  it('forwards expectedVersion, sensitive server input fields and caller idempotency to the exact action URL', async () => {
    const request = vi.fn().mockResolvedValue(record({ currentNodeCode: 'S05', versionNo: 5 }))
    const signal = new AbortController().signal
    const service = createP010Service({ request } as P010Transport)
    const command = {
      expectedVersion: 4, score1000: 886, practicalResult: 'PASS: verified offline',
      effectiveDate: null, expireDate: null, recertificationDate: null,
      resultSummary: '考试事实已记录', evidence: { note: 'immutable exam evidence', recordedAt: '2026-08-14T04:00:00Z' },
    }
    await service.performAction('learning-1', 'SUBMIT_EXAM', command, {
      idempotencyKey: 'p010-exam-1', signal,
    })
    expect(request).toHaveBeenCalledWith(
      '/api/v1/processes/P010/learning-assignments/learning-1/actions/SUBMIT_EXAM',
      { method: 'POST', body: command, idempotencyKey: 'p010-exam-1', signal },
    )
  })

  it('maps every server record and event field without fabricating reveal authority', async () => {
    const source = record({ score1000: 912, practicalResult: 'QUALIFIED' })
    const service = createP010Service({ request: vi.fn().mockResolvedValue(source) } as P010Transport)
    const result = await service.get('learning-1', { signal: new AbortController().signal })
    expect(result).toEqual(source)
    expect(result).not.toHaveProperty('revealed')
    expect(result).not.toHaveProperty('stepUpSatisfied')
    expect(result).not.toHaveProperty('allowedActions')
  })

  it.each([[403, 'forbidden'], [409, 'conflict'], [408, 'timeout']] as const)(
    'keeps backend %s as the final typed action error', async (status, kind) => {
      const service = createP010Service({ request: vi.fn().mockRejectedValue({ status }) } as P010Transport)
      const process = useP010Learning({ service, mode: 'employee' })
      await process.performAction('learning-1', 'COMPLETE_LEARNING', { expectedVersion: 1 }, `idem-${status}`)
      expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind, status } })
    },
  )

  it('keeps records and action states independent without global busy', async () => {
    const resolvers: Array<(value: unknown) => void> = []
    const request = vi.fn(() => {
      if (resolvers.length >= 2) return Promise.resolve([])
      return new Promise(resolve => resolvers.push(resolve))
    })
    const process = useP010Learning({ service: createP010Service({ request } as P010Transport), mode: 'employee' })
    const refresh = process.refresh()
    const action = process.performAction('learning-1', 'COMPLETE_LEARNING', { expectedVersion: 1 }, 'p010-action-independent')
    expect(process.records.state.value.phase).toBe('loading')
    expect(process.action.state.value.phase).toBe('loading')
    expect(process).not.toHaveProperty('creation')
    resolvers[0]?.([])
    resolvers[1]?.(record({ currentNodeCode: 'S04', versionNo: 2 }))
    await Promise.all([refresh, action])
  })

  it('suppresses repeat action and refreshes server facts after success', async () => {
    let resolveAction!: (value: P010LearningRecord) => void
    const actionResult = new Promise<P010LearningRecord>(resolve => { resolveAction = resolve })
    const request = vi.fn().mockResolvedValueOnce([record()]).mockReturnValueOnce(actionResult)
      .mockResolvedValueOnce([record({ businessNo: 'P010-LATEST', currentNodeCode: 'S02', versionNo: 2 })])
    const process = useP010Learning({ service: createP010Service({ request } as P010Transport), mode: 'center' })
    await process.refresh()
    const first = process.performAction('learning-1', 'PUBLISH', { expectedVersion: 1 }, 'same-key')
    const repeated = await process.performAction('learning-1', 'PUBLISH', { expectedVersion: 1 }, 'different-key')
    expect(repeated).toBeUndefined()
    expect(request).toHaveBeenCalledTimes(2)
    resolveAction(record({ currentNodeCode: 'S02', versionNo: 2 }))
    await first
    expect(process.records.state.value).toMatchObject({
      phase: 'success', data: [{ businessNo: 'P010-LATEST', versionNo: 2 }],
    })
  })

  it('aborts stale record loads and keeps only latest server facts', async () => {
    const resolvers: Array<(value: readonly P010LearningRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const service = createP010Service({
      request: vi.fn((_path: string, options?: { signal?: AbortSignal }) => {
        if (options?.signal) signals.push(options.signal)
        return new Promise<readonly P010LearningRecord[]>(resolve => resolvers.push(resolve))
      }),
    } as P010Transport)
    const process = useP010Learning({ service, mode: 'employee' })
    const stale = process.refresh()
    const latest = process.refresh()
    expect(signals[0]?.aborted).toBe(true)
    resolvers[1]?.([record({ businessNo: 'P010-LATEST', versionNo: 4 })])
    resolvers[0]?.([record({ businessNo: 'P010-STALE', versionNo: 1 })])
    await Promise.all([stale, latest])
    expect(process.records.state.value).toMatchObject({
      phase: 'success', data: [{ businessNo: 'P010-LATEST', versionNo: 4 }],
    })
  })

  it('on 409 refreshes and cannot let an older list overwrite the new version', async () => {
    const listResolvers: Array<(value: readonly P010LearningRecord[]) => void> = []
    const signals: AbortSignal[] = []
    const request = vi.fn((_path: string, options?: { method?: string; signal?: AbortSignal }) => {
      if (options?.method === 'POST') return Promise.reject(Object.assign(new Error('conflict'), { status: 409 }))
      if (options?.signal) signals.push(options.signal)
      return new Promise<readonly P010LearningRecord[]>(resolve => listResolvers.push(resolve))
    })
    const process = useP010Learning({ service: createP010Service({ request } as P010Transport), mode: 'center' })
    const stale = process.refresh()
    const action = process.performAction('learning-1', 'PUBLISH', { expectedVersion: 1 }, 'conflict-key')
    await vi.waitFor(() => expect(listResolvers).toHaveLength(2))
    expect(signals[0]?.aborted).toBe(true)
    listResolvers[1]?.([record({ businessNo: 'P010-REFRESHED', versionNo: 5 })])
    listResolvers[0]?.([record({ businessNo: 'P010-OLD', versionNo: 1 })])
    await Promise.all([stale, action])
    expect(process.action.state.value).toMatchObject({ phase: 'error', error: { kind: 'conflict', status: 409 } })
    expect(process.records.state.value).toMatchObject({
      phase: 'success', data: [{ businessNo: 'P010-REFRESHED', versionNo: 5 }],
    })
  })
})
