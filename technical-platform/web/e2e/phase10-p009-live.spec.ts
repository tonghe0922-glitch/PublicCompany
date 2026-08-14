import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = required('PHASE10_P009_TENANT')
const managerLogin = required('PHASE10_P009_LOGIN')
const password = required('PHASE10_P009_PASSWORD')
const employeeLogin = 'phase10.p009.employee'
const reviewerLogin = 'phase10.p009.reviewer'
const hrLogin = 'phase10.p009.hr'
const techLogin = 'phase10.p009.tech'
const outLogin = 'phase10.p009.out'
const api = 'http://127.0.0.1:18089'
const employeeBase = 'http://127.0.0.1:5326/employee.html'
const centerBase = 'http://127.0.0.1:5327/center.html'
const techBase = 'http://127.0.0.1:5328/admin.html'

interface Overtime {
  id: string
  businessNo: string
  currentNodeCode: string
  status: string
  versionNo: number
  reason: string | null
  actualAttendanceSummary: string | null
  schemeType: string | null
  receiptReference: string | null
  actualAmount: number | null
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}
function headers(token: string): { Authorization: string } { return { Authorization: `Bearer ${token}` } }
async function apiLogin(request: APIRequestContext, loginName: string): Promise<string> {
  const response = await request.post(`${api}/api/v1/auth/login`, { data: { tenantCode, loginName, password } })
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
async function getOvertime(request: APIRequestContext, token: string, id: string): Promise<Overtime> {
  const response = await request.get(`${api}/api/v1/processes/P009/overtime-requests/${id}`, { headers: headers(token) })
  expect(response.status()).toBe(200)
  return await response.json() as Overtime
}
async function listOvertime(request: APIRequestContext, token: string): Promise<Overtime[]> {
  const response = await request.get(`${api}/api/v1/processes/P009/overtime-requests`, { headers: headers(token) })
  expect(response.status()).toBe(200)
  return await response.json() as Overtime[]
}
async function act(request: APIRequestContext, token: string, id: string, code: string, version: number, body: Record<string, unknown> = {}) {
  const response = await request.post(`${api}/api/v1/processes/P009/overtime-requests/${id}/actions/${code}`, {
    headers: { ...headers(token), 'Idempotency-Key': `p009-${code.toLowerCase()}-${randomUUID()}` },
    data: {
      expectedVersion: version, reason: null, resultSummary: null, actualAttendanceSummary: null,
      actualStartAt: null, actualEndAt: null, schemeType: null, externalReference: null,
      externallyDeterminedAmount: null, evidence: null, ...body,
    },
  })
  return { status: response.status(), body: response.ok() ? await response.json() as Overtime : undefined }
}
function local(offsetHours: number): string { return new Date(Date.now() + offsetHours * 3_600_000).toISOString().slice(0, 16) }
function isoLocal(value: string): string { return new Date(value).toISOString() }
function evidence(note: string) { return { note, recordedAt: new Date().toISOString() } }
async function selectRecord(page: Page, id: string, businessNo: string): Promise<void> {
  const selector = page.locator(`[data-select-record="${id}"]`)
  if (await selector.count() > 0) await selector.click()
  await expect(page.locator('main')).toContainText(businessNo)
}

test('P009 real overtime lifecycle separates labor facts, HR scheme and external payroll receipt across portals', async ({ page, request }) => {
  const employee = await apiLogin(request, employeeLogin)
  const manager = await apiLogin(request, managerLogin)
  const reviewer = await apiLogin(request, reviewerLogin)
  const hr = await apiLogin(request, hrLogin)
  const tech = await apiLogin(request, techLogin)
  const out = await apiLogin(request, outLogin)
  const start = local(96)
  const end = local(98)
  const subject = 'P009 浏览器真实加班与外部回执闭环'

  await login(page, employeeBase, employeeLogin)
  await page.goto(`${employeeBase}#/employee/03/01/06`)
  await expect(page.getByRole('heading', { name: '加班申请', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '加班与补偿管理', level: 2 })).toBeVisible()
  await page.locator('[data-field="business-date"] input').fill(new Date().toISOString().slice(0, 10))
  await page.locator('[data-field="subject"] input').fill(subject)
  await page.locator('[data-field="attendance-type"] input').fill('OVERTIME')
  await page.locator('[data-field="start-at"] input').fill(start)
  await page.locator('[data-field="end-at"] input').fill(end)
  await page.locator('[data-field="reason"] textarea').fill('景区运营任务需要在正常工作时段外执行并保留独立复核与考勤事实')
  const createResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/processes/P009/overtime-requests' && response.request().method() === 'POST')
  await page.locator('[data-submit-create]').click()
  const createResponse = await createResponsePromise
  expect(createResponse.status()).toBe(200)
  expect(createResponse.request().headers()['idempotency-key']).toMatch(/^p009-create-[0-9a-f-]+$/u)
  expect(createResponse.request().postDataJSON()).toMatchObject({ subject, attendanceType: 'OVERTIME', emergency: false, emergencyEvidence: null })
  const created = (await listOvertime(request, employee)).find(record => record.businessNo === (createResponse.request().postDataJSON() as { businessNo?: string }).businessNo)
    ?? (await listOvertime(request, employee)).find(record => record.currentNodeCode === 'S01')
  expect(created).toBeDefined()
  if (!created) throw new Error('P009 created overtime was not returned by the authoritative list API')
  const id = created.id
  await selectRecord(page, id, created.businessNo)
  await expect(page.locator('main')).toContainText('S01')

  expect(await listOvertime(request, out)).toEqual([])
  expect((await request.get(`${api}/api/v1/processes/P009/overtime-requests/${id}`, { headers: headers(out) })).status()).toBe(403)
  const masked = await getOvertime(request, tech, id)
  expect(masked.reason).toBeNull()
  expect(masked.schemeType).toBeNull()
  expect(masked.actualAmount).toBeNull()
  const emergency = await request.post(`${api}/api/v1/processes/P009/overtime-requests`, {
    headers: { ...headers(employee), 'Idempotency-Key': `p009-emergency-${randomUUID()}` },
    data: { businessDate: new Date().toISOString().slice(0, 10), subject: 'P009 emergency without evidence', reason: 'Emergency registration must fail without immutable factual evidence', attendanceType: 'OVERTIME', emergency: true, startAt: isoLocal(local(120)), endAt: isoLocal(local(122)), emergencyEvidence: null },
  })
  expect(emergency.status()).toBe(409)
  const submitResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/processes/P009/overtime-requests/${id}/actions/SUBMIT` && response.request().method() === 'POST')
  await page.locator('[data-action-code="SUBMIT"]').click()
  expect((await submitResponsePromise).status()).toBe(200)
  await expect(page.locator('[data-action-code="VALIDATE"]')).toHaveCount(0)
  expect((await getOvertime(request, employee, id)).currentNodeCode).toBe('S02')
  const overlap = await request.post(`${api}/api/v1/processes/P009/overtime-requests`, {
    headers: { ...headers(employee), 'Idempotency-Key': `p009-overlap-${randomUUID()}` },
    data: { businessDate: new Date().toISOString().slice(0, 10), subject: 'P009 overlapping browser request', reason: 'This request deliberately overlaps an effective overtime request', attendanceType: 'OVERTIME', emergency: false, startAt: isoLocal(local(97)), endAt: isoLocal(local(99)), emergencyEvidence: null },
  })
  expect(overlap.status()).toBe(409)
  let current = await getOvertime(request, manager, id)
  expect((await act(request, manager, id, 'VALIDATE', current.versionNo - 1)).status).toBe(409)
  let moved = await act(request, manager, id, 'VALIDATE', current.versionNo)
  expect(moved.status).toBe(200)
  current = moved.body!
  expect((await act(request, employee, id, 'APPROVE', current.versionNo, { reason: 'employee self review forbidden' })).status).toBe(403)

  await login(page, centerBase, reviewerLogin)
  await page.goto(`${centerBase}#/center/04/05/01`)
  await expect(page.getByRole('heading', { name: '加班申请', level: 1 })).toBeVisible()
  await selectRecord(page, id, current.businessNo)
  await expect(page.locator('[data-action-code="APPROVE"]')).toBeVisible()
  const approveResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/processes/P009/overtime-requests/${id}/actions/APPROVE` && response.request().method() === 'POST')
  await page.locator('[data-action-code="APPROVE"]').click()
  expect((await approveResponsePromise).status()).toBe(200)
  await expect(page.locator('[data-action-code="RECORD_FACT"]')).toHaveCount(0)
  current = await getOvertime(request, manager, id)
  expect(current.currentNodeCode).toBe('S04')
  moved = await act(request, manager, id, 'RECORD_FACT', current.versionNo, { actualStartAt: isoLocal(start), actualEndAt: isoLocal(end), actualAttendanceSummary: '门禁与考勤源确认实际劳动两小时', evidence: evidence('不可变门禁考勤事实') })
  expect(moved.status).toBe(200)
  current = moved.body!
  moved = await act(request, reviewer, id, 'ACCEPT_RESULT', current.versionNo, { resultSummary: '任务成果按验收标准独立验收通过' })
  expect(moved.status).toBe(200)
  current = moved.body!
  expect((await act(request, employee, id, 'HR_CONFIRM', current.versionNo, { schemeType: 'PAYROLL', evidence: evidence('employee self HR forbidden') })).status).toBe(403)
  moved = await act(request, hr, id, 'HR_CONFIRM', current.versionNo, { schemeType: 'PAYROLL', evidence: evidence('人事复核法定工资路线') })
  expect(moved.status).toBe(200)

  await login(page, employeeBase, employeeLogin)
  await page.goto(`${employeeBase}#/employee/03/01/07`)
  await expect(page.getByRole('heading', { name: '调休申请', level: 1 })).toBeVisible()
  await selectRecord(page, id, moved.body!.businessNo)
  await expect(page.locator('[data-action-code="CONFIRM_SCHEME"]')).toBeVisible()
  await page.locator('[data-action-evidence] textarea').fill('员工本人确认工资补偿方案与外部结算边界')
  const schemeResponsePromise = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/processes/P009/overtime-requests/${id}/actions/CONFIRM_SCHEME` && response.request().method() === 'POST')
  await page.locator('[data-action-code="CONFIRM_SCHEME"]').click()
  expect((await schemeResponsePromise).status()).toBe(200)
  await expect(page.locator('[data-action-code="RECORD_RECEIPT"]')).toHaveCount(0)
  current = await getOvertime(request, hr, id)
  expect(current.currentNodeCode).toBe('S08')
  expect((await act(request, employee, id, 'RECORD_RECEIPT', current.versionNo, { externalReference: 'PAY-EXT-BROWSER-009', externallyDeterminedAmount: 125.5, evidence: evidence('employee receipt forbidden') })).status).toBe(403)
  moved = await act(request, hr, id, 'RECORD_RECEIPT', current.versionNo, { externalReference: 'PAY-EXT-BROWSER-009', externallyDeterminedAmount: 125.5, evidence: evidence('外部薪酬系统签名回执') })
  expect(moved.status).toBe(200)
  current = moved.body!
  expect(current.actualAmount).toBe(125.5)
  moved = await act(request, manager, id, 'ARCHIVE', current.versionNo, { evidence: evidence('归档包校验和与保留期限') })
  expect(moved.status).toBe(200)
  expect(moved.body?.currentNodeCode).toBe('END')
  expect(moved.body?.receiptReference).toBe('PAY-EXT-BROWSER-009')

  await login(page, techBase, techLogin)
  await page.goto(`${techBase}#/tech/07/09/01`)
  await expect(page.getByRole('heading', { name: '运行概览', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'P009 加班流程监控', level: 2 })).toBeVisible()
  await selectRecord(page, id, moved.body!.businessNo)
  const main = page.locator('main')
  await expect(main).toContainText('END')
  await expect(page.locator('[data-sensitive-contract-blocked]')).toContainText('BLOCKED_BY_CONTRACT')
  await expect(page.locator('[data-action-code]')).toHaveCount(0)
  await expect(page.locator('[data-submit-create]')).toHaveCount(0)
  await expect(page.locator('[data-reveal-sensitive]')).toHaveCount(0)
  await expect(main).not.toContainText('门禁与考勤源确认')
  await expect(main).not.toContainText('PAY-EXT-BROWSER-009')
  await expect(main).not.toContainText('125.5')
})
