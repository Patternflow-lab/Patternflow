/**
 * The page script of index.html (page.ts bundles it). A card is one pattern
 * running in its own LabEngine, the Lab preview's engine, with the layer and
 * knobs a paste into Pattern Lab would give it. Cards off screen don't run.
 * The map at the top places every pattern by two of the measures study.ts
 * took; a dot takes you to its card.
 */
import { LabEngine } from "../../../web/src/lib/lab/engine";
import type { CodeLayer } from "../../../web/src/lib/lab/types";

type Knob = { name: string; min: number; max: number; about: string };
type Entry = {
  slug: string;
  title: string;
  family: string;
  note: string;
  idea: string;
  buttons: string;
  code: string;
  layer: CodeLayer;
  matrix: { width: number; height: number };
  knobs: Knob[];
  start: number[];
  measures: Record<string, number>;
  knobResponse: number[];
};
type Data = { patterns: Entry[]; families: Record<string, { label: string; color: string }> };

const data = JSON.parse(document.getElementById("study-data")!.textContent!) as Data;

const AXES: Record<string, { label: string; low: string; high: string; log?: boolean }> = {
  edges: { label: "가장자리", low: "번짐", high: "또렷" },
  motion: { label: "움직임", low: "고요", high: "바쁨", log: true },
  detail: { label: "촘촘함", low: "굵음", high: "잘다" },
  complexity: { label: "복잡도", low: "단순", high: "복잡" },
  coverage: { label: "채움", low: "비어 있음", high: "꽉 참" },
  colour: { label: "색", low: "한 색", high: "여러 색" },
  drift: { label: "모양 바뀜", low: "제자리", high: "흘러감" },
};

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

// ── LED look ────────────────────────────────────────────────────────────────
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

// ── Cards ───────────────────────────────────────────────────────────────────
type Card = {
  entry: Entry;
  root: HTMLElement;
  engine: LabEngine;
  knobs: number[];
  time: number;
  visible: boolean;
  small: HTMLCanvasElement;
  smallCtx: CanvasRenderingContext2D;
  image: ImageData;
  view: HTMLCanvasElement;
  viewCtx: CanvasRenderingContext2D;
  sliders: HTMLInputElement[];
  readouts: HTMLElement[];
  error: HTMLElement;
};

const cards: Card[] = [];
let running = true;

function setKnob(card: Card, index: number, value: number) {
  card.knobs[index] = value;
  card.sliders[index].value = String(value);
  card.readouts[index].textContent = fmt(value);
}

function buildCard(entry: Entry): Card {
  const family = data.families[entry.family];
  const root = el("article", "card");
  root.id = entry.slug;
  root.style.setProperty("--family", family?.color ?? "#ccc");

  const head = el("header", "card-head");
  const title = el("h3", "", entry.title);
  const chip = el("span", "chip", family?.label ?? entry.family);
  head.append(title, chip);

  const { width, height } = entry.matrix;
  const view = el("canvas", "panel");
  view.width = width * SCALE;
  view.height = height * SCALE;
  const small = document.createElement("canvas");
  small.width = width;
  small.height = height;
  const smallCtx = small.getContext("2d")!;

  const note = el("p", "note", entry.note || entry.idea);
  const error = el("p", "error");

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
    row.title = knob.about;
    row.append(name, slider, readout);
    const about = el("span", "knob-about", knob.about);
    row.append(about);
    knobBox.append(row);
    sliders.push(slider);
    readouts.push(readout);
  });

  const tools = el("div", "tools");
  const buttons = el("div", "buttons");
  for (let i = 0; i < 4; i++) {
    const b = el("button", "press", `K${i + 1}`);
    b.title = `K${i + 1} 누르기`;
    buttons.append(b);
    b.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      card.engine.pressButton(i);
    });
    const up = () => card.engine.releaseButton(i);
    b.addEventListener("pointerup", up);
    b.addEventListener("pointerleave", up);
  }
  const copy = el("button", "action", "코드 복사");
  const reset = el("button", "action", "처음 값");
  const restart = el("button", "action", "다시 시작");
  tools.append(buttons, copy, reset, restart);

  const pressNote = el("p", "press-note", entry.buttons ? `버튼: ${entry.buttons}` : "");

  const measured = el("details", "measured");
  measured.append(el("summary", "", "잰 값"));
  const table = el("dl");
  for (const [key, axis] of Object.entries(AXES)) {
    table.append(el("dt", "", axis.label), el("dd", "", fmt(entry.measures[key] ?? 0)));
  }
  table.append(el("dt", "", "노브 반응"), el("dd", "", entry.knobResponse.map(fmt).join(" · ")));
  measured.append(table);

  root.append(head, view, note, error, knobBox, tools, pressNote, measured);

  const card: Card = {
    entry,
    root,
    engine: new LabEngine(),
    knobs: [...entry.start],
    time: 0,
    visible: false,
    small,
    smallCtx,
    image: smallCtx.createImageData(width, height),
    view,
    viewCtx: view.getContext("2d")!,
    sliders,
    readouts,
    error,
  };

  sliders.forEach((slider, i) => slider.addEventListener("input", () => setKnob(card, i, Number(slider.value))));
  reset.addEventListener("click", () => entry.start.forEach((v, i) => setKnob(card, i, v)));
  restart.addEventListener("click", () => {
    card.engine = new LabEngine();
    card.time = 0;
  });
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(entry.code);
    } catch {
      const area = el("textarea");
      area.value = entry.code;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    copy.textContent = "복사했어요";
    setTimeout(() => (copy.textContent = "코드 복사"), 1400);
  });

  return card;
}

function paint(card: Card) {
  const { width, height } = card.entry.matrix;
  const frame = card.engine.render(
    {
      matrix: card.entry.matrix,
      layers: [card.entry.layer],
      activeLayerId: card.entry.layer.id,
      knobs: card.knobs,
      ranges: card.entry.knobs.map((k): [number, number] => [k.min, k.max]),
    },
    1 / 30,
    card.time,
  );
  const error = card.engine.errors.get(card.entry.layer.id) ?? "";
  card.error.textContent = error;
  const out = card.image.data;
  for (let p = 0; p < width * height; p++) {
    // Clear pixels are dark LEDs.
    const a = frame.data[p * 4 + 3] / 255;
    out[p * 4] = frame.data[p * 4] * a;
    out[p * 4 + 1] = frame.data[p * 4 + 1] * a;
    out[p * 4 + 2] = frame.data[p * 4 + 2] * a;
    out[p * 4 + 3] = 255;
  }
  card.smallCtx.putImageData(card.image, 0, 0);
  const ctx = card.viewCtx;
  ctx.globalCompositeOperation = "source-over";
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(card.small, 0, 0, card.view.width, card.view.height);
  if (ledLook) {
    const mask = masksFor(width, height);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(mask.lit, 0, 0);
    ctx.globalCompositeOperation = "lighten";
    ctx.drawImage(mask.dim, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }
}

// Every card steps on the Lab's 30 fps clock, so a pattern runs at the same
// speed here whatever the screen's refresh rate.
const STEP = 1 / 30;
let last = performance.now();
let owed = 0;
function loop(now: number) {
  owed = Math.min(owed + (now - last) / 1000, STEP * 3);
  last = now;
  if (running && owed >= STEP) {
    owed -= STEP;
    for (const card of cards) {
      if (!card.visible) continue;
      card.time += STEP;
      paint(card);
    }
  }
  requestAnimationFrame(loop);
}

// ── Map ─────────────────────────────────────────────────────────────────────
const GRID = 4;
let axisX = remember("x") ?? "edges";
let axisY = remember("y") ?? "motion";
if (!AXES[axisX]) axisX = "edges";
if (!AXES[axisY]) axisY = "motion";
let hiddenFamilies = new Set<string>();

function scale(key: string) {
  const axis = AXES[key];
  const tf = (v: number) => (axis.log ? Math.log10(Math.max(v, 1e-3)) : v);
  const values = data.patterns.map((p) => tf(p.measures[key] ?? 0));
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-6) {
    lo -= 0.5;
    hi += 0.5;
  }
  const pad = (hi - lo) * 0.08;
  return (v: number) => (tf(v) - (lo - pad)) / (hi - lo + 2 * pad);
}

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
  const box = document.getElementById("map")!;
  const W = box.clientWidth;
  const H = Math.round(Math.min(Math.max(W * 0.62, 300), 560));
  const m = { l: 34, r: 14, t: 14, b: 34 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const sx = scale(axisX);
  const sy = scale(axisY);
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

  const shown = data.patterns.filter((p) => !hiddenFamilies.has(p.family));
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
    g.setAttribute("class", "dot");
    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "7");
    circle.setAttribute("fill", color);
    const tip = document.createElementNS(NS, "title");
    tip.textContent = `${p.title} · ${data.families[p.family]?.label ?? p.family}`;
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
      focusCard(p.slug);
    });
    svg.append(g);
  }
  box.replaceChildren(svg);
}

function focusCard(slug: string) {
  const card = cards.find((c) => c.entry.slug === slug);
  if (!card) return;
  for (const c of cards) c.root.classList.toggle("focus", c === card);
  card.root.scrollIntoView({ behavior: "smooth", block: "center" });
  history.replaceState(null, "", `#${slug}`);
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
  for (const [key, family] of Object.entries(data.families)) {
    const count = data.patterns.filter((p) => p.family === key).length;
    const chip = el("button", "legend-chip", `${family.label} ${count}`);
    chip.style.setProperty("--family", family.color);
    chip.addEventListener("click", () => {
      if (hiddenFamilies.has(key)) hiddenFamilies.delete(key);
      else hiddenFamilies.add(key);
      chip.classList.toggle("off", hiddenFamilies.has(key));
      for (const card of cards) card.root.hidden = hiddenFamilies.has(card.entry.family);
      drawMap();
    });
    box.append(chip);
  }
}

// ── Start ───────────────────────────────────────────────────────────────────
function start() {
  document.getElementById("count")!.textContent = String(data.patterns.length);
  const grid = document.getElementById("cards")!;
  for (const entry of data.patterns) {
    const card = buildCard(entry);
    cards.push(card);
    grid.append(card.root);
  }
  const observer = new IntersectionObserver(
    (seen) => {
      for (const s of seen) {
        const card = cards.find((c) => c.root === s.target);
        if (card) card.visible = s.isIntersecting;
      }
    },
    { rootMargin: "120px" },
  );
  for (const card of cards) {
    observer.observe(card.root);
    paint(card);
  }

  axisSelect("axis-x", axisX, (v) => {
    axisX = v;
    remember("x", v);
  });
  axisSelect("axis-y", axisY, (v) => {
    axisY = v;
    remember("y", v);
  });
  legend();
  drawMap();
  window.addEventListener("resize", drawMap);

  const look = document.getElementById("look") as HTMLButtonElement;
  const showLook = () => (look.textContent = ledLook ? "LED 점으로 보는 중" : "픽셀로 보는 중");
  showLook();
  look.addEventListener("click", () => {
    ledLook = !ledLook;
    remember("look", ledLook ? "led" : "pixel");
    showLook();
    for (const card of cards) paint(card);
  });
  const pause = document.getElementById("pause") as HTMLButtonElement;
  pause.addEventListener("click", () => {
    running = !running;
    pause.textContent = running ? "모두 멈춤" : "다시 재생";
  });

  if (location.hash) {
    const slug = decodeURIComponent(location.hash.slice(1));
    requestAnimationFrame(() => focusCard(slug));
  }
  requestAnimationFrame(loop);
}

start();
