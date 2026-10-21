// Every src/**/*.test.ts and *.test.tsx, each beside the file it tests. The
// Pattern Lab panels came first, which is where `check:panels` gets its name:
// React behaviour (pointer gestures, keyboard shortcuts, undo, selection, the
// Director's keyframes) exercised under a DOM. The guide, the landing
// sections, the community and lib/ have tests here now too. The rest of the
// test surface is the bespoke `check:*` smoke scripts.
//
//   npm run check:panels          (part of check:ci)
//
// jsdom has no canvas; test/setup.ts stubs a 2D context that accepts the
// calls the panels make and asserts nothing about pixels on screen — the
// Lab tests read the layer's RGBA buffer in the store instead, which is what
// the device receives.
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    css: { modules: { classNameStrategy: "non-scoped" } },
    restoreMocks: true,
  },
});
