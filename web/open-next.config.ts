import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// The Workers build (`npm run cf:build`, wrangler.jsonc). `next build` and
// Vercel never read this file.
//
// Almost every page is prerendered once at build. The one thing that changes
// between deploys is /api/roadmap (revalidate = 600, the GitHub issue list),
// and a read-only cache would answer the build's copy until the next deploy.
// So the cache is R2, which a revalidation can write to, with each data
// centre keeping its own copy in front of it (long-lived: up to 30 minutes,
// or until the entry's own revalidate runs out). The memory queue does the
// revalidating by asking this same Worker for the page again
// (WORKER_SELF_REFERENCE). Nothing calls revalidateTag or revalidatePath, so
// there is no tag cache.
const config = {
  ...defineCloudflareConfig({
    incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "long-lived" }),
    queue: memoryQueue,
  }),
  // proxy.ts runs on Node, and OpenNext's bundle of it needs one package
  // taken out of its trace first: scripts/cf-proxy-trace.ts says why.
  buildCommand: "npm run build && tsx scripts/cf-proxy-trace.ts",
};

export default config;
