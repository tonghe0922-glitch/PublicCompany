import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import type { MonitorTransport } from '../../../../contracts'
import * as monitorServiceModule from './monitor-service'
import { createMonitorService } from './monitor-service'
import { useMonitorProjection } from './useMonitorProjection'

const portalHarness = vi.hoisted(() => ({ request: vi.fn(), permissions: new Set<string>() }))

vi.mock('../../../../session', () => ({
  usePortalSessionStore: () => ({
    request: portalHarness.request,
    can: (permission: string) => portalHarness.permissions.has(permission),
  }),
}))

const P004_PATH = '/api/v1/processes/P004/monitor-projections'
const P005_PATH = '/api/v1/processes/P005/monitor-projections'

function projection(processCode: 'P004' | 'P005', overrides: Record<string, unknown> = {}) {
  return {
    recordId: `${processCode.toLowerCase()}-record-1`,
    businessNo: `${processCode}-2026-0001`,
    processCode,
    currentNodeCode: 'S04',
    status: 'RUNNING',
    versionNo: 3,
    updatedAt: '2026-08-14T08:00:00Z',
    ...(processCode === 'P005' ? { approvedCount: 2 } : {}),
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, deny) => {
    resolve = accept
    reject = deny
  })
  return { promise, resolve, reject }
}

describe('Phase10 monitor service and composable', () => {
  it('centralizes the default portal transport and forwards both GET signals', async () => {
    portalHarness.permissions.clear()
    portalHarness.permissions.add('p004.request.read')
    portalHarness.permissions.add('p005.notice.monitor')
    portalHarness.request.mockReset()
      .mockResolvedValueOnce([projection('P004')])
      .mockResolvedValueOnce([projection('P005')])
    const portalFactory = Reflect.get(monitorServiceModule, 'createMonitorPortalService')
    expect(portalFactory).toBeTypeOf('function')
    if (typeof portalFactory !== 'function') return
    const service = portalFactory()
    const p004Signal = new AbortController().signal
    const p005Signal = new AbortController().signal
    await service.listP004({ signal: p004Signal })
    await service.listP005({ signal: p005Signal })
    expect(portalHarness.request).toHaveBeenNthCalledWith(1, P004_PATH, { signal: p004Signal })
    expect(portalHarness.request).toHaveBeenNthCalledWith(2, P005_PATH, { signal: p005Signal })
  })

  it.each([
    ['P004-only', 'p004.request.read', 'listP004', 'listP005', P004_PATH],
    ['P005-only', 'p005.notice.monitor', 'listP005', 'listP004', P005_PATH],
  ] as const)('keeps the %s default portal endpoint authority independent', async (
    _label, permission, allowedMethod, deniedMethod, allowedPath,
  ) => {
    portalHarness.permissions.clear()
    portalHarness.permissions.add(permission)
    portalHarness.request.mockReset().mockResolvedValue([projection(permission.startsWith('p004') ? 'P004' : 'P005')])
    const factory = Reflect.get(monitorServiceModule, 'createMonitorPortalService')
    expect(factory).toBeTypeOf('function')
    if (typeof factory !== 'function') return
    const service = factory()
    const allowedSignal = new AbortController().signal
    const deniedSignal = new AbortController().signal
    await expect(service[allowedMethod]({ signal: allowedSignal })).resolves.toHaveLength(1)
    await expect(service[deniedMethod]({ signal: deniedSignal })).resolves.toEqual([])
    expect(portalHarness.request).toHaveBeenCalledTimes(1)
    expect(portalHarness.request).toHaveBeenCalledWith(allowedPath, { signal: allowedSignal })
  })

  it('uses the two exact GET paths and forwards each AbortSignal', async () => {
    const contractSource = readFileSync(new URL('../../../../contracts/monitoring.ts', import.meta.url), 'utf8')
    expect(contractSource).not.toContain("from '../platform/")
    expect(contractSource).not.toContain('processes/shared/async')
    const request = vi.fn()
      .mockResolvedValueOnce([projection('P004')])
      .mockResolvedValueOnce([projection('P005')])
    const service = createMonitorService({ request } as MonitorTransport)
    const p004Signal = new AbortController().signal
    const p005Signal = new AbortController().signal

    await expect(service.listP004({ signal: p004Signal })).resolves.toHaveLength(1)
    await expect(service.listP005({ signal: p005Signal })).resolves.toHaveLength(1)

    expect(request).toHaveBeenNthCalledWith(1, P004_PATH, { signal: p004Signal })
    expect(request).toHaveBeenNthCalledWith(2, P005_PATH, { signal: p005Signal })
    expect(Object.keys(service).sort()).toEqual(['listP004', 'listP005'])
  })

  it('maps every runtime item through a strict allowlist and drops forbidden extra fields', async () => {
    const forbidden = {
      subject: 'secret subject', content: 'secret content', reason: 'secret reason',
      resultSummary: 'secret result', amount: 99, actualAmount: 88,
      ownerEmployeeId: 'employee-secret', recipients: ['recipient-secret'],
      evidence: { note: 'evidence-secret' }, detail: 'detail-secret', stack: 'stack-secret',
    }
    const request = vi.fn()
      .mockResolvedValueOnce([projection('P004', { ...forbidden, approvedCount: 999 })])
      .mockResolvedValueOnce([projection('P005', forbidden)])
    const service = createMonitorService({ request } as MonitorTransport)

    const p004 = await service.listP004({ signal: new AbortController().signal })
    const p005 = await service.listP005({ signal: new AbortController().signal })

    expect(Object.keys(p004[0] ?? {}).sort()).toEqual([
      'businessNo', 'currentNodeCode', 'processCode', 'recordId', 'status', 'updatedAt', 'versionNo',
    ])
    expect(Object.keys(p005[0] ?? {}).sort()).toEqual([
      'approvedCount', 'businessNo', 'currentNodeCode', 'processCode', 'recordId', 'status',
      'updatedAt', 'versionNo',
    ])
    expect(p004[0]).not.toHaveProperty('approvedCount')
    expect(p005[0]?.approvedCount).toBe(2)
    const serialized = JSON.stringify({ p004, p005 })
    for (const secret of Object.values(forbidden).flatMap(value =>
      typeof value === 'object' ? Object.values(value) : [value],
    )) expect(serialized).not.toContain(String(secret))
  })

  it('rejects non-array or malformed runtime projections instead of returning unknown data', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce({ recordId: 'not-an-array' })
      .mockResolvedValueOnce([projection('P005', { approvedCount: 'two' })])
    const service = createMonitorService({ request } as MonitorTransport)

    await expect(service.listP004({ signal: new AbortController().signal }))
      .rejects.toThrow('MONITOR_PROJECTION_ARRAY_INVALID')
    await expect(service.listP005({ signal: new AbortController().signal }))
      .rejects.toThrow('MONITOR_PROJECTION_APPROVED_COUNT_INVALID')
  })

  it('loads both process projections in parallel and forms a success state', async () => {
    const p004 = deferred<unknown>()
    const p005 = deferred<unknown>()
    const request = vi.fn((path: string) => path === P004_PATH ? p004.promise : p005.promise)
    const process = useMonitorProjection(createMonitorService({ request } as MonitorTransport))

    const refresh = process.refresh()
    expect(request).toHaveBeenCalledTimes(2)
    expect(process.state.value).toMatchObject({ phase: 'loading', requestId: 'monitor-1' })
    p004.resolve([projection('P004')])
    p005.resolve([projection('P005')])
    await refresh

    expect(process.state.value).toMatchObject({
      phase: 'success', requestId: 'monitor-1',
      data: { p004: [{ processCode: 'P004' }], p005: [{ processCode: 'P005', approvedCount: 2 }] },
    })
  })

  it('forms partial with a stable missing-resource list when one process fails', async () => {
    const request = vi.fn((path: string) => path === P004_PATH
      ? Promise.resolve([projection('P004')])
      : Promise.reject(Object.assign(new Error('P005 unavailable'), { status: 503 })))
    const process = useMonitorProjection(createMonitorService({ request } as MonitorTransport))

    await process.refresh()

    expect(process.state.value).toMatchObject({
      phase: 'partial', data: { p004: [{ processCode: 'P004' }], p005: [] },
      missingResources: ['P005'], error: { kind: 'server', status: 503 },
    })
  })

  it('forms error without process data when both process reads fail', async () => {
    const request = vi.fn((path: string) => Promise.reject(Object.assign(
      new Error(`${path} unavailable`), { status: path === P004_PATH ? 403 : 503 },
    )))
    const process = useMonitorProjection(createMonitorService({ request } as MonitorTransport))

    await process.refresh()

    expect(process.state.value).toMatchObject({
      phase: 'error', missingResources: ['P004', 'P005'], error: { kind: 'forbidden', status: 403 },
    })
    expect(process.state.value.data).toBeUndefined()
  })

  it('aborts an older refresh and never lets its late response overwrite latest facts', async () => {
    const calls: Array<{ path: string; signal?: AbortSignal; result: ReturnType<typeof deferred<unknown>> }> = []
    const request = vi.fn((path: string, options?: { signal?: AbortSignal }) => {
      const result = deferred<unknown>()
      calls.push({ path, signal: options?.signal, result })
      return result.promise
    })
    const process = useMonitorProjection(createMonitorService({ request } as MonitorTransport))

    const stale = process.refresh()
    const latest = process.refresh()
    expect(calls.slice(0, 2).every(call => call.signal?.aborted)).toBe(true)
    calls[2]?.result.resolve([projection('P004', { businessNo: 'P004-LATEST', versionNo: 8 })])
    calls[3]?.result.resolve([projection('P005', { businessNo: 'P005-LATEST', versionNo: 9 })])
    calls[0]?.result.resolve([projection('P004', { businessNo: 'P004-STALE', versionNo: 1 })])
    calls[1]?.result.resolve([projection('P005', { businessNo: 'P005-STALE', versionNo: 1 })])
    await Promise.all([stale, latest])

    expect(process.state.value).toMatchObject({
      phase: 'success', requestId: 'monitor-2',
      data: {
        p004: [{ businessNo: 'P004-LATEST', versionNo: 8 }],
        p005: [{ businessNo: 'P005-LATEST', versionNo: 9 }],
      },
    })
    expect(JSON.stringify(process.state.value)).not.toContain('STALE')
  })

  it('cancels only the active read state and exposes no action, create, or global busy channel', async () => {
    const pending = deferred<unknown>()
    const service = createMonitorService({ request: vi.fn(() => pending.promise) } as MonitorTransport)
    const process = useMonitorProjection(service)
    const refresh = process.refresh()

    process.cancel()
    expect(process.state.value).toMatchObject({ phase: 'cancelled', requestId: 'monitor-1' })
    expect(Object.keys(process).sort()).toEqual(['cancel', 'refresh', 'state'])
    pending.resolve([])
    await refresh
    expect(process.state.value.phase).toBe('cancelled')
  })
})
