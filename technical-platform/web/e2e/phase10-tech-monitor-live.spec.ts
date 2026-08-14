import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

const api = 'http://127.0.0.1:18093'
const techBase = 'http://127.0.0.1:5372/admin.html'
const monitorRoute = `${techBase}#/tech/05/03/01`
const p004ProjectionPath = '/api/v1/processes/P004/monitor-projections'
const p005ProjectionPath = '/api/v1/processes/P005/monitor-projections'
const p004Keys = ['businessNo', 'currentNodeCode', 'processCode', 'recordId', 'status', 'updatedAt', 'versionNo']
const p005Keys = [...p004Keys, 'approvedCount'].sort()

interface FixtureRuntime {
  baseUrl: string
  tenantCode: string
  password: string
  techLogin: string
  outLogin: string
  deniedLogin: string
  p004RecordId: string
  p004BusinessNo: string
  p004Node: string
  p004Version: number
  p005RecordId: string
  p005BusinessNo: string
  p005Node: string
  p005Version: number
}

interface Projection {
  recordId: string
  businessNo: string
  processCode: 'P004' | 'P005'
  currentNodeCode: string
  status: string
  versionNo: number
  updatedAt: string
  approvedCount?: number
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}

async function apiLogin(request: APIRequestContext, runtime: FixtureRuntime, loginName: string): Promise<string> {
  const response = await request.post(`${api}/api/v1/auth/login`, {
    data: { tenantCode: runtime.tenantCode, loginName, password: runtime.password },
  })
  expect(response.status()).toBe(200)
  return ((await response.json()) as { accessToken: string }).accessToken
}

async function browserLogin(page: Page, runtime: FixtureRuntime, loginName: string): Promise<void> {
  await page.goto(techBase)
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.goto(`${techBase}#/login`)
  await page.locator('input[name="tenantCode"]').fill(runtime.tenantCode)
  await page.locator('input[name="username"]').fill(loginName)
  await page.locator('input[name="password"]').fill(runtime.password)
  await page.locator('form button[type="submit"]').click()
  await expect(page).not.toHaveURL(/#\/login/u)
}

async function projectionGet(
  request: APIRequestContext,
  token: string,
  path: string,
): Promise<{ responseStatus: number; body: Projection[] }> {
  const response = await request.get(`${api}${path}`, { headers: auth(token) })
  return { responseStatus: response.status(), body: response.ok() ? await response.json() as Projection[] : [] }
}

async function serialized(locator: Locator): Promise<string> {
  return locator.evaluate((root) => {
    const elements = [root, ...root.querySelectorAll('*')]
    const attributes = elements.flatMap(element => [...element.attributes].map(attribute => `${attribute.name}=${attribute.value}`))
    return [root.textContent ?? '', root.innerHTML, ...attributes].join('\n')
  })
}

async function openMonitorAndWait(page: Page): Promise<void> {
  const responses = [p004ProjectionPath, p005ProjectionPath].map(path => page.waitForResponse(response => (
    response.request().method() === 'GET' && new URL(response.url()).pathname === path
  )))
  await page.goto(monitorRoute)
  for (const response of await Promise.all(responses)) expect(response.status()).toBe(200)
}

async function expectTechApi(runtime: FixtureRuntime, request: APIRequestContext, token: string): Promise<void> {
  const p004 = await projectionGet(request, token, p004ProjectionPath)
  const p005 = await projectionGet(request, token, p005ProjectionPath)
  expect(p004.responseStatus).toBe(200)
  expect(p005.responseStatus).toBe(200)
  expect(p004.body).toHaveLength(1)
  expect(p005.body).toHaveLength(1)
  expect(Object.keys(p004.body[0] ?? {}).sort()).toEqual(p004Keys)
  expect(Object.keys(p005.body[0] ?? {}).sort()).toEqual(p005Keys)
  expect(p004.body[0]).toMatchObject({ recordId: runtime.p004RecordId, businessNo: runtime.p004BusinessNo, processCode: 'P004' })
  expect(p005.body[0]).toMatchObject({ recordId: runtime.p005RecordId, businessNo: runtime.p005BusinessNo, processCode: 'P005' })
}

async function expectTechMutationsForbidden(runtime: FixtureRuntime, request: APIRequestContext, token: string): Promise<void> {
  const p004 = await request.post(`${api}/api/v1/processes/P004/generic-requests/${runtime.p004RecordId}/actions/ACCEPT`, {
    headers: { ...auth(token), 'Idempotency-Key': `tech-monitor-p004-${randomUUID()}` },
    data: { expectedVersion: runtime.p004Version, reason: 'permission boundary probe', resultSummary: 'not authorized', actualAmount: null },
  })
  const p005 = await request.post(`${api}/api/v1/processes/P005/notices/${runtime.p005RecordId}/actions/ARCHIVE`, {
    headers: { ...auth(token), 'Idempotency-Key': `tech-monitor-p005-${randomUUID()}` },
    data: { expectedVersion: runtime.p005Version, reason: 'permission boundary probe' },
  })
  expect(p004.status()).toBe(403)
  expect(p005.status()).toBe(403)
}

test('fresh technical monitor projects only authorized P004/P005 allowlist facts', async ({ page, request }) => {
  const runtime = JSON.parse(await readFile(resolve(
    process.cwd(), '../backend/apps/api/target/phase10-tech-monitor-fixture-runtime.json',
  ), 'utf8')) as FixtureRuntime
  expect(runtime.baseUrl).toBe(api)
  const techToken = await apiLogin(request, runtime, runtime.techLogin)
  const outToken = await apiLogin(request, runtime, runtime.outLogin)
  const deniedToken = await apiLogin(request, runtime, runtime.deniedLogin)
  await expectTechApi(runtime, request, techToken)
  await expectTechMutationsForbidden(runtime, request, techToken)

  const pageOriginMutations: string[] = []
  page.on('request', current => {
    const path = new URL(current.url()).pathname
    if (/^(POST|PUT|PATCH|DELETE)$/u.test(current.method()) && /^\/api\/v1\/processes\/P00[45]\//u.test(path)) {
      pageOriginMutations.push(`${current.method()} ${path}`)
    }
  })
  await browserLogin(page, runtime, runtime.techLogin)
  await openMonitorAndWait(page)
  const monitor = page.locator('[data-testid="phase09-tech-workflow-monitor"]')
  await expect(monitor).toBeVisible()
  const p004 = monitor.locator('[data-monitor-process="P004"]')
  const p005 = monitor.locator('[data-monitor-process="P005"]')
  await expect(p004).toContainText(runtime.p004BusinessNo)
  await expect(p005).toContainText(runtime.p005BusinessNo)
  await expect(p004.locator('th')).toHaveCount(6)
  await expect(p005.locator('th')).toHaveCount(7)
  await expect(p004).not.toContainText('approvedCount')
  await expect(p005).toContainText('0')
  await expect(monitor.locator('input, textarea, select, [data-action-code], [data-submit-create]')).toHaveCount(0)
  const serializedMonitor = await serialized(monitor)
  for (const secret of [
    'P004 monitor seed', 'Source-backed fixture request', 'Create a minimal monitor projection',
    'P005 monitor seed', 'Fixture-only policy body', 'TECH-MONITOR', 'Tech Monitor Actor',
  ]) expect(serializedMonitor).not.toContain(secret)
  expect(pageOriginMutations).toEqual([])

  const outP004 = await projectionGet(request, outToken, p004ProjectionPath)
  const outP005 = await projectionGet(request, outToken, p005ProjectionPath)
  expect(outP004).toEqual({ responseStatus: 200, body: [] })
  expect(outP005).toEqual({ responseStatus: 200, body: [] })
  await browserLogin(page, runtime, runtime.outLogin)
  await openMonitorAndWait(page)
  const outMonitor = page.locator('[data-testid="phase09-tech-workflow-monitor"]')
  await expect(outMonitor).toBeVisible()
  await expect(outMonitor).not.toContainText(runtime.p004BusinessNo)
  await expect(outMonitor).not.toContainText(runtime.p005BusinessNo)

  expect((await projectionGet(request, deniedToken, p004ProjectionPath)).responseStatus).toBe(403)
  expect((await projectionGet(request, deniedToken, p005ProjectionPath)).responseStatus).toBe(403)
  await browserLogin(page, runtime, runtime.deniedLogin)
  await page.goto(monitorRoute)
  await expect(page).toHaveURL(/#\/forbidden/u)
  await expect(page.locator('[data-testid="phase09-tech-workflow-monitor"]')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(runtime.p004BusinessNo)
  await expect(page.locator('body')).not.toContainText(runtime.p005BusinessNo)
  expect(pageOriginMutations).toEqual([])
})
