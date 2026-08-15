import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE09_P003_TENANT')
const applicantLogin = requiredEnv('PHASE09_P003_LOGIN')
const password = requiredEnv('PHASE09_P003_PASSWORD')
const reviewer1Login = 'phase09.p003.review1'
const reviewer2Login = 'phase09.p003.review2'
const techLogin = 'phase09.p003.tech'
const outLogin = 'phase09.p003.out'
const apiBase = 'http://127.0.0.1:18083'
const employeeBase = 'http://127.0.0.1:5293/employee.html'
const centerBase = 'http://127.0.0.1:5294/center.html'
const techBase = 'http://127.0.0.1:5295/admin.html'
const mainSubject = 'P003 live P3 profile lifecycle'
const syntheticIdNo = 'TESTP003ID00001234'
const proofReference = 'P003-E2E-PROOF-REF-001'

interface ChangeView {
  fieldCode: string
  sensitivity: string
  proposedValueMasked: string
  proofProvided: boolean
}
interface ProfileChangeRecord {
  id: string
  businessNo: string
  workflowInstanceId: string | null
  status: string
  versionNo: number
  subject: string
  riskLevel: string
  ownerEmployeeId: string
  ownerCenterId: string
  closedAt: string | null
  changes: ChangeView[]
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

async function getChange(request: APIRequestContext, token: string, id: string): Promise<ProfileChangeRecord> {
  const response = await request.get(`${apiBase}/api/v1/processes/P003/profile-changes/${id}`, { headers: auth(token) })
  expect(response.status()).toBe(200)
  return await response.json() as ProfileChangeRecord
}

async function review(
  request: APIRequestContext,
  token: string,
  id: string,
  key: string,
  expectedVersion: number,
  decision: 'APPROVE' | 'REJECT',
): Promise<{ status: number; body?: ProfileChangeRecord }> {
  const response = await request.post(`${apiBase}/api/v1/processes/P003/profile-changes/${id}/actions/review`, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data: { expectedVersion, decision, reason: `phase09-p003-${decision.toLowerCase()}` },
  })
  return { status: response.status(), ...(response.ok() ? { body: await response.json() as ProfileChangeRecord } : {}) }
}

test('P003 real P3 profile change, reviewer separation, encryption, scope and three-portal lifecycle', async ({ page, request }) => {
  const applicantToken = await apiLogin(request, applicantLogin)
  const reviewer1Token = await apiLogin(request, reviewer1Login)
  const reviewer2Token = await apiLogin(request, reviewer2Login)
  const techToken = await apiLogin(request, techLogin)
  const outToken = await apiLogin(request, outLogin)

  await loginPortal(page, employeeBase, applicantLogin, '员工工作入口')
  await page.goto(`${employeeBase}#/employee/03/03/01`)
  await expect(page.getByRole('heading', { name: '个人资料变更', level: 2 })).toBeVisible()
  await page.getByLabel('变更字段').selectOption('id_no')
  await page.getByLabel('新值').fill(syntheticIdNo)
  await page.getByLabel('证明引用').fill(proofReference)
  await page.getByLabel('主题').fill(mainSubject)
  await page.getByLabel('变更原因').fill('验证 P3 高度敏感资料真实双人复核与权威主档更新闭环')
  await page.getByLabel('已知影响').fill('仅更新员工权威主档并通过事件驱动同步，不向页面返回明文')
  await page.getByRole('button', { name: '提交资料变更' }).click()
  await expect(page.locator('p.phase09-feedback')).toContainText('字段敏感级别校验')

  const employeeRecord = page.locator('article.record').filter({ hasText: mainSubject })
  await expect(employeeRecord).toContainText('字段敏感级别校验')
  await expect(employeeRecord).toContainText('HIGH')
  await expect(employeeRecord).toContainText('********1234')
  await expect(employeeRecord).not.toContainText(syntheticIdNo)
  await expect(employeeRecord).toContainText('P3-高度敏感')
  await expect(employeeRecord).toContainText('已有证明')
  const requestId = await employeeRecord.getAttribute('data-request-id')
  expect(requestId).toBeTruthy()
  const id = requestId ?? ''

  let current = await getChange(request, applicantToken, id)
  expect(current.status).toBe('字段敏感级别校验')
  expect(current.riskLevel).toBe('HIGH')
  expect(current.changes).toEqual([{ fieldCode: 'id_no', sensitivity: 'P3-高度敏感', proposedValueMasked: '********1234', proofProvided: true }])
  expect(JSON.stringify(current)).not.toContain(syntheticIdNo)

  const outList = await request.get(`${apiBase}/api/v1/processes/P003/profile-changes`, { headers: auth(outToken) })
  expect(outList.status()).toBe(200)
  expect(await outList.json()).toEqual([])
  const outGet = await request.get(`${apiBase}/api/v1/processes/P003/profile-changes/${id}`, { headers: auth(outToken) })
  expect(outGet.status()).toBe(403)

  const applicantCannotReview = await review(request, applicantToken, id, `p003-no-review-${randomUUID()}`, current.versionNo, 'APPROVE')
  expect(applicantCannotReview.status).toBe(403)
  const applicantCannotApply = await request.post(`${apiBase}/api/v1/processes/P003/profile-changes/${id}/actions/apply`, {
    headers: { ...auth(applicantToken), 'Idempotency-Key': `p003-no-apply-${randomUUID()}` },
    data: { expectedVersion: current.versionNo, reason: 'applicant must not apply their own authoritative update' },
  })
  expect(applicantCannotApply.status()).toBe(403)

  const staleReview = await review(
    request,
    reviewer1Token,
    id,
    `p003-stale-review-${randomUUID()}`,
    Math.max(0, current.versionNo - 1),
    'APPROVE',
  )
  expect(staleReview.status).toBe(409)
  current = await getChange(request, applicantToken, id)
  expect(current.status).toBe('字段敏感级别校验')

  await loginPortal(page, centerBase, reviewer1Login, '中心管理工作入口')
  await page.goto(`${centerBase}#/center/03/02/01`)
  await expect(page.getByRole('heading', { name: '个人资料变更复核', level: 2 })).toBeVisible()
  const centerRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(centerRecord).toContainText('字段敏感级别校验')
  await expect(centerRecord).toContainText('********1234')
  await expect(centerRecord).not.toContainText(syntheticIdNo)
  await centerRecord.getByRole('button', { name: '通过当前复核' }).click()
  await expect(centerRecord).toContainText('人事/财务/归口岗核验')

  current = await getChange(request, applicantToken, id)
  expect(current.status).toBe('人事/财务/归口岗核验')
  const sameReviewerAgain = await review(request, reviewer1Token, id, `p003-same-reviewer-${randomUUID()}`, current.versionNo, 'APPROVE')
  expect(sameReviewerAgain.status).toBe(409)

  const review2Key = `p003-review2-${randomUUID()}`
  const review2First = await review(request, reviewer2Token, id, review2Key, current.versionNo, 'APPROVE')
  expect(review2First.status).toBe(200)
  expect(review2First.body?.status).toBe('权威主档更新')
  const review2Replay = await review(request, reviewer2Token, id, review2Key, current.versionNo, 'APPROVE')
  expect(review2Replay.status).toBe(200)
  expect(review2Replay.body?.id).toBe(id)
  expect(review2Replay.body?.status).toBe('权威主档更新')
  expect(review2Replay.body?.versionNo).toBe(review2First.body?.versionNo)

  current = review2First.body ?? await getChange(request, applicantToken, id)
  const reviewerCannotApply = await request.post(`${apiBase}/api/v1/processes/P003/profile-changes/${id}/actions/apply`, {
    headers: { ...auth(reviewer2Token), 'Idempotency-Key': `p003-reviewer-no-apply-${randomUUID()}` },
    data: { expectedVersion: current.versionNo, reason: 'reviewer cannot perform authoritative apply' },
  })
  expect(reviewerCannotApply.status()).toBe(403)
  const staleApply = await request.post(`${apiBase}/api/v1/processes/P003/profile-changes/${id}/actions/apply`, {
    headers: { ...auth(techToken), 'Idempotency-Key': `p003-stale-apply-${randomUUID()}` },
    data: { expectedVersion: Math.max(0, current.versionNo - 1), reason: 'stale authoritative apply must fail' },
  })
  expect(staleApply.status()).toBe(409)

  await loginPortal(page, techBase, techLogin, '技术运行工作入口')
  await page.goto(`${techBase}#/tech/04/01/01`)
  await expect(page.getByRole('heading', { name: '个人资料权威更新与同步', level: 2 })).toBeVisible()
  const techRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(techRecord).toContainText('权威主档更新')
  await expect(techRecord).toContainText('********1234')
  await expect(techRecord).not.toContainText(syntheticIdNo)
  await techRecord.getByRole('button', { name: '执行权威更新并同步' }).click()
  await expect(techRecord).toContainText('已关闭')

  current = await getChange(request, applicantToken, id)
  expect(current.status).toBe('已关闭')
  expect(current.closedAt).toBeTruthy()
  expect(JSON.stringify(current)).not.toContain(syntheticIdNo)
  expect(current.changes[0]?.proposedValueMasked).toBe('********1234')

  const closedReview = await review(request, reviewer1Token, id, `p003-closed-review-${randomUUID()}`, current.versionNo, 'APPROVE')
  expect(closedReview.status).toBe(409)
  const closedApply = await request.post(`${apiBase}/api/v1/processes/P003/profile-changes/${id}/actions/apply`, {
    headers: { ...auth(techToken), 'Idempotency-Key': `p003-closed-apply-${randomUUID()}` },
    data: { expectedVersion: current.versionNo, reason: 'closed request must not apply twice' },
  })
  expect(closedApply.status()).toBe(409)

  await page.goto(`${employeeBase}#/employee/03/03/01`)
  const closedEmployeeRecord = page.locator(`article[data-request-id="${id}"]`)
  await expect(closedEmployeeRecord).toContainText('已关闭')
  await expect(closedEmployeeRecord).toContainText('********1234')
  await expect(closedEmployeeRecord).not.toContainText(syntheticIdNo)
})
