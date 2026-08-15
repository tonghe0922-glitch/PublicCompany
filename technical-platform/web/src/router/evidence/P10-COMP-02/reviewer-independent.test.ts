import { createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../navigation-source', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../navigation-source')>()
  return {
    ...actual,
    PORTAL_IA_NAVIGATION: [
      ...actual.PORTAL_IA_NAVIGATION,
      {
        ...actual.PORTAL_IA_NAVIGATION.find((entry) =>
          entry.portalCode === 'center' && entry.routePath === '/center/04/04/01')!,
        routeName: 'different-explicit-route',
        sourceKey: 'reviewer:conflicting-explicit-route',
      },
    ],
  }
})

import { PORTALS } from '../../../platform/portal-config'
import { createPortalRouter, type PortalRouterSession } from '../../portal-router'

const session: PortalRouterSession = {
  authenticated: true,
  restore: () => Promise.resolve(true),
  can: () => true,
}

describe('P10-COMP-02 reviewer fail-closed variants', () => {
  it('rejects null-name fallback when the authoritative path also has an explicit name', () => {
    expect(() => createPortalRouter(PORTALS.center, session, createMemoryHistory()))
      .toThrow(/ROUTE_SOURCE_(MISSING|AMBIGUOUS)/)
  })
})
