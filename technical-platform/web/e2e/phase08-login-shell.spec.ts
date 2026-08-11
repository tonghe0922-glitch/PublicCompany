import { expect, test } from '@playwright/test'

const portals = [
  { runtime: 'employee', title: '员工端' },
  { runtime: 'center', title: '中心管理端' },
  { runtime: 'admin', title: '技术后台端' },
] as const

for (const portal of portals) {
  test(`${portal.runtime} unauthenticated root enters the shared login shell`, async ({ page }) => {
    const apiRequests: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname.startsWith('/api/')) apiRequests.push(url.pathname)
    })

    await page.goto(`/${portal.runtime}/${portal.runtime}.html`)
    await expect(page).toHaveURL(/#\/login/)
    await expect(page.locator('.sgj-portal-shell__brand')).toContainText(portal.title)
    await expect(page.getByLabel('租户编码')).toHaveValue('')
    await expect(page.getByLabel('登录账号')).toHaveValue('')
    await expect(page.getByLabel('密码')).toHaveValue('')
    await expect(page.getByRole('button', { name: '登录' })).toBeEnabled()
    expect(apiRequests).toEqual([])

    const storage = await page.evaluate(() => ({
      refresh: sessionStorage.getItem('sjg.portal.refresh.v1'),
      localKeys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)),
    }))
    expect(storage.refresh).toBeNull()
    expect(storage.localKeys.filter((key) => key?.toLowerCase().includes('token'))).toEqual([])
  })
}

test('no fourth tech runtime artifact is exposed', async ({ request }) => {
  const response = await request.get('/tech/tech.html')
  expect(response.status()).toBe(404)
})
