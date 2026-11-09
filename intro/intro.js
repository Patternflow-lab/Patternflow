// SPDX-License-Identifier: MIT
//
// The page's moving parts. A 128 x 64 panel runs the pattern sources in
// patterns.js, four knobs turn it, a microphone can turn the knobs the way the
// Audio edition does, and the film loads only when someone presses play.
(() => {
  "use strict";

  const W = 128;
  const H = 64;
  // shared/constants.json: 24 detents a turn, two turns across a knob's range.
  const DETENTS_ACROSS = 24 * 2;
  // web/src/lib/pattern/controls.ts: what a pattern with no @knobs line gets,
  // in firmware order (hue, speed, mode, frequency). Hue and frequency wrap.
  const RANGES = [[0, 1], [0.1, 10], [0, 4.9], [0, 1]];
  const WRAP = [true, false, false, true];
  // Origin starts where its own setup() does; the rest start mid-range, as the
  // community cards and the guide's simulator do.
  const START = { origin: [0, 2, 0, 0.06] };
  const LABELS = {
    origin: ["색", "속도", "타일", "결"],
    "pattern-0629-2": ["소용돌이", "속도", "밀도", "색"],
    "pattern-0524-2": ["굴절", "속도", "물결 수", "반사"],
    "pattern-0629": ["번짐", "회전", "링 간격", "색"],
  };
  // Where each knob sits on the device: K2 and K1 on top, K4 and K3 below.
  const PLACE = [1, 0, 3, 2];
  // How far sound pushes each knob, as a share of its range, and which band.
  const SOUND = [
    { band: "high", reach: 0.25 },
    { band: "low", reach: 0.45 },
    null,
    { band: "mid", reach: 0.08 },
  ];

  const patterns = (window.PF_PATTERNS || []).map((p) => ({ ...p, module: null }));
  const panel = document.querySelector("[data-panel]");
  if (!panel || patterns.length === 0) return;

  // ── Pattern code ──────────────────────────────────────────────────────────
  // The same two rewrites the site's harness makes (web/src/lib/pattern/harness.ts).
  function compile(code) {
    const body = code
      .replace(/^\s*import\s+.*?;?\s*$/gm, "")
      .replace(/\bexport\s+function\b/g, "function");
    return new Function(
      `${body}\nreturn { setup: typeof setup === "function" ? setup : null, update: typeof update === "function" ? update : null, draw };`,
    )();
  }

  const pixels = new Uint8ClampedArray(W * H * 4);
  const frame = new ImageData(pixels, W, H);
  const display = {
    width: W,
    height: H,
    setPixel(x, y, r, g, b) {
      if (Array.isArray(r)) [r, g, b] = r;
      x = Math.floor(x);
      y = Math.floor(y);
      if (!(x >= 0 && y >= 0 && x < W && y < H)) return;
      const i = (y * W + x) * 4;
      pixels[i] = r;
      pixels[i + 1] = g;
      pixels[i + 2] = b;
      pixels[i + 3] = 255;
    },
    setValue(x, y, v) {
      const c = v * 255;
      display.setPixel(x, y, c, c, c);
    },
  };

  // ── Panel ─────────────────────────────────────────────────────────────────
  // Each LED is a round dot on black, six canvas pixels apart.
  const S = 6;
  const ctx = panel.getContext("2d");
  panel.width = W * S;
  panel.height = H * S;
  const source = document.createElement("canvas");
  source.width = W;
  source.height = H;
  const sourceCtx = source.getContext("2d");
  const mask = document.createElement("canvas");
  mask.width = W * S;
  mask.height = H * S;
  {
    const m = mask.getContext("2d");
    m.fillStyle = "#000";
    m.fillRect(0, 0, mask.width, mask.height);
    m.globalCompositeOperation = "destination-out";
    m.beginPath();
    const r = S * 0.43;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const cx = x * S + S / 2;
        const cy = y * S + S / 2;
        m.moveTo(cx + r, cy);
        m.arc(cx, cy, r, 0, Math.PI * 2);
      }
    }
    m.fill();
  }

  function paint() {
    sourceCtx.putImageData(frame, 0, 0);
    ctx.fillStyle = "#141414";
    ctx.fillRect(0, 0, panel.width, panel.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, panel.width, panel.height);
    ctx.drawImage(mask, 0, 0);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let active = 0;
  let params = {};
  const hand = patterns.map((p) => (START[p.id] || RANGES.map(([lo, hi]) => (lo + hi) / 2)).slice());
  const turns = [0, 0, 0, 0];
  const deltas = [0, 0, 0, 0];
  const pushed = [0, 0, 0, 0]; // what sound adds to each knob right now, in value units

  function span(i) {
    return RANGES[i][1] - RANGES[i][0];
  }
  function hold(i, v) {
    const [lo, hi] = RANGES[i];
    if (WRAP[i]) return lo + ((((v - lo) % span(i)) + span(i)) % span(i));
    return Math.min(hi, Math.max(lo, v));
  }
  function value(i) {
    return hold(i, hand[active][i] + pushed[i]);
  }

  function load(index) {
    for (let n = 0; n < patterns.length; n++) {
      active = (index + n) % patterns.length;
      const p = patterns[active];
      try {
        p.module = p.module || compile(p.code);
        params = {};
        p.module.setup && p.module.setup(params);
        break;
      } catch (error) {
        console.error(`${p.name}:`, error);
      }
    }
    const p = patterns[active];
    nameOut.textContent = p.name;
    countOut.textContent = `${active + 1} / ${patterns.length}`;
    const labels = LABELS[p.id] || ["노브 1", "노브 2", "노브 3", "노브 4"];
    knobs.forEach((k, i) => {
      k.name.textContent = labels[i];
      k.el.setAttribute("aria-label", labels[i]);
    });
    deltas.fill(0);
    showKnobs();
  }

  // ── Knobs ─────────────────────────────────────────────────────────────────
  const knobRow = document.querySelector("[data-knobs]");
  const nameOut = document.querySelector("[data-pattern-name]");
  const countOut = document.querySelector("[data-pattern-count]");
  const knobs = [0, 1, 2, 3].map((i) => {
    const el = document.createElement("div");
    el.className = "knob";
    el.tabIndex = 0;
    el.setAttribute("role", "slider");
    el.setAttribute("aria-valuemin", String(RANGES[i][0]));
    el.setAttribute("aria-valuemax", String(RANGES[i][1]));
    el.style.order = String(PLACE[i]);
    const cap = document.createElement("span");
    cap.className = "knob-cap";
    cap.innerHTML = '<span class="knob-mark"></span>';
    const name = document.createElement("span");
    name.className = "knob-name";
    el.append(cap, name);
    knobRow.append(el);
    return { el, cap, name };
  });

  function showKnobs() {
    knobs.forEach((k, i) => {
      const step = span(i) / DETENTS_ACROSS;
      const angle = (turns[i] + pushed[i] / step) * 15;
      k.cap.style.transform = `rotate(${angle}deg)`;
      k.el.setAttribute("aria-valuenow", value(i).toFixed(3));
    });
  }

  function turn(i, detents) {
    if (!detents) return;
    hand[active][i] = hold(i, hand[active][i] + (detents * span(i)) / DETENTS_ACROSS);
    turns[i] += detents;
    deltas[i] += detents;
    showKnobs();
    if (paused) step(0);
  }

  knobs.forEach((k, i) => {
    let last = null;
    let carry = 0;
    k.el.addEventListener("pointerdown", (e) => {
      last = { x: e.clientX, y: e.clientY };
      carry = 0;
      k.el.setPointerCapture(e.pointerId);
      k.el.classList.add("is-turning");
      e.preventDefault();
    });
    k.el.addEventListener("pointermove", (e) => {
      if (!last) return;
      // Up or right turns it clockwise. Nine pixels of drag is one detent.
      carry += e.clientX - last.x - (e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
      const d = Math.trunc(carry / 9);
      carry -= d * 9;
      turn(i, d);
    });
    const end = () => {
      last = null;
      k.el.classList.remove("is-turning");
    };
    k.el.addEventListener("pointerup", end);
    k.el.addEventListener("pointercancel", end);
    k.el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        turn(i, e.deltaY < 0 ? 1 : -1);
      },
      { passive: false },
    );
    k.el.addEventListener("keydown", (e) => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 6, PageDown: -6 }[e.key];
      if (!d) return;
      e.preventDefault();
      turn(i, d);
    });
  });

  // ── Sound ─────────────────────────────────────────────────────────────────
  const soundButton = document.querySelector("[data-sound]");
  const soundNote = document.querySelector("[data-sound-note]");
  let audio = null;
  const level = { low: 0, mid: 0, high: 0 };

  async function soundOn() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("이 주소에서는 브라우저가 마이크를 열지 않습니다. https 나 localhost 로 열어 주세요.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    context.createMediaStreamSource(stream).connect(analyser);
    const bins = new Float32Array(analyser.frequencyBinCount);
    const hz = context.sampleRate / analyser.fftSize;
    const band = (from, to) => [Math.max(1, Math.round(from / hz)), Math.round(to / hz)];
    audio = {
      stream,
      context,
      analyser,
      bins,
      bands: { low: band(40, 200), mid: band(200, 2000), high: band(2000, 8000) },
      // Each band learns its own quiet and its own loud, so a quiet room
      // still moves the knobs and a loud one does not pin them.
      floor: { low: -70, mid: -70, high: -70 },
      peak: { low: -40, mid: -40, high: -40 },
    };
  }

  function soundOff() {
    if (!audio) return;
    audio.stream.getTracks().forEach((t) => t.stop());
    audio.context.close();
    audio = null;
    level.low = level.mid = level.high = 0;
    pushed.fill(0);
    showKnobs();
  }

  function listen(dt) {
    if (!audio) return;
    audio.analyser.getFloatFrequencyData(audio.bins);
    for (const name of ["low", "mid", "high"]) {
      const [a, b] = audio.bands[name];
      let sum = 0;
      for (let k = a; k <= b; k++) sum += audio.bins[k];
      const db = sum / (b - a + 1);
      audio.floor[name] = Math.min(db, audio.floor[name] + dt * 2);
      audio.peak[name] = Math.max(db, audio.peak[name] - dt * 4, audio.floor[name] + 12);
      const target = Math.min(1, Math.max(0, (db - audio.floor[name]) / (audio.peak[name] - audio.floor[name])));
      // Fast up, slow down, like the extension's attack and damping.
      const rate = target > level[name] ? 18 : 3;
      level[name] += (target - level[name]) * Math.min(1, dt * rate);
    }
    SOUND.forEach((s, i) => {
      pushed[i] = s ? level[s.band] * s.reach * span(i) : 0;
    });
    showKnobs();
  }

  if (soundButton) {
    soundButton.addEventListener("click", async () => {
      if (audio) {
        soundOff();
        soundButton.textContent = "마이크 켜기";
        soundButton.setAttribute("aria-pressed", "false");
        soundNote.textContent = "";
        return;
      }
      soundButton.disabled = true;
      try {
        await soundOn();
        soundButton.textContent = "마이크 끄기";
        soundButton.setAttribute("aria-pressed", "true");
        soundNote.textContent = "저음은 속도를, 고음은 색을 돌립니다.";
        if (paused) togglePause();
      } catch (error) {
        soundNote.textContent =
          error && error.name === "NotAllowedError" ? "마이크를 허용하지 않아 열지 못했습니다." : error.message || String(error);
      } finally {
        soundButton.disabled = false;
      }
    });
  }

  // ── Running ───────────────────────────────────────────────────────────────
  const pauseButton = document.querySelector("[data-pause]");
  const nextButton = document.querySelector("[data-next]");
  let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let onScreen = true;
  let time = 0;
  let last = performance.now();

  function step(dt) {
    const p = patterns[active];
    const values = [0, 1, 2, 3].map(value);
    const input = {
      knobDeltas: deltas.slice(),
      knobValues: values,
      knobNormalized: values.map((v, i) => (v - RANGES[i][0]) / span(i)),
      knobRanges: RANGES,
      btnPressed: [false, false, false, false],
      btnHeld: [false, false, false, false],
    };
    deltas.fill(0);
    params.knobValues = input.knobValues;
    params.knobNormalized = input.knobNormalized;
    params.knobDeltas = input.knobDeltas;
    params.knobRanges = input.knobRanges;
    params.btnPressed = input.btnPressed;
    params.btnHeld = input.btnHeld;
    try {
      p.module.update && p.module.update(dt, input, params);
      pixels.fill(0);
      p.module.draw(display, params, time);
    } catch (error) {
      console.error(`${p.name}:`, error);
      load(active + 1);
      return;
    }
    paint();
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (onScreen) {
      listen(dt);
      if (!paused) {
        time += dt;
        step(dt);
      }
    }
    requestAnimationFrame(tick);
  }

  function togglePause() {
    paused = !paused;
    pauseButton.textContent = paused ? "재생" : "멈춤";
    pauseButton.setAttribute("aria-pressed", String(paused));
  }

  pauseButton.addEventListener("click", togglePause);
  nextButton.addEventListener("click", () => {
    load(active + 1);
    step(0);
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
    }).observe(panel);
  }

  load(0);
  if (paused) {
    pauseButton.textContent = "재생";
    pauseButton.setAttribute("aria-pressed", "true");
  }
  step(1 / 30);
  requestAnimationFrame(tick);
})();

// ── Film ────────────────────────────────────────────────────────────────────
// The poster is a photo in this folder. YouTube loads only after a press.
(() => {
  const button = document.querySelector("[data-film]");
  if (!button) return;
  button.addEventListener("click", () => {
    const frame = document.createElement("iframe");
    frame.src = `https://www.youtube-nocookie.com/embed/${button.dataset.film}?autoplay=1&rel=0&playsinline=1`;
    frame.title = button.getAttribute("aria-label") || "영상";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    button.replaceWith(frame);
  });
})();
