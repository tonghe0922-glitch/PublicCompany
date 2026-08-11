import { describe, expect, it } from 'vitest'
import { PORTALS, PORTAL_RUNTIME_ALIASES } from './portal-config'

describe('portal definitions', () => {
  it('uses exactly the three canonical portal codes', () => {
    expect(Object.keys(PORTALS).sort()).toEqual(['center', 'employee', 'tech'])
  })

  it('maps canonical tech to the approved admin runtime/build alias', () => {
    expect(PORTAL_RUNTIME_ALIASES).toEqual({
      employee: 'employee',
      center: 'center',
      tech: 'admin',
    })
    expect(PORTALS.tech.runtimeCode).toBe('admin')
    expect(Object.values(PORTALS).map((portal) => portal.runtimeCode).sort()).toEqual(['admin', 'center', 'employee'])
  })

  it('does not model tech as a business super administrator', () => {
    expect(PORTALS.tech.description).toContain('不代表业务超级管理员')
  })

  it('keeps the three home responsibilities distinct and free of engineering evidence', () => {
    expect(new Set(Object.values(PORTALS).map((portal) => portal.homeTitle)).size).toBe(3)
    expect(PORTALS.employee.homeTitle).toBe('员工工作入口')
    expect(PORTALS.center.homeTitle).toBe('中心管理工作入口')
    expect(PORTALS.tech.homeTitle).toBe('技术运行工作入口')

    const serialized = JSON.stringify(PORTALS)
    expect(serialized).not.toMatch(/\bP\d{3}\b/)
    expect(serialized).not.toContain('/api/v1/phase05/')
    expect(serialized).not.toMatch(/\b(?:welfare|document|integration|audit)\.[a-z_]+\b/)
  })
})
