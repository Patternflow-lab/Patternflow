import { LAB_STORAGE, readJson } from "@/lib/lab/persist";
import type { AiHandle } from "../desk/ai/PracticeAi";
import { deskApp } from "../desk/deskStore";
import { resolveTarget } from "../desk/target";
import type { Beat, BeatCtx, Target, Tutorial } from "../desk/types";

// Make · 02 Pattern Lab — what the desk's pointer does on each step, by step index:
// entry N plays while step N of copy/lab.ts is in the middle of the screen
// (scenes/lab.ts says which windows that step puts on the desk). A missing
// or empty entry: no pointer on that step. Every beat's `win` must be on the
// desk that step (desk.test.ts checks it).
//
// The Lab window is the reader's real Pattern Lab: the pointer only shows
// the way there, and waits for the reader's own click, typing or paste. It
// never presses anything that leaves the browser (Share, ↗ Apply to my
// Patternflow, Upload to the community): those it points at and moves on.
// See desk/types.ts Beat.
//
// The reader is often quicker than the pointer, and does things in their own
// order: so a beat that waits for the reader also knows from STATE that it's
// done — what the practice AI says was pasted, sent and copied (its handle),
// and what the Lab has saved (its project in this browser's storage, read
// only) — not only from an event it happened to be listening for.
//
// Targets in the Lab are the Lab's own words (app/pattern-lab/**: the
// shell's header, HardwareModal, panels/*) or its own stable attributes
// (aria-label, role="tab" / aria-controls from dockview, the dialog's
// aria-label="Hardware", a field's placeholder); never its CSS module class
// names. The practice AI is found by the data-ai-* attributes it sets on
// itself (desk/ai/PracticeAi.tsx).
//
// OWNED BY THE PATTERN LAB CHAPTER.

type Say = Beat["say"];

// ── finding things in the Lab ───────────────────────────────────────────────

const words = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();

/** A dock tab by its title ("Code", "Director", …): dockview gives them role="tab". */
const tab = (title: string): Target => ({ text: title, among: '[role="tab"]' });

function tabEl(root: ParentNode, title: string): Element | null {
  return [...root.querySelectorAll('[role="tab"]')].find((t) => words(t) === title) ?? null;
}

/** What a dock tab shows: the group panel its aria-controls names (only the active tab's content is in it). */
function tabPanel(root: ParentNode, title: string): Element | null {
  const id = tabEl(root, title)?.getAttribute("aria-controls");
  const doc = (root as Node).ownerDocument ?? (root as Document);
  return id ? doc.getElementById(id) : null;
}

const tabActive = (root: ParentNode | null, title: string) => Boolean(root && tabEl(root, title)?.getAttribute("aria-selected") === "true");

/** The Lab's To hardware window (HardwareModal: role="dialog", aria-label="Hardware"). */
const HW = '[role="dialog"][aria-label="Hardware"]';
const hw = (root: ParentNode | null) => root?.querySelector(HW) ?? null;
const lab = (ctx: BeatCtx) => ctx.root("lab");
const hwOpen = (ctx: BeatCtx) => Boolean(hw(lab(ctx)));
const has = (ctx: BeatCtx, target: Target) => Boolean(resolveTarget(lab(ctx), target));

const APPLY: Target = { text: "↗ Apply to my Patternflow" };
const NEXT: Target = { text: "Next →" };
/** HardwareModal's .h box for one pattern (its placeholder), and a stack's per-layer boxes. */
const SINGLE_BOX = 'textarea[placeholder^="Paste the .h"]';
const UNIT_BOX = 'textarea[placeholder^="Paste the namespace L"]';
const HW_BOX: Target = (root) => hw(root)?.querySelector(SINGLE_BOX) ?? null;
/** The To hardware window has gone on to its second page (after Next →). */
const hwReady = (ctx: BeatCtx) => has(ctx, APPLY) || has(ctx, { text: "← Back to the header" });

/** The first knob's slider (KnobsPanel: aria-label "<name> value"; Layers' opacity slider is "Layer opacity"). */
const SLIDER = 'input[type="range"][aria-label$=" value"]';
/** The first knob's max box (KnobsPanel: role="spinbutton", aria-label "<name> max"). */
const MAX_BOX = '[role="spinbutton"][aria-label$=" max"]';

/** A knob's range box while it's being typed in: KnobsPanel swaps it for a field (inputMode decimal) until Enter or a click away. */
const RANGE_FIELD = (root: ParentNode | null) => (root ? (tabPanel(root, "Knobs")?.querySelector('input[inputmode="decimal"]') ?? null) : null);

/** The Preview panel's picture. */
const PREVIEW: Target = (root) => tabPanel(root, "Preview")?.querySelector("canvas") ?? null;

/** The Director's focused lane: the tallest lane in the Director tab (a double-click there adds a keyframe). */
const LANE: Target = (root) => {
  const panel = tabPanel(root, "Director");
  if (!panel) return null;
  let best: Element | null = null;
  let h = 0;
  for (const svg of panel.querySelectorAll("svg")) {
    const r = svg.getBoundingClientRect();
    if (r.width > 100 && r.height > h) {
      best = svg;
      h = r.height;
    }
  }
  return best;
};

// ── what the Lab has saved (read only) ──────────────────────────────────────

/** A layer as the Lab saves it (lib/lab/serialize.ts serializeProject): only what's read here. */
export type SavedLayer = { type?: unknown; code?: unknown; visible?: unknown; role?: unknown; opacity?: unknown };

/** The layers of the Lab's saved project, or null (nothing saved, no storage). Never written. */
function savedLayers(): SavedLayer[] | null {
  const p = readJson(LAB_STORAGE.project);
  const layers = p && typeof p === "object" ? (p as { layers?: unknown }).layers : null;
  return Array.isArray(layers) ? (layers as SavedLayer[]) : null;
}

/** Every code layer's code, as saved. */
const savedCode = () =>
  (savedLayers() ?? [])
    .map((l) => (l.type === "code" && typeof l.code === "string" ? l.code : ""))
    .join("\n");

/**
 * lib/lab/flatten.ts needsFlatten, on saved layers: To hardware offers one
 * conversion prompt only when exactly one visible layer is left and it is a
 * code layer that isn't a mask. (Copied, not imported: flatten.ts brings the
 * Lab's engine with it. lab.test.ts checks the two agree.)
 */
export function stackOf(layers: SavedLayer[]): boolean {
  const visible = layers.filter((l) => l.visible !== false && (l.role === "mask" || (typeof l.opacity === "number" ? l.opacity > 0 : true)));
  if (visible.length !== 1) return true;
  return visible[0].type !== "code" || visible[0].role === "mask";
}

// ── layers, as the Layers panel shows them ──────────────────────────────────

type Row = { eye: HTMLElement; on: boolean; js: boolean; mask: boolean };

/** The Layers panel's rows, top first (LayersPanel: an eye button, the name, MASK↓, then JS or PX); null when the panel isn't showing. */
function layerRows(root: ParentNode | null): Row[] | null {
  const panel = root ? tabPanel(root, "Layers") : null;
  if (!panel) return null;
  const rows: Row[] = [];
  for (const li of panel.querySelectorAll("ol > li")) {
    const eye = li.querySelector<HTMLElement>('button[aria-label="Hide layer"], button[aria-label="Show layer"]');
    if (!eye) continue;
    const spans = [...li.querySelectorAll("span")].map(words);
    rows.push({
      eye,
      on: eye.getAttribute("aria-label") === "Hide layer",
      js: spans[spans.length - 1] === "JS",
      mask: spans.some((t) => /^¬?MASK↓$/.test(t)),
    });
  }
  return rows;
}

/** The row to keep for a one-layer pattern: the lowest code layer that isn't a mask (a showing one first). */
function keepRow(rows: Row[]): number {
  for (const want of [true, false]) {
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].js && !rows[i].mask && (!want || rows[i].on)) return i;
  }
  return -1;
}

/** The Lab has more than one layer showing: To hardware then has a prompt per layer, not the conversion prompt. */
function stacked(ctx: BeatCtx): boolean {
  const root = lab(ctx);
  const dialog = hw(root);
  if (dialog?.querySelector(UNIT_BOX)) return true;
  if (dialog?.querySelector(SINGLE_BOX)) return false;
  const rows = layerRows(root);
  if (rows && rows.length) {
    const keep = keepRow(rows);
    return keep < 0 || !rows[keep].on || rows.some((r, i) => i !== keep && r.on);
  }
  const saved = savedLayers();
  return saved ? stackOf(saved) : false;
}

/** The eye to press next: a showing layer other than the one to keep (or the one to keep, if it's hidden). */
const extraEye = (root: ParentNode): Element | null => {
  const rows = layerRows(root);
  if (!rows) return null;
  const keep = keepRow(rows);
  const hide = rows.find((r, i) => i !== keep && r.on);
  if (hide) return hide.eye;
  return keep >= 0 && !rows[keep].on ? rows[keep].eye : null;
};

// ── the practice AI ─────────────────────────────────────────────────────────

const ai = (ctx: BeatCtx) => ctx.app<AiHandle>("ai");

/** The prompt of this kind is in the practice AI already: in its box, or sent this step. */
const aiHas = (ctx: BeatCtx, kind: "variation" | "conversion") => {
  const a = ai(ctx);
  return Boolean(a && (a.draftKind() === kind || a.sentAt(kind) > ctx.since));
};
const aiSent = (ctx: BeatCtx, kind: "variation" | "conversion") => (ai(ctx)?.sentAt(kind) ?? 0) > ctx.since;
const aiCopied = (ctx: BeatCtx, kind: "js" | "h") => (ai(ctx)?.copiedAt(kind) ?? 0) > ctx.since;

/** The Lab holds the JavaScript the practice AI gave: Paste worked (it says "Pasted ✓" a moment, and saves). */
const labHasAnswer = (ctx: BeatCtx) => has(ctx, { text: "Pasted ✓" }) || Boolean(ai(ctx)?.carriesAnswer(savedCode()));

// ── beats used on more than one step ────────────────────────────────────────

/** The To hardware window covers the Lab: close it first, if it's open. */
const closeHw: Beat = {
  win: "lab",
  target: (root) => hw(root)?.querySelector('button[aria-label="Close"]') ?? null,
  do: "press",
  skipIf: (ctx) => !hwOpen(ctx),
  say: { en: "Close this window first", ko: "이 창부터 닫아요" },
};

/** Bring a dock tab to the front, unless it already is (or `past` says the reader is beyond it). */
const openTab = (title: string, say: Say, past?: (ctx: BeatCtx) => boolean): Beat => ({
  win: "lab",
  target: tab(title),
  do: "press",
  skipIf: (ctx) => tabActive(lab(ctx), title) || Boolean(past?.(ctx)),
  say,
});

const openHw = (past?: (ctx: BeatCtx) => boolean): Beat => ({
  win: "lab",
  target: { text: "To hardware" },
  do: "press",
  skipIf: (ctx) => hwOpen(ctx) || Boolean(past?.(ctx)),
  say: { en: "Press To hardware", ko: "To hardware를 눌러요" },
});

/**
 * With more than one layer showing, To hardware has a prompt per layer and
 * no conversion prompt: hide the others first (hidden layers stay in the
 * pattern; showing them again is one click). One beat, whose target is the
 * next thing to press on the way — To hardware's × (its window covers the
 * Layers panel), the Layers tab, an eye — whatever order the reader goes in.
 */
const unstack: Beat[] = [
  {
    win: "lab",
    target: (root) => {
      const dialog = hw(root);
      if (dialog) return dialog.querySelector('button[aria-label="Close"]');
      if (!tabActive(root, "Layers")) return tabEl(root, "Layers");
      return extraEye(root);
    },
    do: "press",
    on: [],
    skipIf: (ctx) => !stacked(ctx),
    bubble: "above",
    say: { en: "Hide the other layers: one layer, one prompt", ko: "다른 레이어는 숨겨요. 레이어 하나에 프롬프트 하나예요" },
  },
];

/** The practice AI's Send, while its box holds the prompt the step is about (or it's answering it). Otherwise not there: the step starts over at the prompt. */
const sendFor =
  (kind: "variation" | "conversion"): Target =>
  (root) => {
    const a = deskApp<AiHandle>("ai");
    if (a && !a.busy() && a.draftKind() !== kind) return null;
    return root.querySelector("[data-ai-send]");
  };

/** The newest answer's Copy for this kind of code. */
const copyFor =
  (kind: "js" | "h"): Target =>
  (root) => {
    const all = root.querySelectorAll(`[data-ai-copy="${kind}"]`);
    return all.length ? all[all.length - 1] : null;
  };

/** Send something to the practice AI and bring its answer back: paste, Send, it writes, Copy. */
function askAi(copy: "js" | "h"): Beat[] {
  const kind = copy === "js" ? "variation" : "conversion";
  return [
    {
      win: "ai",
      target: "[data-ai-input]",
      do: "paste",
      // Done when the right prompt is in the box: a paste of something else doesn't count.
      on: [],
      done: (ctx) => aiHas(ctx, kind),
      skipIf: (ctx) => aiHas(ctx, kind),
      say: { en: "Paste it here", ko: "여기에 붙여넣어요" },
    },
    {
      win: "ai",
      target: sendFor(kind),
      do: "press",
      // Enter sends too.
      on: [],
      done: (ctx) => aiSent(ctx, kind),
      skipIf: (ctx) => aiSent(ctx, kind),
      say: { en: "Send it", ko: "보내요" },
    },
    {
      win: "ai",
      target: "[data-ai-last]",
      do: "point",
      until: "reader",
      on: [],
      at: [0.3, 0.2],
      done: (ctx) => ai(ctx)?.busy() === false,
      say: copy === "js" ? { en: "It writes a pattern", ko: "AI가 패턴을 써요" } : { en: "It writes the .h", ko: "AI가 .h를 써요" },
    },
    {
      win: "ai",
      target: copyFor(copy),
      do: "press",
      // Copied by the button, or by the reader's own Ctrl/⌘ C on the code.
      on: [],
      done: (ctx) => aiCopied(ctx, copy),
      skipIf: (ctx) => aiCopied(ctx, copy),
      say: copy === "js" ? { en: "Copy the code", ko: "코드를 복사해요" } : { en: "Copy the .h", ko: ".h를 복사해요" },
    },
  ];
}

// ── the knob beat's baseline ────────────────────────────────────────────────

/** The first knob's value now (null when the Knobs panel isn't showing). */
const sliderValue = (ctx: BeatCtx) => (resolveTarget(lab(ctx), SLIDER) as HTMLInputElement | null)?.value ?? null;

export const LAB_TUTORIAL: Tutorial = [
  // 0 — Open the Lab: where things are.
  [
    { win: "lab", target: tab("Preview"), do: "point", until: 1500, say: { en: "The preview", ko: "미리보기" } },
    { win: "lab", target: tab("Code"), do: "point", until: 1500, say: { en: "The code", ko: "코드" } },
    { win: "lab", target: tab("Knobs"), do: "point", until: 1500, say: { en: "The knobs", ko: "노브" } },
    { win: "lab", target: tab("Color Ramp"), do: "point", until: 1500, say: { en: "The Color Ramp", ko: "Color Ramp" } },
  ],

  // 1 — name it (PatternLabClient: the name field, the save status under it).
  [
    closeHw,
    {
      win: "lab",
      target: 'input[aria-label="Pattern name"]',
      do: "type",
      skipIf: (ctx) => Boolean((resolveTarget(lab(ctx), 'input[aria-label="Pattern name"]') as HTMLInputElement | null)?.value.trim()),
      say: { en: "Type a name", ko: "이름을 적어요" },
    },
    {
      win: "lab",
      target: { text: /^(Saved locally|Saving…|Local draft|Unsaved)$/, among: "span" },
      do: "point",
      until: 2200,
      say: { en: "Saved in this browser", ko: "이 브라우저에 저장돼요" },
    },
  ],

  // 2 — ask an AI: Copy prompt → the practice AI → Paste (CodePanel's toolbar).
  [
    closeHw,
    openTab("Code", { en: "Open the Code tab", ko: "Code 탭을 열어요" }, (ctx) => aiHas(ctx, "variation")),
    {
      win: "lab",
      target: { text: "Copy prompt" },
      do: "press",
      done: (ctx) => aiHas(ctx, "variation"),
      skipIf: (ctx) => aiHas(ctx, "variation"),
      say: { en: "Press Copy prompt", ko: "Copy prompt를 눌러요" },
    },
    ...askAi("js"),
    // Paste reads the clipboard itself on click: wait for the click, or see the code arrive.
    {
      win: "lab",
      target: { text: "Paste" },
      do: "press",
      on: "click",
      done: labHasAnswer,
      skipIf: labHasAnswer,
      say: { en: "Press Paste", ko: "Paste를 눌러요" },
    },
  ],

  // 3 — the Color Ramp (RampPanel).
  [
    closeHw,
    {
      win: "lab",
      target: { text: /^Random (ramp|colors)$/ },
      do: "press",
      say: { en: "Press Random ramp", ko: "Random ramp를 눌러요" },
    },
    {
      win: "lab",
      target: '[aria-label="Ramp gradient preview"]',
      do: "point",
      until: 2400,
      at: [0.62, 0.5],
      say: { en: "A click on the bar adds a stop", ko: "바를 클릭하면 지점이 생겨요" },
    },
  ],

  // 4 — the knobs and their ranges (KnobsPanel).
  [
    closeHw,
    {
      win: "lab",
      target: SLIDER,
      do: "drag",
      to: MAX_BOX,
      at: [0.3, 0.5],
      on: [],
      begin: (ctx) => {
        ctx.memo.set("slider", sliderValue(ctx));
      },
      // Moved since the step began (a baseline the Knobs panel wasn't showing for is taken when it is).
      done: (ctx) => {
        const v = sliderValue(ctx);
        if (v === null) return false;
        if (ctx.memo.get("slider") == null) {
          ctx.memo.set("slider", v);
          return false;
        }
        return v !== ctx.memo.get("slider");
      },
      say: { en: "Drag the slider", ko: "슬라이더를 끌어요" },
    },
    {
      win: "lab",
      target: MAX_BOX,
      do: "press",
      on: "dblclick",
      done: (ctx) => Boolean(RANGE_FIELD(lab(ctx))),
      bubble: "left",
      say: { en: "Double-click a range box", ko: "범위 칸을 두 번 클릭해요" },
    },
    {
      win: "lab",
      target: (root) => RANGE_FIELD(root) ?? resolveTarget(root, MAX_BOX),
      do: "type",
      on: [],
      done: (ctx) => !RANGE_FIELD(lab(ctx)),
      bubble: "left",
      say: { en: "Type a number, then Enter", ko: "숫자를 적고 Enter" },
    },
  ],

  // 5 — To hardware: the conversion prompt → the practice AI → the .h (HardwareModal).
  [
    ...unstack,
    openHw((ctx) => aiHas(ctx, "conversion")),
    {
      win: "lab",
      target: { text: "← Back to the header" },
      do: "press",
      skipIf: (ctx) => !hwReady(ctx) || aiHas(ctx, "conversion"),
      say: { en: "Back to the header", ko: "헤더로 돌아가요" },
    },
    {
      win: "lab",
      target: { text: "Copy the conversion prompt" },
      do: "press",
      done: (ctx) => aiHas(ctx, "conversion"),
      skipIf: (ctx) => aiHas(ctx, "conversion"),
      say: { en: "Copy the conversion prompt", ko: "Copy the conversion prompt를 눌러요" },
    },
    ...askAi("h"),
  ],

  // 6 — the .h into the Lab, Next →, and ↗ Apply to my Patternflow (pointed at, never pressed).
  [
    ...unstack,
    openHw(hwReady),
    {
      win: "lab",
      target: HW_BOX,
      do: "paste",
      on: ["paste", "input"],
      at: [0.3, 0.3],
      skipIf: (ctx) => hwReady(ctx) || /^\s*#pragma\s+once\b/m.test((resolveTarget(lab(ctx), HW_BOX) as HTMLTextAreaElement | null)?.value ?? ""),
      say: { en: "Paste the .h here", ko: ".h를 여기 붙여넣어요" },
    },
    {
      win: "lab",
      target: { text: "Looks like a header ✓", among: "p" },
      do: "point",
      until: 1800,
      skipIf: hwReady,
      say: { en: "It starts with #pragma once", ko: "#pragma once로 시작해요" },
    },
    { win: "lab", target: NEXT, do: "press", skipIf: hwReady, done: hwReady, say: { en: "Press Next →", ko: "Next →를 눌러요" } },
    {
      win: "lab",
      target: APPLY,
      do: "point",
      until: 3200,
      bubble: "above",
      say: { en: "This one needs a community sign-in", ko: "이건 커뮤니티 로그인이 필요해요" },
    },
  ],

  // 7 — layers (LayersPanel): + Code, then make it a mask.
  [
    closeHw,
    { win: "lab", target: { text: "+ Code" }, do: "press", say: { en: "Press + Code", ko: "+ Code를 눌러요" } },
    {
      win: "lab",
      target: { text: "masks layer below", among: "label" },
      do: "press",
      at: [0.2, 0.5],
      say: { en: "Tick masks layer below", ko: "masks layer below에 체크해요" },
    },
    {
      win: "lab",
      target: PREVIEW,
      do: "point",
      until: 2400,
      at: [0.5, 0.5],
      say: { en: "The layer below, through it", ko: "아래 레이어가 그 모양대로 보여요" },
    },
  ],

  // 8 — Graphic Export (CapturePanel).
  [
    closeHw,
    openTab("Graphic Export", { en: "Open Graphic Export", ko: "Graphic Export를 열어요" }),
    {
      win: "lab",
      target: 'select[aria-label="Output size preset"]',
      do: "point",
      until: 1800,
      say: { en: "Pick a size", ko: "크기를 골라요" },
    },
    { win: "lab", target: { text: "Save PNG" }, do: "press", say: { en: "Press Save PNG", ko: "Save PNG를 눌러요" } },
  ],

  // 9 — the Director (DirectorPanel): two keyframes on the focused lane, then ▶.
  [
    closeHw,
    openTab("Director", { en: "Open the Director", ko: "Director를 열어요" }),
    // Early in the show (the lane is the whole show's length, 30 s at first): ▶ has something to do at once.
    { win: "lab", target: LANE, do: "press", on: "dblclick", at: [0.035, 0.78], say: { en: "Double-click the lane", ko: "줄을 두 번 클릭해요" } },
    { win: "lab", target: LANE, do: "press", on: "dblclick", at: [0.3, 0.22], say: { en: "Once more, further on", ko: "조금 떨어진 곳에 한 번 더" } },
    { win: "lab", target: { text: "▶" }, do: "press", say: { en: "Press ▶", ko: "▶를 눌러요" } },
  ],

  // 10 — give it back: pointed at only; publishing is the reader's own.
  [
    {
      win: "lab",
      target: { text: "Upload to the community" },
      do: "point",
      until: 2600,
      skipIf: (ctx) => !has(ctx, { text: "Upload to the community" }),
      say: { en: "With its .h", ko: ".h와 함께 올려요" },
    },
    {
      win: "lab",
      target: { text: "Share" },
      do: "point",
      until: 2600,
      skipIf: hwOpen,
      say: { en: "Share: without a .h", ko: "Share는 .h 없이" },
    },
  ],
];
