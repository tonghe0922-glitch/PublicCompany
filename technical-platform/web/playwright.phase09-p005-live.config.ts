import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5393 --strictPort', url: 'http://127.0.0.1:5393/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5394 --strictPort', url: 'http://127.0.0.1:5394/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5395 --strictPort', url: 'http://127.0.0.1:5395/admin.html' },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase09-p005-live.spec.ts',
  timeout: 150_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  forbidOnly: true,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase09-p005-live', open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: servers.map((server) => ({ ...server, reuseExistingServer: false, timeout: 120_000 })),
})
