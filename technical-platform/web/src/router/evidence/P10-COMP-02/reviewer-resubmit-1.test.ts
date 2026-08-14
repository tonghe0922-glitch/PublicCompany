import { createMemoryHistory } from 'vue-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PORTALS } from '../../../platform/portal-config'
import { PORTAL_IA_NAVIGATION } from '../../navigation-source'

type Entries = typeof PORTAL_IA_NAVIGATION

beforeAll(async () => {
  vi.doUnmock('../../navigation-source')
  await import('../../portal-router')
  vi.resetModules()
})

async function centerRouter(transform: (entries: Entries) => Entries) {
  vi.resetModules()
  vi.doMock('../../navigation-source', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../navigation-source')>()
    return { ...actual, PORTAL_IA_NAVIGATION: transform(actual.PORTAL_IA_NAVIGATION) }
  })
  const module = await import('../../portal-router')
  return module.createPortalRouter(PORTALS.center, {
    authenticated: true,
    restore: () => Promise.resolve(true),
    can: () => true,
  }, createMemoryHistory())
}

afterEach(() => {
  vi.doUnmock('../../navigation-source')
  vi.resetModules()
})

describe('P10-COMP-02 resubmit reviewer combinations', () => {
  it('keeps the unique exact-name source authoritative when a null record coexists', async () => {
    const exact = PORTAL_IA_NAVIGATION.find((entry) =>
      entry.portalCode === 'center' && entry.routeName === 'p006-meeting-management')!
    const router = await centerRouter((entries) => [...entries, {
      ...exact,
      routeName: null,
      label: 'Reviewer null decoy',
      sourceKey: 'reviewer:null-decoy',
    }])
    const route = router.getRoutes().find((record) => record.name === exact.routeName)
    expect(route?.meta.sourceKey).toBe(exact.sourceKey)
    expect(route?.meta.title).toBe(exact.label)
  })

  it('rejects duplicate exact names even when the path also has a null record', async () => {
    const exact = PORTAL_IA_NAVIGATION.find((entry) =>
      entry.portalCode === 'center' && entry.routeName === 'p006-meeting-management')!
    await expect(centerRouter((entries) => [
      ...entries,
      { ...exact, sourceKey: 'reviewer:duplicate-exact' },
      { ...exact, routeName: null, sourceKey: 'reviewer:null-decoy' },
    ])).rejects.toThrow(/ROUTE_SOURCE_AMBIGUOUS/)
  })

  it('rejects null fallback when multiple other explicit names occupy the path', async () => {
    const source = PORTAL_IA_NAVIGATION.find((entry) =>
      entry.portalCode === 'center' && entry.routePath === '/center/04/04/01')!
    await expect(centerRouter((entries) => [
      ...entries,
      { ...source, routeName: 'reviewer-explicit-a', sourceKey: 'reviewer:explicit-a' },
      { ...source, routeName: 'reviewer-explicit-b', sourceKey: 'reviewer:explicit-b' },
    ])).rejects.toThrow(/ROUTE_SOURCE_MISSING/)
  })
})
