// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../api'
import type { ApiRequestOptions } from '../../api'
import P011PerformancePage from '../pages/P011PerformancePage.vue'
import P012PromotionPage from '../pages/P012PromotionPage.vue'
import P013RewardPage from '../pages/P013RewardPage.vue'
import P014DisciplinePage from '../pages/P014DisciplinePage.vue'
import P015PointLedgerPage from '../pages/P015PointLedgerPage.vue'
import P016CareSupportPage from '../pages/P016CareSupportPage.vue'
import p011 from '../pages/P011PerformancePage.vue?raw'
import p012 from '../pages/P012PromotionPage.vue?raw'
import p013 from '../pages/P013RewardPage.vue?raw'
import p014 from '../pages/P014DisciplinePage.vue?raw'
import p015 from '../pages/P015PointLedgerPage.vue?raw'
import p016 from '../pages/P016CareSupportPage.vue?raw'

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
  page('P011', 'P011PerformancePage.vue', p011, P011PerformancePage, 'p011/P011PerformanceFeature.vue', 'P011PerformanceFeature', 'p011-page', 'use-p011-performance'),
  page('P012', 'P012PromotionPage.vue', p012, P012PromotionPage, 'p012/P012PromotionFeature.vue', 'P012PromotionFeature', 'p012-page', 'use-p012-promotion'),
  page('P013', 'P013RewardPage.vue', p013, P013RewardPage, 'p013/P013RewardFeature.vue', 'P013RewardFeature', 'p013-page', 'use-p013-reward'),
  page('P014', 'P014DisciplinePage.vue', p014, P014DisciplinePage, 'p014/P014DisciplineFeature.vue', 'P014DisciplineFeature', 'p014-page', 'use-p014-discipline'),
  page('P015', 'P015PointLedgerPage.vue', p015, P015PointLedgerPage, 'p015/P015PointLedgerFeature.vue', 'P015PointLedgerFeature', 'p015-page', 'use-p015-point-ledger'),
  page('P016', 'P016CareSupportPage.vue', p016, P016CareSupportPage, 'p016/P016CareSupportFeature.vue', 'P016CareSupportFeature', 'p016-page', 'use-p016-care-support'),
] as const

const mountRecords: Record<string, unknown[]> = {
  P012: [{
    id: 'promotion-1', businessNo: 'P012-1', currentNodeCode: null, status: 'ARCHIVED',
    versionNo: 1, subject: '晋升夹具', ownerEmployeeId: 'employee-2',
    targetPositionCode: 'POSITION-2', plannedEffectiveDate: '2026-09-01', executions: [],
  }],
  P013: [{
    id: 'reward-1', businessNo: 'P013-1', currentNodeCode: null, status: 'ARCHIVED',
    versionNo: 1, subject: '奖励夹具', ownerEmployeeId: 'employee-2', sourceFactKey: 'FACT-13',
    employeeEventType: 'SERVICE', impacts: [], receipts: [],
  }],
  P014: [{
    id: 'discipline-1', businessNo: 'P014-1', currentNodeCode: 'END', status: 'ARCHIVED',
    versionNo: 1, subject: '纪律夹具', affectedEmployeeId: 'employee-2', sourceFactKey: 'FACT-14',
    businessObjectNo: 'CASE-14', decisions: [], impacts: [], receipts: [],
  }],
}

function page(
  code: string,
  name: string,
  raw: string,
  component: typeof P011PerformancePage,
  featurePath: string,
  featureTag: string,
  testId: string,
  composableName: string,
) {
  return { code, name, raw, component, featurePath, featureTag, testId, composableName }
}

beforeEach(() => {
  sessionRequest.mockReset()
})

describe('PHASE-11 production page architecture', () => {
  it('renders an authoritative backend 403 as no-permission after issuing the real collection request', async () => {
    sessionRequest.mockRejectedValueOnce(new ApiClientError('服务端拒绝当前数据范围', {
      kind: 'http',
      status: 403,
      code: 'forbidden',
      requestId: 'req-page-403',
    }))

    const wrapper = mount(P011PerformancePage, {
      props: {
        mode: 'center',
        portal: {
          code: 'center',
          runtimeCode: 'center',
          title: '中心管理端',
          description: '',
          homeTitle: '',
          homeFocus: [],
        },
      },
    })
    await flushPromises()

    const [path, options] = sessionRequest.mock.calls[0] ?? []
    expect(path).toBe('/api/v1/processes/P011/performance-cycles')
    expect(options?.signal).toBeInstanceOf(AbortSignal)
    expect(wrapper.text()).toContain('服务端拒绝当前数据范围')
    expect(wrapper.text()).not.toContain('暂无绩效周期')
  })

  it.each(pages)('$name mounts the route shell and renders its unique feature root', async item => {
    sessionRequest.mockResolvedValue(mountRecords[item.code] ?? [])
    const wrapper = mount(item.component, { props: { mode: 'center', portal } })
    await flushPromises()

    expect(wrapper.get(`[data-testid="${item.testId}"]`).attributes('data-testid')).toBe(item.testId)
    wrapper.unmount()
  })

  it.each(pages)('$name is an exact thin shell that delegates to one process-local feature', item => {
    expect(item.raw).toContain(`import ${item.featureTag} from '../phase11/${item.featurePath}'`)
    expect(item.raw).toContain('const props = defineProps<')
    expect(item.raw).toContain(`<${item.featureTag} v-bind="props" />`)
    expect(item.raw).not.toMatch(/design-system|usePortalSessionStore|session\.request|useProcessOperation|Sgj[A-Z]/u)
    expect(item.raw).not.toMatch(/<(?:input|select|textarea|button)\b/iu)
  })

  it.each(pages)('$name feature owns public UI, state projection and the process composable', item => {
    const featureUrl = resolve(process.cwd(), 'src/platform/phase11', item.featurePath)
    expect(existsSync(featureUrl), `${item.code} feature is required`).toBe(true)
    if (!existsSync(featureUrl)) return
    const feature = readFileSync(featureUrl, 'utf8')

    expect(feature).toContain("from '@sgj/ui'")
    expect(feature).toContain(item.composableName)
    expect(feature).toContain(`data-testid="${item.testId}"`)
    expect(feature).toMatch(/Sgj(?:Button|Input|Select|Textarea|Checkbox|DateTime)/u)
    expect(feature).toContain('SgjLoading')
    expect(feature).toContain('SgjEmpty')
    expect(feature).toContain('SgjError')
    expect(feature).toContain('SgjNoPermission')
    expect(feature).toContain('SgjConflict')
    if (item.code === 'P015') expect(feature).toContain('SgjPartialFailure')
    else expect(feature).not.toContain('SgjPartialFailure')
  })

  it.each(pages)('$name feature does not collapse resources and actions into global busy/feedback', item => {
    const featureUrl = resolve(process.cwd(), 'src/platform/phase11', item.featurePath)
    if (!existsSync(featureUrl)) return
    const feature = readFileSync(featureUrl, 'utf8')
    expect(feature).not.toMatch(/\bbusy\s*=\s*ref\(/u)
    expect(feature).not.toMatch(/\bfeedback\s*=\s*ref\(/u)
  })

  it.each(pages)('$name feature uses the public card header slot rather than an unsupported title prop', item => {
    const featureUrl = resolve(process.cwd(), 'src/platform/phase11', item.featurePath)
    if (!existsSync(featureUrl)) return
    expect(readFileSync(featureUrl, 'utf8')).not.toMatch(/<SgjCard\b[^>]*\btitle=/u)
  })

  it.each(pages)('$name feature keeps functions readable instead of semicolon-compressed one-liners', item => {
    const featureUrl = resolve(process.cwd(), 'src/platform/phase11', item.featurePath)
    if (!existsSync(featureUrl)) return
    const compressedFunctions = readFileSync(featureUrl, 'utf8')
      .split(/\r?\n/)
      .filter((line) => /(?:async\s+)?function\s+\w+/.test(line) && (line.match(/;/g)?.length ?? 0) >= 2)

    expect(compressedFunctions).toEqual([])
  })
})
