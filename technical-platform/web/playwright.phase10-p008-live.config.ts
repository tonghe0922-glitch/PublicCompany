import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5316 --strictPort', url: 'http://127.0.0.1:5316/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5317 --strictPort', url: 'http://127.0.0.1:5317/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5318 --strictPort', url: 'http://127.0.0.1:5318/admin.html' },
]

export default defineConfig({
  testDir: './e2e', testMatch: 'phase10-p008-live.spec.ts', timeout: 180_000,
  expect: { timeout: 15_000 }, fullyParallel: false, forbidOnly: true, workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase10-p008-live', open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', video: 'retain-on-failure' },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: servers.map(server => ({ ...server, env: { SJG_LOCAL_API_PROXY_TARGET: 'http://127.0.0.1:18088' }, reuseExistingServer: false, timeout: 120_000 })),
})
