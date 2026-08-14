// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../api'
import P011PerformancePage from '../pages/P011PerformancePage.vue'
import p011 from '../pages/P011PerformancePage.vue?raw'
import p012 from '../pages/P012PromotionPage.vue?raw'
import p013 from '../pages/P013RewardPage.vue?raw'
import p014 from '../pages/P014DisciplinePage.vue?raw'
import p015 from '../pages/P015PointLedgerPage.vue?raw'
import p016 from '../pages/P016CareSupportPage.vue?raw'

const sessionRequest = vi.fn()

vi.mock('../../session', () => ({
  usePortalSessionStore: () => ({
    session: { employeeId: 'employee-1' },
    can: () => true,
    request: sessionRequest,
  }),
}))

const pages = {
  'P011PerformancePage.vue': p011,
  'P012PromotionPage.vue': p012,
  'P013RewardPage.vue': p013,
  'P014DisciplinePage.vue': p014,
  'P015PointLedgerPage.vue': p015,
  'P016CareSupportPage.vue': p016,
} as const

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

    expect(sessionRequest).toHaveBeenCalledWith('/api/v1/processes/P011/performance-cycles')
    expect(wrapper.text()).toContain('服务端拒绝当前数据范围')
    expect(wrapper.text()).not.toContain('暂无绩效周期')
  })

  it.each(Object.entries(pages))('%s uses only public design-system interaction primitives', (_name, page) => {

    expect(page).not.toMatch(/<(?:input|select|textarea|button)\b/i)
    expect(page).toContain("from '../../design-system'")
    expect(page).toMatch(/Sgj(?:Button|Input|Select|Textarea|Checkbox|DateTime)/)
    expect(page).toMatch(/Sgj(?:Loading|Empty|Error|PartialFailure|NoPermission|Conflict)/)
  })

  it.each(Object.entries(pages))('%s does not collapse every resource and action into global busy/feedback', (_name, page) => {

    expect(page).not.toMatch(/\bbusy\s*=\s*ref\(/)
    expect(page).not.toMatch(/\bfeedback\s*=\s*ref\(/)
    expect(page).toContain('useProcessOperation')
  })

  it.each(Object.entries(pages))('%s projects authoritative backend permission denial explicitly', (_name, page) => {
    expect(page).toContain("failure === 'no-permission'")
    expect(page).toContain('SgjNoPermission')
  })

  it.each(Object.entries(pages))('%s uses the public card header slot rather than an unsupported title prop', (_name, page) => {
    expect(page).not.toMatch(/<SgjCard\b[^>]*\btitle=/)
  })

  it.each(Object.entries(pages))('%s keeps functions readable instead of semicolon-compressed one-liners', (_name, page) => {
    const compressedFunctions = page
      .split(/\r?\n/)
      .filter((line) => /(?:async\s+)?function\s+\w+/.test(line) && (line.match(/;/g)?.length ?? 0) >= 2)

    expect(compressedFunctions).toEqual([])
  })
})
