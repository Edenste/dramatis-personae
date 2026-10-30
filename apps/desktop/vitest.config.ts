import { defineConfig } from "vitest/config";

// End-to-end specs (e2e/*.spec.ts) are run by Playwright, not Vitest.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
