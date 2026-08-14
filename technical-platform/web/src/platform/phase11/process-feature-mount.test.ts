// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../api'
import type { ApiRequestOptions } from '../../api'
import P011PerformancePage from '../pages/P011PerformancePage.vue'
import P012PromotionPage from '../pages/P012PromotionPage.vue'
import P013RewardPage from '../pages/P013RewardPage.vue'
import P014DisciplinePage from '../pages/P014DisciplinePage.vue'
import P015PointLedgerPage from '../pages/P015PointLedgerPage.vue'
import P016CareSupportPage from '../pages/P016CareSupportPage.vue'

const sessionRequest = vi.fn<(
  path: string,
  options?: ApiRequestOptions,
) => Promise<unknown>>()

vi.mock('../../session', () => ({
  usePortalSessionStore: () => ({
    session: { employeeId: 'employee-1' },
    can: () => true,
    request: sessionRequest,
  }),
}))

const portal = {
  code: 'center',
  runtimeCode: 'center',
  title: '中心管理端',
  description: '',
  homeTitle: '',
  homeFocus: [],
} as const

const pages = [
  { code: 'P011', component: P011PerformancePage, testId: 'p011-page' },
  { code: 'P012', component: P012PromotionPage, testId: 'p012-page' },
  { code: 'P013', component: P013RewardPage, testId: 'p013-page' },
  { code: 'P014', component: P014DisciplinePage, testId: 'p014-page' },
  { code: 'P015', component: P015PointLedgerPage, testId: 'p015-page' },
  { code: 'P016', component: P016CareSupportPage, testId: 'p016-page' },
] as const

const pagesWithoutPartial = pages.filter(item => item.code !== 'P015')

beforeEach(() => {
  sessionRequest.mockReset()
})

describe('PHASE-11 process feature runtime projections', () => {
  it.each(pages)('$code mounts through the real route page and projects an empty resource', async item => {
    sessionRequest.mockResolvedValue([])
    const wrapper = mount(item.component, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.get(`[data-testid="${item.testId}"]`).attributes('data-testid')).toBe(item.testId)
    expect(wrapper.text()).toContain('暂无')
    wrapper.unmount()
  })

  it.each(pages)('$code projects an authoritative backend 403 as no-permission', async item => {
    sessionRequest.mockRejectedValue(new ApiClientError('服务端拒绝当前数据范围', {
      kind: 'http', status: 403, code: 'forbidden', requestId: `req-${item.code}-403`,
    }))
    const wrapper = mount(item.component, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.text()).toContain('服务端拒绝当前数据范围')
    expect(wrapper.text()).not.toContain('暂无可见')
    wrapper.unmount()
  })

  it.each(pagesWithoutPartial)('$code never fabricates partial failure on an empty success', async item => {
    sessionRequest.mockResolvedValue([])
    const wrapper = mount(item.component, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('部分资源')
    expect(wrapper.find('[data-state="partial"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it.each(pagesWithoutPartial)('$code never fabricates partial failure on a complete resource error', async item => {
    sessionRequest.mockRejectedValue(new ApiClientError('完整资源失败', {
      kind: 'http', status: 500, code: 'resource_failed', requestId: `req-${item.code}-500`,
    }))
    const wrapper = mount(item.component, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.text()).not.toContain('部分资源')
    expect(wrapper.find('[data-state="partial"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('projects a generic resource failure as an error with retry help', async () => {
    sessionRequest.mockRejectedValue(new ApiClientError('绩效资源暂不可用', {
      kind: 'http', status: 500, code: 'server_error', requestId: 'req-p011-500', retryable: true,
    }))
    const wrapper = mount(P011PerformancePage, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.text()).toContain('绩效资源暂不可用')
    expect(wrapper.findAll('button').some(button => button.text().includes('重试'))).toBe(true)
    wrapper.unmount()
  })

  it('projects P015 partial failure only when one real resource succeeds and the other fails', async () => {
    sessionRequest.mockImplementation((path: string) => {
      if (path.endsWith('/point-rules')) {
        return Promise.reject(new ApiClientError('规则服务暂不可用', {
          kind: 'http', status: 500, code: 'rule_unavailable', requestId: 'req-rules-500', retryable: true,
        }))
      }
      return Promise.resolve([{
        id: 'point-1', businessNo: 'PT-1', currentNodeCode: 'S01', status: 'ACTIVE', versionNo: 1,
        subject: '已保留的积分事实', affectedEmployeeId: 'employee-1', pointKind: 'GROWTH',
        ruleCode: 'R-1', ruleVersionNo: 1, calculatedPoints: 10, cappedPoints: 10,
        posting: null, balance: null,
      }])
    })
    const wrapper = mount(P015PointLedgerPage, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.text()).toContain('部分')
    expect(wrapper.text()).toContain('规则服务暂不可用')
    expect(wrapper.text()).toContain('已保留的积分事实')
    wrapper.unmount()
  })

  it('projects a P016 create 409 as conflict without replaying the write', async () => {
    sessionRequest.mockImplementation((_path, options) => {
      if (options?.method === 'POST') {
        return Promise.reject(new ApiClientError('版本已变化，请刷新', {
          kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-p016-409',
        }))
      }
      return Promise.resolve([])
    })
    const wrapper = mount(P016CareSupportPage, { props: { mode: 'center', portal } })
    await flushPromises()
    await wrapper.get('input[placeholder="关怀事项主题"]').setValue('关怀冲突测试')
    await wrapper.get('input[placeholder="受影响员工 ID"]').setValue('employee-1')
    await wrapper.get('input[placeholder="唯一来源事实编号"]').setValue('FACT-1')
    await wrapper.get('textarea[placeholder="可核验来源事实摘要"]').setValue('事实摘要')
    await wrapper.get('textarea[placeholder="不可变来源证据"]').setValue('证据')
    const createButton = wrapper.findAll('button')
      .find(button => button.text().includes('创建关怀事项'))
    expect(createButton).toBeDefined()
    await createButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('版本已变化，请刷新')
    expect(sessionRequest.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
    wrapper.unmount()
  })

  it('projects a P011 lifecycle action 409 and executes the write exactly once', async () => {
    sessionRequest.mockImplementation((path, options) => {
      if (path.endsWith('/actions/SET_TARGET') && options?.method === 'POST') {
        return Promise.reject(new ApiClientError('绩效目标版本已变化', {
          kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-p011-action-409',
        }))
      }
      return Promise.resolve([{
        id: 'cycle-1', businessNo: 'PERF-1', currentNodeCode: 'S01', status: 'ACTIVE',
        versionNo: 3, subject: '年度绩效', ownerEmployeeId: 'employee-2',
        score1000: null, appealStatus: null, scores: [],
      }])
    })
    const wrapper = mount(P011PerformancePage, { props: { mode: 'center', portal } })
    await flushPromises()
    await wrapper.get('[data-action="SET_TARGET"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('绩效目标版本已变化')
    expect(sessionRequest.mock.calls.filter(([path, options]) =>
      path.endsWith('/actions/SET_TARGET') && options?.method === 'POST')).toHaveLength(1)
    wrapper.unmount()
  })

  it('projects a P015 rule publish 409 and executes the write exactly once', async () => {
    sessionRequest.mockImplementation((path, options) => {
      if (path.endsWith('/publish') && options?.method === 'POST') {
        return Promise.reject(new ApiClientError('规则版本已变化', {
          kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-p015-publish-409',
        }))
      }
      if (path.endsWith('/point-rules')) {
        return Promise.resolve([{
          rule: {
            id: 'rule-1', ruleCode: 'RULE-1', versionNo: 1, pointKind: 'GROWTH',
            eventType: 'SERVICE', unitPoints: 1, minPoints: 0, maxPoints: 10,
            manualReviewThreshold: 10,
          },
          status: 'DRAFT', effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null, ranks: [],
        }])
      }
      return Promise.resolve([])
    })
    const wrapper = mount(P015PointLedgerPage, { props: { mode: 'tech', portal } })
    await flushPromises()
    const publishButton = wrapper.findAll('button').find(button => button.text().includes('发布规则版本'))
    expect(publishButton).toBeDefined()
    await publishButton!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('规则版本已变化')
    expect(sessionRequest.mock.calls.filter(([path, options]) =>
      path.endsWith('/publish') && options?.method === 'POST')).toHaveLength(1)
    wrapper.unmount()
  })

  it('projects a P011 create 403 as no-permission after backend adjudication', async () => {
    sessionRequest.mockImplementation((_path, options) => options?.method === 'POST'
      ? Promise.reject(new ApiClientError('无权创建绩效周期', {
        kind: 'http', status: 403, code: 'forbidden', requestId: 'req-p011-create-403',
      }))
      : Promise.resolve([]))
    const wrapper = mount(P011PerformancePage, { props: { mode: 'center', portal } })
    await flushPromises()
    await wrapper.get('input[placeholder="绩效周期主题"]').setValue('受限绩效周期')
    await wrapper.get('input[placeholder="员工 ID"]').setValue('employee-2')
    await wrapper.get('textarea[placeholder="不可变证据"]').setValue('权威证据')
    await wrapper.findAll('button').find(button => button.text().includes('创建周期'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('无权创建绩效周期')
    wrapper.unmount()
  })

  it('projects a P015 create 409 as conflict after backend adjudication', async () => {
    sessionRequest.mockImplementation((_path, options) => options?.method === 'POST'
      ? Promise.reject(new ApiClientError('积分来源版本冲突', {
        kind: 'http', status: 409, code: 'version_conflict', requestId: 'req-p015-create-409',
      }))
      : Promise.resolve([]))
    const wrapper = mount(P015PointLedgerPage, { props: { mode: 'center', portal } })
    await flushPromises()
    await wrapper.get('input[placeholder="积分业务主题"]').setValue('积分冲突')
    await wrapper.get('input[placeholder="受影响员工 ID"]').setValue('employee-2')
    await wrapper.get('input[placeholder="唯一来源事实编号"]').setValue('FACT-15')
    await wrapper.get('textarea[placeholder="可核验事实摘要"]').setValue('事实摘要')
    await wrapper.get('textarea[placeholder="不可变来源证据"]').setValue('权威证据')
    await wrapper.findAll('button').find(button => button.text().includes('创建积分业务'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('积分来源版本冲突')
    wrapper.unmount()
  })

  it('aborts an active page resource when the route page unmounts', async () => {
    let signal: AbortSignal | undefined
    sessionRequest.mockImplementation((_path, options) => {
      signal = options?.signal
      return new Promise(() => undefined)
    })
    const wrapper = mount(P011PerformancePage, { props: { mode: 'center', portal } })
    await flushPromises()
    wrapper.unmount()

    expect(signal?.aborted).toBe(true)
  })
})
