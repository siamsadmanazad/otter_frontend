import { test, expect } from "@playwright/test";

/**
 * Visual baseline (rework_frontend.md Phase 0 Step 1 + §8 verification #6).
 *
 * SAFE_ROUTES render without the (now-dead) backend: static / logged-out pages that capture the
 * design identity. They are the baseline we can trust today.
 *
 * DATA_ROUTES require a session and/or live data. They will error or hang until the Supabase backend
 * + seed exist, so they are intentionally skipped now and enabled once the seed lands (Phase 1).
 */
const SAFE_ROUTES = [
  "/home",
  "/login",
  "/signup",
  "/forgot-password",
  "/misc/about",
  "/misc/faq",
  "/misc/privacy-policy",
  "/misc/terms-and-condition",
  "/misc/press",
  "/misc/jobs",
  "/misc/api",
];

// Enable these (and seed an authed storage state) once the Supabase backend is online.
const DATA_ROUTES = [
  "/feed",
  "/tribes",
  "/shop",
  "/companions",
  "/chat",
  "/notifications",
  "/settings",
];
void DATA_ROUTES;

const slug = (route: string) => (route === "/" ? "root" : route.replace(/^\//, "").replace(/\//g, "_"));

for (const route of SAFE_ROUTES) {
  test(`baseline ${route}`, async ({ page }, testInfo) => {
    await page.goto(route, { waitUntil: "domcontentloaded", timeout: 20_000 });
    // Let fonts/images settle without waiting on (failing) data fetches.
    await page.waitForTimeout(1200);
    await expect(page).toHaveScreenshot(`${slug(route)}-${testInfo.project.name}.png`, {
      fullPage: true,
    });
  });
}
