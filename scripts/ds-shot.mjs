#!/usr/bin/env node
// ds-shot.mjs — regression-page screenshot tool for acceptance (reference implementation)
//
// Usage: node ds-shot.mjs <route> [--port 3000] [--host localhost] [--out shots] [--dark]
//   route examples: ds/global-search, or a full path like /ds/global-search
//
// Output: <out>/<route-slug>.png (full page) + one close-up per [data-ds-section]
//         <out>/<route-slug>.dark.png (with --dark)
//
// Requires: playwright installed in the project (@playwright/test as a devDependency is enough).
// Notes: with multiple worktrees fighting over ports, read the real port from your own
//        dev-server log before passing --port. Headless rendering shows CSS fallbacks
//        instead of WebGL/shaders; add --headed to eyeball those pages.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const route = args.find((a) => !a.startsWith("--"));
if (!route) {
  console.error("usage: node ds-shot.mjs <route> [--port N] [--out dir] [--dark] [--headed]");
  process.exit(1);
}
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const has = (name) => args.includes(`--${name}`);

const port = flag("port", "3000");
const host = flag("host", "localhost");
const outDir = resolve(flag("out", "shots"));
const path = route.startsWith("/") ? route : `/${route}`;
const slug = path.replace(/^\//, "").replace(/[\/?#&=]+/g, "-");
const url = `http://${host}:${port}${path}`;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: !has("headed") });
const shoot = async (colorScheme, suffix) => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme,
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: "networkidle" });
  // let entrance animations settle; raise for motion-heavy pages
  await page.waitForTimeout(800);

  const full = `${outDir}/${slug}${suffix}.png`;
  await page.screenshot({ path: full, fullPage: true });
  console.log(full);

  // one close-up per group annotated with data-ds-section="<name>" on the page
  const sections = page.locator("[data-ds-section]");
  const n = await sections.count();
  for (let i = 0; i < n; i++) {
    const el = sections.nth(i);
    const name = (await el.getAttribute("data-ds-section")) || `section-${i}`;
    const file = `${outDir}/${slug}${suffix}.${name.replace(/\s+/g, "-")}.png`;
    await el.screenshot({ path: file });
    console.log(file);
  }
  await page.close();
};

await shoot("light", "");
if (has("dark")) await shoot("dark", ".dark");
await browser.close();
