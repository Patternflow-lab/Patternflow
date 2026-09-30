// The panel's own screens - BRIGHTNESS, NETWORK, KNOB MAP, SELECT and UPDATE -
// drawn into a browser frame buffer exactly the way the firmware draws them,
// for the usage guide's device simulator.
//
// Source of truth is the firmware, not a picture of it:
//   firmware/patternflow/patternflow.ino       the screens and the input handling
//   firmware/patternflow/src/core_ui_text.h    drawLine / drawWrappedName / chrome line
//   firmware/patternflow/src/core_ui_fonts.h   which font each role uses
//   firmware/patternflow/lib/Adafruit_GFX      text layout, circles, setRotation
//   firmware/patternflow/src/hub75/ESP32-HUB75-MatrixPanel-I2S-DMA.h
//                                              drawPixel/fillRect overrides, the
//                                              rotation transform, RGB565 -> 888
// Line numbers cited here are from those files at v3.10.4. When a screen
// changes there, change it here - the test pins a few pixels so drift shows.
//
// Things the port reproduces on purpose, because the panel does them:
//  - Adafruit GFX's text wrap is on (the default; nothing in the firmware turns
//    it off), so on the 64 px portrait line an 11th size-1 character wraps to
//    x = 0 one line down. "TURN = SHOW" on the KNOB MAP and "patternflow" on
//    the hotspot/UPDATE screens are 11 characters and lose their last letter to
//    the next line on the real device, and long pattern names wrap
//    mid-word (see drawWrappedName below).
//  - The brightness notice draws in whatever rotation is current. In RUNNING
//    that is 0 - landscape, sideways on a panel stood in portrait - and in
//    SELECT it is 1, where "BRIGHTNESS nn%" wraps and its bar falls off the
//    bottom edge.
//
// Colours: every colour goes through Adafruit's color565() and back through
// the HUB75 driver's color565to888(), because that round trip is what reaches
// the DMA buffer (e.g. the LED orange 232,85,46 lands as 239,85,41). The
// driver's CIE-1931 luminance table and the canvas gamma are NOT applied: the
// frame here is for a screen, and the pattern pixels it arrives with are not
// gamma-corrected either.
//
// License: MIT. The two font tables this draws with are BSD - see glcdFont.ts
// and tomThumbFont.ts for their notices.

import { GLCD_FONT } from "./glcdFont";
import { TOM_THUMB, type GfxFont } from "./tomThumbFont";

export const PANEL_W = 128;
export const PANEL_H = 64;
const FRAME_BYTES = PANEL_W * PANEL_H * 4;

export type Rgb = readonly [number, number, number];
/** Adafruit GFX rotation. 0 = landscape 128x64 (patterns), 1 = the device's portrait 64x128 (its menus). */
export type Rotation = 0 | 1 | 2 | 3;

/** Values PatternflowWifi::statusText() returns (src/core_wifi.h:613-625, 657). */
export type WifiStatusText = "CONNECTED" | "CONNECTING" | "NO SSID" | "AUTH FAIL" | "OFF";

export type PanelOverlay =
  | {
      kind: "brightness";
      /** What the panel prints: brightnessPercent(level), patternflow.ino:693. */
      percent: number;
      /**
       * false (default): the RUNNING-mode notice, drawn in rotation 0 - landscape,
       * reading sideways on a portrait panel (patternflow.ino:1898-1900).
       * true: the notice as SELECT draws it, after the SELECT overlay in rotation 1
       * (patternflow.ino:1978-1980). Draw the select overlay first, then this.
       */
      portrait?: boolean;
      /** Only while the power clamp is holding brightness down (patternflow.ino:715-729). */
      powerLimit?: { allowedPercent: number; estimateMa: number };
    }
  | {
      kind: "network";
      /** statusText(): CONNECTED / CONNECTING / NO SSID / AUTH FAIL (OFF when Wi-Fi is compiled out). */
      wifi: WifiStatusText | (string & {});
      /** ipString(): the dotted IP, or "-" when not connected (src/core_wifi.h:629-632). */
      ip: string;
      /** Feature toggle rows; a core build has none. At most two are drawn (patternflow.ino:759). */
      rows?: { name: string; on: boolean }[];
      /** The hotspot's name, e.g. "patternflow-a1b2", when the panel's own AP is up. Shown only while not connected. */
      hotspotName?: string;
      /** PatternflowWifi::isConnected(). Defaults to wifi === "CONNECTED". */
      connected?: boolean;
      /** "K1 = SLEEP" line; true unless a build compiles sleep out (config.h:247-248). */
      sleepHint?: boolean;
      /** "K4=UPDATE" line; true unless a build compiles the web update out (net_config.h:172-173). */
      updateHint?: boolean;
    }
  | {
      kind: "knobmap";
      /** 0..3 = K1..K4, the knob being turned (lit for FIRMWARE.knobmapHighlightMs after each detent). */
      activeKnob: number | null;
      /** More than one knob can be lit at once on the device; merged with activeKnob. */
      activeKnobs?: readonly number[];
    }
  | {
      kind: "select";
      /** 1-based rank among visible patterns (visiblePatternRank, patternflow.ino:1040-1045). */
      rank: number;
      /** Number of visible patterns (visiblePatternCount, patternflow.ino:1033-1038). */
      count: number;
      /** The pattern's name as stored; folded to ASCII the way the panel does. */
      name: string;
    }
  | {
      kind: "update";
      /** idle = waiting for a .bin (the screen NETWORK -> turn K4 opens); flashing; done = rebooting. */
      phase?: "idle" | "flashing" | "done";
      /** Upload progress while flashing. */
      percent?: number;
      /** Idle, after a failed upload. */
      failed?: boolean;
      wifi?: WifiStatusText | (string & {});
      ip?: string;
      connected?: boolean;
    };

// ── Firmware constants ──────────────────────────────────────────────────────

const DEFAULT_BRIGHTNESS = 204; // firmware/patternflow/config.h:241 ("80%")

/** The percentage the panel prints for a brightness byte (patternflow.ino:693). */
export function brightnessPercent(level: number): number {
  return Math.trunc((level * 100 + 127) / 255);
}

export interface FirmwareConstants {
  longPressMs: number;
  buttonDebounceMs: number;
  edgesPerDetent: number;
  brightnessIdleExitMs: number;
  brightnessSaveDelayMs: number;
  networkIdleExitMs: number;
  knobmapIdleExitMs: number;
  knobmapHighlightMs: number;
  updateIdleExitMs: number;
  infoRedrawMs: number;
  selectDetentsPerStep: number;
  selectSettleMs: number;
  patternSaveDelayMs: number;
  contentNoticeMs: number;
  brightnessMin: number;
  brightnessMax: number;
  brightnessStepPerDetent: number;
  defaultBrightness: number;
  defaultBrightnessPercent: number;
  networkMaxFeatureRows: number;
  wakeGuardMs: number;
}

export const FIRMWARE: Readonly<FirmwareConstants> = Object.freeze({
  // MODE_HOLD_MS, patternflow.ino:269. Fires WHILE still held, on the first
  // frame the hold exceeds it (strict >, src/core_encoders.h:172); the release
  // that follows is not a click (core_encoders.h:151-154).
  longPressMs: 1000,
  // Button edges closer than this are ignored (src/core_encoders.h:143).
  buttonDebounceMs: 50,
  // Quadrature edges per detent (knobSubSteps default, src/core_encoders.h:76);
  // one detent = one knob delta (patternflow.ino:1168-1182, no acceleration).
  edgesPerDetent: 4,
  // BRIGHTNESS_IDLE_MS, patternflow.ino:270; checked with > at :1566. The timer
  // restarts on entry (:1539) and only when a turn actually changes the level
  // (:1555-1559) - turning against the 5/255 clamp does not keep it open.
  brightnessIdleExitMs: 5000,
  // BRIGHTNESS_SAVE_DELAY_MS, patternflow.ino:273 (NVS write after the mode closes).
  brightnessSaveDelayMs: 3000,
  // OSC_INFO_IDLE_MS (the NETWORK screen's timer despite the name), patternflow.ino:274, :1658.
  networkIdleExitMs: 8000,
  // KNOB_MAP_IDLE_MS, patternflow.ino:276, :1687.
  knobmapIdleExitMs: 8000,
  // KNOB_MAP_HILITE_MS, patternflow.ino:277; a knob stays lit this long after its last detent (:1005-1006).
  knobmapHighlightMs: 600,
  // UPDATE_IDLE_MS, patternflow.ino:278, :1711 (not while flashing).
  updateIdleExitMs: 600000,
  // NET_INFO_REDRAW_MS, patternflow.ino:275: info screens repaint at most this often (or on a change).
  infoRedrawMs: 250,
  // SELECT_DETENTS_PER_STEP, patternflow.ino:240; see stepSelect().
  selectDetentsPerStep: 3,
  // SELECT_SETTLE_MS, patternflow.ino:234: the highlighted pattern loads once K4 has rested this long (:1943).
  selectSettleMs: 350,
  // PATTERN_SAVE_DELAY_MS, patternflow.ino:207 (only once SELECT is left, :313).
  patternSaveDelayMs: 3000,
  // CONTENT_NOTICE_SECONDS, patternflow.ino:279 - the name card after a remote pick; SELECT never shows it.
  contentNoticeMs: 1000,
  // constrain(currentBrightness + d * 5, 5, 255), patternflow.ino:1554.
  brightnessMin: 5,
  brightnessMax: 255,
  brightnessStepPerDetent: 5,
  // DEFAULT_BRIGHTNESS, config.h:241 - a byte, not a percent.
  defaultBrightness: DEFAULT_BRIGHTNESS,
  // brightnessPercent(204) = 80.
  defaultBrightnessPercent: brightnessPercent(DEFAULT_BRIGHTNESS),
  // MAX_FEATURE_ROWS, patternflow.ino:759.
  networkMaxFeatureRows: 2,
  // WAKE_GUARD_MS, src/core_sleep.h:64: input ignored this long after falling asleep.
  wakeGuardMs: 800,
});

/** One K1 turn in BRIGHTNESS mode: `detents` is the frame's signed delta (patternflow.ino:1552-1561). */
export function stepBrightness(level: number, detents: number): number {
  const b = level + detents * FIRMWARE.brightnessStepPerDetent;
  return Math.min(FIRMWARE.brightnessMax, Math.max(FIRMWARE.brightnessMin, b));
}

/**
 * SELECT browsing: K4's detents accumulate and every whole 3 moves the
 * highlight; the signed remainder waits, so a turn back first eats it
 * (patternflow.ino:1907-1909 - C division truncates toward zero).
 */
export function stepSelect(accum: number, detents: number): { steps: number; accum: number } {
  const total = accum + detents;
  const steps = Math.trunc(total / FIRMWARE.selectDetentsPerStep);
  return { steps, accum: total - steps * FIRMWARE.selectDetentsPerStep };
}

/** Floored modulo the firmware wraps the highlight with (patternflow.ino:1917): SELECT wraps, never clamps. */
export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

// Fixed-size name buffers: MODULE_NAME_BYTES, firmware/patternflow/pattern_registry.h:139.
const MODULE_NAME_BYTES = 40;
const LATIN1_FOLD =
  "AAAAAAACEEEEIIII" + // C0-CF
  "DNOOOOOxOUUUUYPs" + // D0-DF
  "aaaaaaaceeeeiiii" + // E0-EF
  "dnooooo/ouuuuypy"; //  F0-FF

/**
 * A pattern name as the panel prints it: asciiFold (patternflow.ino:577-601)
 * over the UTF-8 bytes. Latin-1 letters lose their accent, anything else
 * becomes one '?'. Stored names live in 40-byte buffers (pattern_registry.h:139,
 * snprintf at :217), so at most 39 bytes of the name survive.
 */
export function asciiFold(name: string): string {
  const bytes = new TextEncoder().encode(name).subarray(0, MODULE_NAME_BYTES - 1);
  let out = "";
  let p = 0;
  while (p < bytes.length && bytes[p] !== 0 && out.length + 1 < MODULE_NAME_BYTES) {
    const c = bytes[p];
    if (c >= 0x20 && c <= 0x7e) {
      out += String.fromCharCode(c);
      p++;
    } else if (c === 0xc3 && p + 1 < bytes.length && bytes[p + 1] !== 0) {
      out += LATIN1_FOLD[bytes[p + 1] & 0x3f];
      p += 2;
    } else {
      out += "?";
      p++;
      while (p < bytes.length && (bytes[p] & 0xc0) === 0x80) p++;
    }
  }
  return out;
}

// ── Colour ──────────────────────────────────────────────────────────────────

/** Adafruit's color565 (hub75 ESP32-HUB75-MatrixPanel-I2S-DMA.h:1048-1051). */
export function color565(r: number, g: number, b: number): number {
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | ((b & 0xff) >> 3);
}

/** The HUB75 driver's color565to888 (ESP32-HUB75-MatrixPanel-I2S-DMA.h:991-999): what reaches the panel. */
export function color565to888(c: number): Rgb {
  let r = (c >> 8) & 0xf8;
  let g = (c >> 3) & 0xfc;
  let b = (c << 3) & 0xff;
  r |= r >> 5;
  g |= g >> 6;
  b |= b >> 5;
  return [r, g, b];
}

const rgb565 = (r: number, g: number, b: number): Rgb => color565to888(color565(r, g, b));

/** The firmware's panel palette, as it lands in the frame buffer. */
export const PANEL_COLORS = Object.freeze({
  black: rgb565(0, 0, 0),
  led: rgb565(232, 85, 46), //     pfLedC,   patternflow.ino:635
  white: rgb565(255, 255, 255), // pfWhiteC, :636
  gray: rgb565(140, 140, 140), //  pfGrayC,  :637
  dim: rgb565(90, 90, 90), //      pfDimC,   :638
  rule: rgb565(60, 60, 60), //     pfRuleC,  :639
  green: rgb565(80, 220, 130), //  pfGreenC, :640
  red: rgb565(255, 80, 80), //     pfRedC,   :641
  blue: rgb565(120, 180, 255), //  pfBlueC,  :642
  selectPage: rgb565(190, 190, 190), //    "i / N", :1054
  selectHint: rgb565(200, 200, 200), //    "HOLD TO SELECT", :1084
  knobActiveFill: rgb565(74, 27, 15), //   KNOB MAP active disc, :1009
});

// ── A small Adafruit GFX over an RGBA frame ─────────────────────────────────
//
// Only what the screens use, each routine ported from the vendored library
// (lib/Adafruit_GFX/Adafruit_GFX.cpp) or from the HUB75 driver where the
// driver overrides it. The driver clips every pixel against the physical
// panel after the rotation transform (updateMatrixDMABuffer, hlineDMA,
// vlineDMA), so per-pixel clipping here draws the same pixels.

const GLYPH_OFFSET = 0;
const GLYPH_WIDTH = 1;
const GLYPH_HEIGHT = 2;
const GLYPH_X_ADVANCE = 3;
const GLYPH_X_OFFSET = 4;
const GLYPH_Y_OFFSET = 5;

interface TextBounds {
  x1: number;
  y1: number;
  w: number;
  h: number;
}

/** Logical (x, y) in a rotation -> physical panel pixel (ESP32-HUB75-MatrixPanel-I2S-DMA.h:903-931). */
export function toPanelXY(rotation: Rotation, x: number, y: number): [number, number] {
  switch (rotation) {
    case 1:
      return [PANEL_W - 1 - y, x];
    case 2:
      return [PANEL_W - 1 - x, PANEL_H - 1 - y];
    case 3:
      return [y, PANEL_H - 1 - x];
    default:
      return [x, y];
  }
}

/** Text as the firmware's char* sees it: one byte per character. Non-Latin-1 becomes '?'. */
function textBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out.push(c <= 0xff ? c : 0x3f);
  }
  return out;
}

class PanelGfx {
  rotation: Rotation = 0;
  width = PANEL_W;
  height = PANEL_H;
  private cursorX = 0;
  private cursorY = 0;
  private textSize = 1;
  private textColor: Rgb = PANEL_COLORS.white;
  private font: GfxFont | null = null;
  // Adafruit_GFX's constructor sets wrap = true (Adafruit_GFX.cpp:117); the
  // firmware never calls setTextWrap, so every screen draws with it on.
  private readonly wrap = true;

  constructor(private readonly frame: Uint8ClampedArray) {}

  // Adafruit_GFX.cpp:1573-1587
  setRotation(r: number): void {
    this.rotation = (r & 3) as Rotation;
    const portrait = (this.rotation & 1) === 1;
    this.width = portrait ? PANEL_H : PANEL_W;
    this.height = portrait ? PANEL_W : PANEL_H;
  }

  drawPixel(x: number, y: number, color: Rgb): void {
    const [px, py] = toPanelXY(this.rotation, x, y);
    if (px < 0 || px >= PANEL_W || py < 0 || py >= PANEL_H) return;
    const i = (py * PANEL_W + px) * 4;
    const f = this.frame;
    f[i] = color[0];
    f[i + 1] = color[1];
    f[i + 2] = color[2];
    f[i + 3] = 255;
  }

  fillRect(x: number, y: number, w: number, h: number, color: Rgb): void {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) this.drawPixel(x + i, y + j, color);
    }
  }

  drawFastHLine(x: number, y: number, w: number, color: Rgb): void {
    this.fillRect(x, y, w, 1, color);
  }

  drawFastVLine(x: number, y: number, h: number, color: Rgb): void {
    this.fillRect(x, y, 1, h, color);
  }

  fillScreen(color: Rgb): void {
    for (let py = 0; py < PANEL_H; py++) {
      for (let px = 0; px < PANEL_W; px++) {
        const i = (py * PANEL_W + px) * 4;
        this.frame[i] = color[0];
        this.frame[i + 1] = color[1];
        this.frame[i + 2] = color[2];
        this.frame[i + 3] = 255;
      }
    }
  }

  // Adafruit_GFX.cpp:639-647
  drawRect(x: number, y: number, w: number, h: number, color: Rgb): void {
    this.drawFastHLine(x, y, w, color);
    this.drawFastHLine(x, y + h - 1, w, color);
    this.drawFastVLine(x, y, h, color);
    this.drawFastVLine(x + w - 1, y, h, color);
  }

  // Adafruit_GFX.cpp:472-509 (midpoint circle, 8-way symmetric)
  drawCircle(x0: number, y0: number, r: number, color: Rgb): void {
    let f = 1 - r;
    let ddFx = 1;
    let ddFy = -2 * r;
    let x = 0;
    let y = r;
    this.drawPixel(x0, y0 + r, color);
    this.drawPixel(x0, y0 - r, color);
    this.drawPixel(x0 + r, y0, color);
    this.drawPixel(x0 - r, y0, color);
    while (x < y) {
      if (f >= 0) {
        y--;
        ddFy += 2;
        f += ddFy;
      }
      x++;
      ddFx += 2;
      f += ddFx;
      this.drawPixel(x0 + x, y0 + y, color);
      this.drawPixel(x0 - x, y0 + y, color);
      this.drawPixel(x0 + x, y0 - y, color);
      this.drawPixel(x0 - x, y0 - y, color);
      this.drawPixel(x0 + y, y0 + x, color);
      this.drawPixel(x0 - y, y0 + x, color);
      this.drawPixel(x0 + y, y0 - x, color);
      this.drawPixel(x0 - y, y0 - x, color);
    }
  }

  // Adafruit_GFX.cpp:567-627 (fillCircle + fillCircleHelper, corners 3, delta 0)
  fillCircle(x0: number, y0: number, r: number, color: Rgb): void {
    this.drawFastVLine(x0, y0 - r, 2 * r + 1, color);
    let f = 1 - r;
    let ddFx = 1;
    let ddFy = -2 * r;
    let x = 0;
    let y = r;
    let px = x;
    let py = y;
    const delta = 1; // delta++ on the 0 fillCircle passes
    while (x < y) {
      if (f >= 0) {
        y--;
        ddFy += 2;
        f += ddFy;
      }
      x++;
      ddFx += 2;
      f += ddFx;
      if (x < y + 1) {
        this.drawFastVLine(x0 + x, y0 - y, 2 * y + delta, color);
        this.drawFastVLine(x0 - x, y0 - y, 2 * y + delta, color);
      }
      if (y !== py) {
        this.drawFastVLine(x0 + py, y0 - px, 2 * px + delta, color);
        this.drawFastVLine(x0 - py, y0 - px, 2 * px + delta, color);
        py = y;
      }
      px = x;
    }
  }

  // Adafruit_GFX.cpp:1595-1608 - the cursor shift is kept, although every
  // screen sets the cursor again before it prints.
  setFont(font: GfxFont | null): void {
    if (font) {
      if (!this.font) this.cursorY += 6;
    } else if (this.font) {
      this.cursorY -= 6;
    }
    this.font = font;
  }

  setTextSize(s: number): void {
    this.textSize = s > 0 ? s : 1;
  }

  // setTextColor(c) sets fg == bg, which is "no background" in drawChar.
  setTextColor(color: Rgb): void {
    this.textColor = color;
  }

  setCursor(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
  }

  // Adafruit_GFX.cpp:1705-1735 + charBounds 1628-1690
  getTextBounds(text: string, x: number, y: number): TextBounds {
    const b = { x, y, minx: 0x7fff, miny: 0x7fff, maxx: -1, maxy: -1 };
    for (const c of textBytes(text)) this.charBounds(c, b);
    const out: TextBounds = { x1: x, y1: y, w: 0, h: 0 };
    if (b.maxx >= b.minx) {
      out.x1 = b.minx;
      out.w = b.maxx - b.minx + 1;
    }
    if (b.maxy >= b.miny) {
      out.y1 = b.miny;
      out.h = b.maxy - b.miny + 1;
    }
    return out;
  }

  private charBounds(
    c: number,
    b: { x: number; y: number; minx: number; miny: number; maxx: number; maxy: number },
  ): void {
    const s = this.textSize;
    const font = this.font;
    if (font) {
      if (c === 0x0a) {
        b.x = 0;
        b.y += s * font.yAdvance;
      } else if (c !== 0x0d && c >= font.first && c <= font.last) {
        const g = font.glyphs[c - font.first];
        const gw = g[GLYPH_WIDTH];
        const gh = g[GLYPH_HEIGHT];
        const xo = g[GLYPH_X_OFFSET];
        const yo = g[GLYPH_Y_OFFSET];
        if (this.wrap && b.x + (xo + gw) * s > this.width) {
          b.x = 0;
          b.y += s * font.yAdvance;
        }
        const x1 = b.x + xo * s;
        const y1 = b.y + yo * s;
        const x2 = x1 + gw * s - 1;
        const y2 = y1 + gh * s - 1;
        if (x1 < b.minx) b.minx = x1;
        if (y1 < b.miny) b.miny = y1;
        if (x2 > b.maxx) b.maxx = x2;
        if (y2 > b.maxy) b.maxy = y2;
        b.x += g[GLYPH_X_ADVANCE] * s;
      }
      return;
    }
    if (c === 0x0a) {
      b.x = 0;
      b.y += s * 8;
    } else if (c !== 0x0d) {
      if (this.wrap && b.x + s * 6 > this.width) {
        b.x = 0;
        b.y += s * 8;
      }
      const x2 = b.x + s * 6 - 1;
      const y2 = b.y + s * 8 - 1;
      if (x2 > b.maxx) b.maxx = x2;
      if (y2 > b.maxy) b.maxy = y2;
      if (b.x < b.minx) b.minx = b.x;
      if (b.y < b.miny) b.miny = b.y;
      b.x += s * 6;
    }
  }

  print(text: string): void {
    for (const c of textBytes(text)) this.write(c);
  }

  /** The cursor after the last print, for callers that chain text. */
  cursor(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  // Adafruit_GFX.cpp:1499-1543
  private write(c: number): void {
    const s = this.textSize;
    const font = this.font;
    if (!font) {
      if (c === 0x0a) {
        this.cursorX = 0;
        this.cursorY += s * 8;
      } else if (c !== 0x0d) {
        if (this.wrap && this.cursorX + s * 6 > this.width) {
          this.cursorX = 0;
          this.cursorY += s * 8;
        }
        this.drawClassicChar(this.cursorX, this.cursorY, c, s);
        this.cursorX += s * 6;
      }
      return;
    }
    if (c === 0x0a) {
      this.cursorX = 0;
      this.cursorY += s * font.yAdvance;
    } else if (c !== 0x0d && c >= font.first && c <= font.last) {
      const g = font.glyphs[c - font.first];
      const w = g[GLYPH_WIDTH];
      const h = g[GLYPH_HEIGHT];
      if (w > 0 && h > 0) {
        const xo = g[GLYPH_X_OFFSET];
        if (this.wrap && this.cursorX + s * (xo + w) > this.width) {
          this.cursorX = 0;
          this.cursorY += s * font.yAdvance;
        }
        this.drawFontChar(font, this.cursorX, this.cursorY, c, s);
      }
      this.cursorX += g[GLYPH_X_ADVANCE] * s;
    }
  }

  // Adafruit_GFX.cpp:1391-1430, classic branch, fg == bg (no background).
  private drawClassicChar(x: number, y: number, code: number, s: number): void {
    if (x >= this.width || y >= this.height || x + 6 * s - 1 < 0 || y + 8 * s - 1 < 0) return;
    // cp437(false): glyphs from 176 up are read one along (unsigned char, so 255 wraps to 0).
    const c = code >= 176 ? (code + 1) & 0xff : code;
    for (let i = 0; i < 5; i++) {
      let line = GLCD_FONT[c * 5 + i];
      for (let j = 0; j < 8; j++, line >>= 1) {
        if (line & 1) {
          if (s === 1) this.drawPixel(x + i, y + j, this.textColor);
          else this.fillRect(x + i * s, y + j * s, s, s, this.textColor);
        }
      }
    }
  }

  // Adafruit_GFX.cpp:1432-1491, custom-font branch.
  private drawFontChar(font: GfxFont, x: number, y: number, code: number, s: number): void {
    const g = font.glyphs[code - font.first];
    let bo = g[GLYPH_OFFSET];
    const w = g[GLYPH_WIDTH];
    const h = g[GLYPH_HEIGHT];
    const xo = g[GLYPH_X_OFFSET];
    const yo = g[GLYPH_Y_OFFSET];
    const xo16 = s > 1 ? xo : 0;
    const yo16 = s > 1 ? yo : 0;
    let bits = 0;
    let bit = 0;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (!(bit++ & 7)) bits = font.bitmap[bo++];
        if (bits & 0x80) {
          if (s === 1) this.drawPixel(x + xo + xx, y + yo + yy, this.textColor);
          else this.fillRect(x + (xo16 + xx) * s, y + (yo16 + yy) * s, s, s, this.textColor);
        }
        bits = (bits << 1) & 0xff;
      }
    }
  }
}

// ── The firmware's drawing helpers ──────────────────────────────────────────

/** C integer division (truncates toward zero). */
const cdiv = (a: number, b: number) => Math.trunc(a / b);

// drawCenteredText, patternflow.ino:603-611. Uses whatever font is current -
// the built-in 5x7 on every screen here.
function drawCenteredText(g: PanelGfx, text: string, y: number, color: Rgb, size = 1): void {
  g.setTextSize(size);
  g.setTextColor(color);
  const { w } = g.getTextBounds(text, 0, 0);
  g.setCursor(cdiv(g.width - w, 2), y);
  g.print(text);
}

// drawCenteredTextScrim, patternflow.ino:618-628.
function drawCenteredTextScrim(g: PanelGfx, text: string, y: number, color: Rgb, size = 1): void {
  g.setTextSize(size);
  const { w, h } = g.getTextBounds(text, 0, 0);
  const x = cdiv(g.width - w, 2);
  g.fillRect(x - 2, y - 2, w + 4, h + 4, PANEL_COLORS.black);
  g.setTextColor(color);
  g.setCursor(x, y);
  g.print(text);
}

// drawScreenHeader, patternflow.ino:646-657: LED dot + title + hairline.
function drawScreenHeader(g: PanelGfx, title: string): void {
  g.setTextSize(1);
  const { w: tw } = g.getTextBounds(title, 0, 0);
  const x = cdiv(g.width - (tw + 6), 2);
  g.fillRect(x, 7, 2, 2, PANEL_COLORS.led);
  g.setTextColor(PANEL_COLORS.white);
  g.setCursor(x + 6, 4);
  g.print(title);
  g.drawFastHLine(4, 15, g.width - 8, PANEL_COLORS.rule);
}

// PatternflowUiText::drawLine, src/core_ui_text.h:369-379: centred, on a 2 px scrim.
function drawUiLine(g: PanelGfx, font: GfxFont | null, text: string, yTop: number, color: Rgb): void {
  g.setFont(font);
  g.setTextSize(1);
  const { x1, y1, w, h } = g.getTextBounds(text, 0, 0);
  const x = cdiv(g.width - w, 2);
  g.fillRect(x - 2, yTop - 2, w + 4, h + 4, PANEL_COLORS.black);
  g.setTextColor(color);
  g.setCursor(x - x1, yTop - y1);
  g.print(text);
}

// PatternflowUiText::drawWrappedName, src/core_ui_text.h:447-449 -> drawWrapped
// (:388-445) with PF_UI_FONT_SELECT = the built-in 5x7 (core_ui_fonts.h:50-52)
// and pitch 9 (:64-66).
//
// Only drawWrapped's first branch is ported, because it is the only one that
// runs: it measures the whole name with getTextBounds, and with GFX wrap on,
// the built-in font never measures wider than 60 px on a 64 px line - so
// `w <= width - 4` always holds, the word-wrap code below it is unreachable,
// and the name is printed in one go with GFX breaking it every 10 characters,
// mid-word, the first line at the centred x and the rest at x = 0, on an
// 8 px pitch. That is what the panel shows.
function drawWrappedName(g: PanelGfx, name: string, yMiddle: number, color: Rgb): void {
  const pitch = 9;
  drawUiLine(g, null, name, yMiddle - cdiv(pitch, 2), color);
}

function drawTextSplitIp(g: PanelGfx, ip: string, y0: number, y1: number): void {
  // "A full IPv4 (up to 15 chars) doesn't fit one portrait line - split after
  // the second octet's dot." patternflow.ino:800-807 (UPDATE: :951-958).
  if (ip.length <= 10) {
    drawCenteredText(g, ip, y0, PANEL_COLORS.gray);
  } else {
    const cut = ip.indexOf(".", ip.indexOf(".") + 1) + 1;
    drawCenteredText(g, ip.substring(0, cut), y0, PANEL_COLORS.gray);
    drawCenteredText(g, ip.substring(cut), y1, PANEL_COLORS.gray);
  }
}

// ── The screens ─────────────────────────────────────────────────────────────

// drawBrightnessNotice, patternflow.ino:691-730. No setRotation inside: it
// draws in the caller's rotation.
function drawBrightnessNotice(
  g: PanelGfx,
  percent: number,
  powerLimit?: { allowedPercent: number; estimateMa: number },
): void {
  const pct = Math.trunc(percent);
  const buf = `BRIGHTNESS ${pct}%`;
  g.setTextSize(1);
  const { w, h } = g.getTextBounds(buf, 0, 0);
  const x = cdiv(g.width - w, 2);
  const y = g.height - 16;
  g.fillRect(x - 2, y - 2, w + 4, h + 9, PANEL_COLORS.black);
  g.setTextColor(PANEL_COLORS.white);
  g.setCursor(x, y);
  g.print(buf);

  const by = y + h + 3;
  g.drawFastHLine(x, by, w, PANEL_COLORS.dim);
  const fw = cdiv(w * pct, 100);
  if (fw > 0) g.drawFastHLine(x, by, fw, PANEL_COLORS.led);

  if (powerLimit) {
    const aw = cdiv(w * Math.trunc(powerLimit.allowedPercent), 100);
    if (aw < fw) g.drawFastHLine(x + aw, by, fw - aw, PANEL_COLORS.dim);
    const lim = `PWR ${Math.trunc(powerLimit.estimateMa)}mA`;
    const lb = g.getTextBounds(lim, 0, 0);
    const lx = cdiv(g.width - lb.w, 2);
    const ly = y - lb.h - 3;
    g.fillRect(lx - 2, ly - 2, lb.w + 4, lb.h + 4, PANEL_COLORS.black);
    g.setTextColor(PANEL_COLORS.led);
    g.setCursor(lx, ly);
    g.print(lim);
  }
}

// drawNetworkInfo, patternflow.ino:739-852.
function drawNetworkInfo(g: PanelGfx, o: Extract<PanelOverlay, { kind: "network" }>): void {
  g.setRotation(1);
  g.fillScreen(PANEL_COLORS.black);
  const w = g.width;
  drawScreenHeader(g, "NETWORK");

  const rows = (o.rows ?? []).slice(0, FIRMWARE.networkMaxFeatureRows);
  g.setTextSize(1);
  rows.forEach((row, i) => {
    const y = 22 + i * 11;
    const st = row.on ? PANEL_COLORS.green : PANEL_COLORS.red;
    g.fillRect(8, y + 2, 2, 2, st);
    g.setTextColor(PANEL_COLORS.white);
    g.setCursor(14, y);
    g.print(row.name);
    const val = row.on ? "ON" : "OFF";
    const { w: tw } = g.getTextBounds(val, 0, 0);
    g.setTextColor(st);
    g.setCursor(w - 8 - tw, y);
    g.print(val);
  });

  const wifiUp = o.connected ?? o.wifi === "CONNECTED";
  if (!wifiUp && o.hotspotName) {
    drawCenteredText(g, "HOTSPOT", 50, PANEL_COLORS.green);
    const name = o.hotspotName;
    let dash = name.indexOf("-");
    if (dash < 0) dash = name.length;
    drawCenteredText(g, name.substring(0, dash), 62, PANEL_COLORS.white);
    drawCenteredText(g, name.substring(dash), 72, PANEL_COLORS.white);
  } else {
    drawCenteredText(g, o.wifi, 50, wifiUp ? PANEL_COLORS.green : PANEL_COLORS.blue);
    drawTextSplitIp(g, o.ip, 62, 72);
  }

  g.drawFastHLine(4, 82, w - 8, PANEL_COLORS.rule);
  const hints: [string, Rgb][] = [];
  if (rows.length > 0) {
    hints.push([rows.length > 1 ? "TURN K2/K3" : "TURN K2", PANEL_COLORS.dim]);
    // snprintf into char[16], patternflow.ino:822-831.
    const names = rows.length > 1 ? `${rows[0].name} / ${rows[1].name}` : rows[0].name;
    hints.push([names.slice(0, 15), PANEL_COLORS.dim]);
  }
  if (o.sleepHint ?? true) hints.push(["K1 = SLEEP", PANEL_COLORS.led]);
  if (o.updateHint ?? true) hints.push(["K4=UPDATE", PANEL_COLORS.dim]);
  hints.push(["K2 = EXIT", PANEL_COLORS.dim]);
  const HINT_Y = [86, 95, 105, 114, 123];
  hints.forEach(([text, color], i) => drawCenteredText(g, text, HINT_Y[i], color));
}

// drawUpdateScreen, patternflow.ino:910-967.
function drawUpdateScreen(g: PanelGfx, o: Extract<PanelOverlay, { kind: "update" }>): void {
  g.setRotation(1);
  g.fillScreen(PANEL_COLORS.black);
  const w = g.width;
  const h = g.height;
  drawScreenHeader(g, "UPDATE");
  const phase = o.phase ?? "idle";
  if (phase === "flashing") {
    const pct = Math.trunc(o.percent ?? 0);
    drawCenteredText(g, "FLASHING", 26, PANEL_COLORS.gray);
    drawCenteredText(g, `${pct}%`, 44, PANEL_COLORS.white, 2);
    const bx = 8;
    const by = 70;
    const bw = w - 16;
    g.drawRect(bx, by, bw, 7, PANEL_COLORS.rule);
    const fill = cdiv((bw - 4) * Math.min(100, Math.max(0, pct)), 100);
    if (fill > 0) g.fillRect(bx + 2, by + 2, fill, 3, PANEL_COLORS.led);
    g.drawFastHLine(4, h - 26, w - 8, PANEL_COLORS.rule);
    drawCenteredText(g, "KEEP POWER", h - 21, PANEL_COLORS.dim);
    drawCenteredText(g, "ON", h - 11, PANEL_COLORS.dim);
  } else if (phase === "done") {
    drawCenteredText(g, "DONE", 46, PANEL_COLORS.green);
    drawCenteredText(g, "REBOOTING", 60, PANEL_COLORS.white);
  } else {
    const wifi = o.wifi ?? "CONNECTED";
    const wifiUp = o.connected ?? wifi === "CONNECTED";
    if (o.failed) drawCenteredText(g, "FAILED", 21, PANEL_COLORS.red);
    else drawCenteredText(g, wifiUp ? "READY" : "NO WIFI", 21, wifiUp ? PANEL_COLORS.green : PANEL_COLORS.red);
    if (wifiUp) {
      drawCenteredText(g, "DROP .BIN:", 36, PANEL_COLORS.dim);
      drawCenteredText(g, "patternflow", 48, PANEL_COLORS.white); // PF_OTA_HOSTNAME, net_config.h:150
      drawCenteredText(g, ".local", 58, PANEL_COLORS.white);
      drawCenteredText(g, "/update", 68, PANEL_COLORS.white);
      drawTextSplitIp(g, o.ip ?? "-", 82, 92);
    } else {
      drawCenteredText(g, wifi, 52, PANEL_COLORS.blue);
    }
    g.drawFastHLine(4, h - 16, w - 8, PANEL_COLORS.rule);
    drawCenteredText(g, "K4 = EXIT", h - 11, PANEL_COLORS.dim);
  }
}

// drawKnobMap, patternflow.ino:973-1018. The active knob gets an LED-orange
// ring over a dark orange disc; its digit stays white.
function drawKnobMap(g: PanelGfx, active: readonly boolean[]): void {
  g.setRotation(1);
  g.fillScreen(PANEL_COLORS.black);
  const w = g.width;
  const h = g.height;

  const title = "KNOB MAP";
  g.setTextSize(1);
  const { w: tw } = g.getTextBounds(title, 0, 0);
  const tx = cdiv(w - (tw + 6), 2);
  const ty = cdiv(h, 2) - 10;
  g.fillRect(tx, ty + 3, 2, 2, PANEL_COLORS.led);
  g.setTextColor(PANEL_COLORS.white);
  g.setCursor(tx + 6, ty);
  g.print(title);
  drawCenteredText(g, "TURN = SHOW", cdiv(h, 2) + 2, PANEL_COLORS.dim);
  drawCenteredText(g, "K3 = EXIT", cdiv(h, 2) + 12, PANEL_COLORS.dim);

  // Front view: K1 top-right, K2 top-left, K3 bottom-right, K4 bottom-left.
  const cx = [w - 13, 13, w - 13, 13];
  const cy = [14, 14, h - 14, h - 14];
  for (let i = 0; i < 4; i++) {
    if (active[i]) g.fillCircle(cx[i], cy[i], 10, PANEL_COLORS.knobActiveFill);
    g.drawCircle(cx[i], cy[i], 10, active[i] ? PANEL_COLORS.led : PANEL_COLORS.white);
    g.setTextSize(1);
    g.setTextColor(PANEL_COLORS.white);
    g.setCursor(cx[i] - 2, cy[i] - 3);
    g.print(String.fromCharCode(0x31 + i));
  }
}

// drawSelectingMode, patternflow.ino:1047-1089, drawn after setRotation(1)
// (:1973) over the frame the pattern (or its thumbnail) already filled.
function drawSelectingMode(g: PanelGfx, rank: number, count: number, name: string): void {
  g.setRotation(1);
  const screenH = g.height;
  const visN = Math.trunc(count);
  const visI = Math.trunc(rank);

  drawCenteredTextScrim(g, `${visI} / ${visN}`, 10, PANEL_COLORS.selectPage);

  const trackW = 40;
  const tx = cdiv(g.width - trackW, 2);
  const ty = 23;
  g.fillRect(tx - 2, ty - 2, trackW + 4, 5, PANEL_COLORS.black);
  g.drawFastHLine(tx, ty, trackW, PANEL_COLORS.dim);
  const mx = visN > 1 ? tx + cdiv((trackW - 3) * (visI > 0 ? visI - 1 : 0), visN - 1) : tx;
  g.fillRect(mx, ty - 1, 3, 3, PANEL_COLORS.led);

  drawWrappedName(g, asciiFold(name), cdiv(screenH, 2), PANEL_COLORS.white);
  // drawChromeLine (core_ui_text.h:381-383): TomThumb, PF_UI_FONT_CHROME.
  drawUiLine(g, TOM_THUMB, "HOLD TO SELECT", screenH - 22, PANEL_COLORS.selectHint);
  g.setFont(null);
}

/**
 * Draw one of the panel's own screens into `frame` - 128*64*4 RGBA, landscape,
 * row-major, y = 0 at the top - exactly as the firmware composes it:
 * - select and brightness draw over what the frame already holds (the pattern);
 * - network, knobmap and update clear the whole panel first, as the device does
 *   (no pattern renders under them).
 */
export function drawOverlay(frame: Uint8ClampedArray, overlay: PanelOverlay): void {
  if (frame.length !== FRAME_BYTES) {
    throw new RangeError(`panel frame must be ${FRAME_BYTES} bytes (128x64 RGBA), got ${frame.length}`);
  }
  const g = new PanelGfx(frame);
  switch (overlay.kind) {
    case "brightness":
      g.setRotation(overlay.portrait ? 1 : 0);
      drawBrightnessNotice(g, overlay.percent, overlay.powerLimit);
      return;
    case "network":
      drawNetworkInfo(g, overlay);
      return;
    case "knobmap": {
      const active = [false, false, false, false];
      const lit = [...(overlay.activeKnobs ?? []), ...(overlay.activeKnob === null ? [] : [overlay.activeKnob])];
      for (const k of lit) if (k >= 0 && k < 4) active[k] = true;
      drawKnobMap(g, active);
      return;
    }
    case "select":
      drawSelectingMode(g, overlay.rank, overlay.count, overlay.name);
      return;
    case "update":
      drawUpdateScreen(g, overlay);
      return;
  }
}

/**
 * Print `text` in the built-in 5x7 font the way the firmware's print() does:
 * cursor at the character cell's top-left, 6 px advance per size, GFX wrap at
 * the rotated width. Returns the cursor after the last character.
 */
export function drawText(
  frame: Uint8ClampedArray,
  x: number,
  y: number,
  text: string,
  rgb: Rgb,
  size = 1,
  rotation: Rotation = 0,
): { x: number; y: number } {
  if (frame.length !== FRAME_BYTES) {
    throw new RangeError(`panel frame must be ${FRAME_BYTES} bytes (128x64 RGBA), got ${frame.length}`);
  }
  const g = new PanelGfx(frame);
  g.setRotation(rotation);
  g.setTextSize(size);
  g.setTextColor(rgb);
  g.setCursor(x, y);
  g.print(text);
  return g.cursor();
}

/** getTextBounds(text, 0, 0) in the built-in font, with GFX wrap at the rotated width. */
export function measureText(text: string, size = 1, rotation: Rotation = 0): { x1: number; y1: number; w: number; h: number } {
  const g = new PanelGfx(new Uint8ClampedArray(0));
  g.setRotation(rotation);
  g.setTextSize(size);
  return g.getTextBounds(text, 0, 0);
}
