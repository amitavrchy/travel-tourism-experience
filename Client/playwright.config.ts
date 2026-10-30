import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import path from "node:path";

export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 960 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "node dist/main.js",
      cwd: "../Server",
      url: "http://127.0.0.1:4100/health",
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        PORT: "4100",
        NODE_ENV: "test",
        STORAGE_MODE: "file",
        DATA_DIRECTORY: path.join(
          tmpdir(),
          `wanderline-browser-${process.pid}`,
        ),
        JWT_SECRET: "wanderline-e2e-test-secret-for-isolated-storage",
        ADMIN_EMAIL: "admin@wanderline.test",
        ADMIN_PASSWORD: "browser-admin-password-123",
        AI_SERVICE_URL: "http://127.0.0.1:9",
        CLIENT_ORIGIN: "http://127.0.0.1:3100",
      },
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 30000,
      env: { API_URL: "http://127.0.0.1:4100" },
    },
  ],
});
