import { defineConfig, devices } from '@playwright/test'

const servers = [
  {
    command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5410 --strictPort',
    url: 'http://127.0.0.1:5410/employee.html',
  },
  {
    command: 'pnpm vite --mode center --host 127.0.0.1 --port 5411 --strictPort',
    url: 'http://127.0.0.1:5411/center.html',
  },
  {
    command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5412 --strictPort',
    url: 'http://127.0.0.1:5412/admin.html',
  },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase11-live.spec.ts',
  timeout: 420_000,
  expect: { timeout: 25_000 },
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-phase11-live', open: 'never' }],
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
