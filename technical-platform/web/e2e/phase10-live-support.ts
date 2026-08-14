import { randomUUID } from 'node:crypto'
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test'

export const tenantCode = requiredEnv('PHASE10_E2E_TENANT')
export const password = requiredEnv('PHASE10_E2E_PASSWORD')
export const employeeLogin = requiredEnv('PHASE10_E2E_LOGIN')
export const managerLogin = 'phase10.manager'
export const techLogin = 'phase10.tech'
export const outLogin = 'phase10.out'
export const apiBase = 'http://127.0.0.1:18110'
export const employeeBase = 'http://127.0.0.1:5310/employee.html'
export const centerBase = 'http://127.0.0.1:5311/center.html'
export const techBase = 'http://127.0.0.1:5312/admin.html'
export const centerA = '10000000-0000-0000-0000-000000001010'
export const employeeId = '30000000-0000-0000-0000-000000001010'
export const managerId = '30000000-0000-0000-0000-000000001011'
export const courseVersionId = 'COURSE-P010-E2E'
export const privateMeeting = 'P006-PRIVATE-MEETING-CONTENT'
export const privateLeave = 'P008-PRIVATE-LEAVE-REASON'
export const privateOvertime = 'P009-PRIVATE-OVERTIME-REASON'

export interface CoreRecord {
  id: string
  businessNo: string
  currentNodeCode: string
  status: string
  versionNo: number
  subject?: string | null
  ownerEmployeeId?: string | null
}

export interface MeetingRecord extends CoreRecord {
  officialSubject: string | null
  officialContent: string | null
}

export interface MeetingItem {
  id: string
  fieldCode: string
  actionStatus: string | null
}

export interface MeetingAggregate {
  meeting: MeetingRecord
  items: MeetingItem[]
}

export interface RecordAggregate {
  record: CoreRecord
}

export interface LearningAggregate extends RecordAggregate {
  evidence: Array<{ evidenceType: string }>
}

export interface RouteExpectation {
  path: string
  testId: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

async function responseText(response: APIResponse): Promise<string> {
  return response.text()
}

async function expectRejected(response: APIResponse, status: number): Promise<void> {
  const body = await responseText(response)
  expect(response.status(), body).toBe(status)
}

async function expectJson<T>(response: APIResponse, status = 200): Promise<T> {
  const body = await responseText(response)
  expect(response.status(), body).toBe(status)
  if (!body) throw new Error(`expected JSON response for ${response.url()}`)
  return JSON.parse(body) as T
}

export async function apiLogin(request: APIRequestContext, loginName: string): Promise<string> {
  const response = await request.post(`${apiBase}/api/v1/auth/login`, {
    data: { tenantCode, loginName, password },
  })
  const payload = await expectJson<{ accessToken: string }>(response)
  return payload.accessToken
}

export async function loginPortal(
  page: Page,
  base: string,
  loginName: string,
  homeTitle: string,
): Promise<void> {
  await page.goto(base)
  await expect(page).toHaveURL(/#\/login/u)
  await page.getByLabel('租户编码').fill(tenantCode)
  await page.getByLabel('登录账号').fill(loginName)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: homeTitle, level: 1 })).toBeVisible()
}

export async function verifyRoutes(
  page: Page,
  base: string,
  routes: readonly RouteExpectation[],
): Promise<void> {
  for (const route of routes) {
    await page.goto(`${base}#${route.path}`)
    await expect(page.getByTestId(route.testId)).toBeVisible()
  }
}

export async function postJson<T>(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
  key = `phase10-${randomUUID()}`,
): Promise<T> {
  const response = await request.post(`${apiBase}${path}`, {
    headers: { ...auth(token), 'Idempotency-Key': key },
    data,
  })
  return expectJson<T>(response)
}

export async function rejectedPost(
  request: APIRequestContext,
  token: string,
  path: string,
  data: unknown,
  status: number,
): Promise<void> {
  const response = await request.post(`${apiBase}${path}`, {
    headers: { ...auth(token), 'Idempotency-Key': `phase10-${randomUUID()}` },
    data,
  })
  await expectRejected(response, status)
}

export async function getJson<T>(
  request: APIRequestContext,
  token: string,
  path: string,
): Promise<T> {
  const response = await request.get(`${apiBase}${path}`, { headers: auth(token) })
  return expectJson<T>(response)
}

export async function rejectedGet(
  request: APIRequestContext,
  token: string,
  path: string,
  status: number,
): Promise<void> {
  const response = await request.get(`${apiBase}${path}`, { headers: auth(token) })
  await expectRejected(response, status)
}

export function actionBody(versionNo: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { expectedVersion: versionNo, reason: 'PHASE-10 live gate', ...extra }
}

export async function meetingAction(
  request: APIRequestContext,
  token: string,
  aggregate: MeetingAggregate,
  action: string,
  extra: Record<string, unknown> = {},
  key?: string,
): Promise<MeetingAggregate> {
  return postJson<MeetingAggregate>(
    request,
    token,
    `/api/v1/processes/P006/meetings/${aggregate.meeting.id}/actions/${action}`,
    actionBody(aggregate.meeting.versionNo, extra),
    key,
  )
}

export async function recordAction(
  request: APIRequestContext,
  token: string,
  process: 'P007' | 'P008' | 'P009',
  resource: string,
  aggregate: RecordAggregate,
  action: string,
  extra: Record<string, unknown> = {},
  key?: string,
): Promise<RecordAggregate> {
  return postJson<RecordAggregate>(
    request,
    token,
    `/api/v1/processes/${process}/${resource}/${aggregate.record.id}/actions/${action}`,
    actionBody(aggregate.record.versionNo, extra),
    key,
  )
}

export async function learningAction(
  request: APIRequestContext,
  token: string,
  aggregate: LearningAggregate,
  action: string,
  extra: Record<string, unknown> = {},
): Promise<LearningAggregate> {
  return postJson<LearningAggregate>(
    request,
    token,
    `/api/v1/processes/P010/assignments/${aggregate.record.id}/actions/${action}`,
    { expectedVersion: aggregate.record.versionNo, note: 'PHASE-10 live gate', ...extra },
  )
}

export async function verifyCrossCenterIsolation(
  request: APIRequestContext,
  token: string,
  listPath: string,
  itemPath: string,
): Promise<void> {
  expect(await getJson<unknown[]>(request, token, listPath)).toEqual([])
  await rejectedGet(request, token, itemPath, 403)
}

export const employeeRoutes: readonly RouteExpectation[] = [
  { path: '/employee/05/01/03', testId: 'p006-page' },
  { path: '/employee/04/01/01', testId: 'p007-page' },
  { path: '/employee/03/01/01', testId: 'p008-leave-request-page' },
  { path: '/employee/04/03/02', testId: 'p008-leave-quota-ledger-page' },
  { path: '/employee/03/01/02', testId: 'p008-leave-change-page' },
  { path: '/employee/03/01/06', testId: 'p009-overtime-request-page' },
  { path: '/employee/03/01/07', testId: 'p009-time-off-request-page' },
  { path: '/employee/04/04/02', testId: 'p009-result-acceptance-page' },
  { path: '/employee/07/01/01', testId: 'p010-learning-tasks-page' },
  { path: '/employee/07/04/02', testId: 'p010-online-exam-page' },
  { path: '/employee/07/05/01', testId: 'p010-practical-task-page' },
  { path: '/employee/07/06/01', testId: 'p010-qualifications-page' },
]

export const centerRoutes: readonly RouteExpectation[] = [
  { path: '/center/06/09/03', testId: 'p006-page' },
  { path: '/center/04/01/01', testId: 'p007-page' },
  { path: '/center/04/04/01', testId: 'p008-leave-review-page' },
  { path: '/center/04/04/03', testId: 'p008-quota-management-page' },
  { path: '/center/04/04/06', testId: 'p008-leave-change-center-page' },
  { path: '/center/04/05/01', testId: 'p009-overtime-management-page' },
  { path: '/center/04/05/05', testId: 'p009-hr-review-page' },
  { path: '/center/04/05/06', testId: 'p009-payroll-basis-page' },
  { path: '/center/06/03/07', testId: 'p010-learning-management-page' },
  { path: '/center/10/08/03', testId: 'p010-practical-certification-page' },
  { path: '/center/10/08/07', testId: 'p010-permission-linkage-page' },
]

export const techRoutes: readonly RouteExpectation[] = [
  { path: '/tech/05/03/01', testId: 'phase09-tech-workflow-monitor' },
  { path: '/tech/07/11/01', testId: 'phase10-tech-monitor' },
  { path: '/tech/07/09/01', testId: 'phase10-tech-monitor' },
  { path: '/tech/03/03/09', testId: 'phase10-tech-monitor' },
]
