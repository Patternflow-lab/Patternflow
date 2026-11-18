/**
 * Pictures of a brand folder's patterns as the panel shows them, into its
 * shots/. From web/:
 *
 *   npx tsx ../incoming/collab-kit/shoot.ts clio                  every pattern
 *   ... shoot.ts clio --only rouge-lacquer --at 8                 one, the still at 8 s
 *
 * For each pattern:
 *   <slug>.png          the frame at --at seconds (default 6) at its start knobs, round LEDs at 5 px
 *   <slug>.webp         five seconds from --at at 15 fps, round LEDs at 4 px, animated (needs ffmpeg
 *                       with libwebp). Six seconds of PERIPERA's Glassy Ink, which changes everywhere
 *                       every frame, came to 3.1 MB as GIF at 3 px and 2.5 MB as WebP at quality 82;
 *                       quality 60 at 4 px is 1.5 MB and still reads as LEDs.
 *   <slug>-looks.png    each look sheet.json names for it, side by side at 3 px, at the same second
 * The frames come from LabEngine through lab.ts; the LEDs get the firmware's
 * saturation boost and CIE1931 steps (kit.ts), so a dark ground looks the way
 * the panel shows it rather than the way the browser does.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { blit, brandDir, image, leds, listSlugs, loadBrandPattern, loadSheet, onlyArg, png, run } from "./kit";

const args = process.argv.slice(2);
const brand = args[0];
if (!brand || brand.startsWith("--")) {
  console.log("usage: shoot.ts <brand> [--only a,b] [--at seconds]");
  process.exit(1);
}
const dir = brandDir(brand);
const only = onlyArg(args);
const atArg = args.indexOf("--at");
const AT = atArg >= 0 ? Number(args[atArg + 1]) : 6;
const sheet = fs.existsSync(path.join(dir, "sheet.json")) ? loadSheet(dir) : null;
const shots = path.join(dir, "shots");
fs.mkdirSync(shots, { recursive: true });

const W = 64;
const H = 128;
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

for (const slug of listSlugs(dir).filter((s) => !only || only.has(s))) {
  const p = loadBrandPattern(dir, slug);

  // The still and the moving frames, in one run.
  const moving: Uint8Array[] = [];
  let still: Uint8Array | null = null;
  const r = run(p, {
    knobs: p.start,
    seconds: AT + 5,
    from: AT - 1e-6,
    onFrame: (f) => {
      if (!still) still = f.rgb;
      // 30 fps down to 15.
      if (Math.round((f.t - AT) * 30) % 2 === 0) moving.push(f.rgb);
    },
  });
  if (r.error || !still) {
    console.log(`${slug}: ${r.error ?? "no frame"}`);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(path.join(shots, `${slug}.png`), png(leds(still, W, H, 5)));
  const wrote = [`${slug}.png`];

  if (hasFfmpeg) {
    const pitch = 4;
    const raw = Buffer.concat(moving.map((f) => Buffer.from(leds(f, W, H, pitch).px)));
    const out = path.join(shots, `${slug}.webp`);
    const ff = spawnSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W * pitch}x${H * pitch}`, "-r", "15", "-i", "-",
        "-c:v", "libwebp_anim", "-lossless", "0", "-quality", "60", "-compression_level", "6", "-loop", "0",
        out,
      ],
      { input: raw, maxBuffer: 1 << 28 },
    );
    if (ff.status === 0) wrote.push(`${slug}.webp (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
    else console.log(`${slug}: ffmpeg failed: ${ff.stderr.toString().trim()}`);
  }

  const looks = sheet?.patterns.find((s) => s.slug === slug)?.looks ?? [];
  if (looks.length) {
    const pitch = 3;
    const gap = 12;
    const sheetImg = image(looks.length * W * pitch + (looks.length - 1) * gap, H * pitch, 24);
    looks.forEach((look, i) => {
      let last: Uint8Array | null = null;
      const lr = run(p, { knobs: look.knobs, seconds: AT, from: AT - 1e-6, onFrame: (f) => (last ??= f.rgb) });
      if (lr.error || !last) throw new Error(`${slug} look ${look.name}: ${lr.error ?? "no frame"}`);
      blit(sheetImg, leds(last, W, H, pitch), i * (W * pitch + gap), 0);
    });
    fs.writeFileSync(path.join(shots, `${slug}-looks.png`), png(sheetImg));
    wrote.push(`${slug}-looks.png (${looks.length})`);
  }
  console.log(`${slug}: ${wrote.join(", ")}`);
}
