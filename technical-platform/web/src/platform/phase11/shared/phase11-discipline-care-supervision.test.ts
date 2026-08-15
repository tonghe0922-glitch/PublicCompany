// @vitest-environment happy-dom

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import Phase11DisciplineCareSupervisionFeature from './Phase11DisciplineCareSupervisionFeature.vue'

const pagePath = resolve('src/platform/pages/Phase11DisciplineCareSupervisionPage.vue')
const featurePath = resolve('src/platform/phase11/shared/Phase11DisciplineCareSupervisionFeature.vue')
const p014FeaturePath = resolve('src/platform/phase11/p014/P014DisciplineFeature.vue')
const p016FeaturePath = resolve('src/platform/phase11/p016/P016CareSupportFeature.vue')

const permissions = new Set<string>()

vi.mock('../../../session', () => ({
  usePortalSessionStore: () => ({
    can: (permission: string) => permissions.has(permission),
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

const processFeatureStubs = {
  P014DisciplineFeature: {
    props: ['portal', 'mode', 'headingLevel'],
    template: '<div data-process="P014" :data-heading-level="headingLevel" />',
  },
  P016CareSupportFeature: {
    props: ['portal', 'mode', 'headingLevel'],
    template: '<div data-process="P016" :data-heading-level="headingLevel" />',
  },
}

describe('Phase 11 discipline and care shared supervision boundary', () => {
  it('provides an explicit thin route page and shared feature', () => {
    expect(existsSync(pagePath), 'Phase11DisciplineCareSupervisionPage.vue must exist').toBe(true)
    expect(existsSync(featurePath), 'Phase11DisciplineCareSupervisionFeature.vue must exist').toBe(true)
  })

  it('composes process features directly and never nests a route page', () => {
    expect(existsSync(pagePath), 'shared supervision page must exist').toBe(true)
    expect(existsSync(featurePath), 'shared supervision feature must exist').toBe(true)
    if (!existsSync(pagePath) || !existsSync(featurePath)) return
    const page = readFileSync(pagePath, 'utf8')
    const feature = readFileSync(featurePath, 'utf8')

    expect(page).toContain('Phase11DisciplineCareSupervisionFeature')
    expect(page).not.toMatch(/P014DisciplineFeature|P016CareSupportFeature/u)
    expect(feature).toContain('P014DisciplineFeature')
    expect(feature).toContain('P016CareSupportFeature')
    expect(feature).not.toMatch(/import\s+\w+Page\s+from|<\w+Page\b/u)
    expect(feature).toContain('PermissionGate')
  })

  it.each([
    ['P014 only', 'p014.discipline', 'data-testid="p014-supervision-section"'],
    ['P016 only', 'p016.welfare', 'data-testid="p016-supervision-section"'],
  ])('declares an independent permission and mount boundary for %s', (_label, permission, section) => {
    expect(existsSync(featurePath), 'shared supervision feature must exist').toBe(true)
    if (!existsSync(featurePath)) return
    const source = readFileSync(featurePath, 'utf8')
    expect(source).toContain(permission)
    expect(source).toContain(section)
  })

  it('leaves the route h1 to PortalShell and binds nested business headings at level 2', () => {
    const shared = readFileSync(featurePath, 'utf8')
    const p014 = readFileSync(p014FeaturePath, 'utf8')
    const p016 = readFileSync(p016FeaturePath, 'utf8')

    expect(shared).not.toMatch(/<h1\b/iu)
    expect(shared.match(/:heading-level="2"/gu)).toHaveLength(2)
    for (const source of [p014, p016]) {
      expect(source).toContain('headingLevel?: 1 | 2 | 3')
      expect(source).toContain('headingLevel: 1')
      expect(source).toContain(':heading-level="headingLevel"')
    }
  })

  it.each([
    { label: 'P014 only', allowed: ['p014.discipline.read'], visible: ['P014'], hidden: ['P016'] },
    { label: 'P016 only', allowed: ['p016.welfare.read'], visible: ['P016'], hidden: ['P014'] },
    { label: 'both', allowed: ['p014.discipline.read', 'p016.welfare.read'], visible: ['P014', 'P016'], hidden: [] },
    { label: 'neither', allowed: [], visible: [], hidden: ['P014', 'P016'] },
  ])('mounts $label without a local h1 and passes heading level 2 to visible children', ({ allowed, visible, hidden }) => {
    permissions.clear()
    allowed.forEach(permission => permissions.add(permission))
    const wrapper = mount(Phase11DisciplineCareSupervisionFeature, {
      props: { portal },
      global: { stubs: processFeatureStubs },
    })

    expect(wrapper.findAll('h1')).toHaveLength(0)
    visible.forEach(code => {
      expect(wrapper.get(`[data-process="${code}"]`).attributes('data-heading-level')).toBe('2')
    })
    hidden.forEach(code => expect(wrapper.find(`[data-process="${code}"]`).exists()).toBe(false))
  })
})
