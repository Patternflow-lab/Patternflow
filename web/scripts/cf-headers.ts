// Run by `npm run cf:build` after OpenNext has written .open-next/assets.
// Vercel and the Pi never run it.
//
// On Cloudflare a file from public/ is answered by Workers Static Assets
// before Next.js runs, so the headers() rules in next.config.ts never reach
// it. On 25 October 2026 the local preview served /flash/manifest.json and
// /flash/bin/* without Access-Control-Allow-Origin, which is what a panel's
// own console needs to read the manifest and to fetch an image for a wireless
// update. Static Assets reads its rules from a _headers file in the assets
// directory instead, so this writes one from the same headers(): next.config.ts
// stays the one place they are kept, and pages, which do go through Next.js,
// keep getting them from there.
//
// One rule is added that next.config.ts does not have. Vercel serves the
// build's hashed files under /_next/static as immutable by itself, and Static
// Assets answers everything with max-age=0 unless told otherwise.

import { writeFileSync } from "node:fs";
import path from "node:path";

type Rule = { source: string; headers: { key: string; value: string }[]; has?: unknown; missing?: unknown };

const OUT = path.join(process.cwd(), ".open-next", "assets", "_headers");

const IMMUTABLE_BUILD_FILES: Rule = {
  source: "/_next/static/:path*",
  headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
};

/** next.config's `/flash/bin/:path*` is `/flash/bin/*` in _headers. */
function pattern(source: string): string {
  const splat = source.replace(/\/:[a-z]+\*$/i, "/*");
  if (splat.includes(":")) {
    throw new Error(`cf-headers: ${source} has a parameter _headers cannot express; write its rule by hand`);
  }
  return splat;
}

async function main() {
  // next.config.ts reads NODE_ENV when it loads: the sandbox's cache header
  // is no-store in development and a year everywhere else.
  Object.assign(process.env, { NODE_ENV: "production" });
  const { default: config } = await import("../next.config");
  const rules: Rule[] = [...((await config.headers?.()) ?? []), IMMUTABLE_BUILD_FILES];

  const blocks = rules.map((rule) => {
    if (rule.has || rule.missing) {
      throw new Error(`cf-headers: ${rule.source} has has/missing conditions, which _headers cannot express`);
    }
    return [pattern(rule.source), ...rule.headers.map(({ key, value }) => `  ${key}: ${value}`)].join("\n");
  });

  writeFileSync(OUT, `${blocks.join("\n\n")}\n`);
  console.log(`cf-headers: ${rules.length} rules written to ${path.relative(process.cwd(), OUT)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
