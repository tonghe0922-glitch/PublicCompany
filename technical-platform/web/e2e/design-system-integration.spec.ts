import { expect, test } from '@playwright/test'

const portals = [
  { runtime: 'employee', title: '员工端' },
  { runtime: 'center', title: '中心管理端' },
  { runtime: 'admin', title: '技术后台端' },
] as const

for (const portal of portals) {
  test(`${portal.runtime} build consumes Design System through the real login shell`, async ({ page }) => {
    await page.goto(`/${portal.runtime}/${portal.runtime}.html`)
    await expect(page.locator('.sgj-portal-shell')).toBeVisible()
    await expect(page.locator('.sgj-portal-shell__brand')).toContainText(portal.title)
    await expect(page.getByRole('heading', { name: '登录', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: '登录' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
}

test('skip link reaches the login shell main content without changing the hash route', async ({ page }) => {
  await page.goto('/employee/employee.html')
  const skip = page.locator('.sgj-skip-link')
  await skip.focus()
  await expect(skip).toBeFocused()
  expect(await skip.getAttribute('href')).toBe('#sgj-main-content')
  await skip.press('Enter')
  await expect(page.locator('#sgj-main-content')).toBeFocused()
  await expect(page).toHaveURL(/#\/login/)
})
