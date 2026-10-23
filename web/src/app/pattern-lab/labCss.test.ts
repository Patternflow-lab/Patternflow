// jsdom applies none of the CSS modules, so the narrow rules below are read
// from the files. In Chromium, with Share and To hardware in the header, the
// Panels menu opened at x −106~84 on a 320px screen. Hung from its button's
// left edge instead, it ran to x 449 on a 390px one. Hung from the action row
// it stays inside, 14~374 at 390px. The Code guide × measured 30×30px before
// and 44×44px after, in a header 59px tall both times. On a 390×844 touch
// screen the tab strip under Preview was 736px for 333px of room, and every
// tab carried a 27×27px ×. Without the × it is 520px and Knobs shows whole.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NARROW_DOCK_QUERY } from "./panels/registry";

const css = (name: string) => readFileSync(path.resolve(__dirname, name), "utf8");

/** The bodies of every `@media <query>` block in the file, braces matched. */
function mediaBlocks(source: string, query: string): string[] {
  const blocks: string[] = [];
  const head = `@media ${query} {`;
  let at = source.indexOf(head);
  while (at > -1) {
    const start = at + head.length;
    let depth = 1;
    let i = start;
    while (depth > 0 && i < source.length) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") depth -= 1;
      i += 1;
    }
    blocks.push(source.slice(start, i - 1));
    at = source.indexOf(head, i);
  }
  return blocks;
}

/** The declarations of every `selector` rule inside a `@media <query>` block. */
function mediaRule(source: string, query: string, selector: string): string {
  const found: string[] = [];
  for (const block of mediaBlocks(source, query)) {
    const at = block.indexOf(`\n  ${selector} {`);
    if (at > -1) found.push(block.slice(block.indexOf("{", at) + 1, block.indexOf("}", at)));
  }
  return found.join("");
}

/** The declarations of every `selector` rule inside a narrow-dock block. */
function narrowRule(source: string, selector: string): string {
  return mediaRule(source, NARROW_DOCK_QUERY, selector);
}

describe("Lab header menus below 800px", () => {
  const dock = css("LabPanels.module.css");

  it("hang from the action row, not from their button", () => {
    expect(narrowRule(dock, ".dockHeaderGroup:last-child")).toMatch(/position: relative;/);
    expect(narrowRule(dock, ".menuWrap")).toMatch(/position: static;/);
    const pop = narrowRule(dock, ".menuPop");
    expect(pop).toMatch(/top: auto;/);
    expect(pop).toMatch(/left: 0;/);
    expect(pop).toMatch(/max-width: 360px;/);
  });

  it("come after the rules they override", () => {
    // Same specificity, so the later rule wins: a narrow block above
    // `.menuWrap { position: relative }` would change nothing.
    const base = dock.indexOf("\n.menuWrap {");
    const narrow = dock.lastIndexOf(`@media ${NARROW_DOCK_QUERY} {`);
    expect(base).toBeGreaterThan(-1);
    expect(narrow).toBeGreaterThan(base);
  });

  it("give each row a 44px height", () => {
    expect(narrowRule(dock, ".menuPop button")).toMatch(/min-height: 44px;/);
  });
});

describe("Lab dialogs below 800px", () => {
  it("give the header's close button a 44px box and keep the header's height", () => {
    const lab = css("PatternLab.module.css");
    const button = narrowRule(lab, ".modalHeader button");
    expect(button).toMatch(/min-width: 44px;/);
    expect(button).toMatch(/min-height: 44px;/);
    // 44 - 30 = 14px, half of it on each side.
    expect(button).toMatch(/margin: -7px;/);
    expect(lab.lastIndexOf(`@media ${NARROW_DOCK_QUERY} {`)).toBeGreaterThan(lab.indexOf("\n.modalHeader button {"));
  });
});

describe("Lab dock on a touch screen", () => {
  const theme = css("lab-dock.css");
  const dockview = readFileSync(createRequire(import.meta.url).resolve("dockview/dist/styles/dockview.css"), "utf8");
  const action = ".dv-tab .dv-default-tab .dv-default-tab-action";

  it("lifts the tab overflow menu over the panels", () => {
    // The menu's wrapper takes z-index from this variable, and dockview only
    // sets it inside its own themes.
    const at = theme.indexOf(".dockview-theme-patternflow {");
    const body = theme.slice(at, theme.indexOf("}", at));
    expect(body).toMatch(/--dv-overlay-z-index: 999;/);
  });

  it("drops the × from every tab where there is no hover", () => {
    expect(mediaRule(theme, "(hover: none)", `.dockview-theme-patternflow ${action}`)).toMatch(/display: none;/);
  });

  it("answers dockview's rule with a property it does not set", () => {
    // dockview shows the × by visibility at the same specificity. If it ever
    // sets display there instead, the order of the two files decides.
    const shown = mediaRule(dockview, "(hover: none)", ".dv-tab.dv-inactive-tab .dv-default-tab .dv-default-tab-action");
    expect(shown).toMatch(/visibility: visible;/);
    expect(shown).not.toMatch(/display:/);
  });
});
