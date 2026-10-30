import { defineConfig } from "@playwright/test";
import type { Target } from "./e2e/fixtures.ts";

const projects: Array<{ name: Target; use: { target: Target } }> = [
  { name: "browser", use: { target: "browser" } },
  ...(process.env.E2E_SKIP_ELECTRON === "1"
    ? []
    : [{ name: "electron" as const, use: { target: "electron" as const } }]),
];

export default defineConfig<{ target: Target }>({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 7_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { trace: "on-first-retry", actionTimeout: 10_000 },
  projects,
});
