// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { effectScope, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import AsyncStateBoundary from './AsyncStateBoundary.vue'
import useAsyncAction from './useAsyncAction'
import useAsyncResource from './useAsyncResource'

describe('shared async contracts', () => {
  it('projects all seven phases without treating cancellation as an error', async () => {
    const wrapper = mount(AsyncStateBoundary, {
      props: { state: { phase: 'idle' } },
      slots: { idle: '<p>等待加载</p>', default: '<p>成功内容</p>' },
    })
    expect(wrapper.get('[data-state="idle"]').text()).toContain('等待加载')
    await wrapper.setProps({ state: { phase: 'loading', requestId: 'req-1' } })
    expect(wrapper.get('[data-state="loading"]').text()).toContain('正在加载')
    await wrapper.setProps({ state: { phase: 'success', data: ['可用'], requestId: 'req-2' } })
    expect(wrapper.get('[data-state="success"]').text()).toContain('成功内容')
    await wrapper.setProps({ state: { phase: 'empty', data: [], requestId: 'req-3' } })
    expect(wrapper.get('[data-state="empty"]').text()).toContain('暂无数据')
    await wrapper.setProps({ state: { phase: 'partial', data: ['可用'], missingResources: ['审批意见'], requestId: 'req-4' } })
    expect(wrapper.text()).toContain('审批意见')
    await wrapper.setProps({ state: { phase: 'error', requestId: 'req-5', error: { kind: 'server', title: '服务失败', userMessage: '稍后重试', nextAction: '重试', requestId: 'trace-5' } } })
    expect(wrapper.get('[data-state="error"]').text()).toContain('服务失败')
    expect(wrapper.get('[data-state="error"]').text()).toContain('trace-5')
    await wrapper.setProps({ state: { phase: 'cancelled', requestId: 'req-6' } })
    expect(wrapper.get('[data-state="cancelled"]').text()).toContain('已取消')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('aborts stale resources and lets only the latest request win', async () => {
    const pending: Array<(value: string) => void> = []
    const signals: AbortSignal[] = []
    const scope = effectScope()
    const resource = scope.run(() => useAsyncResource<string>(({ signal }) => {
      signals.push(signal)
      return new Promise(resolve => pending.push(resolve))
    }))!
    const first = resource.execute()
    const second = resource.execute()
    expect(signals[0]?.aborted).toBe(true)
    pending[0]?.('stale')
    pending[1]?.('fresh')
    await Promise.all([first, second])
    expect(resource.state.value).toMatchObject({ phase: 'success', data: 'fresh', requestId: 'resource-2' })
    void resource.execute()
    scope.stop()
    expect(signals[2]?.aborted).toBe(true)
  })

  it('requires caller idempotency and keeps action state separate from resource state', async () => {
    const runner = vi.fn(({ input, idempotencyKey }: { input: number; idempotencyKey: string }) => Promise.resolve(`${input}:${idempotencyKey}`))
    const resource = useAsyncResource(() => Promise.resolve('record'))
    const action = useAsyncAction<number, string>(runner)
    await resource.execute()
    await action.execute(3, { idempotencyKey: 'caller-key-3' })
    await flushPromises()
    expect(runner).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'caller-key-3', requestId: 'action-1' }))
    expect(action.state.value).toMatchObject({ phase: 'success', data: '3:caller-key-3' })
    expect(resource.state.value).toMatchObject({ phase: 'success', data: 'record' })
    action.cancel()
    await nextTick()
  })

  it('rejects a blank caller idempotency key without invoking the runner', async () => {
    const runner = vi.fn(() => Promise.resolve('unexpected'))
    const action = useAsyncAction<string, string>(runner)
    await expect(action.execute('payload', { idempotencyKey: '  ' })).rejects.toThrow('CALLER_IDEMPOTENCY_KEY_REQUIRED')
    expect(runner).not.toHaveBeenCalled()
  })

  it('prevents duplicate execution while one action is loading', async () => {
    let resolveAction: ((value: string) => void) | undefined
    const runner = vi.fn(() => new Promise<string>(resolve => { resolveAction = resolve }))
    const action = useAsyncAction<string, string>(runner)
    const first = action.execute('first', { idempotencyKey: 'caller-first' })
    const duplicate = action.execute('duplicate', { idempotencyKey: 'caller-duplicate' })
    expect(runner).toHaveBeenCalledTimes(1)
    resolveAction?.('done')
    await Promise.all([first, duplicate])
    expect(action.state.value).toMatchObject({ phase: 'success', data: 'done', requestId: 'action-1' })
  })

  it('keeps cancellation stable when an action resolves late', async () => {
    let resolveAction: ((value: string) => void) | undefined
    const action = useAsyncAction<string, string>(() => new Promise<string>(resolve => { resolveAction = resolve }))
    const pendingAction = action.execute('payload', { idempotencyKey: 'caller-cancel' })
    action.cancel()
    expect(action.state.value).toMatchObject({ phase: 'cancelled', requestId: 'action-1' })
    resolveAction?.('late')
    await pendingAction
    expect(action.state.value).toMatchObject({ phase: 'cancelled', requestId: 'action-1' })
  })
})
