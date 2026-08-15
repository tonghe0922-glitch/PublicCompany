// @vitest-environment happy-dom

import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { NavigationSourceEntry } from './navigation-source'
import { PORTAL_IA_NAVIGATION } from './navigation-source'
import { projectActiveNavigation, projectPortalTaxonomy, splitMobileNavigation } from './navigation-projection'
import PortalNavigation from './PortalNavigation.vue'

function entry(overrides: Partial<NavigationSourceEntry> = {}): NavigationSourceEntry {
  return {
    portalCode: 'employee',
    sourceKey: 'source-1',
    sourceFile: 'employee.xlsx',
    sourceSheet: '完整页面树',
    level1: '工作台',
    level2: '记录',
    label: '记录列表',
    routeName: 'records',
    routePath: '/records',
    permissionCodes: [],
    mobileAccess: 'full',
    status: 'planned',
    sensitiveLevel: 'DATA-L1',
    dataScope: 'SELF',
    ...overrides,
  }
}

describe('PHASE-08 navigation projection', () => {
  it('exposes the implemented P001-P005 menu entries for the three demo permission sets', () => {
    const implementedRoutePaths = new Set([
      '/employee/13/04/04', '/employee/13/04/06', '/employee/03/07/04', '/employee/03/07/05',
      '/employee/03/03/01', '/employee/03/07/01', '/employee/13/01/05',
      '/center/02/01/01', '/center/03/02/01', '/center/13/01/05',
      '/tech/03/01/01', '/tech/03/01/04', '/tech/04/01/01', '/tech/05/03/01',
    ])
    const employee = projectActiveNavigation(PORTAL_IA_NAVIGATION, {
      portalCode: 'employee', implementedRoutePaths, mobile: false,
      permissions: new Set(['p002.request.submit', 'p003.change.submit', 'p004.request.submit', 'p005.notice.read']),
    })
    const center = projectActiveNavigation(PORTAL_IA_NAVIGATION, {
      portalCode: 'center', implementedRoutePaths, mobile: false,
      permissions: new Set(['p003.change.review', 'p004.request.act', 'p005.notice.publish']),
    })
    const tech = projectActiveNavigation(PORTAL_IA_NAVIGATION, {
      portalCode: 'tech', implementedRoutePaths, mobile: false,
      permissions: new Set(['p001.session.monitor', 'p002.request.execute', 'p003.change.apply', 'p005.notice.monitor']),
    })

    expect(employee.map((item) => item.label)).toEqual(expect.arrayContaining([
      '账号安全 · MFA', '临时权限申请', '个人资料变更', '通用申请与审批', '制度通知与执行回执',
    ]))
    expect(employee).toHaveLength(7)
    expect(center).toHaveLength(3)
    expect(tech).toHaveLength(4)
  })

  it('never activates a planned business page even when the suggested route exists', () => {
    const items = projectActiveNavigation([entry()], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(['/records']), mobile: false,
    })
    expect(items).toEqual([])
  })

  it('requires both an implemented status and a real router path', () => {
    const item = entry({ status: 'implemented' })
    expect(projectActiveNavigation([item], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(), mobile: false,
    })).toEqual([])
    expect(projectActiveNavigation([item], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(['/records']), mobile: false,
    })).toHaveLength(1)
  })

  it('fails closed when any required permission is missing', () => {
    const item = entry({ status: 'implemented', permissionCodes: ['record.read', 'record.scope'] })
    const base = { portalCode: 'employee' as const, implementedRoutePaths: new Set(['/records']), mobile: false }
    expect(projectActiveNavigation([item], { ...base, permissions: new Set(['record.read']) })).toEqual([])
    expect(projectActiveNavigation([item], { ...base, permissions: new Set(['record.read', 'record.scope']) })).toHaveLength(1)
  })

  it('projects a shared any-permission entry only when one declared monitor permission is granted', () => {
    const sharedMonitor = {
      ...entry({ status: 'implemented', portalCode: 'tech', routePath: '/tech/05/03/01' }),
      permissionCodes: [],
      permissionCodesAny: ['p014.discipline.monitor', 'p016.welfare.monitor'],
    } as NavigationSourceEntry
    const base = {
      portalCode: 'tech' as const,
      implementedRoutePaths: new Set(['/tech/05/03/01']),
      mobile: false,
    }

    expect(projectActiveNavigation([sharedMonitor], { ...base, permissions: new Set() })).toEqual([])
    expect(projectActiveNavigation([sharedMonitor], {
      ...base,
      permissions: new Set(['p016.welfare.monitor']),
    })).toHaveLength(1)
  })

  it('shows shared monitor navigation to a P016-monitor-only user', () => {
    const items = projectActiveNavigation(PORTAL_IA_NAVIGATION, {
      portalCode: 'tech',
      permissions: new Set(['p016.welfare.monitor']),
      implementedRoutePaths: new Set(['/tech/05/03/01']),
      mobile: false,
    })

    expect(items.map(item => item.routePath)).toContain('/tech/05/03/01')
  })

  it('honors mobile no/limited without expanding capability', () => {
    const noItem = entry({ sourceKey: 'no', status: 'implemented', mobileAccess: 'no' })
    const limited = entry({ sourceKey: 'limited', status: 'implemented', mobileAccess: 'limited' })
    const items = projectActiveNavigation([noItem, limited], {
      portalCode: 'employee', permissions: new Set(), implementedRoutePaths: new Set(['/records']), mobile: true,
    })
    expect(items.map((item) => item.sourceKey)).toEqual(['limited'])
    expect(items[0]?.limited).toBe(true)
  })

  it('puts only already-active mobile routes into primary and More groups', () => {
    const entries = [
      entry({ sourceKey: 'a', label: 'A入口', routePath: '/a', status: 'implemented' }),
      entry({ sourceKey: 'b', label: 'B入口', routePath: '/b', status: 'implemented' }),
      entry({ sourceKey: 'c', label: 'C入口', routePath: '/c', status: 'implemented' }),
      entry({ sourceKey: 'd', label: 'D入口', routePath: '/d', status: 'implemented' }),
      entry({ sourceKey: 'planned', label: '待施工', routePath: '/planned', status: 'planned' }),
      entry({ sourceKey: 'mobile-no', label: '移动隐藏', routePath: '/mobile-no', status: 'implemented', mobileAccess: 'no' }),
    ]
    const active = projectActiveNavigation(entries, {
      portalCode: 'employee',
      permissions: new Set(),
      implementedRoutePaths: new Set(['/a', '/b', '/c', '/d', '/planned', '/mobile-no']),
      mobile: true,
    })
    const groups = splitMobileNavigation(active, 3)
    const projectedKeys = [...groups.primary, ...groups.overflow].map((item) => item.sourceKey)

    expect(groups.primary).toHaveLength(3)
    expect(groups.overflow).toHaveLength(1)
    expect(projectedKeys).toEqual(active.map((item) => item.sourceKey))
    expect(projectedKeys).not.toContain('planned')
    expect(projectedKeys).not.toContain('mobile-no')
  })

  it('deduplicates taxonomy into sourced level-one groups', () => {
    const items = projectPortalTaxonomy([
      entry({ sourceKey: '1', level1: '员工事务' }),
      entry({ sourceKey: '2', level1: '员工事务', level2: '另一个二级页' }),
      entry({ sourceKey: '3', level1: '个人中心' }),
    ], 'employee')
    expect(items).toEqual([
      { label: '个人中心', sourceCount: 1 },
      { label: '员工事务', sourceCount: 2 },
    ])
  })
})

describe('PHASE-08 PortalNavigation', () => {
  it('renders the real home route and sourced taxonomy without fake business links', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
    })
    await router.push('/')
    const wrapper = mount(PortalNavigation, {
      props: { portalCode: 'employee' },
      global: { plugins: [router] },
    })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]?.text()).toContain('首页')
    expect(links[0]?.attributes('aria-current')).toBe('page')
    expect(wrapper.findAll('[aria-disabled="true"]').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('待办 99')
  })

  it('keeps the mobile bottom navigation free of planned fake More entries', async () => {
    setActivePinia(createPinia())
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
    })
    await router.push('/')
    const wrapper = mount(PortalNavigation, {
      props: { portalCode: 'employee', mobile: true },
      global: { plugins: [router] },
    })

    expect(wrapper.classes()).toContain('portal-navigation--mobile')
    expect(wrapper.findAll('a')).toHaveLength(1)
    expect(wrapper.find('summary').exists()).toBe(false)
    expect(wrapper.text()).toContain('首页')
  })
})
