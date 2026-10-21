// jsdom applies none of the CSS modules, so the sizes and states below are
// read from the files. In Chromium at 390px the dialog × measured 11×23px
// before these rules and 44×44px after.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = (name: string) => readFileSync(path.resolve(__dirname, name), "utf8");

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(source: string, selector: string): string {
  const at = source.indexOf(`\n${selector} {`);
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf("{", at) + 1, source.indexOf("}", at));
}

describe("community dialogs", () => {
  it("give the header's close button a 44px box", () => {
    const button = rule(css("Community.module.css"), ".modalHeader button");
    expect(button).toMatch(/min-width: 44px;/);
    expect(button).toMatch(/min-height: 44px;/);
  });
});

describe("atlas", () => {
  const atlas = css("Atlas.module.css");

  it("draws the focus ring on a point only for the keyboard", () => {
    expect(rule(atlas, ".focusRing")).toMatch(/visibility: hidden;/);
    expect(rule(atlas, ".node:focus-visible .focusRing")).toMatch(/visibility: visible;/);
  });

  it("frames a focused pin tile inside the tile", () => {
    expect(rule(atlas, ".pin:focus-visible .pinTile::after")).toMatch(/inset: 0;/);
  });

  it("stops the live ring's pulse under reduced motion", () => {
    const reduced = atlas.split("@media (prefers-reduced-motion: reduce) {").slice(1);
    expect(reduced.some((part) => /^\s*\.pulseRing \{[^}]*animation: none;/.test(part))).toBe(true);
  });
});
