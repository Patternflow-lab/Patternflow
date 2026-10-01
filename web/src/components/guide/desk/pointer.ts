// The desk's guiding pointer: a drawn cursor that glides to a control in one
// of the desk's windows, shows a press, and parks there with a gentle pulse
// while the reader does it. This file only moves and draws it — imperatively,
// once a frame, on elements DeskStage renders — and never touches what is
// under it (the layer takes no pointer events). What it aims at and when is
// the tutorial's (runner.ts).
//
// Coordinates: an aim answers in page (viewport) px; the pointer lives in the
// desk's layer and draws in the desk's own px (page minus the desk's box).

/** Something to aim at, asked again every frame. */
export type Aim = {
  /** The target's box in page px, or null when it isn't there (the pointer hides). */
  rect: () => DOMRect | null;
  /** The window's visible content box in page px: the pointer never leaves it. */
  box: () => DOMRect | null;
  /** Where on the target the tip rests, as fractions of its box. */
  at?: [number, number];
  /** Where the hint sits: below right of the tip (default), above the target, or left of it. */
  bubble?: "above" | "left";
  /** The target (page px) is what the reader sees there, not covered by another window: the halo rings it only then. */
  shows?: (target: DOMRect) => boolean;
};

export type PointerEls = {
  /** The desk's layer (its box is the desk's). */
  layer: HTMLElement;
  cursor: HTMLElement;
  /** An expanding ring at the tip: a press. */
  ripple: HTMLElement;
  /** The rectangle around the target while the pointer waits for the reader. */
  halo: HTMLElement;
  bubble: HTMLElement;
  bubbleText: HTMLElement;
  bubbleChip: HTMLElement;
};

type Pt = { x: number; y: number };

type Tween = { from: Pt; t0: number; dur: number; arc: number; done: () => void };

const EDGE = 5;

function clamp(v: number, lo: number, hi: number) {
  return hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v));
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Where the tip rests on a target: `at` of its box, but a big target (a panel, an editor) gets its top-left part, not its middle. */
function tipOn(r: DOMRect, at: [number, number] | undefined): Pt {
  const [fx, fy] = at ?? [0.5, 0.6];
  const dx = at ? r.width * fx : Math.min(r.width * fx, 64);
  const dy = at ? r.height * fy : Math.min(r.height * fy, 26);
  return { x: r.left + dx, y: r.top + dy };
}

export class Pointer {
  private els: PointerEls;
  private reduced: () => boolean;
  private aim: Aim | null = null;
  private pos: Pt = { x: 0, y: 0 };
  private shown = false;
  private tween: Tween | null = null;
  private raf = 0;
  private waiting = false;
  private pressed = false;
  private bubbleSize = { w: 0, h: 0 };
  private dead = false;

  constructor(els: PointerEls, reduced: () => boolean) {
    this.els = els;
    this.reduced = reduced;
  }

  // ── what to aim at ─────────────────────────────────────────────────────────

  /**
   * Glide to `aim` (or, with null, fade out where it is). Resolves when the
   * tip has arrived — at once under reduced motion, or if the target isn't
   * there (the pointer stays hidden and follows it if it turns up).
   */
  goTo(aim: Aim | null): Promise<void> {
    this.aim = aim;
    this.finishTween();
    if (!aim) {
      this.setShown(false);
      return Promise.resolve();
    }
    const dest = this.dest();
    if (!dest) {
      this.setShown(false);
      this.kick();
      return Promise.resolve();
    }
    if (!this.shown) {
      // Coming in from nothing: appear a little below right of the target, then glide on.
      this.pos = this.clampTo({ x: dest.pt.x + 70, y: dest.pt.y + 84 }, dest.box);
      this.setShown(true);
    }
    return this.startTween(dest.pt);
  }

  /** "Show me again": the same aim, from a little way off. */
  replayFrom(): Promise<void> {
    const dest = this.dest();
    if (!this.aim || !dest) return Promise.resolve();
    this.finishTween();
    this.pos = this.clampTo({ x: dest.pt.x + 90, y: dest.pt.y + 96 }, dest.box);
    this.setShown(true);
    this.paint();
    return this.startTween(dest.pt);
  }

  // ── gestures ───────────────────────────────────────────────────────────────

  /** A press: the cursor dips, a ring goes out from the tip. */
  press(): Promise<void> {
    if (!this.shown) return Promise.resolve();
    this.ring();
    this.els.cursor.dataset.press = "1";
    return new Promise((resolve) => {
      window.setTimeout(() => {
        if (!this.pressed) delete this.els.cursor.dataset.press;
        resolve();
      }, 230);
    });
  }

  /** Stop where it is, mid-glide (the reader did it before the pointer got there). */
  halt() {
    const box = this.aim?.box;
    this.finishTween();
    if (!box || !this.shown) return;
    const p = { ...this.pos };
    const layer = this.els.layer;
    this.aim = {
      rect: () => {
        const o = layer.getBoundingClientRect();
        return new DOMRect(o.left + p.x, o.top + p.y, 0, 0);
      },
      box,
      at: [0, 0],
    };
    this.kick();
  }

  /** Held down (a drag). */
  hold(on: boolean) {
    this.pressed = on;
    if (on) this.els.cursor.dataset.press = "1";
    else delete this.els.cursor.dataset.press;
  }

  /** A gesture that lasts: "scroll" bobs the cursor, "type" blinks a caret at it. */
  mode(m: "scroll" | "type" | null) {
    if (m) this.els.cursor.dataset.mode = m;
    else delete this.els.cursor.dataset.mode;
  }

  /** Parked on the target, waiting for the reader: the halo and the pulse. */
  setWaiting(on: boolean) {
    this.waiting = on;
    this.els.layer.dataset.waiting = on ? "1" : "0";
    if (!on) this.els.halo.dataset.on = "0";
    this.kick();
  }

  /** The reader did it: one ring, the halo goes. */
  ack() {
    this.setWaiting(false);
    if (this.shown) this.ring();
  }

  /** The hint beside the pointer, and a keys chip in it ("Ctrl V"). */
  say(text: string | null, chip: string | null = null) {
    const { bubble, bubbleText, bubbleChip } = this.els;
    bubbleText.textContent = text ?? "";
    bubbleChip.textContent = chip ?? "";
    bubbleChip.hidden = !chip;
    const on = Boolean(text || chip);
    bubble.dataset.on = on ? "1" : "0";
    this.bubbleSize = on ? { w: bubble.offsetWidth, h: bubble.offsetHeight } : { w: 0, h: 0 };
    this.kick();
  }

  destroy() {
    this.dead = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.finishTween();
  }

  // ── the frame ──────────────────────────────────────────────────────────────

  private ring() {
    const r = this.els.ripple;
    r.dataset.on = "0";
    void r.offsetWidth; // restart the animation
    r.dataset.on = "1";
  }

  private startTween(to: Pt): Promise<void> {
    const dist = Math.hypot(to.x - this.pos.x, to.y - this.pos.y);
    if (this.reduced() || dist < 2) {
      this.pos = to;
      this.paint();
      this.kick();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.tween = {
        from: { ...this.pos },
        t0: performance.now(),
        dur: clamp(380 + dist * 0.55, 460, 1150),
        // A slight curve, as a hand moves; bigger for a longer way.
        arc: Math.min(56, dist * 0.12) * (to.x >= this.pos.x ? -1 : 1),
        done: resolve,
      };
      this.kick();
    });
  }

  private finishTween() {
    const t = this.tween;
    this.tween = null;
    t?.done();
  }

  private setShown(on: boolean) {
    if (this.shown === on) return;
    this.shown = on;
    this.els.layer.dataset.shown = on ? "1" : "0";
    if (!on) this.els.halo.dataset.on = "0";
  }

  /** Where the tip should be now, in desk px, and the window box it must stay in (desk px). */
  private dest(): { pt: Pt; box: DOMRect; target: DOMRect | null; lit: boolean } | null {
    const aim = this.aim;
    if (!aim) return null;
    let r: DOMRect | null = null;
    let b: DOMRect | null = null;
    try {
      r = aim.rect();
      b = aim.box();
    } catch {
      return null;
    }
    if (!r || !b || b.width < 8 || b.height < 8) return null;
    const o = this.els.layer.getBoundingClientRect();
    const box = new DOMRect(b.left - o.left, b.top - o.top, b.width, b.height);
    const tr = new DOMRect(r.left - o.left, r.top - o.top, r.width, r.height);
    const tip = tipOn(tr, aim.at);
    // Only asked while the halo could show: it hit-tests the page.
    let lit = true;
    if (this.waiting && !this.tween && aim.shows) {
      try {
        lit = aim.shows(r);
      } catch {
        lit = true;
      }
    }
    return { pt: this.clampTo(tip, box), box, target: tr, lit };
  }

  private clampTo(p: Pt, box: DOMRect): Pt {
    return {
      x: clamp(p.x, box.left + EDGE, box.right - EDGE - 10),
      y: clamp(p.y, box.top + EDGE, box.bottom - EDGE - 14),
    };
  }

  private kick() {
    if (!this.raf && !this.dead) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    const d = this.dest();
    if (!d) {
      // The target isn't there (yet, or any more): hidden, still looking.
      if (this.tween) this.finishTween();
      this.setShown(false);
    } else {
      if (!this.shown) {
        this.pos = this.clampTo({ x: d.pt.x + 70, y: d.pt.y + 84 }, d.box);
        this.setShown(true);
        if (this.reduced()) this.pos = d.pt;
        else {
          const done = () => {};
          const dist = Math.hypot(d.pt.x - this.pos.x, d.pt.y - this.pos.y);
          this.tween = { from: { ...this.pos }, t0: now, dur: clamp(380 + dist * 0.55, 460, 1150), arc: 0, done };
        }
      }
      const tw = this.tween;
      if (tw) {
        const t = Math.min(1, (now - tw.t0) / tw.dur);
        const e = easeInOut(t);
        const dx = d.pt.x - tw.from.x;
        const dy = d.pt.y - tw.from.y;
        const len = Math.hypot(dx, dy) || 1;
        const bend = Math.sin(Math.PI * t) * tw.arc;
        this.pos = {
          x: tw.from.x + dx * e + (-dy / len) * bend,
          y: tw.from.y + dy * e + (dx / len) * bend,
        };
        if (t >= 1) {
          this.pos = d.pt;
          this.finishTween();
        }
      } else {
        this.pos = d.pt;
      }
      this.paint(d.target, d.box, d.lit);
    }
    if (this.aim || this.tween) this.kick();
  };

  private paint(target?: DOMRect | null, box?: DOMRect, lit = true) {
    const { cursor, ripple, halo, bubble, layer } = this.els;
    const x = this.pos.x;
    const y = this.pos.y;
    cursor.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    ripple.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;

    // The halo: the target, cut to the window it is in — and none on a target another window covers.
    if (!lit) halo.dataset.on = "0";
    else if (this.waiting && target && box && !this.tween) {
      const pad = 4;
      const l = Math.max(target.left - pad, box.left + 1);
      const t = Math.max(target.top - pad, box.top + 1);
      const r = Math.min(target.right + pad, box.right - 1);
      const b = Math.min(target.bottom + pad, box.bottom - 1);
      if (r - l > 6 && b - t > 6) {
        halo.style.transform = `translate3d(${l.toFixed(1)}px, ${t.toFixed(1)}px, 0)`;
        halo.style.width = `${(r - l).toFixed(1)}px`;
        halo.style.height = `${(b - t).toFixed(1)}px`;
        halo.dataset.on = "1";
      } else halo.dataset.on = "0";
    } else if (this.tween) halo.dataset.on = "0";

    // The bubble: below right of the tip, flipped to stay on the desk — or,
    // where the beat asks, above the target or left of it, off what the
    // reader has to read next to it.
    if (bubble.dataset.on === "1") {
      const W = layer.clientWidth;
      const H = layer.clientHeight;
      const { w, h } = this.bubbleSize;
      const side = this.aim?.bubble;
      let bx = x + 20;
      let by = y + 26;
      let placed = false;
      if (side === "above" && target) {
        const top = target.top - 10 - h;
        if (top >= 8) {
          bx = x - Math.min(40, w * 0.25);
          by = top;
          placed = true;
        }
      } else if (side === "left" && target) {
        const left = target.left - 12 - w;
        if (left >= 8) {
          bx = left;
          by = target.top + target.height / 2 - h / 2;
          placed = true;
        }
      }
      if (!placed) {
        if (bx + w > W - 8) bx = x - 12 - w;
        if (by + h > H - 8) by = y - 12 - h;
      }
      bx = clamp(bx, 8, W - 8 - w);
      by = clamp(by, 8, H - 8 - h);
      bubble.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
    }
  }
}
