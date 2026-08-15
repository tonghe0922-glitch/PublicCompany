import { describe, expect, it, vi } from 'vitest'
import {
  createProcessRecord,
  executeProcessAction,
  listProcessRecords,
} from './process-client'

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
    await listProcessRecords(requester, '/api/v1/processes/P011/performance-cycles', {
      signal: listSignal,
    })
    await createProcessRecord(requester, '/api/v1/processes/P011/performance-cycles', 'logical-p011-create-key', {
      subject: 'H2',
    }, { signal: createSignal })
    await executeProcessAction(requester, '/api/v1/processes/P011/performance-cycles', 'case-1', 'CALIBRATE', 'logical-p011-action-key', {
      expectedVersion: 3,
    }, { signal: actionSignal })

    expect(request).toHaveBeenNthCalledWith(1, '/api/v1/processes/P011/performance-cycles', {
      signal: listSignal,
    })
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      signal: createSignal,
      idempotencyKey: 'logical-p011-create-key',
    })
    expect(request.mock.calls[2]?.[1]).toMatchObject({
      signal: actionSignal,
      idempotencyKey: 'logical-p011-action-key',
    })
  })

  it('uses the logical-operation key verbatim without accepting a client target state', async () => {
    const request = vi.fn().mockResolvedValue({ id: 'case-1' })
    const requester = { request }

    await createProcessRecord(requester, '/api/v1/processes/P011/performance-cycles', 'logical-create-001', {
      subject: 'H2',
    })
    await executeProcessAction(requester, '/api/v1/processes/P011/performance-cycles', 'case-1', 'CALIBRATE', 'logical-action-001', {
      expectedVersion: 3,
      score1000: 900,
    })

    expect(request.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      idempotencyKey: 'logical-create-001',
      body: { subject: 'H2' },
    })
    expect(request.mock.calls[1]?.[0]).toBe('/api/v1/processes/P011/performance-cycles/case-1/actions/CALIBRATE')
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      idempotencyKey: 'logical-action-001',
      body: { expectedVersion: 3, score1000: 900 },
    })
    expect(request.mock.calls[1]?.[1]).not.toHaveProperty('body.targetState')
  })
})
