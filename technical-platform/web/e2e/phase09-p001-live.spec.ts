import { createHmac, randomUUID } from 'node:crypto'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE09_P001_TENANT')
const monitorLogin = requiredEnv('PHASE09_P001_LOGIN')
const password = requiredEnv('PHASE09_P001_PASSWORD')
const targetLogin = 'phase09.p001.target'
const monitorUserId = '50000000-0000-0000-0000-000000000991'
const targetUserId = '50000000-0000-0000-0000-000000000992'
const outUserId = '50000000-0000-0000-0000-000000000993'
const monitorEmployeeId = '30000000-0000-0000-0000-000000000991'
const targetEmployeeId = '30000000-0000-0000-0000-000000000992'
const apiBase = 'http://127.0.0.1:18081'
const employeeBase = 'http://127.0.0.1:5273/employee.html'
const centerBase = 'http://127.0.0.1:5274/center.html'
const techBase = 'http://127.0.0.1:5275/admin.html'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}

function base32Decode(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of value.replace(/=+$/u, '').toUpperCase()) {
    const index = alphabet.indexOf(char)
    if (index < 0) throw new Error('invalid base32 secret')
    buffer = (buffer << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((buffer >> (bits - 8)) & 0xff)
      bits -= 8
      buffer &= bits === 0 ? 0 : (1 << bits) - 1
    }
  }
  return Buffer.from(bytes)
}

function totp(secret: string, now = Date.now()): string {
  const counter = BigInt(Math.floor(now / 1000 / 30))
  const input = Buffer.alloc(8)
  input.writeBigUInt64BE(counter)
  const digest = createHmac('sha1', base32Decode(secret)).update(input).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

async function apiLogin(request: APIRequestContext, loginName: string, mfaCode?: string): Promise<string> {
  const response = await request.post(`${apiBase}/api/v1/auth/login`, {
    data: {
      tenantCode,
      loginName,
      password,
      ...(mfaCode ? { mfaCode } : {}),
    },
  })
  expect(response.status()).toBe(200)
  const body = await response.json() as { accessToken: string }
  return body.accessToken
}

async function loginPortal(page: Page, base: string, homeTitle: string, mfaCode?: string): Promise<void> {
  await page.goto(base)
  await expect(page).toHaveURL(/#\/login/u)
  await page.getByLabel('租户编码').fill(tenantCode)
  await page.getByLabel('登录账号').fill(monitorLogin)
  await page.getByLabel('密码').fill(password)
  if (mfaCode) await page.getByLabel('MFA 验证码（已启用时填写）').fill(mfaCode)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: homeTitle, level: 1 })).toBeVisible()
}

function auth(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` }
}

test('P001 real MFA lifecycle, typed negatives, data scope and three-portal rendering', async ({ page, request }) => {
  const preMfaToken = await apiLogin(request, monitorLogin)
  const badReauth = await request.post(`${apiBase}/api/v1/processes/P001/mfa/totp/enroll`, {
    headers: { ...auth(preMfaToken), 'Idempotency-Key': `p001-bad-reauth-${randomUUID()}` },
    data: { issuer: '上金谷', accountName: monitorUserId, password: `${password}-wrong` },
  })
  expect(badReauth.status()).toBe(401)
  const statusAfterBadReauth = await request.get(`${apiBase}/api/v1/processes/P001/mfa/totp`, { headers: auth(preMfaToken) })
  expect(statusAfterBadReauth.status()).toBe(200)
  expect((await statusAfterBadReauth.json() as { status: string }).status).toBe('NONE')

  await loginPortal(page, employeeBase, '员工工作入口')
  await page.goto(`${employeeBase}#/employee/13/04/04`)
  await expect(page.getByRole('heading', { name: '账号安全与会话管理', level: 2 })).toBeVisible()
  await expect(page.getByTestId('p001-mfa-status')).toContainText('NONE')
  await page.getByLabel('账号标识').fill(monitorUserId)
  await page.getByLabel('当前密码（绑定前重新验证）').fill(password)
  await page.getByRole('button', { name: '创建 TOTP' }).click()
  const secret1 = (await page.locator('.phase09-secret code').textContent())?.trim()
  expect(secret1).toBeTruthy()
  await expect(page.getByTestId('p001-mfa-status')).toContainText('PENDING')
  await page.getByLabel('6 位验证码').fill(totp(secret1 ?? ''))
  await page.getByRole('button', { name: '确认启用' }).click()
  await expect(page.getByTestId('p001-mfa-status')).toContainText('ACTIVE')

  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/#\/login/u)
  await page.getByLabel('租户编码').fill(tenantCode)
  await page.getByLabel('登录账号').fill(monitorLogin)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByText('登录信息或 MFA 验证码无效，请检查后重试。')).toBeVisible()
  await page.getByLabel('密码').fill(password)
  await page.getByLabel('MFA 验证码（已启用时填写）').fill(totp(secret1 ?? ''))
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: '员工工作入口', level: 1 })).toBeVisible()
  await page.goto(`${employeeBase}#/employee/13/04/06`)
  await expect(page.getByRole('heading', { name: '账号安全与会话管理', level: 2 })).toBeVisible()
  await expect(page.locator('tbody')).toContainText(monitorEmployeeId)

  const activeToken = await apiLogin(request, monitorLogin, totp(secret1 ?? ''))
  const activeStatusResponse = await request.get(`${apiBase}/api/v1/processes/P001/mfa/totp`, { headers: auth(activeToken) })
  expect(activeStatusResponse.status()).toBe(200)
  const activeStatus = await activeStatusResponse.json() as { versionNo: number; status: string }
  expect(activeStatus.status).toBe('ACTIVE')

  const staleDisable = await request.delete(`${apiBase}/api/v1/processes/P001/mfa/totp`, {
    headers: { ...auth(activeToken), 'Idempotency-Key': `p001-stale-${randomUUID()}` },
    data: { expectedVersion: Math.max(0, activeStatus.versionNo - 1), code: totp(secret1 ?? '') },
  })
  expect(staleDisable.status()).toBe(409)

  const badAssertion = await request.delete(`${apiBase}/api/v1/processes/P001/mfa/totp`, {
    headers: { ...auth(activeToken), 'Idempotency-Key': `p001-bad-code-${randomUUID()}` },
    data: { expectedVersion: activeStatus.versionNo, code: '000000' },
  })
  expect(badAssertion.status()).toBe(403)

  const activeOverwrite = await request.post(`${apiBase}/api/v1/processes/P001/mfa/totp/enroll`, {
    headers: { ...auth(activeToken), 'Idempotency-Key': `p001-active-overwrite-${randomUUID()}` },
    data: { issuer: '上金谷', accountName: monitorUserId, password },
  })
  expect(activeOverwrite.status()).toBe(409)

  const sameCenterSessions = await request.get(`${apiBase}/api/v1/processes/P001/sessions?userId=${targetUserId}`, { headers: auth(activeToken) })
  expect(sameCenterSessions.status()).toBe(200)
  const sameCenterRows = await sameCenterSessions.json() as Array<{ employeeId: string }>
  expect(sameCenterRows.some((row) => row.employeeId === targetEmployeeId)).toBe(true)

  const crossCenterSessions = await request.get(`${apiBase}/api/v1/processes/P001/sessions?userId=${outUserId}`, { headers: auth(activeToken) })
  expect(crossCenterSessions.status()).toBe(200)
  expect(await crossCenterSessions.json()).toEqual([])

  const targetToken = await apiLogin(request, targetLogin)
  const noMonitorPermission = await request.get(`${apiBase}/api/v1/processes/P001/sessions?userId=${monitorUserId}`, { headers: auth(targetToken) })
  expect(noMonitorPermission.status()).toBe(403)

  const disable = await request.delete(`${apiBase}/api/v1/processes/P001/mfa/totp`, {
    headers: { ...auth(activeToken), 'Idempotency-Key': `p001-disable-${randomUUID()}` },
    data: { expectedVersion: activeStatus.versionNo, code: totp(secret1 ?? '') },
  })
  expect(disable.status()).toBe(204)

  const disabledStatusResponse = await request.get(`${apiBase}/api/v1/processes/P001/mfa/totp`, { headers: auth(activeToken) })
  expect(disabledStatusResponse.status()).toBe(200)
  const disabledStatus = await disabledStatusResponse.json() as { status: string; versionNo: number }
  expect(disabledStatus.status).toBe('DISABLED')
  expect(disabledStatus.versionNo).toBeGreaterThan(activeStatus.versionNo)

  const reenroll = await request.post(`${apiBase}/api/v1/processes/P001/mfa/totp/enroll`, {
    headers: { ...auth(activeToken), 'Idempotency-Key': `p001-reenroll-${randomUUID()}` },
    data: { issuer: '上金谷', accountName: monitorUserId, password },
  })
  expect(reenroll.status()).toBe(200)
  const reenrollment = await reenroll.json() as { credentialId: string; versionNo: number; secret: string; status: string }
  expect(reenrollment.status).toBe('PENDING')
  expect(reenrollment.secret).not.toBe(secret1)
  expect(reenrollment.versionNo).toBeGreaterThan(disabledStatus.versionNo)

  const confirmReenrollment = await request.post(`${apiBase}/api/v1/processes/P001/mfa/totp/confirm`, {
    headers: { ...auth(activeToken), 'Idempotency-Key': `p001-reconfirm-${randomUUID()}` },
    data: { expectedVersion: reenrollment.versionNo, code: totp(reenrollment.secret) },
  })
  expect(confirmReenrollment.status()).toBe(200)
  const confirmedAgain = await confirmReenrollment.json() as { versionNo: number; status: string }
  expect(confirmedAgain.status).toBe('ACTIVE')

  const newSecret = reenrollment.secret
  await loginPortal(page, centerBase, '中心管理工作入口', totp(newSecret))
  await page.goto(`${centerBase}#/center/02/01/01`)
  await expect(page.getByRole('heading', { name: '身份与会话审批监督', level: 2 })).toBeVisible()
  await page.getByLabel('目标用户 ID').fill(targetUserId)
  await page.getByRole('button', { name: '刷新服务端会话' }).click()
  await expect(page.locator('tbody')).toContainText(targetEmployeeId)

  await loginPortal(page, techBase, '技术运行工作入口', totp(newSecret))
  await page.goto(`${techBase}#/tech/03/01/01`)
  await expect(page.getByRole('heading', { name: '身份与会话安全监控', level: 2 })).toBeVisible()
  await page.getByLabel('目标用户 ID').fill(targetUserId)
  await page.getByRole('button', { name: '刷新服务端会话' }).click()
  await expect(page.locator('tbody')).toContainText(targetEmployeeId)

  const finalLogin = await request.post(`${apiBase}/api/v1/auth/login`, {
    data: { tenantCode, loginName: monitorLogin, password, mfaCode: totp(newSecret) },
  })
  expect(finalLogin.status()).toBe(200)
})
