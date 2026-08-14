import { describe, expect, it } from 'vitest'
import { ApiClientError } from '../../api'
import {
  failedProcessState,
  partialProcessState,
  successProcessState,
} from './process-state'

describe('PHASE-11 process state', () => {
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

  it('keeps partial and successful resource states explicit', () => {
    expect(partialProcessState('规则加载失败')).toMatchObject({ failure: 'partial', retryable: true })
    expect(successProcessState('已完成')).toMatchObject({ phase: 'success', message: '已完成' })
  })
})
