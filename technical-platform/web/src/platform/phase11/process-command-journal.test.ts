import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../api'
import { useProcessOperation } from './use-process-operation'
import { canonicalPayloadHash } from './process-command-journal'
import type { ProcessCommandActor, ProcessCommandDescriptor } from './process-command-journal'

const actorA = { tenantId: 'tenant-a', userId: 'user-a', identityId: 'identity-a' }
const actorVariants: ProcessCommandActor[] = [
  { ...actorA, tenantId: 'tenant-b' },
  { ...actorA, userId: 'user-b' },
  { ...actorA, identityId: 'identity-b' },
]

function command(
  action: string,
  recordId = 'record-1',
  payload: unknown = { expectedVersion: 4, decision: 'APPROVE' },
  actor: ProcessCommandActor = actorA,
): ProcessCommandDescriptor {
  return {
    stateKey: `P016:action:${recordId}:${action}`,
    recordLockKey: `P016:record:${recordId}`,
    operationKey: `P016:${recordId}:${action}`,
    actor,
    payload,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('PHASE-11 logical command journal', () => {
  it('uses a 256-bit canonical payload identity and changes it for one payload bit', async () => {
    const first = await canonicalPayloadHash({ expectedVersion: 4, decision: 'APPROVE' })
    const reordered = await canonicalPayloadHash({ decision: 'APPROVE', expectedVersion: 4 })
    const changed = await canonicalPayloadHash({ expectedVersion: 5, decision: 'APPROVE' })

    expect(first).toMatch(/^[0-9a-f]{64}$/u)
    expect(reordered).toBe(first)
    expect(changed).not.toBe(first)
  })

  it.each([
    ['undefined', undefined],
    ['function', () => undefined],
    ['symbol', Symbol('invalid')],
    ['bigint', 1n],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['Date', new Date('2026-08-15T00:00:00Z')],
    ['class instance', new (class InvalidPayload {})()],
  ])('rejects non-JSON %s payloads without running or retaining a lock', async (_label, payload) => {
    const operation = useProcessOperation()
    const runner = vi.fn(() => Promise.resolve('must-not-run'))

    const invalid = {
      ...command('APPROVE_CARE', `invalid-${String(_label)}`),
      payload,
    }
    await expect(operation.runCommand(invalid, runner))
      .rejects.toThrow('JSON-compatible')
    expect(runner).not.toHaveBeenCalled()
    expect(operation.recordPending(actorA, `P016:record:invalid-${String(_label)}`)).toBe(false)
  })

  it('rejects cyclic payloads without running or retaining a lock', async () => {
    const operation = useProcessOperation()
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const runner = vi.fn(() => Promise.resolve('must-not-run'))

    await expect(operation.runCommand(command('APPROVE_CARE', 'invalid-cycle', cyclic), runner))
      .rejects.toThrow('cycles')
    expect(runner).not.toHaveBeenCalled()
    expect(operation.recordPending(actorA, 'P016:record:invalid-cycle')).toBe(false)
  })

  it('canonicalizes payloads and reuses an unknown key across route scopes', async () => {
    const firstScope = effectScope()
    const first = firstScope.run(useProcessOperation)!
    const observed: string[] = []
    let firstSignal: AbortSignal | undefined
    const started = deferred<void>()
    const initial = first.runCommand(command('APPROVE_CARE', 'scope-record'), context => {
      firstSignal = context.signal
      observed.push(context.idempotencyKey)
      started.resolve()
      return new Promise((_resolve, reject) => {
        context.signal.addEventListener('abort', () => reject(new ApiClientError('route left', {
          kind: 'aborted',
        })), { once: true })
      })
    })

    await started.promise
    firstScope.stop()
    await expect(initial).resolves.toMatchObject({ ok: false, outcome: 'unknown' })
    expect(firstSignal?.aborted).toBe(true)

    const retryScope = effectScope()
    const retry = retryScope.run(useProcessOperation)!
    const sameSemanticPayload = { decision: 'APPROVE', expectedVersion: 4 }
    await expect(retry.runCommand(
      command('APPROVE_CARE', 'scope-record', sameSemanticPayload),
      context => {
        observed.push(context.idempotencyKey)
        return Promise.resolve('confirmed')
      },
    )).resolves.toMatchObject({ ok: true, data: 'confirmed' })
    expect(observed).toHaveLength(2)
    expect(observed[1]).toBe(observed[0])
    retryScope.stop()
  })

  it('keeps unknown ownership fail-closed and does not leak it across actor identities', async () => {
    const operation = useProcessOperation()
    const firstRunner = vi.fn(() => Promise.reject(new ApiClientError('network lost', {
      kind: 'transport', retryable: true,
    })))
    await expect(operation.runCommand(command('APPROVE_CARE', 'identity-record'), firstRunner))
      .resolves.toMatchObject({ ok: false, outcome: 'unknown' })
    expect(operation.recordPending(actorA, 'P016:record:identity-record')).toBe(true)

    const blocked = vi.fn(() => Promise.resolve('must-not-run'))
    await expect(operation.runCommand(command('REJECT_CARE', 'identity-record'), blocked))
      .resolves.toMatchObject({ ok: false, outcome: 'in-flight' })
    expect(blocked).not.toHaveBeenCalled()

    const otherActorKeys: string[] = []
    for (const actor of actorVariants) {
      await operation.runCommand(command('APPROVE_CARE', 'identity-record', {
        expectedVersion: 4, decision: 'APPROVE',
      }, actor), context => {
        otherActorKeys.push(context.idempotencyKey)
        return Promise.resolve('other actor isolated')
      })
    }
    const firstAttempt = await operation.commandAttempt(actorA, 'P016:identity-record:APPROVE_CARE', {
      expectedVersion: 4, decision: 'APPROVE',
    })
    expect(new Set([firstAttempt?.idempotencyKey, ...otherActorKeys])).toHaveProperty('size', 4)
  })

  it('takes the record lock before transport and allows different records concurrently', async () => {
    const operation = useProcessOperation()
    const recordOne = deferred<string>()
    const recordTwo = deferred<string>()
    const recordOneStarted = deferred<void>()
    const recordTwoStarted = deferred<void>()
    const approve = vi.fn(() => {
      recordOneStarted.resolve()
      return recordOne.promise
    })
    const reject = vi.fn(() => Promise.resolve('rejected'))
    const other = vi.fn(() => {
      recordTwoStarted.resolve()
      return recordTwo.promise
    })

    const first = operation.runCommand(command('APPROVE_CARE', 'concurrent-1'), approve)
    const blocked = operation.runCommand(command('REJECT_CARE', 'concurrent-1'), reject)
    const concurrent = operation.runCommand(command('APPROVE_CARE', 'concurrent-2'), other)
    await Promise.all([recordOneStarted.promise, recordTwoStarted.promise])
    expect(approve).toHaveBeenCalledTimes(1)
    expect(reject).not.toHaveBeenCalled()
    expect(other).toHaveBeenCalledTimes(1)
    expect(operation.recordPending(actorA, 'P016:record:concurrent-1')).toBe(true)
    expect(operation.recordPending(actorA, 'P016:record:concurrent-2')).toBe(true)

    recordOne.resolve('approved')
    recordTwo.resolve('other approved')
    await expect(blocked).resolves.toMatchObject({ ok: false, outcome: 'in-flight' })
    await Promise.all([first, concurrent])
  })

  it('reserves a same-record command before its payload digest can be overtaken', async () => {
    const operation = useProcessOperation()
    const firstDigest = deferred<ArrayBuffer>()
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle)
    let digestCalls = 0
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation((algorithm, data) => {
      digestCalls += 1
      if (digestCalls === 1) return firstDigest.promise
      return originalDigest(algorithm, data)
    })
    const firstRunner = vi.fn(() => Promise.resolve('approved'))
    const siblingRunner = vi.fn(() => Promise.resolve('rejected'))
    const otherStarted = deferred<void>()
    const otherRunner = vi.fn(() => {
      otherStarted.resolve()
      return Promise.resolve('other approved')
    })
    const pending: Promise<unknown>[] = []

    try {
      const first = operation.runCommand(command('APPROVE_CARE', 'digest-race'), firstRunner)
      const sibling = operation.runCommand(command('REJECT_CARE', 'digest-race'), siblingRunner)
      pending.push(first, sibling)

      expect(digestSpy).toHaveBeenCalledTimes(1)
      expect(siblingRunner).not.toHaveBeenCalled()

      const other = operation.runCommand(command('APPROVE_CARE', 'digest-independent'), otherRunner)
      pending.push(other)
      await otherStarted.promise
      expect(digestSpy).toHaveBeenCalledTimes(2)
      expect(otherRunner).toHaveBeenCalledTimes(1)

      firstDigest.resolve(new Uint8Array(32).buffer)
      await expect(first).resolves.toMatchObject({ ok: true, data: 'approved' })
      await expect(sibling).resolves.toMatchObject({ ok: false, outcome: 'in-flight' })
      await expect(other).resolves.toMatchObject({ ok: true, data: 'other approved' })
      expect(firstRunner).toHaveBeenCalledTimes(1)
      expect(siblingRunner).not.toHaveBeenCalled()
    } finally {
      firstDigest.resolve(new Uint8Array(32).buffer)
      digestSpy.mockRestore()
      await Promise.allSettled(pending)
    }
  })

  it('ends deterministic 4xx attempts and never reuses a key for changed payload', async () => {
    const operation = useProcessOperation()
    const keys: string[] = []
    await expect(operation.runCommand(command('APPROVE_CARE', 'deterministic'), context => {
      keys.push(context.idempotencyKey)
      return Promise.reject(new ApiClientError('stale', {
        kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-409',
      }))
    })).resolves.toMatchObject({ ok: false, outcome: 'failed' })
    expect(operation.recordPending(actorA, 'P016:record:deterministic')).toBe(false)

    await operation.runCommand(command('APPROVE_CARE', 'deterministic', {
      expectedVersion: 5, decision: 'APPROVE',
    }), context => {
      keys.push(context.idempotencyKey)
      return Promise.resolve('new command')
    })
    expect(keys).toHaveLength(2)
    expect(keys[1]).not.toBe(keys[0])
  })

  it.each([
    ['403', () => new ApiClientError('forbidden', { kind: 'http', status: 403 }), 'failed', false],
    ['409', () => new ApiClientError('conflict', { kind: 'http', status: 409 }), 'failed', false],
    ['500', () => new ApiClientError('server', { kind: 'http', status: 500 }), 'unknown', true],
    ['503', () => new ApiClientError('unavailable', { kind: 'http', status: 503 }), 'unknown', true],
    ['transport', () => new ApiClientError('transport', { kind: 'transport' }), 'unknown', true],
    ['timeout', () => new ApiClientError('timeout', { kind: 'timeout' }), 'unknown', true],
    ['aborted', () => new ApiClientError('aborted', { kind: 'aborted' }), 'unknown', true],
    ['non-api', () => new Error('unknown'), 'unknown', true],
  ] as const)('classifies %s without message matching', async (label, cause, outcome, pending) => {
    const operation = useProcessOperation()
    const record = `typed-${label}`

    await expect(operation.runCommand(command('APPROVE_CARE', record), () => Promise.reject(cause())))
      .resolves.toMatchObject({ ok: false, outcome })
    expect(operation.recordPending(actorA, `P016:record:${record}`)).toBe(pending)
  })
})
