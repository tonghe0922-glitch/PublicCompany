import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageNames = [
  'P001IdentityPage',
  'P002PermissionRequestPage',
  'P003ProfileChangePage',
  'P004GenericRequestPage',
  'P005NoticePage',
] as const

const legacyPaths = [
  'src/platform/AuthenticatedPortalLayout.vue',
  'src/platform/pages/ForbiddenPage.vue',
  'src/platform/pages/LoginPage.vue',
  'src/platform/pages/NotFoundPage.vue',
  'src/platform/PortalRuntimeRoot.vue',
  'src/platform/PortalSessionHeader.vue',
] as const

const sourceFingerprints: Record<(typeof pageNames)[number], readonly string[]> = {
  P001IdentityPage: [
    '<section class="phase09-page">',
    'data-testid="p001-mfa-status"',
    '6 位验证码',
    'placeholder="UUID；留空查看本人"',
    '/api/v1/processes/P001/mfa/totp',
    '/api/v1/processes/P001/sessions',
    '/api/v1/processes/P001/mfa/totp/enroll',
    '/api/v1/processes/P001/mfa/totp/confirm',
    '@click="enroll"',
    '@click="confirm"',
    '@click="disable"',
  ],
  P002PermissionRequestPage: [
    'data-testid="p002-page"',
    '申请角色 ID',
    '提交权限申请',
    '/api/v1/processes/P002/permission-requests',
    '/actions/review',
    '/actions/execute',
    '/actions/revoke',
    "review(record, 'APPROVE')",
    "review(record, 'REJECT')",
  ],
  P003ProfileChangePage: [
    'data-testid="p003-page"',
    'placeholder="P3 字段必填"',
    '提交资料变更',
    '/api/v1/processes/P003/profile-changes',
    '/actions/review',
    '/actions/apply',
    "review(record, 'APPROVE')",
    "review(record, 'REJECT')",
  ],
  P004GenericRequestPage: [
    'data-testid="p004-page"',
    '申请金额（可选）',
    'placeholder="执行、验收、补偿或归档时按实际需要填写"',
    '提交申请',
    '/api/v1/processes/P004/generic-requests',
    '/actions/${action}',
    '@click="submit"',
    '@click="() => run(load)"',
  ],
  P005NoticePage: [
    'data-testid="p005-page"',
    'placeholder="到执行任务节点后填写"',
    '发布制度通知',
    '/api/v1/processes/P005/notices',
    '/actions/${actionCode}',
    '@click="publish"',
    'receipt(view, receiptAction(view)!)',
    'manage(view, action.code)',
  ],
}

function readWeb(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8')
}

function pageSource(pageName: (typeof pageNames)[number]): string {
  return readWeb(`src/platform/pages/${pageName}.vue`)
}

function collectComponentIds(value: unknown, result: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectComponentIds(item, result)
    return
  }
  if (typeof value !== 'object' || value === null) return
  for (const [key, item] of Object.entries(value)) {
    if (key === 'component_id' && typeof item === 'string') result.add(item)
    collectComponentIds(item, result)
  }
}

describe('CXR-08 PHASE-09 UI component migration contract', () => {
  it('removes every raw interactive element from P001-P005', () => {
    const counts = Object.fromEntries(pageNames.map((pageName) => [
      pageName,
      pageSource(pageName).match(/<(?:input|select|textarea|button|table)\b/gu)?.length ?? 0,
    ]))
    expect(counts).toEqual(Object.fromEntries(pageNames.map((pageName) => [pageName, 0])))
  })

  it('uses only the public @sgj/ui entrypoint in the six legacy consumers', () => {
    const violations = legacyPaths.flatMap((path) => {
      const source = readWeb(path)
      return source.match(/from\s+['"][^'"]*design-system[^'"]*['"]/gu)?.map((entry) => `${path}:${entry}`) ?? []
    })
    expect(violations).toEqual([])
  })

  it('uses public @sgj/ui controls without deep imports in P001-P005', () => {
    const violations = pageNames.flatMap((pageName) => {
      const source = pageSource(pageName)
      const issues: string[] = []
      if (!/from\s+['"]@sgj\/ui['"]/u.test(source)) issues.push(`${pageName}:PUBLIC_IMPORT_MISSING`)
      if (/from\s+['"][^'"]*design-system[^'"]*['"]/u.test(source)) issues.push(`${pageName}:DEEP_IMPORT`)
      return issues
    })
    expect(violations).toEqual([])
  })

  for (const pageName of pageNames) {
    it(`preserves ${pageName} locator, label and API fingerprints`, () => {
      const source = pageSource(pageName)
      const missing = sourceFingerprints[pageName].filter((fingerprint) => !source.includes(fingerprint))
      expect(missing).toEqual([])
    })
  }

  it('keeps five plans registry-valid and removes deferred raw-control debt', () => {
    const registry = JSON.parse(readFileSync(
      resolve(process.cwd(), '../../docs/implementation/ui/UI_COMPONENT_REGISTRY.json'),
      'utf8',
    )) as { components: Array<{ id: string }> }
    const registered = new Set(registry.components.map((component) => component.id))
    const issues: string[] = []
    for (const pageName of pageNames) {
      const planSource = readWeb(`src/platform/pages/${pageName}.ui-plan.json`)
      const plan = JSON.parse(planSource) as unknown
      const componentIds = new Set<string>()
      collectComponentIds(plan, componentIds)
      for (const componentId of componentIds) {
        if (!registered.has(componentId)) issues.push(`${pageName}:UNKNOWN_COMPONENT:${componentId}`)
      }
      if (/deferred-existing-debt|legacy debt|future debt|migration is deferred|is deferred|raw form/iu.test(planSource)) {
        issues.push(`${pageName}:DEFERRED_RAW_CONTROL_DEBT`)
      }
    }
    expect(issues).toEqual([])
  })
})
