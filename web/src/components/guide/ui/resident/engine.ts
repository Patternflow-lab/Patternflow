import { COLS, framePath, type Eyes, type Pose } from "./sprite";

// How the resident moves. It stands on a line and is told where along it to
// be (walkTo); it gets there on its own feet — a quick start, a run, a short
// stop — and hops whatever gaps the line has on the way. Told to hop, it
// hops. Left alone it blinks, and after a while it sits down.
//
// It costs nothing while it is still: the frame loop below runs only between
// a walkTo (or a hop) and the figure coming to rest, and what it does in a
// frame is a few sums and one transform. At rest there is a timer for the
// next blink and nothing else. A frame of the figure is one `d` on one path,
// written only when the frame changes.

export type ResidentSetup = {
  /** Pixels a cell: the figure is 7 × 6 of them. */
  scale: number;
  /** How high a hop goes, px. */
  hop: number;
  /** Left alone this long it sits down, ms. */
  sitAfter: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class Resident {
  /** The figure's width, px. */
  readonly width: number;
  /** Where its container's left edge is on the screen (for the glance: the pointer's x is the screen's). */
  private origin = 0;
  /** Nothing moves (prefers-reduced-motion): it is put where it belongs and stands. */
  still = false;

  private x = 0;
  private target = 0;
  private placed = false;
  private raf = 0;
  private last = 0;
  private vmax = 0;
  private going = 0;
  private walked = 0;
  private stepClock = 0;
  private foot = false;
  private dir = 1;
  private hopT = -1;
  private look: -1 | 0 | 1 = 0;
  private blinking = false;
  private sat = false;
  private restful = true;
  private gaps: number[] = [];
  private gapHalf = 0;
  private blinkTimer = 0;
  private sitTimer = 0;
  private shownFrame = "";
  private shownAt = "";

  constructor(
    private el: HTMLElement,
    private path: SVGPathElement,
    private setup: ResidentSetup,
  ) {
    this.width = COLS * setup.scale;
  }

  /** Where it is (or is going), by its middle, on the screen. */
  get centre() {
    return this.origin + this.target + this.width / 2;
  }
  /** Its container's left edge on the screen, and (when its line is not the container's own edge) how far down the container its head is. */
  setGround(origin: number, top?: number) {
    this.origin = origin;
    if (top !== undefined) this.el.style.top = `${Math.round(top)}px`;
  }
  get isPlaced() {
    return this.placed;
  }

  /** The gaps in the line it stands on, each by its middle (where the figure's middle crosses), and how far either side a hop over one reaches. */
  setGaps(middles: number[], half: number) {
    this.gaps = middles;
    this.gapHalf = half;
  }

  /** Put it there, now: its first place, a place after the window changed, every place under reduced motion. */
  place(x: number) {
    this.x = this.target = Math.round(x);
    if (!this.placed) {
      this.placed = true;
      this.el.dataset.on = "1";
    }
    if (!this.raf) {
      this.draw(false, false);
      this.rest();
    }
  }

  /** Its place has moved under it (the window changed size): there now — or, on its way somewhere, on its way to there. */
  put(x: number) {
    if (this.placed && this.raf && !this.still) this.walkTo(x);
    else this.place(x);
  }

  /** Walk there. */
  walkTo(x: number) {
    x = Math.round(x);
    if (!this.placed || this.still) return this.place(x);
    if (x === this.target) return;
    this.target = x;
    // Any trip takes about as long: a step along the rail is a scurry, the hub's width a dash.
    this.vmax = clamp(Math.abs(x - this.x) / 0.55, 150, 1400);
    this.going = 0;
    this.wake();
    this.start();
  }

  /** A hop on the spot (or in its stride). */
  hop() {
    if (!this.placed || this.still) return;
    if (this.hopT < 0) this.hopT = 0;
    this.wake();
    this.start();
  }

  /** Which way the eyes go: −1 left, 1 right, 0 straight ahead. Looking does not get it up. */
  glance(dir: -1 | 0 | 1) {
    if (this.still || this.look === dir) return;
    this.look = dir;
    if (!this.raf && this.placed) this.draw(false, false);
  }

  /** Whether it may sit down when left alone (not while it is holding a choice). */
  setRestful(on: boolean) {
    if (this.restful === on) return;
    this.restful = on;
    if (!this.placed || this.raf) return;
    if (!on) {
      this.sat = false;
      this.draw(false, false);
    }
    this.rest();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.wake();
  }

  private wake() {
    window.clearTimeout(this.blinkTimer);
    window.clearTimeout(this.sitTimer);
    this.blinking = false;
    this.sat = false;
  }

  /** At rest: the next blink, and sitting down. */
  private rest() {
    window.clearTimeout(this.blinkTimer);
    window.clearTimeout(this.sitTimer);
    if (this.still) return;
    const blink = () => {
      this.blinking = true;
      this.draw(false, false);
      this.blinkTimer = window.setTimeout(() => {
        this.blinking = false;
        this.draw(false, false);
        this.blinkTimer = window.setTimeout(blink, 2400 + Math.random() * 3600);
      }, 140);
    };
    this.blinkTimer = window.setTimeout(blink, 1600 + Math.random() * 3000);
    if (this.restful && !this.sat && this.setup.sitAfter > 0) {
      this.sitTimer = window.setTimeout(() => {
        this.sat = true;
        this.draw(false, false);
      }, this.setup.sitAfter);
    }
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    const left = this.target - this.x;
    const moving = Math.abs(left) > 0.5;
    if (moving) {
      this.going += dt;
      this.dir = left > 0 ? 1 : -1;
      // Off the mark in a seventh of a second; the last stretch slows to the place.
      const v = Math.min(this.vmax * Math.min(1, 0.2 + this.going / 0.14), Math.max(70, Math.abs(left) * 10));
      const step = Math.min(Math.abs(left), v * dt);
      this.x += this.dir * step;
      // A foot a stride, and never faster than the eye can count them.
      this.walked += step;
      this.stepClock += dt;
      if (this.walked >= this.setup.scale * 3 && this.stepClock >= 0.075) {
        this.foot = !this.foot;
        this.walked = 0;
        this.stepClock = 0;
      }
    } else {
      this.x = this.target;
    }
    let air = false;
    if (this.hopT >= 0) {
      this.hopT += dt / 0.36;
      if (this.hopT >= 1) this.hopT = -1;
      else air = true;
    }
    this.draw(moving, air);
    if (moving || air) {
      this.raf = requestAnimationFrame(this.tick);
    } else {
      this.raf = 0;
      this.rest();
    }
  };

  private draw(moving: boolean, air: boolean) {
    let y = 0;
    if (air) y = -this.setup.hop * 4 * this.hopT * (1 - this.hopT);
    if (moving) {
      // Over a gap in the line: up and across.
      const c = this.x + this.width / 2;
      for (const g of this.gaps) {
        const t = (c - (g - this.gapHalf)) / (2 * this.gapHalf);
        if (t > 0 && t < 1) {
          y = Math.min(y, -this.setup.hop * Math.sin(Math.PI * t));
          air = true;
        }
      }
      // A step has a little lift in it.
      if (!air && this.foot) y = -1;
    }
    const pose: Pose = air ? "hop" : moving ? (this.foot ? "stepA" : "stepB") : this.sat ? "sit" : "stand";
    const eyes: Eyes = moving ? (this.dir > 0 ? "right" : "left") : this.blinking ? "shut" : this.look < 0 ? "left" : this.look > 0 ? "right" : "mid";
    const frame = `${pose}:${eyes}`;
    if (frame !== this.shownFrame) {
      this.shownFrame = frame;
      this.path.setAttribute("d", framePath(pose, eyes));
    }
    // On whole pixels: its cells are square and stay sharp.
    const at = `translate3d(${Math.round(this.x)}px,${Math.round(y)}px,0)`;
    if (at !== this.shownAt) {
      this.shownAt = at;
      this.el.style.transform = at;
    }
  }
}
