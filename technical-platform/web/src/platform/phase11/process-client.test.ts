import { describe, expect, it, vi } from 'vitest'
import {
  createProcessRecord,
  executeProcessAction,
  listProcessRecords,
} from './process-client'

interface RequestContext {
  signal: AbortSignal
}

type ListWithContext = <T>(
  requester: { request: ReturnType<typeof vi.fn> },
  path: string,
  context: RequestContext,
) => Promise<T[]>

type CreateWithContext = <TResponse, TBody>(
  requester: { request: ReturnType<typeof vi.fn> },
  path: string,
  scope: string,
  body: TBody,
  context: RequestContext,
) => Promise<TResponse>

type ActionWithContext = <TResponse, TBody extends { expectedVersion: number }>(
  requester: { request: ReturnType<typeof vi.fn> },
  path: string,
  recordId: string,
  actionCode: string,
  scope: string,
  body: TBody,
  context: RequestContext,
) => Promise<TResponse>

describe('PHASE-11 process client', () => {
  it('keeps collection paths and server response facts intact', async () => {
    const request = vi.fn().mockResolvedValue([{ id: 'case-1' }])
    const requester = { request }

    await expect(listProcessRecords<{ id: string }>(requester, '/api/v1/processes/P016/care-cases'))
      .resolves.toEqual([{ id: 'case-1' }])
    expect(request).toHaveBeenCalledWith('/api/v1/processes/P016/care-cases')
  })

  it('forwards the exact AbortSignal through list, create and action requests', async () => {
    const request = vi.fn().mockResolvedValue([])
    const requester = { request }
    const listSignal = new AbortController().signal
    const createSignal = new AbortController().signal
    const actionSignal = new AbortController().signal
    const list = listProcessRecords as unknown as ListWithContext
    const create = createProcessRecord as unknown as CreateWithContext
    const action = executeProcessAction as unknown as ActionWithContext

    await list(requester, '/api/v1/processes/P011/performance-cycles', { signal: listSignal })
    await create(requester, '/api/v1/processes/P011/performance-cycles', 'p011-create', {
      subject: 'H2',
    }, { signal: createSignal })
    await action(requester, '/api/v1/processes/P011/performance-cycles', 'case-1', 'CALIBRATE', 'p011-calibrate', {
      expectedVersion: 3,
    }, { signal: actionSignal })

    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P011/performance-cycles', {
      signal: listSignal,
    })
    expect(request.mock.calls[1]?.[1]).toMatchObject({ signal: createSignal })
    expect(request.mock.calls[2]?.[1]).toMatchObject({ signal: actionSignal })
  })

  it('adds an idempotency key without accepting a client target state', async () => {
    const request = vi.fn().mockResolvedValue({ id: 'case-1' })
    const requester = { request }

    await createProcessRecord(requester, '/api/v1/processes/P011/performance-cycles', 'p011-create', {
      subject: 'H2',
    })
    await executeProcessAction(requester, '/api/v1/processes/P011/performance-cycles', 'case-1', 'CALIBRATE', 'p011-calibrate', {
      expectedVersion: 3,
      score1000: 900,
    })

    expect(request.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', body: { subject: 'H2' } })
    expect(request.mock.calls[1]?.[0]).toBe('/api/v1/processes/P011/performance-cycles/case-1/actions/CALIBRATE')
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: { expectedVersion: 3, score1000: 900 },
    })
    expect(request.mock.calls[1]?.[1]).not.toHaveProperty('body.targetState')
  })
})
