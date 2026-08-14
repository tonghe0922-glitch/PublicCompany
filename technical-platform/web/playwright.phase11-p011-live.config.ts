import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5330 --strictPort', url: 'http://127.0.0.1:5330/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5331 --strictPort', url: 'http://127.0.0.1:5331/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5332 --strictPort', url: 'http://127.0.0.1:5332/admin.html' },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase11-p011-live.spec.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase11-p011-live', open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: servers.map((server) => ({
    ...server,
    env: { SJG_LOCAL_API_PROXY_TARGET: 'http://127.0.0.1:18090' },
    reuseExistingServer: false,
    timeout: 120_000,
  })),
})
