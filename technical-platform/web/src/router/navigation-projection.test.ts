// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import type { NavigationCatalogSection } from './navigation-catalog'
import type { NavigationSourceEntry } from './navigation-source'
import {
  projectActiveNavigation,
  projectNavigationGroups,
  resolveActiveGroup,
  resolveActiveItem,
} from './navigation-projection'
import PortalNavigation from './PortalNavigation.vue'

function entry(overrides: Partial<NavigationSourceEntry> = {}): NavigationSourceEntry {
  return {
    portalCode: 'employee', sourceKey: 'todo', sourceFile: 'employee.xlsx', sourceSheet: '完整页面树',
    level1: '待办与任务', level2: '我的待办', label: '我的待办', routeName: 'todo', routePath: '/todo',
    permissionCodes: [], mobileAccess: 'full', status: 'planned', sensitiveLevel: 'DATA-L1', dataScope: 'SELF',
    ...overrides,
  }
}

const catalog: readonly NavigationCatalogSection[] = [{
  key: 'tasks', label: '待办与任务', iconKey: 'tasks', mobileAccess: 'primary',
  children: [{ key: 'tasks-mine', label: '我的待办' }, { key: 'tasks-created', label: '我发起的' }],
}]

describe('navigation projection security and completeness', () => {
  it('keeps the existing search projection fail-closed', () => {
    expect(projectActiveNavigation([entry()], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(['/todo']), mobile: false,
    })).toEqual([])
    expect(projectActiveNavigation([entry({ status: 'implemented' })], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(['/todo']), mobile: false,
    })).toHaveLength(1)
  })

  it('shows every catalog item and maps missing pages to developing', () => {
    const groups = projectNavigationGroups([entry()], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(['/']), mobile: false, catalog,
    })
    expect(groups[0]?.items.map((item) => item.label)).toEqual(['我的待办', '我发起的'])
    expect(groups[0]?.items.every((item) => item.state === 'developing')).toBe(true)
    expect(groups[0]?.items[0]?.routePath).toContain('/developing?')
  })

  it('activates a real route only when router metadata authorizes it', () => {
    const source = entry({ status: 'implemented', permissionCodes: ['legacy.all'] })
    const routeAccessRules = new Map([['/todo', { any: ['todo.read', 'todo.review'] }]])
    const project = (permissions: ReadonlySet<string>) => projectNavigationGroups([source], {
      portalCode: 'employee', permissions, implementedRoutePaths: new Set(['/todo']), routeAccessRules,
      mobile: false, catalog,
    })[0]?.items[0]
    expect(project(new Set(['todo.review']))).toMatchObject({ state: 'implemented', routePath: '/todo' })
    expect(project(new Set())).toMatchObject({ state: 'unauthorized', sourceRoutePath: '/todo' })
    expect(project(new Set())?.routePath).toContain('/forbidden?')
  })

  it('resolves active parent and child for a developing route', () => {
    const groups = projectNavigationGroups([], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(), mobile: false, catalog,
    })
    expect(resolveActiveItem(groups, '/developing', 'tasks-created')?.label).toBe('我发起的')
    expect(resolveActiveGroup(groups, '/developing', 'tasks-created')?.label).toBe('待办与任务')
  })

  it('uses the same complete catalog for employee, center and tech', () => {
    const counts = (['employee', 'center', 'tech'] as const).map((portalCode) => projectNavigationGroups([], {
      portalCode, permissions: new Set(), implementedRoutePaths: new Set(['/']), mobile: false,
    }).length)
    expect(counts).toEqual([12, 12, 12])
  })
})

describe('PortalNavigation interaction', () => {
  function createTestRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/developing', component: { template: '<div />' } },
        { path: '/forbidden', component: { template: '<div />' } },
      ],
    })
  }

  it('renders all groups and routes an unfinished child to the placeholder', async () => {
    setActivePinia(createPinia())
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(PortalNavigation, {
      props: { portalCode: 'employee' }, global: { plugins: [router] }, attachTo: document.body,
    })
    expect(wrapper.findAll('.portal-navigation__group')).toHaveLength(12)
    expect(wrapper.text()).toContain('中心事务')
    const tasks = wrapper.findAll('.portal-navigation__group-button').find((button) => button.text().includes('待办与任务'))
    await tasks?.trigger('click')
    expect(router.currentRoute.value.path).toBe('/developing')
    expect(router.currentRoute.value.query.group).toBe('待办与任务')
    wrapper.unmount()
  })

  it('keeps four high-frequency entries plus More in the mobile bar', async () => {
    setActivePinia(createPinia())
    const router = createTestRouter()
    await router.push('/')
    const wrapper = mount(PortalNavigation, {
      props: { portalCode: 'tech', mobile: true }, global: { plugins: [router] },
    })
    expect(wrapper.findAll('.portal-navigation__mobile-list > li')).toHaveLength(5)
    expect(wrapper.find('summary').text()).toContain('更多')
  })
})
