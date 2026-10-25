// Run by open-next.config.ts after `next build`, before OpenNext bundles the
// Worker. Vercel and the Pi never run it.
//
// OpenNext copies the files Next traced for proxy.ts into .open-next and
// bundles the copy with esbuild, which resolves a package through the
// "module" field of its package.json. Next's tracer asks for
// @opentelemetry/api, and the trace holds only that package's CommonJS build
// (build/src), not the build/esm its "module" field names, so the bundle stops
// at "Could not resolve @opentelemetry/api". OpenNext 1.20.12 steps around
// this only for an app that does not install the package; this one has it
// through drizzle-orm and better-auth. Tracing includes in next.config.ts do
// not reach the proxy's trace under Turbopack (tried on 25 October 2026).
//
// Taking the package out of the proxy's trace leaves no copy in .open-next,
// so esbuild walks up to node_modules/@opentelemetry/api, the whole package,
// and bundles that.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const TRACE = path.join(process.cwd(), ".next", "server", "middleware.js.nft.json");
const PACKAGE = "node_modules/@opentelemetry/api/";

if (!existsSync(TRACE)) {
  console.log(`cf-proxy-trace: no ${path.relative(process.cwd(), TRACE)}, nothing to change`);
} else {
  const trace = JSON.parse(readFileSync(TRACE, "utf8")) as { files: string[] };
  const kept = trace.files.filter((file) => !file.includes(PACKAGE));
  writeFileSync(TRACE, JSON.stringify({ ...trace, files: kept }));
  console.log(`cf-proxy-trace: took ${trace.files.length - kept.length} @opentelemetry/api files out of the proxy's trace`);
}
