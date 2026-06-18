import { defineConfig } from "@playwright/test";

/**
 * Visual-baseline config for the Supabase re-wire (rework_frontend.md Phase 0 Step 1).
 *
 * Run:  pnpm exec playwright test            # diff against committed baseline
 *       pnpm exec playwright test --update-snapshots   # (re)create baseline — Phase 0, or a
 *                                                       # DELIBERATE Phase 3 re-baseline only
 *
 * The first run creates the baseline PNGs under tests/visual/__screenshots__/.
 * Those committed PNGs ARE the "identical look" contract for Phase 1.
 */
export default defineConfig({
  testDir: "./tests/visual",
  // Deterministic snapshots: no animation, consistent fonts/threshold.
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
    },
  },
  // One stable, organized path per route+viewport.
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
  },
  // Both projects use Chromium (one engine, no extra browser downloads); only the viewport differs.
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
  // Reuse a dev server you already have running; otherwise start one.
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
