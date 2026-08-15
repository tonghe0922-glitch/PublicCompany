import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5293 --strictPort', url: 'http://127.0.0.1:5293/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5294 --strictPort', url: 'http://127.0.0.1:5294/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5295 --strictPort', url: 'http://127.0.0.1:5295/admin.html' },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase09-p003-live.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase09-p003-live', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: servers.map((server) => ({
    ...server,
    env: { SJG_LOCAL_API_PROXY_TARGET: 'http://127.0.0.1:18083' },
    reuseExistingServer: false,
    timeout: 120_000,
  })),
})
