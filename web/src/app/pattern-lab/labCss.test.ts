// jsdom applies none of the CSS modules, so the narrow rules below are read
// from the files. In Chromium, with Share and To hardware in the header, the
// Panels menu opened at x −106~84 on a 320px screen. Hung from its button's
// left edge instead, it ran to x 449 on a 390px one. Hung from the action row
// it stays inside, 14~374 at 390px. The Code guide × measured 30×30px before
// and 44×44px after, in a header 59px tall both times. On a 390×844 touch
// screen the tab strip under Preview was 736px for 333px of room, and every
// tab carried a 27×27px ×. Without the × it is 520px and Knobs shows whole.
// On the same screen Del was 37×28px, the layer eye 20×17px and Push 40×22px,
// and the Pixel status bar was 51px, two lines with the mouse gestures.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bareCss, readers } from "../../../test/cssModules";
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

describe("Layers and Knobs on a touch screen", () => {
  const dock = css("LabPanels.module.css");
  const own = css("panels/LayersPanel.module.css");
  const knobs = css("panels/KnobsPanel.module.css");
  const layers = css("panels/LayersPanel.tsx");
  const touch = (source: string, selector: string) => mediaRule(source, "(hover: none)", selector);

  it("give the Layers bar buttons a 44px box", () => {
    const button = touch(own, ".layerBar button");
    expect(button).toMatch(/min-width: 44px;/);
    expect(button).toMatch(/min-height: 44px;/);
    // Only the Layers bar: the Pixel toolbars carry a dozen buttons each.
    expect(layers).toMatch(/className=\{`\$\{dock\.panelBar\} \$\{local\.layerBar\}`\}/);
    expect(touch(dock, ".panelBar button")).toBe("");
  });

  it("let the eye fill a 44px row", () => {
    const row = touch(own, ".layerRow");
    expect(row).toMatch(/min-height: 46px;/);
    expect(row).toMatch(/padding-block: 0;/);
    const eye = touch(own, ".layerEye");
    expect(eye).toMatch(/align-self: stretch;/);
    expect(eye).toMatch(/width: 44px;/);
  });

  it("give the mask, opacity and blend rows a 44px height", () => {
    expect(touch(own, ".layerMaskLabel")).toMatch(/min-height: 44px;/);
    expect(touch(own, ".layerControlRow select")).toMatch(/min-height: 44px;/);
    expect(mediaBlocks(own, "(hover: none)").join("")).toContain('.layerControlRow input[type="range"],\n  .layerControlRow select {');
  });

  it("give Push a 44px box", () => {
    const push = touch(knobs, ".knobButton");
    expect(push).toMatch(/min-width: 44px;/);
    expect(push).toMatch(/min-height: 44px;/);
  });

  it("come after the rules they override", () => {
    // Same specificity again, so each touch block has to sit below them.
    const ownTouch = own.lastIndexOf("@media (hover: none) {");
    for (const base of ["\n.layerRow {", "\n.layerEye {", "\n.layerControlRow select {", "\n.layerMaskLabel {"]) {
      expect(own.indexOf(base)).toBeGreaterThan(-1);
      expect(ownTouch).toBeGreaterThan(own.indexOf(base));
    }
    // `.layerBar button` answers `.panelBar button` from the other file. The
    // bundle keeps the stylesheets in the order the panel imports them.
    expect(dock.indexOf("\n.panelBar button {")).toBeGreaterThan(-1);
    const dockImport = layers.indexOf('import dock from "../LabPanels.module.css";');
    expect(dockImport).toBeGreaterThan(-1);
    expect(layers.indexOf('import local from "./LayersPanel.module.css";')).toBeGreaterThan(dockImport);
    // The 980px block sets Push back to 22px.
    expect(knobs.lastIndexOf("@media (hover: none) {")).toBeGreaterThan(knobs.indexOf("@media (max-width: 980px) {"));
  });
});

describe("Pixel status line on a touch screen", () => {
  const own = css("panels/PixelPanel.module.css");
  const pixel = css("panels/PixelPanel.tsx");

  it("drops the mouse gestures, and nothing else", () => {
    expect(mediaRule(own, "(hover: none)", ".pixelMouseHint")).toMatch(/display: none;/);
    expect(pixel).toContain("<span className={local.pixelMouseHint}>alt-click picks · right-drag erases · middle-drag pans</span>");
    expect(mediaRule(own, "(hover: none)", ".pixelStatus")).toBe("");
  });
});

describe("PatternLab.module.css", () => {
  // The file is for what two or more files draw with. Until 25 October 2026
  // it also held 22 rules only the shell read, for the header, and the dark
  // button only To hardware read. Two classes whose plain rule is one rule
  // count each other's files: `.headerToggle, .headerSelect` is one look, the
  // header's buttons and Preview's quality menu.
  it("holds no class that only one file reads", () => {
    const read = readers(path.resolve(__dirname, "PatternLab.module.css"));
    expect(read).not.toBeNull();
    const by = (cls: string) => [...(read?.get(cls) ?? [])];
    const files = new Map<string, Set<string>>();
    for (const [, selectors] of bareCss(path.resolve(__dirname, "PatternLab.module.css")).matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      const plain = selectors.split(",").flatMap((part) => /^\s*\.([_a-zA-Z][\w-]*)\s*$/.exec(part)?.[1] ?? []);
      for (const [, cls] of selectors.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
        const reach = plain.includes(cls) ? plain.flatMap(by) : by(cls);
        files.set(cls, new Set([...(files.get(cls) ?? []), ...reach]));
      }
    }
    const alone = [...files].filter(([, from]) => from.size < 2).map(([cls]) => cls).sort();
    expect(files.size).toBeGreaterThan(0);
    expect(alone).toEqual([]);
  });
});

describe("LabPanels.module.css", () => {
  // The dock and the chrome the panels share. Until 25 October 2026 it also
  // held 20 rules that one panel file read, for Preview's body and frame,
  // Pixel's viewport and toolbars, Color Ramp's body and Knobs' padding. A
  // class one file under panels/ reads belongs in that panel's stylesheet.
  // The shell's header is the dock, so a class only the shell reads stays.
  it("holds no class that only one panel file reads", () => {
    const read = readers(path.resolve(__dirname, "LabPanels.module.css"));
    expect(read).not.toBeNull();
    // Only names the file defines: registry.tsx also reads `def.dock.ref`.
    const defined = new Set([...bareCss(path.resolve(__dirname, "LabPanels.module.css")).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    const panels = path.join(__dirname, "panels") + path.sep;
    const alone = [...(read ?? [])]
      .filter(([cls, from]) => defined.has(cls) && from.size === 1 && [...from].every((file) => file.startsWith(panels)))
      .map(([cls]) => cls)
      .sort();
    expect(defined.size).toBeGreaterThan(0);
    expect(alone).toEqual([]);
  });
});
