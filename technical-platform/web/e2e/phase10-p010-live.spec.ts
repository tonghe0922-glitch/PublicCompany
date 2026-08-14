import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = required('PHASE10_P010_TENANT')
const managerLogin = required('PHASE10_P010_LOGIN')
const password = required('PHASE10_P010_PASSWORD')
const learnerLogin = 'phase10.p010.learner'
const assessorLogin = 'phase10.p010.assessor'
const certifierLogin = 'phase10.p010.certifier'
const linkerLogin = 'phase10.p010.linker'
const techLogin = 'phase10.p010.tech'
const outLogin = 'phase10.p010.out'
const api = 'http://127.0.0.1:18090'
const employeeBase = 'http://127.0.0.1:5330/employee.html'
const centerBase = 'http://127.0.0.1:5331/center.html'
const techBase = 'http://127.0.0.1:5332/admin.html'
const assignmentsPath = '/api/v1/processes/P010/learning-assignments'

interface FixtureRuntime {
  learnerId: string
}
interface Assignment {
  id: string
  businessNo: string
  currentNodeCode: string
  versionNo: number
  reason: string | null
  score1000: number | null
  practicalResult: string | null
  qualificationEffectiveDate: string | null
  qualificationExpireDate: string | null
  events: unknown[]
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}
function headers(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` }
}
async function apiLogin(request: APIRequestContext, loginName: string): Promise<string> {
  const response = await request.post(`${api}/api/v1/auth/login`, {
    data: { tenantCode, loginName, password },
  })
  expect(response.status()).toBe(200)
  return ((await response.json()) as { accessToken: string }).accessToken
}
async function login(page: Page, base: string, loginName: string): Promise<void> {
  await page.goto(base)
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.goto(`${base}#/login`)
  await page.locator('input[name="tenantCode"]').fill(tenantCode)
  await page.locator('input[name="username"]').fill(loginName)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await expect(page).not.toHaveURL(/#\/login/u)
}
async function getAssignment(request: APIRequestContext, token: string, id: string): Promise<Assignment> {
  const response = await request.get(`${api}${assignmentsPath}/${id}`, { headers: headers(token) })
  expect(response.status()).toBe(200)
  return await response.json() as Assignment
}
async function listAssignments(request: APIRequestContext, token: string): Promise<Assignment[]> {
  const response = await request.get(`${api}${assignmentsPath}`, { headers: headers(token) })
  expect(response.status()).toBe(200)
  return await response.json() as Assignment[]
}
function evidence(note: string): { note: string; recordedAt: string } {
  return { note, recordedAt: new Date().toISOString() }
}
async function act(
  request: APIRequestContext,
  token: string,
  id: string,
  code: string,
  version: number,
  data: Record<string, unknown> = {},
): Promise<{ status: number; body: Assignment | undefined }> {
  const response = await request.post(`${api}${assignmentsPath}/${id}/actions/${code}`, {
    headers: { ...headers(token), 'Idempotency-Key': `p010-${code.toLowerCase()}-${randomUUID()}` },
    data: {
      expectedVersion: version,
      score1000: null,
      practicalResult: null,
      effectiveDate: null,
      expireDate: null,
      recertificationDate: null,
      resultSummary: 'browser verified',
      evidence: evidence(code),
      ...data,
    },
  })
  return { status: response.status(), body: response.ok() ? await response.json() as Assignment : undefined }
}
async function selectRecord(page: Page, id: string, businessNo: string): Promise<void> {
  const selector = page.locator(`[data-select-record="${id}"]`)
  if (await selector.count() > 0) await selector.click()
  await expect(page.locator('main')).toContainText(businessNo)
}
async function uiAction(page: Page, id: string, code: string): Promise<void> {
  const exactPath = `${assignmentsPath}/${id}/actions/${code}`
  const responsePromise = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === exactPath,
  )
  await page.locator(`[data-action-code="${code}"]`).click()
  expect((await responsePromise).status()).toBe(200)
}
async function serializedMain(page: Page): Promise<string> {
  return page.locator('main').evaluate(main => {
    const attributes = [...main.querySelectorAll('*')].flatMap(element =>
      [...element.attributes].map(attribute => `${attribute.name}=${attribute.value}`),
    )
    return `${main.textContent ?? ''}\n${main.innerHTML}\n${attributes.join('\n')}`
  })
}

test('P010 real lifecycle keeps directory creation blocked and sensitive qualification facts masked', async ({ page, request }) => {
  const runtime = JSON.parse(await readFile(
    resolve(process.cwd(), '../backend/apps/api/target/phase10-p010-fixture-runtime.json'),
    'utf8',
  )) as FixtureRuntime
  expect(runtime.learnerId).toMatch(/^[0-9a-f-]{36}$/u)
  const learner = await apiLogin(request, learnerLogin)
  const manager = await apiLogin(request, managerLogin)
  const assessor = await apiLogin(request, assessorLogin)
  const certifier = await apiLogin(request, certifierLogin)
  const linker = await apiLogin(request, linkerLogin)
  const tech = await apiLogin(request, techLogin)
  const out = await apiLogin(request, outLogin)
  let uiCreateRequests = 0
  page.on('request', pageRequest => {
    if (pageRequest.method() === 'POST' && new URL(pageRequest.url()).pathname === assignmentsPath) {
      uiCreateRequests += 1
    }
  })

  await login(page, centerBase, managerLogin)
  await page.goto(`${centerBase}#/center/06/03/07`)
  await expect(page.getByRole('heading', { name: '学习、考试、实操和资格', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '学习、考试与资格管理', level: 2 })).toBeVisible()
  const blockedCreate = page.locator('[data-owner-directory-blocked]')
  await expect(blockedCreate).toContainText('BLOCKED_BY_CONTRACT')
  await expect(blockedCreate.locator('input, select, button')).toHaveCount(0)
  await expect(page.locator('[data-submit-create]')).toHaveCount(0)
  expect(uiCreateRequests).toBe(0)

  // The learner id comes only from this fresh fixture's runtime authority and is used only by the API seed.
  // It is never entered into the UI and does not stand in for a directory search contract.
  const createKey = `p010-fixture-seed-${randomUUID()}`
  const subject = 'P010 browser qualification lifecycle'
  const createPayload = {
    businessDate: new Date().toISOString().slice(0, 10),
    subject,
    reason: 'Role qualification requires independent learning, assessment and permission facts',
    ownerEmployeeId: runtime.learnerId,
    courseVersionId: 'SAFETY-V1',
    contentVersion: '2026.08',
    courseTeamName: 'Safety Academy',
    periodOrCourseNo: 'SAFE-001',
    learnerProfile: 'High risk operators',
    evidence: evidence('fixture-authoritative-publication-package'),
  }
  const createResponse = await request.post(`${api}${assignmentsPath}`, {
    headers: { ...headers(manager), 'Idempotency-Key': createKey },
    data: createPayload,
  })
  expect(createResponse.status()).toBe(200)
  expect(createKey.trim()).not.toBe('')
  expect(createPayload.ownerEmployeeId).toBe(runtime.learnerId)
  const createdResponse = await createResponse.json() as Assignment
  const created = (await listAssignments(request, manager)).find(record => record.id === createdResponse.id)
  expect(created).toBeDefined()
  if (!created) throw new Error('P010 API-seeded assignment was not returned by the authoritative list API')
  const id = created.id
  expect((await getAssignment(request, manager, id)).businessNo).toBe(created.businessNo)
  await page.locator('[data-refresh-facts]').click()
  await selectRecord(page, id, created.businessNo)

  expect(await listAssignments(request, out)).toEqual([])
  expect((await request.get(`${api}${assignmentsPath}/${id}`, { headers: headers(out) })).status()).toBe(403)
  let masked = await getAssignment(request, tech, id)
  expect(masked.reason).toBeNull()
  expect(masked.score1000).toBeNull()
  expect(masked.events).toEqual([])
  expect((await act(request, manager, id, 'PUBLISH', created.versionNo - 1)).status).toBe(409)

  await page.locator('[data-action-evidence] textarea').fill('Approved course publication package')
  await expect(page.locator('[data-action-code="PUBLISH"]')).toBeVisible()
  await uiAction(page, id, 'PUBLISH')
  await expect(page.locator('[data-action-code="ASSIGN"]')).toBeVisible()
  await page.locator('[data-action-evidence] textarea').fill('Risk-based assignment scope and learner receipt')
  await uiAction(page, id, 'ASSIGN')
  await expect(page.locator('[data-action-code="COMPLETE_LEARNING"]')).toHaveCount(0)

  await login(page, employeeBase, learnerLogin)
  await page.goto(`${employeeBase}#/employee/07/01/01`)
  await expect(page.getByRole('heading', { name: '待学习', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '学习、考试与资格管理', level: 2 })).toBeVisible()
  await expect(page.locator('[data-owner-directory-blocked]')).toContainText('BLOCKED_BY_CONTRACT')
  await expect(page.locator('[data-submit-create]')).toHaveCount(0)
  await selectRecord(page, id, created.businessNo)
  await page.locator('[data-action-evidence] textarea').fill('Learning platform completion and content-version receipt')
  await expect(page.locator('[data-action-code="COMPLETE_LEARNING"]')).toBeVisible()
  await uiAction(page, id, 'COMPLETE_LEARNING')

  await page.goto(`${employeeBase}#/employee/07/04/02`)
  await expect(page.getByRole('heading', { name: '在线考试', level: 1 })).toBeVisible()
  await selectRecord(page, id, created.businessNo)
  await page.locator('[data-score-1000] input').fill('886')
  await page.locator('[data-action-evidence] textarea').fill('Signed online examination receipt')
  await expect(page.locator('[data-action-code="SUBMIT_EXAM"]')).toBeVisible()
  await uiAction(page, id, 'SUBMIT_EXAM')
  expect((await getAssignment(request, learner, id)).score1000).toBe(886)
  expect(await serializedMain(page)).not.toContain('886')
  expect(uiCreateRequests).toBe(0)

  let current = await getAssignment(request, assessor, id)
  let moved = await act(request, assessor, id, 'RECORD_PRACTICAL', current.versionNo, {
    practicalResult: 'PASS: emergency stop and isolation verified',
  })
  expect(moved.status).toBe(200)
  current = moved.body!
  expect((await act(request, assessor, id, 'CERTIFY', current.versionNo)).status).toBe(409)
  expect((await act(request, tech, id, 'CERTIFY', current.versionNo)).status).toBe(403)
  moved = await act(request, certifier, id, 'CERTIFY', current.versionNo)
  expect(moved.status).toBe(200)
  current = moved.body!
  const effective = new Date().toISOString().slice(0, 10)
  const expiry = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10)
  const recertification = new Date(Date.now() + 335 * 86_400_000).toISOString().slice(0, 10)
  moved = await act(request, manager, id, 'ACTIVATE', current.versionNo, {
    effectiveDate: effective,
    expireDate: expiry,
  })
  expect(moved.status).toBe(200)
  current = moved.body!
  moved = await act(request, linker, id, 'LINK_PERMISSION', current.versionNo)
  expect(moved.status).toBe(200)
  current = moved.body!
  const session = await (await request.get(`${api}/api/v1/session`, { headers: headers(learner) })).json() as {
    permissions: string[]
  }
  expect(session.permissions).toContain('qualified.safety.access')
  moved = await act(request, manager, id, 'SCHEDULE_RECERTIFICATION', current.versionNo, {
    recertificationDate: recertification,
  })
  expect(moved.status).toBe(200)
  current = moved.body!
  moved = await act(request, manager, id, 'ARCHIVE', current.versionNo)
  expect(moved.status).toBe(200)
  expect(moved.body?.currentNodeCode).toBe('END')

  await login(page, techBase, techLogin)
  await page.goto(`${techBase}#/tech/03/03/09`)
  await expect(page.getByRole('heading', { name: '操作审计', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'P010 学习流程监控', level: 2 })).toBeVisible()
  await expect(page.locator('[data-owner-directory-blocked]')).toContainText('BLOCKED_BY_CONTRACT')
  await expect(page.locator('[data-submit-create]')).toHaveCount(0)
  await selectRecord(page, id, moved.body!.businessNo)
  await expect(page.locator('main')).toContainText('END')
  await expect(page.locator('[data-sensitive-contract-blocked]')).toContainText('BLOCKED_BY_CONTRACT')
  await expect(page.locator('[data-action-code]')).toHaveCount(0)
  await expect(page.locator('[data-reveal-sensitive]')).toHaveCount(0)
  const safeProjection = await serializedMain(page)
  for (const secret of ['886', 'emergency stop and isolation verified', effective, expiry]) {
    expect(safeProjection).not.toContain(secret)
  }
  masked = await getAssignment(request, tech, id)
  expect(masked.score1000).toBeNull()
  expect(masked.practicalResult).toBeNull()
  expect(masked.qualificationEffectiveDate).toBeNull()
  expect(masked.qualificationExpireDate).toBeNull()
  expect(masked.events).toEqual([])
  expect(uiCreateRequests).toBe(0)
})
