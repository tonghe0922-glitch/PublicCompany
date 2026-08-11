import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5283 --strictPort', url: 'http://127.0.0.1:5283/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5284 --strictPort', url: 'http://127.0.0.1:5284/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5285 --strictPort', url: 'http://127.0.0.1:5285/admin.html' },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase09-p002-live.spec.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase09-p002-live', open: 'never' }]],
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
    reuseExistingServer: false,
    timeout: 120_000,
  })),
})
