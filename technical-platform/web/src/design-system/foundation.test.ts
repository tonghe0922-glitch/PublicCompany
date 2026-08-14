/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import portalNavigationSource from '../router/PortalNavigation.vue?raw'
import { eventValue } from './eventValue'

function collectTokens(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)]
    .map((match) => match[1])
    .filter((token): token is string => Boolean(token))
}

function collectDesignSystemStyles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return collectDesignSystemStyles(path)
    return /\.(?:css|vue)$/.test(entry.name) ? [readFileSync(path, 'utf8')] : []
  })
}

describe('PHASE-07 form event contract', () => {
  it('normalizes valid form event values', () => {
    const event = { target: { value: '财神谷' } } as unknown as Event
    expect(eventValue(event)).toBe('财神谷')
  })

  it('fails closed for missing or non-string values', () => {
    expect(eventValue({ target: null } as unknown as Event)).toBe('')
    expect(eventValue({ target: { value: 42 } } as unknown as Event)).toBe('')
  })

  it('defines every semantic token consumed by the design system and PortalNavigation', () => {
    const tokenSource = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
    const designSystemRoot = fileURLToPath(new URL('.', import.meta.url))
    const defined = new Set(collectTokens(tokenSource, /(--sgj-[a-z0-9-]+)\s*:/g))
    const consumed = new Set(
      [...collectDesignSystemStyles(designSystemRoot), portalNavigationSource]
        .flatMap((source) => collectTokens(source, /var\((--sgj-[a-z0-9-]+)/g)),
    )
    expect([...consumed].filter((token) => !defined.has(token))).toEqual([])
    expect(portalNavigationSource).toContain('var(--sgj-shadow-overlay)')
    expect(portalNavigationSource).not.toContain('var(--sgj-shadow-lg)')
    expect(defined.has('--sgj-shadow-overlay')).toBe(true)
    expect(consumed.has('--sgj-shadow-overlay')).toBe(true)
  })
})
