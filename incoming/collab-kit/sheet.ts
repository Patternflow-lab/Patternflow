/**
 * reference.html: the one sheet a brand folder hands over, built from its
 * sheet.json and patterns. It runs on its own, opened from disk: the patterns
 * play live through play.ts, which esbuild bundles here with LabEngine, the
 * Lab preview's engine, so a panel on the sheet renders what Pattern Lab
 * renders at the same knobs. From web/:
 *
 *   npx tsx ../incoming/collab-kit/sheet.ts clio          write incoming/collab-clio/reference.html
 *   ... sheet.ts clio --png                               and shots/reference-1440.png, reference-390.png
 *   ... sheet.ts clio --check                             write nothing; fail if reference.html is stale
 *
 * Each panel's background is the pattern's still from shoot.ts, so the sheet
 * shows a picture before the script starts. Run shoot.ts first.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type * as Esbuild from "esbuild";

import { brandDir, KIT, loadBrandPattern, loadSheet, type Place, type Sheet } from "./kit";

const esbuild = createRequire(path.resolve(KIT, "../../web/package.json"))("esbuild") as typeof Esbuild;

const args = process.argv.slice(2);
const brand = args[0];
if (!brand || brand.startsWith("--")) {
  console.log("usage: sheet.ts <brand> [--png] [--check]");
  process.exit(1);
}
const dir = brandDir(brand);
const sheet = loadSheet(dir) as Sheet & { theme?: "light" | "dark" };
const out = path.join(dir, "reference.html");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const inline = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

const patterns = sheet.patterns.map((s) => {
  const p = loadBrandPattern(dir, s.slug);
  return { sheet: s, p };
});
const bySlug = new Map(patterns.map((x) => [x.sheet.slug, x]));
const still = (slug: string) => (fs.existsSync(path.join(dir, "shots", `${slug}.png`)) ? ` style="background-image:url(shots/${slug}.png)"` : "");

function canvas(slug: string, opts: { knobs?: number[]; own?: string; cls?: string; offset?: number } = {}) {
  if (!bySlug.has(slug)) throw new Error(`sheet.json names ${slug}, which is not in patterns/`);
  const attrs = [`data-play="${esc(slug)}"`];
  if (opts.knobs) attrs.push(`data-knobs="${opts.knobs.join(",")}"`);
  if (opts.own) attrs.push(`data-own="${esc(opts.own)}"`);
  if (opts.offset) attrs.push(`data-offset="${opts.offset}"`);
  const title = bySlug.get(slug)!.p.title;
  return `<div class="panel${opts.cls ? ` ${opts.cls}` : ""}"${still(slug)}><canvas ${attrs.join(" ")} role="img" aria-label="${esc(title)}"></canvas></div>`;
}

function scene(place: Place) {
  const c = (cls?: string, offset?: number) => canvas(place.pattern, { knobs: place.knobs, cls, offset });
  switch (place.kind) {
    case "wall":
      return `<div class="scene wall">${c("p1")}${c("p2")}${c("p3")}</div>`;
    case "counter":
      return `<div class="scene counter"><div class="top"></div><i class="tester t1"></i><i class="tester t2"></i><i class="tester t3"></i><i class="tester t4"></i><i class="tester t5"></i>${c()}</div>`;
    case "mirror":
      return `<div class="scene mirror"><div class="glass"></div>${c()}</div>`;
    case "reel":
      return `<div class="scene reel"><div class="phone">${c()}</div></div>`;
    case "window":
      return `<div class="scene window"><div class="frame">${c()}${c()}${c()}${c()}</div></div>`;
  }
}

const body = `
<header class="head">
  <div>
    <div class="kicker">협업 레퍼런스 · 제안 초안</div>
    <h1>Patternflow<span class="x">×</span>${esc(sheet.brand)}</h1>
    <p class="line">${esc(sheet.line)}</p>
    <div class="meta">${esc(sheet.brandKo)} · ${esc(sheet.date)} · 64×128 LED 패널 한 대에서 도는 패턴 ${patterns.length}개</div>
  </div>
  <div class="hero">${patterns.map((x) => canvas(x.sheet.slug)).join("")}</div>
</header>

<section>
  <h2>브랜드 결</h2>
  <div class="mood">
    <div>
      ${sheet.mood.map((m) => `<p>${esc(m)}</p>`).join("\n      ")}
      <div class="chips">${sheet.keywords.map((k) => `<span>${esc(k)}</span>`).join("")}</div>
    </div>
    <div class="swatches">
      ${sheet.palette
        .map((c) => `<div class="swatch"><i style="background:${esc(c.hex)}"></i><div><b>${esc(c.name)}</b><code>${esc(c.hex)}</code><small>${esc(c.from)}</small></div></div>`)
        .join("\n      ")}
    </div>
  </div>
</section>

<section>
  <h2>패턴</h2>
  <div class="tiles">
${patterns
  .map(({ sheet: s, p }) => {
    const own = `${s.slug}#tile`;
    const knobs = p.knobs
      .map(
        (k, i) =>
          `<label>K${i + 1} ${esc(k.name)}<input type="range" min="${k.min}" max="${k.max}" step="${(k.max - k.min) / 200}" value="${p.start[i]}" data-knob-for="${esc(own)}" data-knob="${i}"><output></output></label>`,
      )
      .join("");
    const looks = (s.looks ?? [])
      .map((l) => `<figure>${canvas(s.slug, { knobs: l.knobs })}<b>${esc(l.name)}</b>${l.note ? esc(l.note) : ""}</figure>`)
      .join("");
    return `    <article class="tile" data-tile>
      ${canvas(s.slug, { own: "tile" })}
      <div>
        <h3>${esc(p.title)}</h3>
        <p class="note">${esc(s.note)}</p>
        <p class="why">${esc(s.why)}</p>
        <div class="knobs">${knobs}</div>
      </div>
      ${looks ? `<div class="looks">${looks}</div>` : ""}
    </article>`;
  })
  .join("\n")}
  </div>
</section>

<section>
  <h2>쓰일 자리</h2>
  <div class="places">
${sheet.places.map((pl) => `    <figure class="place">${scene(pl)}<figcaption><b>${esc(pl.title)}</b><span>${esc(pl.text)}</span></figcaption></figure>`).join("\n")}
  </div>
</section>

<section class="sources">
  <h2>조사한 곳</h2>
  <ol>
${sheet.sources.map((s) => `    <li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><span>${esc(s.what)}</span></li>`).join("\n")}
  </ol>
</section>

<footer>${esc(sheet.fineprint)}</footer>
`;

const data = {
  patterns: patterns.map(({ p, sheet: s }) => ({
    slug: s.slug,
    title: p.title,
    layer: { ...p.layer, id: `layer-${s.slug}` },
    matrix: p.matrix,
    knobs: p.knobs,
    start: p.start,
  })),
};

const bundle = esbuild.buildSync({
  entryPoints: [path.join(KIT, "play.ts")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2018"],
  minifyWhitespace: true,
  minifySyntax: true,
  legalComments: "none",
  logLevel: "warning",
});
const js = bundle.outputFiles[0].text.trimEnd();
if (js.includes("</script")) throw new Error("the bundle contains '</script' and cannot be inlined");

const accent = sheet.palette[0]?.hex ?? "#c0392b";
const accent2 = sheet.palette[1]?.hex ?? accent;
const html = fs
  .readFileSync(path.join(KIT, "sheet.html"), "utf8")
  .replace("__THEME__", sheet.theme ?? "light")
  .replace("__TITLE__", () => esc(`Patternflow × ${sheet.brand}`))
  .replace("/*__VARS__*/", () => `--accent: ${accent}; --accent2: ${accent2};`)
  .replace("<!--__BODY__-->", () => body.trim())
  .replace("/*__DATA__*/", () => inline(data))
  .replace("/*__SCRIPT__*/", () => js);

if (args.includes("--check")) {
  const now = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  if (now !== html) {
    console.log(`FAIL ${path.relative(process.cwd(), out)} is not what sheet.json and the patterns build: run sheet.ts without --check`);
    process.exit(1);
  }
  console.log(`${path.relative(process.cwd(), out)} is up to date`);
  process.exit(0);
}

fs.writeFileSync(out, html);
console.log(`${path.relative(process.cwd(), out)} · ${(html.length / 1024).toFixed(0)} KB`);

if (args.includes("--png")) void shoot();

// Top-level await is out: tsx runs these files as CommonJS.
async function shoot() {
  const { chromium } = createRequire(import.meta.url)("playwright") as typeof import("playwright");
  const browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "warning" && errors.push(m.text()));
    await page.goto(`file://${out}`);
    // Scroll through once so every panel has been on screen and drawn.
    const height = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(700);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1500);
    const file = path.join(dir, "shots", `reference-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${path.relative(process.cwd(), file)}${overflow > 0 ? ` · scrolls sideways by ${overflow} px` : ""}${errors.length ? ` · ${errors.join(" | ")}` : ""}`);
    await page.close();
  }
  await browser.close();
}
