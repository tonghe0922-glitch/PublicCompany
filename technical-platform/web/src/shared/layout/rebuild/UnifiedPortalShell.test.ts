// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { PORTALS } from '../../../platform/portal-config'
import UnifiedPortalShell from './UnifiedPortalShell.vue'

async function mountShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div>首页内容</div>' } },
      { path: '/tasks', component: { template: '<div>任务内容</div>' } },
    ],
  })
  await router.push('/tasks')
  const wrapper = mount(UnifiedPortalShell, {
    props: {
      portal: PORTALS.employee,
      pageTitle: '待办与任务',
      searchItems: [{ sourceKey: 'tasks', label: '待办与任务', routePath: '/tasks' }],
    },
    slots: {
      header: '<span>当前身份</span>',
      sidebar: '<a href="#/tasks">任务导航</a>',
      bottomNav: '<a href="#/">首页导航</a>',
      default: '<section>真实业务页面</section>',
    },
    global: { plugins: [router] },
    attachTo: document.body,
  })
  return { router, wrapper }
}

describe('rebuild unified portal shell', () => {
  it('keeps route content, navigation slots and locked brand context visible', async () => {
    const { wrapper } = await mountShell()
    expect(wrapper.text()).toContain('上金谷管理平台')
    expect(wrapper.text()).toContain('数字化现场调度协同系统')
    expect(wrapper.get('.rebuild-shell__brand-tag').text()).toBe('员工端')
    expect(wrapper.get('.rebuild-shell__brand-logo').attributes('alt')).toBe('上金谷品牌标志')
    expect(wrapper.get('.rebuild-shell__brand-logo').attributes('src')).toContain('LOGO.svg')
    expect(wrapper.find('.rebuild-shell__brand-mark').exists()).toBe(false)
    expect(wrapper.text()).toContain('待办与任务')
    expect(wrapper.text()).toContain('任务导航')
    expect(wrapper.text()).toContain('真实业务页面')
    wrapper.unmount()
  })

  it('searches only supplied accessible routes and navigates through Vue Router', async () => {
    const { router, wrapper } = await mountShell()
    await wrapper.get('[data-test="shell-search"]').setValue('待办')
    const result = wrapper.findAll('.rebuild-shell__search-results button')
      .find((button) => button.text().includes('待办与任务'))
    expect(result).toBeDefined()
    await result?.trigger('click')
    expect(router.currentRoute.value.path).toBe('/tasks')
    wrapper.unmount()
  })
})
