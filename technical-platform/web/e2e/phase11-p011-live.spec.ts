import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = required('PHASE11_P011_TENANT')
const managerLogin = required('PHASE11_P011_LOGIN')
const password = required('PHASE11_P011_PASSWORD')
const ownerLogin = 'phase11.p011.owner'
const calibratorLogin = 'phase11.p011.calibrator'
const appealLogin = 'phase11.p011.appeal'
const executorLogin = 'phase11.p011.executor'
const techLogin = 'phase11.p011.tech'
const outsiderLogin = 'phase11.p011.out'
const api = 'http://127.0.0.1:18090'
const employeeBase = 'http://127.0.0.1:5330/employee.html'
const centerBase = 'http://127.0.0.1:5331/center.html'
const techBase = 'http://127.0.0.1:5332/admin.html'
const ownerId = '30000000-0000-0000-0000-000000003321'

interface Cycle {
  id: string
  businessNo: string
  currentNodeCode: string
  versionNo: number
  reason: string | null
  score1000: number | null
  appealStatus: string | null
  scores: Array<{ scoreType: string; score1000: number }>
  events: unknown[]
  effects: Array<{ executionType: string; externalReference: string }>
}

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function evidence(note: string) {
  return { note, recordedAt: new Date().toISOString() }
}

async function apiLogin(request: APIRequestContext, name: string) {
  const response = await request.post(`${api}/api/v1/auth/login`, {
    data: { tenantCode, loginName: name, password },
  })
  expect(response.status()).toBe(200)
  return ((await response.json()) as { accessToken: string }).accessToken
}

async function login(page: Page, base: string, name: string) {
  await page.goto(base)
  await page.evaluate(() => sessionStorage.clear())
  await page.reload()
  await page.goto(`${base}#/login`)
  await page.locator('input[name="tenantCode"]').fill(tenantCode)
  await page.locator('input[name="username"]').fill(name)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('form button[type="submit"]').click()
  await expect(page).not.toHaveURL(/#\/login/u)
}

async function getCycle(request: APIRequestContext, token: string, id: string) {
  const response = await request.get(`${api}/api/v1/processes/P011/performance-cycles/${id}`, {
    headers: headers(token),
  })
  expect(response.status()).toBe(200)
  return (await response.json()) as Cycle
}

async function act(
  request: APIRequestContext,
  token: string,
  id: string,
  code: string,
  version: number,
  data: Record<string, unknown> = {},
) {
  const response = await request.post(
    `${api}/api/v1/processes/P011/performance-cycles/${id}/actions/${code}`,
    {
      headers: { ...headers(token), 'Idempotency-Key': `p011-${code}-${randomUUID()}` },
      data: {
        expectedVersion: version,
        score1000: null,
        appealRaised: null,
        executionType: null,
        externalReference: null,
        resultSummary: 'browser verified',
        evidence: evidence(code),
        ...data,
      },
    },
  )
  return { status: response.status(), body: response.ok() ? ((await response.json()) as Cycle) : undefined }
}

async function move(
  request: APIRequestContext,
  token: string,
  id: string,
  code: string,
  version: number,
  data: Record<string, unknown> = {},
) {
  const result = await act(request, token, id, code, version, data)
  expect(result.status).toBe(200)
  if (!result.body) throw new Error(`${code} response body missing`)
  return result.body
}

test('P011 real browser lifecycle separates score facts, recusal, appeal and effect receipt', async ({ page, request }) => {
  const owner = await apiLogin(request, ownerLogin)
  const manager = await apiLogin(request, managerLogin)
  const calibrator = await apiLogin(request, calibratorLogin)
  const appeal = await apiLogin(request, appealLogin)
  const executor = await apiLogin(request, executorLogin)
  const tech = await apiLogin(request, techLogin)
  const outsider = await apiLogin(request, outsiderLogin)

  await login(page, centerBase, managerLogin)
  await page.goto(`${centerBase}#/center/10/02/01`)
  const centerRouteHeading = page.getByRole('heading', { name: '员工自评', level: 1 })
  await expect(centerRouteHeading).toHaveCount(1)
  await expect(centerRouteHeading).toBeVisible()
  const centerBusinessHeading = page.getByRole('heading', { name: '绩效评价、校准与执行', level: 2 })
  await expect(centerBusinessHeading).toHaveCount(1)
  await expect(centerBusinessHeading).toBeVisible()
  await page.getByPlaceholder('绩效周期主题').fill('P011 浏览器真实绩效闭环')
  await page.getByPlaceholder('员工 ID').fill(ownerId)
  await page.getByPlaceholder('内容版本').fill('2026-H2-V1')
  await page.getByPlaceholder('周期编号').fill('PERF-BROWSER-011')
  await page.getByPlaceholder('原因').fill('批准的绩效目标与权威指标包')
  await page.getByPlaceholder('不可变证据').fill('目标设定审批记录')
  await page.getByRole('button', { name: '创建周期' }).click()
  const record = page.locator('article.record').filter({ hasText: 'P011 浏览器真实绩效闭环' })
  await expect(record).toContainText('S01')
  const cycleId = await record.getAttribute('data-cycle-id')
  expect(cycleId).toBeTruthy()
  if (!cycleId) throw new Error('cycle id missing')

  const outsiderList = await request.get(`${api}/api/v1/processes/P011/performance-cycles`, { headers: headers(outsider) })
  expect(await outsiderList.json()).toEqual([])
  expect((await request.get(`${api}/api/v1/processes/P011/performance-cycles/${cycleId}`, { headers: headers(outsider) })).status()).toBe(403)
  let masked = await getCycle(request, tech, cycleId)
  expect(masked.reason).toBeNull()
  expect(masked.score1000).toBeNull()
  expect(masked.appealStatus).toBeNull()
  expect(masked.scores).toEqual([])
  expect(masked.events).toEqual([])
  expect(masked.effects).toEqual([])

  let current = await getCycle(request, manager, cycleId)
  expect((await act(request, manager, cycleId, 'SET_TARGET', current.versionNo - 1)).status).toBe(409)
  const targetSet = await move(request, manager, cycleId, 'SET_TARGET', current.versionNo)
  expect(targetSet.currentNodeCode).toBe('S02')

  await login(page, employeeBase, ownerLogin)
  await page.goto(`${employeeBase}#/employee/02/03/06`)
  const ownerRecord = page.locator(`article[data-cycle-id="${cycleId}"]`)
  await expect(ownerRecord).toContainText('S02')
  await page.getByPlaceholder('节点证据').fill('员工确认目标与周期')
  await ownerRecord.getByRole('button', { name: '员工确认' }).click()
  await expect(ownerRecord).toContainText('S03')

  current = await getCycle(request, manager, cycleId)
  current = await move(request, manager, cycleId, 'RECORD_COACHING', current.versionNo)
  current = await move(request, manager, cycleId, 'COLLECT_AUTHORITY_DATA', current.versionNo)
  expect((await act(request, owner, cycleId, 'SUBMIT_SELF_EVALUATION', current.versionNo, { score1000: 1001 })).status).toBe(409)

  await page.reload()
  await expect(ownerRecord).toContainText('S05')
  await page.getByPlaceholder('千分制分数').fill('860')
  await page.getByPlaceholder('节点证据').fill('员工自评证据')
  await ownerRecord.getByRole('button', { name: '提交员工自评' }).click()
  await expect(ownerRecord).toContainText('EMPLOYEE_SELF')

  current = await getCycle(request, manager, cycleId)
  expect((await act(request, owner, cycleId, 'SUBMIT_SUPERVISOR_EVALUATION', current.versionNo, { score1000: 900 })).status).toBe(409)
  current = await move(request, manager, cycleId, 'SUBMIT_SUPERVISOR_EVALUATION', current.versionNo, { score1000: 900 })
  current = await move(request, manager, cycleId, 'CALCULATE_SCORE', current.versionNo)
  expect(current.score1000).toBe(880)
  expect((await act(request, manager, cycleId, 'CALIBRATE', current.versionNo, { score1000: 885 })).status).toBe(403)
  expect((await act(request, tech, cycleId, 'CALIBRATE', current.versionNo, { score1000: 885 })).status).toBe(403)
  current = await move(request, calibrator, cycleId, 'CALIBRATE', current.versionNo, { score1000: 885 })
  current = await move(request, owner, cycleId, 'CONFIRM_FEEDBACK', current.versionNo, { appealRaised: true })
  expect((await act(request, appeal, cycleId, 'NO_APPEAL', current.versionNo)).status).toBe(409)
  current = await move(request, appeal, cycleId, 'RESOLVE_APPEAL', current.versionNo)
  expect((await act(request, executor, cycleId, 'EXECUTE_EFFECT', current.versionNo, { executionType: 'DEVELOPMENT_PLAN' })).status).toBe(409)
  current = await move(request, executor, cycleId, 'EXECUTE_EFFECT', current.versionNo, {
    executionType: 'DEVELOPMENT_PLAN',
    externalReference: 'HR-DEVELOPMENT-RECEIPT-BROWSER-011',
  })
  current = await move(request, manager, cycleId, 'ARCHIVE', current.versionNo)
  expect(current.currentNodeCode).toBe('END')
  expect(current.scores.map((score) => score.scoreType)).toEqual([
    'EMPLOYEE_SELF', 'SUPERVISOR', 'SYSTEM_CALCULATED', 'CALIBRATED',
  ])
  expect(current.effects[0]?.externalReference).toBe('HR-DEVELOPMENT-RECEIPT-BROWSER-011')

  await login(page, techBase, techLogin)
  await page.goto(`${techBase}#/tech/06/05/01`)
  const techRouteHeading = page.getByRole('heading', { name: '配置列表', level: 1 })
  await expect(techRouteHeading).toHaveCount(1)
  await expect(techRouteHeading).toBeVisible()
  const techBusinessHeading = page.getByRole('heading', { name: '绩效流程元数据监控', level: 2 })
  await expect(techBusinessHeading).toHaveCount(1)
  await expect(techBusinessHeading).toBeVisible()
  const techRecord = page.locator(`article[data-cycle-id="${cycleId}"]`)
  await expect(techRecord).toContainText('END')
  await expect(techRecord).toContainText('员工、分数、申诉、证据和执行结果均已屏蔽。')
  await expect(techRecord.getByRole('button')).toHaveCount(0)
  await expect(techRecord).not.toContainText(ownerId)
  await expect(techRecord).not.toContainText('885')
  await expect(techRecord).not.toContainText('HR-DEVELOPMENT-RECEIPT')
  masked = await getCycle(request, tech, cycleId)
  expect(masked.reason).toBeNull()
  expect(masked.score1000).toBeNull()
  expect(masked.appealStatus).toBeNull()
  expect(masked.scores).toEqual([])
  expect(masked.events).toEqual([])
  expect(masked.effects).toEqual([])
})
