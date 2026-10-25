/**
 * The page script of index.html (page.ts bundles it). The patterns sit in the
 * groups shelf.json sorts them into, one folded section each; a group's tiles
 * are built the first time it opens. A tile is one pattern running in its own
 * LabEngine, the Lab preview's engine, with the layer the Lab builds from its
 * code and the study's start knobs. Only tiles on screen run: a tile gets an
 * engine when it scrolls into view and drops it when it leaves, and all the
 * running tiles share a few milliseconds a frame, so a screen full of heavy
 * patterns plays slower instead of locking the page.
 *
 * A tile opens a card with the knobs, the buttons and the code. The map,
 * folded at the bottom, places every pattern by two of the measures study.ts
 * took; a dot opens its card. The newest round's dots wear a white ring, and
 * the chips under the map hide a round or a family.
 *
 * A star marks a pattern as picked. The picks stay in this browser, and the
 * toolbar copies them as a list to paste where the next round will read it.
 */
import { LabEngine, type EngineFrame } from "../../../web/src/lib/lab/engine";
import type { CodeLayer } from "../../../web/src/lib/lab/types";
import { stripRampAnnotation } from "../../../web/src/lib/pattern/ramp";

import { AXES, GRID, scale } from "./map";

type Knob = { name: string; min: number; max: number };
type Entry = {
  slug: string;
  title: string;
  family: string;
  round: number;
  note: string;
  why: string;
  block: number;
  ramped: boolean;
  layer: Omit<CodeLayer, "code">;
  matrix: { width: number; height: number };
  knobs: Knob[];
  start: number[];
  measures: Record<string, number>;
  knobResponse: number[];
};
type Group = { key: string; label: string; why: string; open: boolean; patterns: string[] };
type Data = {
  patterns: Entry[];
  families: Record<string, { label: string; color: string }>;
  shelf: { date: string; about: string; groups: Group[] };
};

const data = JSON.parse(document.getElementById("study-data")!.textContent!) as Data;
const bySlug = new Map(data.patterns.map((p) => [p.slug, p]));
const groupOf = new Map<string, Group>();
for (const group of data.shelf.groups) for (const slug of group.patterns) groupOf.set(slug, group);

// The newest round stands out on the map, its chip and its tiles. With one
// round there is nothing newer to tell apart.
const rounds = [...new Set(data.patterns.map((p) => p.round))].sort((a, b) => a - b);
const newest = rounds[rounds.length - 1] ?? 0;
const roundClass = (round: number) => `r${round}${rounds.length > 1 && round === newest ? " new" : ""}`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const fmt = (v: number) => `${Number(v.toPrecision(3))}`;
const remember = (key: string, value?: string) => {
  try {
    if (value === undefined) return localStorage.getItem(`pattern-study:${key}`);
    localStorage.setItem(`pattern-study:${key}`, value);
  } catch {
    // A file:// page in a private window has no storage; nothing to keep.
  }
  return null;
};

// ── Code ────────────────────────────────────────────────────────────────────
// Each pattern's code sits in one of the JSON blocks page.ts writes. The first
// block is read before this script runs; the others may still be arriving.
const blocks = new Map<number, Record<string, string>>();
const loaded = () => document.readyState !== "loading";

function codeOf(entry: Entry): string | null {
  if (!blocks.has(entry.block)) {
    const node = document.getElementById(`code-${entry.block}`);
    if (!node || (entry.block > 0 && !loaded())) return null;
    blocks.set(entry.block, JSON.parse(node.textContent!) as Record<string, string>);
  }
  return blocks.get(entry.block)![entry.slug] ?? null;
}

/** The sentence after the knob's name on each "// Knob N:" line: "Hue. Turns the pair..." → "Turns the pair...". */
function knobNotes(code: string): string[] {
  return [1, 2, 3, 4].map((n) => {
    const line = code.match(new RegExp(`^//[ \\t]*Knob ${n}:[ \\t]*(.+)$`, "m"))?.[1].trim() ?? "";
    return line.replace(/^[^.]{1,20}\.\s*/, "");
  });
}

function layerOf(entry: Entry): CodeLayer | null {
  const code = codeOf(entry);
  if (code === null) return null;
  // The Lab runs the code without its @ramp line, as page.ts checked.
  return { ...entry.layer, code: entry.ramped ? stripRampAnnotation(code) : code } as CodeLayer;
}

// ── Running ─────────────────────────────────────────────────────────────────
// Every runner steps on the Lab's 30 fps clock, so a pattern runs at the same
// speed here whatever the screen's refresh rate, until the page runs out of
// time in a frame.
const STEP = 1 / 30;
const BUDGET_MS = 10;

type Runner = {
  entry: Entry;
  engine: LabEngine | null;
  layer: CodeLayer | null;
  knobs: number[];
  time: number;
  owed: number;
  show: (frame: EngineFrame) => void;
  error: (message: string) => void;
};

const active = new Set<Runner>();
let running = true;
let cursor = 0;
/** The open card's runner. */
let focus: Runner | null = null;

function runner(entry: Entry, show: Runner["show"], error: Runner["error"]): Runner {
  return { entry, engine: null, layer: null, knobs: [...entry.start], time: 0, owed: STEP, show, error };
}

/** One step of one runner. False when its code has not arrived yet. */
function step(r: Runner): boolean {
  if (!r.layer) r.layer = layerOf(r.entry);
  if (!r.layer) return false;
  if (!r.engine) r.engine = new LabEngine();
  r.time += STEP;
  const frame = r.engine.render(
    {
      matrix: r.entry.matrix,
      layers: [r.layer],
      activeLayerId: r.layer.id,
      knobs: r.knobs,
      ranges: r.entry.knobs.map((k): [number, number] => [k.min, k.max]),
    },
    STEP,
    r.time,
  );
  r.error(r.engine.errors.get(r.layer.id) ?? "");
  r.show(frame);
  return true;
}

let last = performance.now();
function loop(now: number) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  if (running) {
    const started = performance.now();
    // An open card covers the tiles, so it runs alone.
    const list = focus ? [focus] : [...active];
    for (const r of list) r.owed = Math.min(r.owed + dt, STEP * 2);
    for (let k = 0; k < list.length; k++) {
      const r = list[(cursor + k) % list.length];
      if (r.owed < STEP) continue;
      if (step(r)) r.owed -= STEP;
      if (performance.now() - started > BUDGET_MS) {
        cursor = (cursor + k + 1) % list.length;
        break;
      }
    }
  }
  requestAnimationFrame(loop);
}

// ── Tiles ───────────────────────────────────────────────────────────────────
type Tile = { entry: Entry; root: HTMLElement; runner: Runner };
const tiles = new Map<string, Tile>();

const seen = new IntersectionObserver(
  (entries) => {
    for (const s of entries) {
      const tile = tiles.get((s.target as HTMLElement).dataset.slug!);
      if (!tile) continue;
      if (s.isIntersecting) active.add(tile.runner);
      else {
        // Off screen, a tile keeps its last frame and lets its engine go.
        active.delete(tile.runner);
        tile.runner.engine = null;
        tile.runner.time = 0;
      }
    }
  },
  { rootMargin: "160px" },
);

/** Clear pixels are dark LEDs. */
function toLeds(frame: EngineFrame, out: ImageData) {
  const src = frame.data;
  const dst = out.data;
  for (let p = 0; p < src.length; p += 4) {
    const a = src[p + 3] / 255;
    dst[p] = src[p] * a;
    dst[p + 1] = src[p + 1] * a;
    dst[p + 2] = src[p + 2] * a;
    dst[p + 3] = 255;
  }
}

function buildTile(entry: Entry): Tile {
  const family = data.families[entry.family];
  const root = el("article", `tile ${roundClass(entry.round)}`);
  root.dataset.slug = entry.slug;
  root.style.setProperty("--family", family?.color ?? "#ccc");
  root.title = entry.note;

  const open = el("button", "tile-open");
  open.setAttribute("aria-label", `${entry.title} 열기`);
  const canvas = el("canvas", "tile-panel");
  canvas.width = entry.matrix.width;
  canvas.height = entry.matrix.height;
  canvas.style.aspectRatio = `${entry.matrix.width} / ${entry.matrix.height}`;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(entry.matrix.width, entry.matrix.height);
  const name = el("span", "tile-name", entry.title);
  const round = el("span", "tile-round", `${entry.round}판`);
  open.append(canvas, name, round);
  open.addEventListener("click", () => openCard(entry.slug));

  const star = starButton(entry.slug);
  root.append(open, star);
  if (entry.why) root.append(el("p", "tile-why", entry.why));

  const tile: Tile = {
    entry,
    root,
    runner: runner(
      entry,
      (frame) => {
        toLeds(frame, image);
        ctx.putImageData(image, 0, 0);
      },
      (message) => root.classList.toggle("broken", Boolean(message)),
    ),
  };
  tiles.set(entry.slug, tile);
  root.hidden = isHidden(entry);
  seen.observe(root);
  return tile;
}

// ── Picks ───────────────────────────────────────────────────────────────────
const picked = new Set<string>(
  (() => {
    try {
      const list = JSON.parse(remember("picked") ?? "[]") as unknown;
      return Array.isArray(list) ? list.filter((s): s is string => typeof s === "string" && bySlug.has(s)) : [];
    } catch {
      return [];
    }
  })(),
);

function starButton(slug: string) {
  const star = el("button", "star");
  star.dataset.star = slug;
  star.addEventListener("click", (event) => {
    event.stopPropagation();
    if (picked.has(slug)) picked.delete(slug);
    else picked.add(slug);
    remember("picked", JSON.stringify([...picked]));
    showPicks();
  });
  paintStar(star, picked.has(slug));
  return star;
}

function paintStar(star: HTMLElement, on: boolean) {
  star.textContent = on ? "★" : "☆";
  star.classList.toggle("on", on);
  star.title = on ? "고른 것에서 빼기" : "고르기";
}

function pickList() {
  const chosen = data.patterns.filter((p) => picked.has(p.slug));
  return `패턴 연구에서 고른 것 ${chosen.length}개: ${chosen.map((p) => `${p.title} (${p.slug})`).join(", ")}`;
}

function showPicks() {
  for (const star of document.querySelectorAll<HTMLElement>("[data-star]")) paintStar(star, picked.has(star.dataset.star!));
  document.getElementById("picked-count")!.textContent = `고른 것 ${picked.size}개`;
  (document.getElementById("picked-copy") as HTMLButtonElement).disabled = picked.size === 0;
  (document.getElementById("picked-clear") as HTMLButtonElement).disabled = picked.size === 0;
}

async function copyText(text: string, button: HTMLButtonElement, done: string) {
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = el("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = done;
  setTimeout(() => (button.textContent = label), 1400);
}

// ── Card ────────────────────────────────────────────────────────────────────
// The open card draws the panel larger, as LED dots or as plain pixels.
const SCALE = 4;
let ledLook = remember("look") !== "pixel";

function dotMask(width: number, height: number, lit: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = lit ? "#000" : "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = lit ? "#fff" : "#17171a";
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      ctx.beginPath();
      ctx.arc(x * SCALE + SCALE / 2, y * SCALE + SCALE / 2, SCALE * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
  return canvas;
}
const masks = new Map<string, { lit: HTMLCanvasElement; dim: HTMLCanvasElement }>();
function masksFor(width: number, height: number) {
  const key = `${width}x${height}`;
  if (!masks.has(key)) masks.set(key, { lit: dotMask(width, height, true), dim: dotMask(width, height, false) });
  return masks.get(key)!;
}

const dialog = document.getElementById("card") as HTMLDialogElement;

function openCard(slug: string) {
  const entry = bySlug.get(slug);
  if (!entry) return;
  dropCard();
  const family = data.families[entry.family];
  const group = groupOf.get(slug);
  const { width, height } = entry.matrix;

  const root = el("article", "card");
  root.style.setProperty("--family", family?.color ?? "#ccc");
  // A panel standing up sits beside its controls instead of above them.
  root.classList.toggle("portrait", height > width);

  const head = el("header", "card-head");
  const title = el("h3", "", entry.title);
  const tags = el("span", "tags");
  tags.append(el("span", "chip", family?.label ?? entry.family), el("span", `round ${roundClass(entry.round)}`, `${entry.round}판`));
  const close = el("button", "close", "닫기");
  close.addEventListener("click", () => closeCard());
  head.append(title, tags, starButton(slug), close);

  const view = el("canvas", "panel");
  view.width = width * SCALE;
  view.height = height * SCALE;
  view.style.aspectRatio = `${width} / ${height}`;
  const viewCtx = view.getContext("2d")!;
  const small = document.createElement("canvas");
  small.width = width;
  small.height = height;
  const smallCtx = small.getContext("2d")!;
  const image = smallCtx.createImageData(width, height);

  const placed = el("p", "placed");
  if (group) {
    placed.append(el("strong", "", group.label));
    placed.append(document.createTextNode(` · ${entry.why || group.why}`));
  }
  const note = el("p", "note", entry.note);
  const error = el("p", "error");

  // A card opened from the map before the later code blocks have arrived
  // shows no knob notes; its panel starts once the code is there.
  const code = codeOf(entry) ?? "";
  const about = knobNotes(code);
  const knobBox = el("div", "knobs");
  const sliders: HTMLInputElement[] = [];
  const readouts: HTMLElement[] = [];
  entry.knobs.forEach((knob, i) => {
    const row = el("label", "knob");
    const name = el("span", "knob-name", `K${i + 1} ${knob.name}`);
    const slider = el("input");
    slider.type = "range";
    slider.min = String(knob.min);
    slider.max = String(knob.max);
    slider.step = String((knob.max - knob.min) / 480);
    slider.value = String(entry.start[i]);
    const readout = el("span", "knob-value", fmt(entry.start[i]));
    row.title = about[i];
    row.append(name, slider, readout, el("span", "knob-about", about[i]));
    knobBox.append(row);
    sliders.push(slider);
    readouts.push(readout);
  });

  const r = runner(
    entry,
    (frame) => {
      toLeds(frame, image);
      smallCtx.putImageData(image, 0, 0);
      viewCtx.globalCompositeOperation = "source-over";
      viewCtx.imageSmoothingEnabled = false;
      viewCtx.drawImage(small, 0, 0, view.width, view.height);
      if (ledLook) {
        const mask = masksFor(width, height);
        viewCtx.globalCompositeOperation = "multiply";
        viewCtx.drawImage(mask.lit, 0, 0);
        viewCtx.globalCompositeOperation = "lighten";
        viewCtx.drawImage(mask.dim, 0, 0);
        viewCtx.globalCompositeOperation = "source-over";
      }
    },
    (message) => (error.textContent = message),
  );
  const setKnob = (index: number, value: number) => {
    r.knobs[index] = value;
    sliders[index].value = String(value);
    readouts[index].textContent = fmt(value);
  };
  sliders.forEach((slider, i) => slider.addEventListener("input", () => setKnob(i, Number(slider.value))));

  const tools = el("div", "tools");
  const buttons = el("div", "buttons");
  for (let i = 0; i < 4; i++) {
    const b = el("button", "press", `K${i + 1}`);
    b.title = `K${i + 1} 누르기`;
    buttons.append(b);
    b.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      r.engine?.pressButton(i);
    });
    const up = () => r.engine?.releaseButton(i);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointerleave", up);
  }
  const copy = el("button", "action", "코드 복사");
  const reset = el("button", "action", "처음 값");
  const restart = el("button", "action", "다시 시작");
  const look = el("button", "action");
  const showLook = () => (look.textContent = ledLook ? "LED 점" : "픽셀");
  showLook();
  tools.append(buttons, copy, reset, restart, look);
  reset.addEventListener("click", () => entry.start.forEach((v, i) => setKnob(i, v)));
  restart.addEventListener("click", () => {
    r.engine = null;
    r.time = 0;
  });
  copy.addEventListener("click", () => {
    const code = codeOf(entry);
    if (code !== null) void copyText(code, copy, "복사했어요");
  });
  look.addEventListener("click", () => {
    ledLook = !ledLook;
    remember("look", ledLook ? "led" : "pixel");
    showLook();
  });

  const buttonsLine = code.match(/^\/\/[ \t]*Buttons:[ \t]*(.+)$/m)?.[1].trim() ?? "";
  const pressNote = el("p", "press-note", buttonsLine ? `버튼: ${buttonsLine}` : "");

  const measured = el("details", "measured");
  measured.append(el("summary", "", "잰 값"));
  const table = el("dl");
  for (const [key, axis] of Object.entries(AXES)) table.append(el("dt", "", axis.label), el("dd", "", fmt(entry.measures[key] ?? 0)));
  table.append(el("dt", "", "노브 반응"), el("dd", "", entry.knobResponse.map(fmt).join(" · ")));
  measured.append(table);

  const pasteNote = el(
    "p",
    "paste-note",
    "「코드 복사」로 가져가 Lab 의 CODE 칸에 붙여 넣으면 돼요. 노브는 Lab 의 기본 노브 값 0, 2, 0, 0.06 을 이 패턴의 범위 안으로 당긴 자리에서 시작해요. 붙여 넣으면 노브는 그때 Lab 에 있던 값을 새 범위로 당긴 자리에 서니, 같은 화면을 보려면 슬라이더 값대로 Knobs 칸을 맞춰요.",
  );

  const side = el("div", "card-side");
  side.append(placed, note, error, knobBox, tools, pressNote, measured, pasteNote);
  const body = el("div", "card-body");
  body.append(view, side);
  root.append(head, body);

  dialog.replaceChildren(root);
  focus = r;
  if (!dialog.open) dialog.showModal();
  history.replaceState(null, "", `#${slug}`);
}

function dropCard() {
  focus = null;
}

function closeCard() {
  dropCard();
  if (dialog.open) dialog.close();
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

// ── Groups ──────────────────────────────────────────────────────────────────
function buildGroups() {
  const box = document.getElementById("groups")!;
  for (const group of data.shelf.groups) {
    const section = el("details", `group g-${group.key}`);
    section.id = `group-${group.key}`;
    const summary = el("summary");
    const label = el("span", "group-label", group.label);
    const count = el("span", "group-count", `${group.patterns.length}개`);
    summary.append(label, count, el("span", "group-why", group.why));
    const grid = el("div", "tiles");
    section.append(summary, grid);
    let built = false;
    const build = () => {
      if (built) return;
      built = true;
      for (const slug of group.patterns) grid.append(buildTile(bySlug.get(slug)!).root);
    };
    section.addEventListener("toggle", () => section.open && build());
    if (group.open) {
      section.open = true;
      build();
    }
    box.append(section);
  }
}

// ── Map ─────────────────────────────────────────────────────────────────────
let axisX = remember("x") ?? "edges";
let axisY = remember("y") ?? "motion";
if (!AXES[axisX]) axisX = "edges";
if (!AXES[axisY]) axisY = "motion";
const hiddenFamilies = new Set<string>();
const hiddenRounds = new Set<number>();
const isHidden = (p: Entry) => hiddenFamilies.has(p.family) || hiddenRounds.has(p.round);

const allMeasures = data.patterns.map((p) => p.measures);
const mapSection = document.getElementById("map-section") as HTMLDetailsElement;

type Spot = { x: number; y: number; anchor: "start" | "end" };

/**
 * Where each dot's name goes: right of the dot if that is free, else left,
 * else a line above or below. Names that would sit on another name or dot
 * try the next place; the first place stands when none is free.
 */
function labelPlaces(
  points: { p: Entry; x: number; y: number }[],
  charWidth: number,
  plot: { l: number; r: number; t: number; b: number },
) {
  type Box = { x0: number; x1: number; y0: number; y1: number };
  const taken: Box[] = points.map(({ x, y }) => ({ x0: x - 7, x1: x + 7, y0: y - 7, y1: y + 7 }));
  const hits = (a: Box) => taken.some((b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1);
  const out = new Map<string, Spot>();
  const order = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const { p, x, y } of order) {
    const width = p.title.length * charWidth;
    const tries: Spot[] = [];
    for (const dy of [4, -8, 16, -20, 28]) {
      tries.push({ x: x + 9, y: y + dy, anchor: "start" }, { x: x - 9, y: y + dy, anchor: "end" });
    }
    const boxOf = (s: Spot): Box => {
      const x0 = s.anchor === "start" ? s.x : s.x - width;
      return { x0, x1: x0 + width, y0: s.y - 10, y1: s.y + 2 };
    };
    const inside = (b: Box) => b.x0 >= plot.l - 30 && b.x1 <= plot.r + 12 && b.y0 >= plot.t - 4 && b.y1 <= plot.b + 4;
    const spot = tries.find((s) => inside(boxOf(s)) && !hits(boxOf(s))) ?? tries.find((s) => inside(boxOf(s))) ?? tries[0];
    taken.push(boxOf(spot));
    out.set(p.slug, spot);
  }
  return out;
}

function drawMap() {
  if (!mapSection.open) return;
  const box = document.getElementById("map")!;
  const W = box.clientWidth;
  const H = Math.round(Math.min(Math.max(W * 0.62, 300), 560));
  const m = { l: 34, r: 14, t: 14, b: 34 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const sx = scale(axisX, allMeasures);
  const sy = scale(axisY, allMeasures);
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    if (text !== undefined) node.textContent = text;
    svg.append(node);
    return node;
  };

  const shown = data.patterns.filter((p) => !isHidden(p));
  const points = shown.map((p) => ({
    p,
    x: m.l + sx(p.measures[axisX] ?? 0) * iw,
    y: m.t + (1 - sy(p.measures[axisY] ?? 0)) * ih,
  }));

  // Two patterns that measure almost alike would hide one dot under the
  // other, so dots closer than 14 px push apart a little. The cells below are
  // counted from where the measures put them, before the push.
  const measured = points.map(({ x, y }) => ({ x, y }));
  for (let round = 0; round < 40; round++) {
    for (let a = 0; a < points.length; a++)
      for (let b = a + 1; b < points.length; b++) {
        const dx = points[b].x - points[a].x;
        const dy = points[b].y - points[a].y;
        const d = Math.hypot(dx, dy);
        if (d >= 14) continue;
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        const push = (14 - d) / 2;
        points[a].x -= ux * push;
        points[a].y -= uy * push;
        points[b].x += ux * push;
        points[b].y += uy * push;
      }
    for (const point of points) {
      point.x = Math.max(m.l, Math.min(m.l + iw, point.x));
      point.y = Math.max(m.t, Math.min(m.t + ih, point.y));
    }
  }

  // Empty cells: the places on this map no pattern stands yet.
  const filled = new Set(measured.map(({ x, y }) => `${Math.min(GRID - 1, Math.floor(((x - m.l) / iw) * GRID))},${Math.min(GRID - 1, Math.floor(((y - m.t) / ih) * GRID))}`));
  for (let gx = 0; gx < GRID; gx++)
    for (let gy = 0; gy < GRID; gy++) {
      const empty = !filled.has(`${gx},${gy}`);
      add("rect", {
        x: m.l + (gx * iw) / GRID,
        y: m.t + (gy * ih) / GRID,
        width: iw / GRID,
        height: ih / GRID,
        class: empty ? "cell empty" : "cell",
      });
    }
  add("text", { x: m.l + iw / 2, y: H - 8, class: "axis", "text-anchor": "middle" }, `${AXES[axisX].label} →`);
  add("text", { x: m.l, y: H - 8, class: "axis-end" }, AXES[axisX].low);
  add("text", { x: m.l + iw, y: H - 8, class: "axis-end", "text-anchor": "end" }, AXES[axisX].high);
  add("text", { x: 14, y: m.t + ih / 2, class: "axis", "text-anchor": "middle", transform: `rotate(-90 14 ${m.t + ih / 2})` }, `${AXES[axisY].label} →`);
  add("text", { x: m.l + 4, y: m.t + ih - 6, class: "axis-end" }, AXES[axisY].low);
  add("text", { x: m.l + 4, y: m.t + 14, class: "axis-end" }, AXES[axisY].high);

  // A narrow map still names its dots, in a smaller face.
  const narrow = W < 520;
  svg.classList.toggle("narrow", narrow);
  const place = labelPlaces(points, narrow ? 5.2 : 6.4, { l: m.l, r: m.l + iw, t: m.t, b: m.t + ih });
  for (const { p, x, y } of points) {
    const color = data.families[p.family]?.color ?? "#ccc";
    const g = document.createElementNS(NS, "a");
    g.setAttribute("href", `#${p.slug}`);
    g.setAttribute("class", `dot ${roundClass(p.round)}${picked.has(p.slug) ? " picked" : ""}`);
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "7");
    circle.setAttribute("fill", color);
    const tip = document.createElementNS(NS, "title");
    tip.textContent = `${p.title} · ${data.families[p.family]?.label ?? p.family} · ${p.round}판 · ${groupOf.get(p.slug)?.label ?? ""}`;
    circle.append(tip);
    g.append(circle);
    const text = document.createElementNS(NS, "text");
    const spot = place.get(p.slug)!;
    text.setAttribute("x", String(spot.x));
    text.setAttribute("y", String(spot.y));
    text.setAttribute("text-anchor", spot.anchor);
    text.textContent = p.title;
    g.append(text);
    g.addEventListener("click", (event) => {
      event.preventDefault();
      openCard(p.slug);
    });
    svg.append(g);
  }
  box.replaceChildren(svg);
}

function axisSelect(id: string, current: string, set: (v: string) => void) {
  const select = document.getElementById(id) as HTMLSelectElement;
  for (const [key, axis] of Object.entries(AXES)) {
    const option = el("option", "", `${axis.label} (${axis.low} → ${axis.high})`);
    option.value = key;
    select.append(option);
  }
  select.value = current;
  select.addEventListener("change", () => {
    set(select.value);
    drawMap();
  });
}

function legend() {
  const box = document.getElementById("legend")!;
  const refresh = () => {
    for (const tile of tiles.values()) tile.root.hidden = isHidden(tile.entry);
    drawMap();
  };
  for (const round of rounds) {
    const count = data.patterns.filter((p) => p.round === round).length;
    const chip = el("button", `legend-chip round-chip ${roundClass(round)}`, `${round}판 ${count}`);
    chip.addEventListener("click", () => {
      if (hiddenRounds.has(round)) hiddenRounds.delete(round);
      else hiddenRounds.add(round);
      chip.classList.toggle("off", hiddenRounds.has(round));
      refresh();
    });
    box.append(chip);
  }
  for (const [key, family] of Object.entries(data.families)) {
    const count = data.patterns.filter((p) => p.family === key).length;
    const chip = el("button", "legend-chip", `${family.label} ${count}`);
    chip.style.setProperty("--family", family.color);
    chip.addEventListener("click", () => {
      if (hiddenFamilies.has(key)) hiddenFamilies.delete(key);
      else hiddenFamilies.add(key);
      chip.classList.toggle("off", hiddenFamilies.has(key));
      refresh();
    });
    box.append(chip);
  }
}

// ── Start ───────────────────────────────────────────────────────────────────
function start() {
  document.getElementById("count")!.textContent = String(data.patterns.length);
  document.getElementById("rounds")!.textContent = rounds.length > 1 ? `${rounds[0]}–${newest}판` : `${newest}판`;
  document.getElementById("newest")!.textContent = String(newest);
  const about = document.getElementById("about")!;
  about.textContent = data.shelf.about;
  about.hidden = !data.shelf.about;

  buildGroups();

  axisSelect("axis-x", axisX, (v) => {
    axisX = v;
    remember("x", v);
  });
  axisSelect("axis-y", axisY, (v) => {
    axisY = v;
    remember("y", v);
  });
  legend();
  mapSection.addEventListener("toggle", drawMap);
  window.addEventListener("resize", drawMap);

  const pause = document.getElementById("pause") as HTMLButtonElement;
  pause.addEventListener("click", () => {
    running = !running;
    pause.textContent = running ? "모두 멈춤" : "다시 재생";
  });
  const copyPicks = document.getElementById("picked-copy") as HTMLButtonElement;
  copyPicks.addEventListener("click", () => void copyText(pickList(), copyPicks, "복사했어요"));
  document.getElementById("picked-clear")!.addEventListener("click", () => {
    if (!confirm(`고른 것 ${picked.size}개를 비울까요?`)) return;
    picked.clear();
    remember("picked", "[]");
    showPicks();
  });
  showPicks();

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeCard();
  });
  dialog.addEventListener("close", () => closeCard());

  // A link to #<slug>, or the back button to one, opens that card.
  const fromHash = () => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (bySlug.has(slug)) openCard(slug);
    else if (dialog.open) closeCard();
  };
  window.addEventListener("hashchange", fromHash);
  if (location.hash) requestAnimationFrame(fromHash);
  requestAnimationFrame(loop);
}

start();
