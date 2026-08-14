import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../api'
import * as processState from './process-state'
import {
  idleProcessState,
  loadingProcessState,
  failedProcessState,
  partialProcessState,
  successProcessState,
} from './process-state'

interface ExpectedStateFactories {
  cancelledProcessState: (requestId: string) => unknown
  emptyProcessState: <T>(data: T, requestId: string) => unknown
}

const expectedFactories = processState as unknown as ExpectedStateFactories

describe('PHASE-11 process state', () => {
  it('keeps idle and loading distinct and carries the active request identity', () => {
    expect(idleProcessState()).toEqual({
      phase: 'idle',
      failure: 'none',
      message: '',
      retryable: false,
    })
    expect(loadingProcessState('resource-0')).toMatchObject({
      phase: 'loading',
      failure: 'none',
      requestId: 'resource-0',
      retryable: false,
    })
  })

  it('classifies permission and conflict responses without flattening them into generic feedback', () => {
    const forbidden = failedProcessState(new ApiClientError('denied', {
      kind: 'http', status: 403, code: 'forbidden', requestId: 'req-403',
    }))
    const conflict = failedProcessState(new ApiClientError('stale', {
      kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-409',
    }))

    expect(forbidden).toMatchObject({ failure: 'no-permission', traceId: 'req-403' })
    expect(conflict).toMatchObject({ failure: 'conflict', retryable: true, traceId: 'req-409' })
  })

  it('exposes empty, partial, success and cancelled as distinct typed phases', () => {
    expect(expectedFactories.emptyProcessState([], 'resource-1')).toMatchObject({
      phase: 'empty',
      data: [],
      requestId: 'resource-1',
    })
    expect(partialProcessState('规则加载失败', ['已保留'], ['rules'], 'resource-3')).toMatchObject({
      phase: 'partial',
      failure: 'partial',
      data: ['已保留'],
      missingResources: ['rules'],
      requestId: 'resource-3',
      retryable: true,
    })
    expect(successProcessState('已完成')).toMatchObject({ phase: 'success', message: '已完成' })
    expect(expectedFactories.cancelledProcessState('resource-2')).toMatchObject({
      phase: 'cancelled',
      failure: 'none',
      requestId: 'resource-2',
      retryable: false,
    })
    expect(expectedFactories.cancelledProcessState('resource-2')).not.toMatchObject({
      phase: 'error',
      failure: 'error',
    })
  })
})
