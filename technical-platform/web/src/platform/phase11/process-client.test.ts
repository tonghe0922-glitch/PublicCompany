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
