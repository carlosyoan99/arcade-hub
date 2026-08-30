import { defineConfig } from '@playwright/test';

// La suite E2E usa el Google Chrome del sistema (channel 'chrome') — el repo no
// descarga los browsers de Playwright. En las runners de GitHub Actions Chrome
// ya viene instalado; si faltara, PLAYWRIGHT_CHANNEL=chromium lo cambia al
// Chromium empaquetado (ver .github/workflows/e2e.yml).
const PORT = 8124;
const isCI = !!process.env.CI;
const channel = process.env.PLAYWRIGHT_CHANNEL === 'chromium' ? undefined : 'chrome';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // 2 workers: ejecutar más en paralelo satura la CPU (rAF de decenas de juegos
  // headless) y se arrastran los timeouts — produce fallos por contención, no
  // por bugs de los juegos.
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    channel,
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 720 },
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        // Headless en ventanas "occluded" a veces limita rAF a ~10fps; sin esto
        // juegos lentos parecen congelados. Seguros y sin efecto en CI.
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        ...(isCI ? ['--no-sandbox'] : []),
      ],
    },
  },
  webServer: {
    command: `node scripts/web-server.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 30000,
  },
});
