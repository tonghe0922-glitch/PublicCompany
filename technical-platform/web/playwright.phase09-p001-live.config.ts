import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5273 --strictPort', url: 'http://127.0.0.1:5273/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5274 --strictPort', url: 'http://127.0.0.1:5274/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5275 --strictPort', url: 'http://127.0.0.1:5275/admin.html' },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase09-p001-live.spec.ts',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase09-p001-live', open: 'never' }]],
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
