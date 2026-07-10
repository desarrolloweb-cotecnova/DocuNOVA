import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración de Playwright para las pruebas de humo (e2e).
 * Levanta el servidor de Next.js con variables de Supabase de marcador de
 * posición (la página de login se renderiza sin llamadas de red).
 */
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Permite usar un Chromium preinstalado (p. ej. en el entorno de
        // desarrollo) definiendo PW_CHROMIUM_PATH. En CI se deja sin definir y
        // Playwright usa el navegador que instala `playwright install`.
        launchOptions: {
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    },
  },
});
