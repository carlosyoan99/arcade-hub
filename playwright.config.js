import { defineConfig } from '@playwright/test';

const host = '127.0.0.1';
const hubPort = 4173;
// El relay no sirve HTTP: Playwright espera a que el puerto TCP acepte conexiones.
const arcadePort = process.env.ARCADE_PORT ?? '8787';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        // El Firefox del sistema no habla el protocolo Juggler de Playwright
        // (termina con exitCode=0 al recibir -juggler-pipe): se usa el build
        // de Firefox que instala `npx playwright install firefox`.
      },
    },
  ],
  use: {
    baseURL: `http://${host}:${hubPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      name: 'hub',
      command: `python3 -m http.server ${hubPort} --bind ${host}`,
      url: `http://${host}:${hubPort}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      name: 'arcade-server',
      command: 'npm run start -w @arcade/server',
      env: { ARCADE_HOST: host, ARCADE_PORT: arcadePort },
      port: Number(arcadePort),
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
