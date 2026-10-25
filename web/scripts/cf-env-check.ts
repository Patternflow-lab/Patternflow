// Run first by `npm run cf:build`. Vercel and the Pi never run it.
//
// OpenNext copies every key in web/.env, .env.local, .env.production and
// .env.production.local into the Worker it builds, where it becomes
// process.env, and writes the .env.development and .env.test files into the
// same bundle beside them (@opennextjs/cloudflare, compile-env-files.js). A
// desk set up for the community from .env.example has COMMUNITY_ENABLED=1 and
// a BETTER_AUTH_SECRET in .env.local, and a Worker built there would carry the
// secret in its code and send /api/community to a SQLite file it cannot open.
//
// So a Cloudflare build stops here unless those files hold only NEXT_PUBLIC_
// names, the ones Next.js writes into the pages anyway. A server value goes
// to the deployed Worker with `npx wrangler secret put NAME`, and to the local
// preview through .dev.vars.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FILES = [".env", ".env.local"].concat(
  ...["production", "development", "test"].map((mode) => [`.env.${mode}`, `.env.${mode}.local`]),
);

const found: string[] = [];
for (const file of FILES) {
  const full = path.join(process.cwd(), file);
  if (!existsSync(full)) continue;
  for (const match of readFileSync(full, "utf8").matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) {
    if (!match[1].startsWith("NEXT_PUBLIC_")) found.push(`${file}: ${match[1]}`);
  }
}

if (found.length > 0) {
  console.error("cf-env-check: OpenNext would build these into the Worker:");
  for (const line of found) console.error(`  ${line}`);
  console.error("Take them out of those files for the Cloudflare build. DEPLOY-cloudflare.md says where each one goes instead.");
  process.exit(1);
}
console.log(`cf-env-check: ${FILES.filter((file) => existsSync(path.join(process.cwd(), file))).length} env files, NEXT_PUBLIC_ names only`);
