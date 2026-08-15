import { defineConfig, devices } from '@playwright/test'

const servers = [
  {
    command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5310 --strictPort',
    url: 'http://127.0.0.1:5310/employee.html',
  },
  {
    command: 'pnpm vite --mode center --host 127.0.0.1 --port 5311 --strictPort',
    url: 'http://127.0.0.1:5311/center.html',
  },
  {
    command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5312 --strictPort',
    url: 'http://127.0.0.1:5312/admin.html',
  },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase10-live.spec.ts',
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-phase10-live', open: 'never' }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: servers.map((server) => ({
    ...server,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
})
