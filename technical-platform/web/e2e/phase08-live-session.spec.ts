import { expect, test, type Page } from '@playwright/test'

const tenantCode = requiredEnv('PHASE08_E2E_TENANT')
const loginName = requiredEnv('PHASE08_E2E_LOGIN')
const password = requiredEnv('PHASE08_E2E_PASSWORD')
const identityA = '60000000-0000-0000-0000-000000000881'

const portals = [
  {
    runtime: 'employee',
    code: 'employee',
    title: '员工端',
    homeTitle: '员工工作入口',
    base: 'http://127.0.0.1:5173/employee.html',
  },
  {
    runtime: 'center',
    code: 'center',
    title: '中心管理端',
    homeTitle: '中心管理工作入口',
    base: 'http://127.0.0.1:5174/center.html',
  },
  {
    runtime: 'admin',
    code: 'tech',
    title: '技术后台端',
    homeTitle: '技术运行工作入口',
    base: 'http://127.0.0.1:5175/admin.html',
  },
] as const

type PortalFixture = (typeof portals)[number]

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`required E2E environment missing: ${name}`)
  return value
}

async function expectNoEngineeringEvidence(page: Page): Promise<void> {
  const shell = page.locator('.platform-shell')
  await expect(shell).not.toContainText('PHASE-05')
  await expect(shell).not.toContainText(/\bP0(?:16|17|18|19|20)\b/)
  await expect(shell).not.toContainText('welfare.care_case')
  await expect(shell).not.toContainText('/api/v1/phase05/')
  await expect(shell).not.toContainText('已关闭')
}

async function login(page: Page, portal: PortalFixture): Promise<void> {
  await page.goto(portal.base)
  await expect(page).toHaveURL(/#\/login/)
  await page.getByLabel('租户编码').fill(tenantCode)
  await page.getByLabel('登录账号').fill(loginName)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page.getByRole('heading', { name: portal.homeTitle, level: 1 })).toBeVisible()
  await expect(page.locator('.platform-shell')).toHaveAttribute('data-home-role', portal.code)
  await expectNoEngineeringEvidence(page)
}

function bearerToken(requestHeaders: Record<string, string>): string | null {
  const authorization = requestHeaders.authorization
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null
}

async function currentSessionWith(page: Page, base: string, token: string) {
  return page.request.get(new URL('/api/v1/session', base).href, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

for (const portal of portals) {
  test(`${portal.runtime} real backend login refresh restore and logout`, async ({ page }) => {
    await login(page, portal)
    await expect(page.locator('.sgj-portal-shell__brand')).toContainText(portal.title)
    await expect(page.locator('.portal-session-header__context strong')).toHaveText('Synthetic E2E Identity A')

    const storedAfterLogin = await page.evaluate(() => ({
      refresh: sessionStorage.getItem('sjg.portal.refresh.v1'),
      localTokenKeys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key) => key?.toLowerCase().includes('token')),
    }))
    expect(storedAfterLogin.refresh).toContain('refreshToken')
    expect(storedAfterLogin.refresh).not.toContain('accessToken')
    expect(storedAfterLogin.localTokenKeys).toEqual([])

    await page.reload()
    await expect(page.getByRole('heading', { name: portal.homeTitle, level: 1 })).toBeVisible()
    await expect(page.locator('.platform-shell')).toHaveAttribute('data-home-role', portal.code)
    await expectNoEngineeringEvidence(page)
    await expect(page.locator('.portal-session-header__context strong')).toHaveText('Synthetic E2E Identity A')

    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/#\/login/)
    expect(await page.evaluate(() => sessionStorage.getItem('sjg.portal.refresh.v1'))).toBeNull()
  })
}

test('refresh rotation identity switch authorization and logout revoke old credentials', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'deep credential rotation check runs once on desktop')
  const sessionTokens: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname !== '/api/v1/session' || request.method() !== 'GET') return
    const token = bearerToken(request.headers())
    if (token) sessionTokens.push(token)
  })

  const portal = portals[0]
  const base = portal.base
  await login(page, portal)
  await expect.poll(() => sessionTokens.length).toBeGreaterThan(0)
  const initialAccess = sessionTokens.at(-1)
  expect(initialAccess).toBeTruthy()

  await page.reload()
  await expect(page.getByRole('heading', { name: portal.homeTitle, level: 1 })).toBeVisible()
  await expectNoEngineeringEvidence(page)
  await expect.poll(() => sessionTokens.at(-1)).not.toBe(initialAccess)
  const rotatedAccess = sessionTokens.at(-1)
  expect(rotatedAccess).toBeTruthy()

  const initialAfterRefresh = await currentSessionWith(page, base, initialAccess ?? '')
  expect(initialAfterRefresh.status()).toBe(401)

  await page.getByLabel('当前身份').selectOption({ label: 'Synthetic E2E Identity B' })
  await expect(page.getByText('Synthetic E2E Identity B')).toBeVisible()
  await expect(page.getByLabel('当前身份')).toHaveCount(0)
  await expect.poll(() => sessionTokens.at(-1)).not.toBe(rotatedAccess)
  const switchedAccess = sessionTokens.at(-1)
  expect(switchedAccess).toBeTruthy()

  const oldAfterSwitch = await currentSessionWith(page, base, rotatedAccess ?? '')
  expect(oldAfterSwitch.status()).toBe(401)

  const deniedSwitch = await page.request.post(new URL('/api/v1/session/switch', base).href, {
    headers: { Authorization: `Bearer ${switchedAccess ?? ''}` },
    data: { identityId: identityA },
  })
  expect(deniedSwitch.status()).toBe(403)

  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(/#\/login/)
  const afterLogout = await currentSessionWith(page, base, switchedAccess ?? '')
  expect(afterLogout.status()).toBe(401)
})
