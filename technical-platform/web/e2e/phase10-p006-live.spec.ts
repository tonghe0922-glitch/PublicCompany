import { randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE10_P006_TENANT')
const ownerLogin = requiredEnv('PHASE10_P006_LOGIN')
const password = requiredEnv('PHASE10_P006_PASSWORD')
const managerLogin = 'phase10.p006.manager'
const acceptorLogin = 'phase10.p006.acceptor'
const techLogin = 'phase10.p006.tech'
const outLogin = 'phase10.p006.out'
const ownerEmployeeId = '30000000-0000-0000-0000-000000002026'
const apiBase = 'http://127.0.0.1:18086'
const employeeBase = 'http://127.0.0.1:5303/employee.html'
const centerBase = 'http://127.0.0.1:5304/center.html'
const techBase = 'http://127.0.0.1:5305/admin.html'
const privateContent = 'P006-PRIVATE-MINUTES-BROWSER-E2E'

interface Meeting {
  id: string; businessNo: string; workflowInstanceNo: string | null; currentNodeCode: string | null
  subject: string; status: string; versionNo: number; reason: string | null; officialContent: string | null
}
function requiredEnv(name: string): string { const value = process.env[name]; if (!value) throw new Error(`required E2E environment missing: ${name}`); return value }
function auth(token: string): Record<string, string> { return { Authorization: `Bearer ${token}` } }
async function apiLogin(request: APIRequestContext, loginName: string): Promise<string> {
  const response = await request.post(`${apiBase}/api/v1/auth/login`, { data: { tenantCode, loginName, password } })
  expect(response.status()).toBe(200); return ((await response.json()) as { accessToken: string }).accessToken
}
async function loginPortal(page: Page, base: string, loginName: string, homeTitle: string): Promise<void> {
  await page.goto(base); await expect(page).toHaveURL(/#\/login/u)
  await page.getByLabel('租户编码').fill(tenantCode); await page.getByLabel('登录账号').fill(loginName); await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click(); await expect(page.getByRole('heading', { name: homeTitle, level: 1 })).toBeVisible()
}
async function getMeeting(request: APIRequestContext, token: string, id: string): Promise<Meeting> {
  const response = await request.get(`${apiBase}/api/v1/processes/P006/meetings/${id}`, { headers: auth(token) })
  expect(response.status()).toBe(200); return await response.json() as Meeting
}
async function listMeetings(request: APIRequestContext, token: string): Promise<Meeting[]> {
  const response = await request.get(`${apiBase}/api/v1/processes/P006/meetings`, { headers: auth(token) })
  expect(response.status()).toBe(200); return await response.json() as Meeting[]
}
async function selectMeeting(page: Page, meeting: Meeting): Promise<void> {
  const selector = page.locator(`[data-select-record="${meeting.id}"]`)
  if (await selector.count() > 0) await selector.click()
  await expect(page.getByText(`${meeting.businessNo} · ${meeting.subject}`, { exact: true })).toBeVisible()
}
async function act(
  request: APIRequestContext, token: string, id: string, actionCode: string, expectedVersion: number,
  extra: Partial<{ reason: string; resultSummary: string; actionItems: unknown[]; evidence: Record<string, string> }> = {},
): Promise<{ status: number; body?: Meeting }> {
  const response = await request.post(`${apiBase}/api/v1/processes/P006/meetings/${id}/actions/${actionCode}`, {
    headers: { ...auth(token), 'Idempotency-Key': `p006-${actionCode.toLowerCase()}-${randomUUID()}` },
    data: { expectedVersion, reason: extra.reason ?? `P006 ${actionCode} browser E2E`, resultSummary: extra.resultSummary ?? null,
      actionItems: extra.actionItems ?? [], evidence: extra.evidence ?? null },
  })
  return { status: response.status(), ...(response.ok() ? { body: await response.json() as Meeting } : {}) }
}
function evidence(note: string): Record<string, string> { return { note, recordedAt: new Date().toISOString() } }
function localDateTime(offsetDays: number): string { const value = new Date(Date.now() + offsetDays * 86_400_000); return value.toISOString().slice(0, 16) }

test('P006 real meeting lifecycle spans employee, center and tech portals with rework and independent acceptance', async ({ page, request }) => {
  const owner = await apiLogin(request, ownerLogin), manager = await apiLogin(request, managerLogin)
  const acceptor = await apiLogin(request, acceptorLogin), tech = await apiLogin(request, techLogin), out = await apiLogin(request, outLogin)

  await loginPortal(page, employeeBase, ownerLogin, '员工工作入口')
  await page.goto(`${employeeBase}#/employee/05/01/03`)
  await expect(page.getByRole('heading', { name: '会议详情与材料', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '会议、纪要与行动项', level: 2 })).toBeVisible()
  await page.getByLabel('会议主题').fill('P006 浏览器真实会议闭环')
  await page.getByLabel('正式标题').fill('P006 浏览器独立验收会议')
  await page.getByLabel('业务日期').fill(new Date().toISOString().slice(0, 10))
  await page.getByLabel('开始时间').fill(localDateTime(2))
  await page.getByLabel('地点/渠道').fill('第一会议室')
  await page.getByLabel('登记原因').fill('用于验证会议行动项完整闭环与权限隔离')
  await page.getByLabel('议题正文').fill(privateContent)
  const createResponsePromise = page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/v1/processes/P006/meetings')
  await page.getByRole('button', { name: '保存议题' }).click()
  const createResponse = await createResponsePromise
  expect(createResponse.status()).toBe(200)
  const created = await createResponse.json() as Meeting
  const id = created.id
  expect(id).toBeTruthy()
  const ownerMeetings = await listMeetings(request, owner)
  expect(ownerMeetings.some(meeting => meeting.id === id && meeting.subject === created.subject)).toBe(true)
  await selectMeeting(page, created)
  await expect(page.getByText('S01', { exact: true }).first()).toBeVisible()

  expect((await request.get(`${apiBase}/api/v1/processes/P006/meetings`, { headers: auth(out) })).status()).toBe(200)
  expect(await (await request.get(`${apiBase}/api/v1/processes/P006/meetings`, { headers: auth(out) })).json()).toEqual([])
  expect((await request.get(`${apiBase}/api/v1/processes/P006/meetings/${id}`, { headers: auth(out) })).status()).toBe(403)
  const techMasked = await getMeeting(request, tech, id); expect(techMasked.reason).toBeNull(); expect(techMasked.officialContent).toBeNull(); expect(JSON.stringify(techMasked)).not.toContain(privateContent)

  const submitResponsePromise = page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === `/api/v1/processes/P006/meetings/${id}/actions/SUBMIT`)
  await page.locator('[data-action-code="SUBMIT"]').click()
  expect((await submitResponsePromise).status()).toBe(200)
  let current = await getMeeting(request, owner, id); expect(current.currentNodeCode).toBe('S02')
  await expect(page.getByText('S02', { exact: true }).first()).toBeVisible()
  expect((await act(request, owner, id, 'ACCEPT', current.versionNo)).status).toBe(403)

  await loginPortal(page, centerBase, managerLogin, '中心管理工作入口')
  await page.goto(`${centerBase}#/center/06/09/03`)
  await expect(page.getByRole('heading', { name: '会议议题、材料、签到、纪要与行动', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: '会议、纪要与行动项', level: 2 })).toBeVisible()
  current = await getMeeting(request, manager, id)
  await selectMeeting(page, current)
  await expect(page.getByText('S02', { exact: true }).first()).toBeVisible()
  await page.getByLabel('处理/退回原因').fill('材料完整，允许发布')
  const acceptResponsePromise = page.waitForResponse(response => response.request().method() === 'POST'
    && new URL(response.url()).pathname === `/api/v1/processes/P006/meetings/${id}/actions/ACCEPT`)
  await page.locator('[data-action-code="ACCEPT"]').click()
  expect((await acceptResponsePromise).status()).toBe(200)
  await expect(page.getByText('S03', { exact: true }).first()).toBeVisible()

  current = await getMeeting(request, owner, id)
  let moved = await act(request, manager, id, 'PUBLISH', current.versionNo); expect(moved.status).toBe(200); current = moved.body!
  moved = await act(request, owner, id, 'RECORD_ATTENDANCE', current.versionNo); expect(moved.status).toBe(200); current = moved.body!
  moved = await act(request, manager, id, 'CONVENE', current.versionNo); expect(moved.status).toBe(200); current = moved.body!
  moved = await act(request, manager, id, 'CONFIRM_MINUTES', current.versionNo, { resultSummary: '主持人确认纪要并冻结' }); expect(moved.status).toBe(200); current = moved.body!
  const actionItems = [{ itemKey: 'A01', itemName: '完成浏览器闭环证据', ownerEmployeeId,
    plannedStartAt: new Date(Date.now() + 86_400_000).toISOString(), plannedFinishAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), acceptanceCriteria: '页面、接口和证据完整' }]
  moved = await act(request, manager, id, 'GENERATE_ACTIONS', current.versionNo, { actionItems }); expect(moved.status).toBe(200); current = moved.body!
  expect(current.currentNodeCode).toBe('S08')
  expect((await act(request, manager, id, 'SUBMIT_EXECUTION', current.versionNo, { evidence: evidence('越权执行') })).status).toBe(403)
  moved = await act(request, owner, id, 'SUBMIT_EXECUTION', current.versionNo, { evidence: evidence('第一次真实执行证据') }); expect(moved.status).toBe(200); current = moved.body!
  expect((await act(request, owner, id, 'ACCEPT_RESULT', current.versionNo, { evidence: evidence('禁止自验收') })).status).toBe(403)
  moved = await act(request, acceptor, id, 'REWORK', current.versionNo, { reason: '证据不完整，受控返工', evidence: evidence('缺少浏览器截图') }); expect(moved.status).toBe(200); current = moved.body!
  expect(current.currentNodeCode).toBe('S08')
  moved = await act(request, owner, id, 'SUBMIT_EXECUTION', current.versionNo, { evidence: evidence('返工后补齐真实证据') }); expect(moved.status).toBe(200); current = moved.body!
  moved = await act(request, acceptor, id, 'ACCEPT_RESULT', current.versionNo, { evidence: evidence('独立验收人复核通过') }); expect(moved.status).toBe(200); current = moved.body!
  moved = await act(request, manager, id, 'ACKNOWLEDGE_OVERDUE', current.versionNo, { evidence: evidence('逾期升级事实已核对') }); expect(moved.status).toBe(200); current = moved.body!
  moved = await act(request, manager, id, 'ARCHIVE', current.versionNo, { resultSummary: '归档复盘完成', evidence: evidence('归档清单已核对') }); expect(moved.status).toBe(200); current = moved.body!
  expect(current.currentNodeCode).toBe('END'); expect(current.status).toBe('已归档')

  await loginPortal(page, techBase, techLogin, '技术运行工作入口')
  await page.goto(`${techBase}#/tech/05/03/01`)
  await expect(page.getByRole('heading', { name: 'P004/P005 工作流监控', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'P006 工作流运行监控', level: 2 })).toBeVisible()
  const techRecord = await getMeeting(request, tech, id)
  await selectMeeting(page, techRecord)
  await expect(page.getByText('已归档', { exact: true }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText(privateContent)
  await expect(page.locator('[data-action-code]')).toHaveCount(0)

  await page.goto(`${employeeBase}#/employee/05/07/02`)
  await expect(page.getByRole('heading', { name: '我的行动项', level: 1 })).toBeVisible()
  const employeeClosed = await getMeeting(request, owner, id)
  expect(employeeClosed.officialContent).toBe(privateContent)
  await selectMeeting(page, employeeClosed)
  await expect(page.getByText('已归档', { exact: true }).first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText(privateContent)
})
