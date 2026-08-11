import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE09_P002_TENANT')
const applicantLogin = requiredEnv('PHASE09_P002_LOGIN')
const password = requiredEnv('PHASE09_P002_PASSWORD')
const reviewer1Login = 'phase09.p002.review1'
const reviewer2Login = 'phase09.p002.review2'
const reviewer3Login = 'phase09.p002.review3'
const techLogin = 'phase09.p002.tech'
const outLogin = 'phase09.p002.out'
const requestedHighRoleId = '70000000-0000-0000-0000-000000000997'
const apiBase = 'http://127.0.0.1:18082'
const employeeBase = 'http://127.0.0.1:5283/employee.html'
const centerBase = 'http://127.0.0.1:5284/center.html'
const techBase = 'http://127.0.0.1:5285/admin.html'
const mainSubject = 'P002 live high-risk lifecycle'

interface PermissionRequestRecord {
  id: string
  businessNo: string
  workflowInstanceId: string | null
  status: string
  versionNo: number
  riskLevel: string
  ownerEmployeeId: string
  requestedRoleId: string
  userRoleId: string | null
  grantStatus: string
  effectiveStartAt: string
  effectiveEndAt: string
  executedAt: string | null
  revokedAt: string | null
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}

async function apiLogin(request: APIRequestContext, loginName: string): Promise<string> {
  const response = await request.post(`${apiBase}/api/v1/auth/login`, {
    data: { tenantCode, loginName, password },
  })
  expect(response.status()).toBe(200)
  const body = await response.json() as { accessToken: string }
  return body.accessToken
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

function auth(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` }
}

function localDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function getRequest(request: APIRequestContext, token: string, id: string): Promise<PermissionRequestRecord> {
  const response = await request.get(`${apiBase}/api/v1/processes/P002/permission-requests/${id}`, { headers: auth(token) })
  expect(response.status()).toBe(200)
  return await response.json() as PermissionRequestRecord
}

async function review(
  request: APIRequestContext,
  token: string,
  id: string,
  key: string,
  expectedVersion: number,
  decision: 'APPROVE' | 'REJECT' | 'KEEP' | 'REVOKE',
): Promise<{ status: number; body?: PermissionRequestRecord }> {
  const response = await request.post(`${apiBase}/api/v1/processes/P002/permission-requests/${id}/actions/review`, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data: { expectedVersion, decision, reason: `phase09-p002-${decision.toLowerCase()}` },
  })
  return {
    status: response.status(),
    ...(response.ok() ? { body: await response.json() as PermissionRequestRecord } : {}),
  }
}

test('P002 real high-risk request, reviewer separation, idempotency, scope and three-portal lifecycle', async ({ page, request }) => {
  const applicantToken = await apiLogin(request, applicantLogin)
  const reviewer1Token = await apiLogin(request, reviewer1Login)
  const reviewer2Token = await apiLogin(request, reviewer2Login)
  const reviewer3Token = await apiLogin(request, reviewer3Login)
  const techToken = await apiLogin(request, techLogin)
  const outToken = await apiLogin(request, outLogin)

  await loginPortal(page, employeeBase, applicantLogin, '员工工作入口')
  await page.goto(`${employeeBase}#/employee/03/07/04`)
  await expect(page.getByRole('heading', { name: '临时权限申请', level: 1 })).toBeVisible()
  const start = new Date(Date.now() - 60_000)
  const end = new Date(Date.now() + 2 * 60 * 60_000)
  await page.getByLabel('申请角色 ID').fill(requestedHighRoleId)
  await page.getByLabel('生效时间').fill(localDateTime(start))
  await page.getByLabel('结束时间').fill(localDateTime(end))
  await page.getByLabel('业务对象编号').fill(`P002-LIVE-${Date.now()}`)
  await page.getByLabel('业务对象名称').fill('PHASE-09 real permission target')
  await page.getByLabel('业务范围 ID').fill('CENTER_A')
  await page.getByLabel('主题').fill(mainSubject)
  await page.getByLabel('申请原因').fill('验证真实三端权限申请审批执行回收闭环')
  await page.getByLabel('期望结果').fill('高风险权限经三人关键节点复核后生效并可回收')
  await page.getByRole('button', { name: '提交权限申请' }).click()
  await expect(page.getByRole('status')).toContainText('业务负责人确认')
  const employeeRecord = page.locator('article.record').filter({ hasText: mainSubject })
  await expect(employeeRecord).toContainText('业务负责人确认')
  await expect(employeeRecord).toContainText('HIGH')
  const requestId = await employeeRecord.getAttribute('data-request-id')
  expect(requestId).toBeTruthy()
  const id = requestId ?? ''

  let current = await getRequest(request, applicantToken, id)
  expect(current.riskLevel).toBe('HIGH')
  expect(current.status).toBe('业务负责人确认')
  expect(current.grantStatus).toBe('REQUESTED')
  expect(current.requestedRoleId).toBe(requestedHighRoleId)

  const outList = await request.get(`${apiBase}/api/v1/processes/P002/permission-requests`, { headers: auth(outToken) })
  expect(outList.status()).toBe(200)
  expect(await outList.json()).toEqual([])
  const outGet = await request.get(`${apiBase}/api/v1/processes/P002/permission-requests/${id}`, { headers: auth(outToken) })
  expect(outGet.status()).toBe(403)
  const applicantCannotReview = await review(request, applicantToken, id, `p002-no-review-${randomUUID()}`, current.versionNo, 'APPROVE')
  expect(applicantCannotReview.status).toBe(403)

  const staleReview = await review(
    request,
    reviewer1Token,
    id,
    `p002-stale-review-${randomUUID()}`,
    Math.max(0, current.versionNo - 1),
    'APPROVE',
  )
  expect(staleReview.status).toBe(409)
  current = await getRequest(request, applicantToken, id)
  expect(current.status).toBe('业务负责人确认')

  await loginPortal(page, centerBase, reviewer1Login, '中心管理工作入口')
  await page.goto(`${centerBase}#/center/02/01/01`)
  await expect(page.getByRole('heading', { name: '中心管理端审批与监督', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '权限申请审批收件箱', level: 1 })).toBeVisible()
  let centerRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(centerRecord).toContainText('业务负责人确认')
  await centerRecord.getByRole('button', { name: '通过当前复核' }).click()
  await expect(centerRecord).toContainText('数据责任人复核')

  current = await getRequest(request, applicantToken, id)
  expect(current.status).toBe('数据责任人复核')
  const sameReviewerAgain = await review(request, reviewer1Token, id, `p002-same-reviewer-${randomUUID()}`, current.versionNo, 'APPROVE')
  expect(sameReviewerAgain.status).toBe(409)

  const review2Key = `p002-review2-${randomUUID()}`
  const review2First = await review(request, reviewer2Token, id, review2Key, current.versionNo, 'APPROVE')
  expect(review2First.status).toBe(200)
  expect(review2First.body?.status).toBe('高风险权限审批')
  const review2Replay = await review(request, reviewer2Token, id, review2Key, current.versionNo, 'APPROVE')
  expect(review2Replay.status).toBe(200)
  expect(review2Replay.body?.id).toBe(id)
  expect(review2Replay.body?.status).toBe('高风险权限审批')
  expect(review2Replay.body?.versionNo).toBe(review2First.body?.versionNo)

  current = await getRequest(request, applicantToken, id)
  const reviewer2CannotTakeNextKeyNode = await review(
    request,
    reviewer2Token,
    id,
    `p002-review2-repeat-${randomUUID()}`,
    current.versionNo,
    'APPROVE',
  )
  expect(reviewer2CannotTakeNextKeyNode.status).toBe(409)

  const review3 = await review(request, reviewer3Token, id, `p002-review3-${randomUUID()}`, current.versionNo, 'APPROVE')
  expect(review3.status).toBe(200)
  expect(review3.body?.status).toBe('权限生效')
  current = review3.body ?? await getRequest(request, applicantToken, id)

  const staleExecute = await request.post(`${apiBase}/api/v1/processes/P002/permission-requests/${id}/actions/execute`, {
    headers: { ...auth(techToken), 'Idempotency-Key': `p002-stale-execute-${randomUUID()}` },
    data: { expectedVersion: Math.max(0, current.versionNo - 1), reason: 'stale execution must fail' },
  })
  expect(staleExecute.status()).toBe(409)

  await loginPortal(page, techBase, techLogin, '技术运行工作入口')
  await page.goto(`${techBase}#/tech/03/01/04`)
  await expect(page.getByRole('heading', { name: '权限授权执行与回收', level: 1 })).toBeVisible()
  let techRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(techRecord).toContainText('权限生效')
  await techRecord.getByRole('button', { name: '执行授权' }).click()
  await expect(techRecord).toContainText('定期复核')
  await expect(techRecord).toContainText('ACTIVE')

  current = await getRequest(request, applicantToken, id)
  expect(current.status).toBe('定期复核')
  expect(current.grantStatus).toBe('ACTIVE')
  expect(current.userRoleId).toBeTruthy()
  expect(current.executedAt).toBeTruthy()

  await page.goto(`${centerBase}#/center/02/01/01`)
  centerRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(centerRecord).toContainText('定期复核')
  await centerRecord.getByRole('button', { name: '进入回收' }).click()
  await expect(centerRecord).toContainText('到期/调岗/离职回收')

  await page.goto(`${techBase}#/tech/03/01/04`)
  techRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(techRecord).toContainText('到期/调岗/离职回收')
  await techRecord.getByRole('button', { name: '执行回收' }).click()
  await expect(techRecord).toContainText('已关闭')
  await expect(techRecord).toContainText('REVOKED')

  current = await getRequest(request, applicantToken, id)
  expect(current.status).toBe('已关闭')
  expect(current.grantStatus).toBe('REVOKED')
  expect(current.revokedAt).toBeTruthy()
  expect(current.userRoleId).toBeTruthy()

  const techCannotExecuteClosed = await request.post(`${apiBase}/api/v1/processes/P002/permission-requests/${id}/actions/execute`, {
    headers: { ...auth(techToken), 'Idempotency-Key': `p002-closed-execute-${randomUUID()}` },
    data: { expectedVersion: current.versionNo, reason: 'closed request must fail execution' },
  })
  expect(techCannotExecuteClosed.status()).toBe(409)
})
