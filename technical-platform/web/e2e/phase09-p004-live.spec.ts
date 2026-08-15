import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE09_P004_TENANT')
const applicantLogin = requiredEnv('PHASE09_P004_LOGIN')
const password = requiredEnv('PHASE09_P004_PASSWORD')
const actor1Login = 'phase09.p004.actor1'
const actor2Login = 'phase09.p004.actor2'
const techLogin = 'phase09.p004.tech'
const outLogin = 'phase09.p004.out'
const apiBase = 'http://127.0.0.1:18084'
const employeeBase = 'http://127.0.0.1:5293/employee.html'
const centerBase = 'http://127.0.0.1:5294/center.html'
const techBase = 'http://127.0.0.1:5295/admin.html'
const mainSubject = 'P004 live generic request lifecycle'
const privateReason = 'P004-PRIVATE-REASON-ONLY-BUSINESS-ACTORS'

interface GenericRequestRecord {
  id: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: string | null
  status: string
  versionNo: number
  reason: string | null
  requestedResult: string | null
  actualAmount: number | null
  actualEndAt: string | null
  initialSubmissionNo: string | null
  initialFormVersion: number
  resultSummary: string | null
}

type ActionResult = { status: number; body?: GenericRequestRecord }

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}
function auth(accessToken: string): Record<string, string> { return { Authorization: `Bearer ${accessToken}` } }
function requiredRequestId(value: string | null): string {
  if (!value) throw new Error('P004 E2E request id is missing from the rendered record')
  return value
}
async function apiLogin(request: APIRequestContext, loginName: string): Promise<string> {
  const response = await request.post(`${apiBase}/api/v1/auth/login`, { data: { tenantCode, loginName, password } })
  expect(response.status()).toBe(200)
  return ((await response.json()) as { accessToken: string }).accessToken
}
async function loginPortal(page: Page, base: string, loginName: string, homeTitle: string): Promise<void> {
  await page.goto(base)
  await expect(page).toHaveURL(/#\/login/u)
  await page.getByLabel('租户编码').fill(tenantCode)
  await page.getByLabel('登录账号').fill(loginName)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: homeTitle, level: 1 })).toBeVisible()
}
async function getRequest(request: APIRequestContext, token: string, id: string): Promise<GenericRequestRecord> {
  const response = await request.get(`${apiBase}/api/v1/processes/P004/generic-requests/${id}`, { headers: auth(token) })
  expect(response.status()).toBe(200)
  return await response.json() as GenericRequestRecord
}
async function recordOrReload(
  result: ActionResult,
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<GenericRequestRecord> {
  if (result.body) return result.body
  return getRequest(request, token, id)
}
async function act(
  request: APIRequestContext,
  token: string,
  id: string,
  actionCode: string,
  expectedVersion: number,
  key = `p004-${actionCode.toLowerCase()}-${randomUUID()}`,
  extra: Partial<{ reason: string; resultSummary: string; actualAmount: number }> = {},
): Promise<ActionResult> {
  const response = await request.post(`${apiBase}/api/v1/processes/P004/generic-requests/${id}/actions/${actionCode}`, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data: {
      expectedVersion,
      reason: extra.reason ?? `P004 ${actionCode} E2E`,
      resultSummary: extra.resultSummary ?? null,
      actualAmount: extra.actualAmount ?? null,
    },
  })
  return { status: response.status(), ...(response.ok() ? { body: await response.json() as GenericRequestRecord } : {}) }
}

test('P004 real generic request enforces scope, dual review, independent acceptance and three-portal projection', async ({ page, request }) => {
  const applicantToken = await apiLogin(request, applicantLogin)
  const actor1Token = await apiLogin(request, actor1Login)
  const actor2Token = await apiLogin(request, actor2Login)
  const techToken = await apiLogin(request, techLogin)
  const outToken = await apiLogin(request, outLogin)

  await loginPortal(page, employeeBase, applicantLogin, '员工工作入口')
  await page.goto(`${employeeBase}#/employee/03/07/01`)
  await expect(page.getByRole('heading', { name: '通用申请与审批', level: 2 })).toBeVisible()
  await page.getByLabel('业务事项类型').fill('GENERAL_E2E')
  await page.getByLabel('主题').fill(mainSubject)
  await page.getByLabel('申请原因').fill(privateReason)
  await page.getByLabel('期望结果').fill('完成真实审批、执行、独立验收和归档闭环')
  await page.getByLabel('申请金额（可选）').fill('123.45')
  await page.getByRole('button', { name: '提交申请' }).click()
  await expect(page.locator('p.phase09-feedback')).toContainText('前置规则校验')

  const employeeRecord = page.locator('article.record').filter({ hasText: mainSubject })
  await expect(employeeRecord).toContainText('前置规则校验')
  await expect(employeeRecord).toContainText(privateReason)
  await expect(employeeRecord).toContainText('初始表单版本')
  const id = requiredRequestId(await employeeRecord.getAttribute('data-request-id'))

  let current = await getRequest(request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S03')
  expect(current.status).toBe('前置规则校验')
  expect(current.workflowInstanceId).toBeTruthy()
  expect(current.workflowInstanceNo).toBeTruthy()
  expect(current.initialSubmissionNo).toBeTruthy()
  expect(current.initialFormVersion).toBe(1)

  const outList = await request.get(`${apiBase}/api/v1/processes/P004/generic-requests`, { headers: auth(outToken) })
  expect(outList.status()).toBe(200)
  expect(await outList.json()).toEqual([])
  const outGet = await request.get(`${apiBase}/api/v1/processes/P004/generic-requests/${id}`, { headers: auth(outToken) })
  expect(outGet.status()).toBe(403)

  const techView = await getRequest(request, techToken, id)
  expect(techView.reason).toBeNull()
  expect(techView.requestedResult).toBeNull()
  expect(techView.resultSummary).toBeNull()
  expect(JSON.stringify(techView)).not.toContain(privateReason)

  expect((await act(request, applicantToken, id, 'ACCEPT', current.versionNo)).status).toBe(403)
  expect((await act(request, actor1Token, id, 'ACCEPT', Math.max(0, current.versionNo - 1))).status).toBe(409)
  const accepted = await act(request, actor1Token, id, 'ACCEPT', current.versionNo)
  expect(accepted.status).toBe(200)
  current = await recordOrReload(accepted, request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S04')

  await loginPortal(page, centerBase, actor1Login, '中心管理工作入口')
  await page.goto(`${centerBase}#/center/02/01/01`)
  await expect(page.getByRole('heading', { name: '通用申请审批与执行', level: 2 })).toBeVisible()
  const centerRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(centerRecord).toContainText('提交审批')
  await centerRecord.getByRole('button', { name: '提交审批处理' }).click()
  await expect(centerRecord).toContainText('动态审批与会签')

  current = await getRequest(request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S05')
  expect((await act(request, actor1Token, id, 'APPROVE', current.versionNo)).status).toBe(409)

  const approvalKey = `p004-approve-${randomUUID()}`
  const approval = await act(request, actor2Token, id, 'APPROVE', current.versionNo, approvalKey)
  expect(approval.status).toBe(200)
  expect(approval.body?.currentNodeCode).toBe('S06')
  const approvalReplay = await act(request, actor2Token, id, 'APPROVE', current.versionNo, approvalKey)
  expect(approvalReplay.status).toBe(200)
  expect(approvalReplay.body?.versionNo).toBe(approval.body?.versionNo)
  expect(approvalReplay.body?.currentNodeCode).toBe('S06')

  current = await recordOrReload(approval, request, applicantToken, id)
  const createdTask = await act(request, actor2Token, id, 'CREATE_TASK', current.versionNo)
  expect(createdTask.status).toBe(200)
  current = await recordOrReload(createdTask, request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S07')

  const submittedResult = await act(request, actor1Token, id, 'SUBMIT_RESULT', current.versionNo, undefined, {
    reason: '执行任务完成', resultSummary: 'P004 execution result verified by E2E', actualAmount: 111.11,
  })
  expect(submittedResult.status).toBe(200)
  current = await recordOrReload(submittedResult, request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S08')
  expect(Number(current.actualAmount)).toBe(111.11)

  expect((await act(request, actor1Token, id, 'ACCEPT_RESULT', current.versionNo)).status).toBe(409)
  const acceptedResult = await act(request, actor2Token, id, 'ACCEPT_RESULT', current.versionNo)
  expect(acceptedResult.status).toBe(200)
  current = await recordOrReload(acceptedResult, request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S09')

  const compensated = await act(request, actor1Token, id, 'COMPLETE', current.versionNo)
  expect(compensated.status).toBe(200)
  current = await recordOrReload(compensated, request, applicantToken, id)
  expect(current.currentNodeCode).toBe('S10')

  const archived = await act(request, actor2Token, id, 'ARCHIVE', current.versionNo)
  expect(archived.status).toBe(200)
  current = await recordOrReload(archived, request, applicantToken, id)
  expect(current.currentNodeCode).toBe('END')
  expect(current.status).toBe('已关闭')
  expect(current.actualEndAt).toBeTruthy()
  expect((await act(request, actor1Token, id, 'ACCEPT', current.versionNo)).status).toBe(409)

  await loginPortal(page, techBase, techLogin, '技术运行工作入口')
  await page.goto(`${techBase}#/tech/05/03/01`)
  await expect(page.getByRole('heading', { name: 'P004 请求监控', level: 3, exact: true })).toBeVisible()
  const monitorSection = page.locator('section[data-monitor-process="P004"]')
  const monitorTable = monitorSection.getByRole('table', { name: 'P004 请求监控投影' })
  const techRecord = monitorTable.getByRole('row').filter({ hasText: current.businessNo })
  await expect(techRecord).toHaveCount(1)
  await expect(techRecord).toContainText('END')
  await expect(techRecord).toContainText('已关闭')
  await expect(techRecord).not.toContainText(privateReason)
  await expect(monitorSection).not.toContainText(privateReason)
  await expect(page.locator('main')).not.toContainText(privateReason)
  await expect(techRecord.getByRole('button')).toHaveCount(0)
  await expect(monitorSection.locator('[data-action], [data-business-mutation]')).toHaveCount(0)

  await page.goto(`${employeeBase}#/employee/03/07/01`)
  const closedEmployeeRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(closedEmployeeRecord).toContainText('已关闭')
  await expect(closedEmployeeRecord).toContainText(privateReason)
})
