import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../api'
import { useProcessOperation } from './use-process-operation'

interface OperationContext {
  signal: AbortSignal
  requestId: string
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function expectedOperations() {
  return useProcessOperation()
}

describe('PHASE-11 process operation concurrency contract', () => {
  it('aborts the previous resource request and isolates both stale success and stale error', async () => {
    const operation = expectedOperations()
    const requests = [deferred<string[]>(), deferred<string[]>()]
    const signals: Array<AbortSignal | undefined> = []
    let call = 0
    const loader = (context?: OperationContext) => {
      signals.push(context?.signal)
      return requests[call++]!.promise
    }

    const first = operation.runResource('cycles:tenant-a:center', loader)
    const second = operation.runResource('cycles:tenant-a:center', loader)
    expect(signals[0]?.aborted).toBe(true)

    requests[1]!.resolve(['fresh'])
    await second
    expect(operation.resourceState('cycles:tenant-a:center')).toMatchObject({
      phase: 'success',
      data: ['fresh'],
      requestId: 'cycles:tenant-a:center:2',
    })

    requests[0]!.resolve(['stale'])
    await first
    expect(operation.resourceState('cycles:tenant-a:center')).toMatchObject({
      phase: 'success',
      data: ['fresh'],
      requestId: 'cycles:tenant-a:center:2',
    })

    const staleError = deferred<string[]>()
    const latest = deferred<string[]>()
    const old = operation.runResource('cycles:tenant-a:center', () => staleError.promise)
    const current = operation.runResource('cycles:tenant-a:center', () => latest.promise)
    latest.resolve(['latest'])
    await current
    staleError.reject(new Error('stale failure'))
    await old
    expect(operation.resourceState('cycles:tenant-a:center')).toMatchObject({
      phase: 'success',
      data: ['latest'],
    })
  })

  it('returns typed empty, forbidden and conflict outcomes instead of undefined', async () => {
    const operation = expectedOperations()
    const empty = await operation.runResource('empty', () => Promise.resolve([]))
    const forbidden = await operation.runResource('forbidden', () => Promise.reject(new ApiClientError('denied', {
      kind: 'http', status: 403, code: 'forbidden', requestId: 'req-403',
    })))
    const conflict = await operation.runResource('conflict', () => Promise.reject(new ApiClientError('stale', {
      kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-409',
    })))

    expect(empty).toMatchObject({ ok: true, data: [] })
    expect(operation.resourceState('empty')).toMatchObject({ phase: 'empty', data: [] })
    expect(forbidden).toMatchObject({ ok: false, outcome: 'failed' })
    expect(operation.resourceState('forbidden')).toMatchObject({ failure: 'no-permission' })
    expect(conflict).toMatchObject({ ok: false, outcome: 'failed' })
    expect(operation.resourceState('conflict')).toMatchObject({ failure: 'conflict' })
  })

  it('does not abort or replay an in-flight action with the same record and action key', async () => {
    const operation = expectedOperations()
    const pending = deferred<string>()
    const signals: Array<AbortSignal | undefined> = []
    const runner = vi.fn((context?: OperationContext) => {
      signals.push(context?.signal)
      return pending.promise
    })

    const first = operation.runAction('record-1:APPROVE', runner)
    const duplicatePromise = operation.runAction('record-1:APPROVE', runner)
    pending.resolve('approved')
    const [firstResult, duplicate] = await Promise.all([first, duplicatePromise])
    expect(runner).toHaveBeenCalledTimes(1)
    expect(signals[0]?.aborted).toBe(false)
    expect(duplicate).toMatchObject({ ok: false, outcome: 'in-flight' })
    expect(firstResult).toMatchObject({ ok: true, data: 'approved' })
  })

  it('returns a typed failed action result and keeps its error state visible', async () => {
    const operation = expectedOperations()
    const result = await operation.runAction('record-1:REJECT', () => Promise.reject(new ApiClientError('拒绝失败', {
      kind: 'http', status: 500, code: 'action_failed', requestId: 'req-action-500',
    })))

    expect(result).toMatchObject({ ok: false, outcome: 'failed' })
    expect(operation.actionState('record-1:REJECT')).toMatchObject({
      phase: 'error',
      failure: 'error',
      traceId: 'req-action-500',
    })
  })

  it('aborts a scoped resource, marks it cancelled and isolates a late resolution', async () => {
    const scope = effectScope()
    const pending = deferred<string[]>()
    let signal: AbortSignal | undefined
    const operation = scope.run(() => expectedOperations())!
    const result = operation.runResource('records:tenant-a:center', context => {
      signal = context?.signal
      return pending.promise
    })

    scope.stop()
    expect(signal?.aborted).toBe(true)
    expect(operation.resourceState('records:tenant-a:center')).toMatchObject({
      phase: 'cancelled',
      failure: 'none',
    })
    pending.resolve(['late'])
    await expect(result).resolves.toMatchObject({ ok: false, outcome: 'cancelled' })
    expect(operation.resourceState('records:tenant-a:center')).toMatchObject({
      phase: 'cancelled',
      failure: 'none',
    })
  })

  it('keeps different action keys independent and cancels active transport on scope disposal', async () => {
    const scope = effectScope()
    const pendingA = deferred<string>()
    const pendingB = deferred<string>()
    const signals: AbortSignal[] = []
    const operation = scope.run(() => expectedOperations())!
    const first = operation.runAction('record-1:APPROVE', (context) => {
      if (context) signals.push(context.signal)
      return pendingA.promise
    })
    const second = operation.runAction('record-2:APPROVE', (context) => {
      if (context) signals.push(context.signal)
      return pendingB.promise
    })

    expect(signals).toHaveLength(2)
    scope.stop()
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(operation.actionState('record-1:APPROVE').phase).toBe('cancelled')
    expect(operation.actionState('record-2:APPROVE').phase).toBe('cancelled')
    pendingA.resolve('late-a')
    pendingB.resolve('late-b')
    await Promise.all([first, second])
    expect(operation.actionState('record-1:APPROVE').phase).toBe('cancelled')
    expect(operation.actionState('record-2:APPROVE').phase).toBe('cancelled')
    expect(operation.actionState('record-1:APPROVE').requestId)
      .not.toBe(operation.actionState('record-2:APPROVE').requestId)
  })
})
