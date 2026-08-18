import { describe, expect, it } from 'vitest'
import appSource from '../platform/create-portal-app.ts?raw'
import styleEntry from '../styles.css?raw'
import tokenSource from './tokens.css?raw'
import shellSource from '../shared/layout/rebuild/rebuild-shell.css?raw'

describe('Rebuild website design-system entry', () => {
  it('loads the global style entry for every portal application', () => {
    expect(appSource).toContain("import '../styles.css'")
  })

  it('loads the complete design system and the rebuilt shell in deterministic order', () => {
    const expectedImports = [
      './design-system/tokens.css',
      './design-system/base.css',
      './design-system/components.css',
      './design-system/templates.css',
      './design-system/extended.css',
      './platform/phase10/phase10.css',
      './shared/layout/rebuild/rebuild-shell.css',
      './design-system/reference-theme.css',
    ]
    let previousIndex = -1
    for (const path of expectedImports) {
      const currentIndex = styleEntry.indexOf(path)
      expect(currentIndex).toBeGreaterThan(previousIndex)
      previousIndex = currentIndex
    }
  })

  it('uses the latest warm amber-orange reference instead of the old indigo token set', () => {
    expect(tokenSource).toContain('--sgj-brand-600: #ea580c')
    expect(tokenSource).toContain('--sgj-canvas: #f4f4f7')
    expect(tokenSource).not.toContain('#4f46e5')
  })

  it('keeps desktop, drawer and mobile-bottom-navigation shell contracts', () => {
    expect(shellSource).toContain('.rebuild-shell__sidebar')
    expect(shellSource).toContain('.rebuild-shell--drawer-open')
    expect(shellSource).toContain('.rebuild-shell__bottom-nav')
  })
})
