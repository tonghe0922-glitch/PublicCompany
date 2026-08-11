import { defineConfig, devices } from '@playwright/test'

const servers = [
  { command: 'pnpm vite --mode employee --host 127.0.0.1 --port 5173 --strictPort', url: 'http://127.0.0.1:5173/employee.html' },
  { command: 'pnpm vite --mode center --host 127.0.0.1 --port 5174 --strictPort', url: 'http://127.0.0.1:5174/center.html' },
  { command: 'pnpm vite --mode admin --host 127.0.0.1 --port 5175 --strictPort', url: 'http://127.0.0.1:5175/admin.html' },
]

export default defineConfig({
  testDir: './e2e',
  testMatch: 'phase08-live-session.spec.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright-phase08-live', open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: servers.map((server) => ({
    ...server,
    reuseExistingServer: false,
    timeout: 120_000,
  })),
})
