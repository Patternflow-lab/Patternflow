/**
 * Opens each pattern of a brand folder in the real Pattern Lab and keeps a
 * screenshot, the proof that the site's preview runs it. The pattern goes in
 * the way a community page's "Open in Pattern Lab" hands it over: the
 * sessionStorage handoff the Lab reads on mount (web/src/lib/community/handoff.ts).
 * Needs the site running (npm run dev in web/). From web/:
 *
 *   npx tsx ../incoming/collab-kit/lab-shot.ts clio                         http://localhost:3000
 *   ... lab-shot.ts clio --url http://localhost:3001 --only rouge-lacquer
 *
 * Writes shots/lab-<slug>.png at 1440 x 900 and prints any page error. It
 * also reads the Lab's preview canvas twice, a second apart, and says whether
 * the picture moved and how much of it is lit.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { brandDir, listSlugs, onlyArg } from "./kit";

const args = process.argv.slice(2);
const brand = args[0];
if (!brand || brand.startsWith("--")) {
  console.log("usage: lab-shot.ts <brand> [--url http://localhost:3000] [--only a,b]");
  process.exit(1);
}
const dir = brandDir(brand);
const only = onlyArg(args);
const urlArg = args.indexOf("--url");
const base = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:3000";

// Top-level await is out: tsx runs these files as CommonJS.
void (async () => {
const { chromium } = createRequire(import.meta.url)("playwright") as typeof import("playwright");
const browser = await chromium.launch();
let failed = 0;
for (const slug of listSlugs(dir).filter((s) => !only || only.has(s))) {
  const code = fs.readFileSync(path.join(dir, "patterns", `${slug}.js`), "utf8");
  const title = code.match(/^\/\/[ \t]*Title:[ \t]*(.+)$/m)?.[1].trim() ?? slug;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([c, t]) => {
      // Only the first load: the Lab clears the handoff once it has opened it.
      if (sessionStorage.getItem("collab-kit:handed")) return;
      sessionStorage.setItem("collab-kit:handed", "1");
      sessionStorage.setItem("patternflow.community.labHandoff", JSON.stringify({ code: c, parentId: null, parentTitle: t, parentLicense: "CC-BY-SA-4.0" }));
    },
    [code, title],
  );
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/pattern-lab`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(5000);
  // The preview is the largest canvas on the page.
  const sample = () =>
    page.evaluate(() => {
      const canvases = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height);
      const c = canvases[0];
      if (!c) return null;
      const probe = document.createElement("canvas");
      probe.width = 64;
      probe.height = 128;
      const ctx = probe.getContext("2d")!;
      ctx.drawImage(c, 0, 0, 64, 128);
      const d = ctx.getImageData(0, 0, 64, 128).data;
      return { w: c.width, h: c.height, px: Array.from(d) };
    });
  const a = await sample();
  await page.waitForTimeout(1000);
  const b = await sample();
  const file = path.join(dir, "shots", `lab-${slug}.png`);
  await page.screenshot({ path: file });
  let note = "no preview canvas";
  if (a && b) {
    let moved = 0;
    let lit = 0;
    for (let i = 0; i < a.px.length; i += 4) {
      moved += Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2]);
      if (Math.max(b.px[i], b.px[i + 1], b.px[i + 2]) > 24) lit++;
    }
    note = `preview ${a.w}x${a.h} · moved ${(moved / (a.px.length * 0.75) / 255).toFixed(3)} in 1 s · lit ${((lit / (a.px.length / 4)) * 100).toFixed(0)}%`;
    if (moved === 0) failed++;
  } else failed++;
  const named = await page.evaluate((t) => document.body.innerText.includes(t), title);
  console.log(`${slug}: ${path.relative(process.cwd(), file)} · ${note} · title on page: ${named ? "yes" : "no"}${errors.length ? ` · errors: ${errors.join(" | ")}` : ""}`);
  if (errors.length) failed++;
  await context.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
})();
