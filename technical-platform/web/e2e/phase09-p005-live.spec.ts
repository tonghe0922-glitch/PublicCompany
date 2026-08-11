import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE09_P005_TENANT')
const recipient1Login = requiredEnv('PHASE09_P005_RECIPIENT1_LOGIN')
const password = requiredEnv('PHASE09_P005_PASSWORD')
const publisherLogin = 'phase09.p004.actor1'
const recipient2Login = 'phase09.p004.actor2'
const techLogin = 'phase09.p004.tech'
const outsiderLogin = 'phase09.p004.out'
const apiBase = 'http://127.0.0.1:18084'
const employeeBase = 'http://127.0.0.1:5393/employee.html'
const centerBase = 'http://127.0.0.1:5394/center.html'
const techBase = 'http://127.0.0.1:5395/admin.html'
const policyCode = 'P005-LIVE-POLICY'
const privateSubject = 'P005 LIVE PRIVATE POLICY SUBJECT'
const privateContent = 'P005-PRIVATE-CONTENT-ONLY-BUSINESS-RECIPIENTS'

interface Notice {
  id: string
  businessNo: string
  workflowInstanceId: string | null
  workflowInstanceNo: string | null
  currentNodeCode: string | null
  status: string
  versionNo: number
  policyCode: string
  policyVersion: number
  officialSubject: string | null
  officialContent: string | null
  ownerEmployeeId: string | null
  targetCenterId: string
  targetPositionCode: string | null
  archivedAt: string | null
  actualEndAt: string | null
}
interface Recipient {
  id: string
  employeeId: string
  deliveryStatus: string
  deliveredAt: string | null
  readAt: string | null
  confirmedAt: string | null
  understandingScore: number | null
  understandingPassedAt: string | null
  executionSummary: string | null
  executedAt: string | null
  acceptedAt: string | null
  versionNo: number
}
interface NoticeView {
  notice: Notice
  recipients: Recipient[]
  recipientCount: number
  deliveredCount: number
  readCount: number
  confirmedCount: number
  understandingPassedCount: number
  executedCount: number
  acceptedCount: number
}
type ApiResult = { status: number; body?: NoticeView }
type ReceiptKind = 'read' | 'confirm' | 'understanding' | 'execution'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}
function auth(accessToken: string): Record<string, string> { return { Authorization: `Bearer ${accessToken}` } }
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
async function getView(request: APIRequestContext, token: string, id: string): Promise<NoticeView> {
  const response = await request.get(`${apiBase}/api/v1/processes/P005/notices/${id}`, { headers: auth(token) })
  expect(response.status()).toBe(200)
  return await response.json() as NoticeView
}
async function postReceipt(
  request: APIRequestContext,
  token: string,
  id: string,
  kind: ReceiptKind,
  expectedRecipientVersion: number,
  key = `p005-${kind}-${randomUUID()}`,
  extra: Partial<{ score: number; summary: string }> = {},
): Promise<ApiResult> {
  const data: Record<string, unknown> = { expectedRecipientVersion }
  if (kind === 'understanding') data.score = extra.score ?? 95
  if (kind === 'execution') data.summary = extra.summary ?? 'P005 recipient execution completed by live E2E'
  const response = await request.post(`${apiBase}/api/v1/processes/P005/notices/${id}/${kind}`, {
    headers: { ...auth(token), 'Idempotency-Key': key }, data,
  })
  return { status: response.status(), ...(response.ok() ? { body: await response.json() as NoticeView } : {}) }
}
async function refreshRecord(page: Page, id: string): Promise<Locator> {
  const p005 = page.locator('main[data-testid="p005-page"]')
  await p005.getByRole('button', { name: '刷新' }).click()
  const record = p005.locator(`article[data-notice-id="${id}"]`)
  await expect(record).toBeVisible()
  return record
}

test('P005 real notice delivery keeps read distinct from confirm and closes three-portal lifecycle', async ({ page, request }) => {
  const publisherToken = await apiLogin(request, publisherLogin)
  const recipient1Token = await apiLogin(request, recipient1Login)
  const recipient2Token = await apiLogin(request, recipient2Login)
  const techToken = await apiLogin(request, techLogin)
  const outsiderToken = await apiLogin(request, outsiderLogin)

  await loginPortal(page, centerBase, publisherLogin, '中心管理工作入口')
  await page.goto(`${centerBase}#/center/13/01/05`)
  await expect(page.getByRole('heading', { name: '制度通知发布与验收', level: 1 })).toBeVisible()
  await page.getByLabel('制度编码').fill(policyCode)
  await page.getByLabel('目标岗位编码（可选）').fill('P005_RECIPIENT')
  await page.getByLabel('理解验证通过分').fill('80')
  await page.getByLabel('正式主题').fill(privateSubject)
  await page.getByLabel('正式正文').fill(privateContent)
  await page.getByRole('button', { name: '发布制度通知' }).click()
  await expect(page.locator('p.phase09-feedback')).toContainText('已发布')

  const publishedRecord = page.locator('article.record').filter({ hasText: privateSubject })
  await expect(publishedRecord).toBeVisible()
  const id = await publishedRecord.getAttribute('data-notice-id')
  if (!id) throw new Error('P005 rendered notice id is missing')

  let managerView = await getView(request, publisherToken, id)
  expect(managerView.notice.currentNodeCode).toBe('S04')
  expect(managerView.notice.policyVersion).toBe(1)
  expect(managerView.recipientCount).toBe(2)
  expect(managerView.recipients).toHaveLength(2)

  await expect.poll(async () => (await getView(request, publisherToken, id)).deliveredCount).toBe(2)
  managerView = await getView(request, publisherToken, id)
  expect(managerView.recipients.every((recipient) => recipient.deliveryStatus === 'DELIVERED' && recipient.deliveredAt)).toBe(true)

  const outsiderList = await request.get(`${apiBase}/api/v1/processes/P005/notices`, { headers: auth(outsiderToken) })
  expect(outsiderList.status()).toBe(200)
  expect(await outsiderList.json()).toEqual([])
  const outsiderGet = await request.get(`${apiBase}/api/v1/processes/P005/notices/${id}`, { headers: auth(outsiderToken) })
  expect(outsiderGet.status()).toBe(403)

  const techView = await getView(request, techToken, id)
  expect(techView.notice.officialSubject).toBeNull()
  expect(techView.notice.officialContent).toBeNull()
  expect(techView.notice.ownerEmployeeId).toBeNull()
  expect(techView.recipients).toEqual([])
  expect(JSON.stringify(techView)).not.toContain(privateSubject)
  expect(JSON.stringify(techView)).not.toContain(privateContent)
  const techManage = await request.post(`${apiBase}/api/v1/processes/P005/notices/${id}/actions/ACCEPT_EXECUTION`, {
    headers: { ...auth(techToken), 'Idempotency-Key': `p005-tech-forbidden-${randomUUID()}` },
    data: { expectedVersion: techView.notice.versionNo, reason: 'must be forbidden' },
  })
  expect(techManage.status()).toBe(403)

  const recipient2Before = await getView(request, recipient2Token, id)
  const recipient2Version = recipient2Before.recipients[0]?.versionNo
  expect(recipient2Version).toBeGreaterThan(0)
  expect((await postReceipt(request, recipient2Token, id, 'confirm', recipient2Version)).status).toBe(409)
  expect((await postReceipt(request, recipient2Token, id, 'read', recipient2Version - 1)).status).toBe(409)

  await loginPortal(page, employeeBase, recipient1Login, '员工工作入口')
  await page.goto(`${employeeBase}#/employee/13/01/05`)
  await expect(page.getByRole('heading', { name: '制度通知与执行回执', level: 1 })).toBeVisible()
  let employeeRecord = page.locator(`article[data-notice-id="${id}"]`)
  await expect(employeeRecord).toContainText('送达：DELIVERED')
  await employeeRecord.getByRole('button', { name: '标记已阅读' }).click()
  await expect(employeeRecord).toContainText('阅读 1')
  await expect(employeeRecord).toContainText('确认 0')
  let recipient1View = await getView(request, recipient1Token, id)
  expect(recipient1View.readCount).toBe(1)
  expect(recipient1View.confirmedCount).toBe(0)

  const readKey = `p005-recipient2-read-${randomUUID()}`
  const read2 = await postReceipt(request, recipient2Token, id, 'read', recipient2Version, readKey)
  expect(read2.status).toBe(200)
  expect(read2.body?.notice.currentNodeCode).toBe('S05')
  const replay2 = await postReceipt(request, recipient2Token, id, 'read', recipient2Version, readKey)
  expect(replay2.status).toBe(200)
  expect(replay2.body?.notice.currentNodeCode).toBe('S05')

  employeeRecord = await refreshRecord(page, id)
  await employeeRecord.getByRole('button', { name: '确认阅签' }).click()
  await expect.poll(async () => (await getView(request, recipient1Token, id)).confirmedCount).toBe(1)
  recipient1View = await getView(request, recipient1Token, id)
  expect(recipient1View.readCount).toBe(2)
  expect(recipient1View.confirmedCount).toBe(1)
  const recipient2Confirm = await getView(request, recipient2Token, id)
  const confirm2 = await postReceipt(request, recipient2Token, id, 'confirm', recipient2Confirm.recipients[0].versionNo)
  expect(confirm2.status).toBe(200)
  expect(confirm2.body?.notice.currentNodeCode).toBe('S06')

  employeeRecord = await refreshRecord(page, id)
  await page.getByLabel('理解验证分数').fill('92')
  await employeeRecord.getByRole('button', { name: '提交理解验证' }).click()
  await expect.poll(async () => (await getView(request, recipient1Token, id)).understandingPassedCount).toBe(1)
  const recipient2Understanding = await getView(request, recipient2Token, id)
  const understood2 = await postReceipt(
    request, recipient2Token, id, 'understanding', recipient2Understanding.recipients[0].versionNo, undefined, { score: 96 },
  )
  expect(understood2.status).toBe(200)
  expect(understood2.body?.notice.currentNodeCode).toBe('S07')

  employeeRecord = await refreshRecord(page, id)
  await page.getByLabel('执行结果摘要').fill('P005 recipient one execution completed by UI')
  await employeeRecord.getByRole('button', { name: '提交执行结果' }).click()
  await expect.poll(async () => (await getView(request, recipient1Token, id)).executedCount).toBe(1)
  const recipient2Execution = await getView(request, recipient2Token, id)
  const executed2 = await postReceipt(
    request, recipient2Token, id, 'execution', recipient2Execution.recipients[0].versionNo, undefined,
    { summary: 'P005 recipient two execution completed by API' },
  )
  expect(executed2.status).toBe(200)
  expect(executed2.body?.notice.currentNodeCode).toBe('S08')

  await page.goto(`${centerBase}#/center/13/01/05`)
  let centerRecord = await refreshRecord(page, id)
  await centerRecord.getByRole('button', { name: '验收执行结果' }).click()
  await expect(centerRecord).toContainText('未完成催办升级')
  centerRecord = page.locator(`article[data-notice-id="${id}"]`)
  await centerRecord.getByRole('button', { name: '处理催办升级' }).click()
  await expect(centerRecord).toContainText('档案移交')
  centerRecord = page.locator(`article[data-notice-id="${id}"]`)
  await centerRecord.getByRole('button', { name: '移交归档并关闭' }).click()
  await expect(centerRecord).toContainText('已关闭')

  managerView = await getView(request, publisherToken, id)
  expect(managerView.notice.currentNodeCode).toBe('END')
  expect(managerView.notice.status).toBe('已关闭')
  expect(managerView.notice.archivedAt).toBeTruthy()
  expect(managerView.notice.actualEndAt).toBeTruthy()
  expect(managerView.acceptedCount).toBe(2)

  await loginPortal(page, techBase, techLogin, '技术运行工作入口')
  await page.goto(`${techBase}#/tech/05/03/01`)
  await expect(page.getByRole('heading', { name: '制度通知与执行回执监控', level: 1 })).toBeVisible()
  const techRecord = page.locator(`article[data-notice-id="${id}"]`)
  await expect(techRecord).toContainText('已关闭')
  await expect(techRecord).not.toContainText(privateSubject)
  await expect(techRecord).not.toContainText(privateContent)
  await expect(techRecord).toContainText('技术监控按最小必要原则')

  await page.goto(`${employeeBase}#/employee/13/01/05`)
  const closedEmployeeRecord = page.locator(`article[data-notice-id="${id}"]`)
  await expect(closedEmployeeRecord).toContainText('已关闭')
  await expect(closedEmployeeRecord).toContainText(privateSubject)
  await expect(closedEmployeeRecord).toContainText(privateContent)
})
