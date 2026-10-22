import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUS_RELEASE_GRACE_MS, LANE_HAND_HOLD_MS, LANE_RELEASE_MS } from "./deviceSim";
import { brightnessPercent, FIRMWARE, MODULE_NAME_BYTES, type FirmwareConstants } from "./panelScreens";

// The guide's panel plays by the firmware's timings and limits, and those
// numbers were copied out of the firmware by hand: 5000 ms in brightness, 350
// ms before SELECT loads, three detents a step. check:shared keeps the values
// both sides read from shared/constants.json, and none of these is one of
// them. On 21 October 2026 all 21 copies matched the firmware. This file is
// what says so the day one stops matching. The firmware is only read here.

/** The repository's root: this file is web/src/lib/guide/. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const firmwareSource = (file: string) =>
  readFileSync(path.join(ROOT, "firmware/patternflow", file), "utf8");

/** The right-hand side of the one `const`, `constexpr` or `#define` that names `name` in `file`. */
function declared(file: string, name: string): string {
  const text = firmwareSource(file);
  const found = [
    ...text.matchAll(new RegExp(`\\b(?:const|constexpr)\\s+[\\w:]+\\s+${name}\\s*=\\s*([^;]+);`, "g")),
    ...text.matchAll(new RegExp(`^\\s*#define\\s+${name}\\s+(\\S+)`, "gm")),
  ];
  if (found.length !== 1) {
    throw new Error(`firmware/patternflow/${file} declares ${name} ${found.length} times, not once`);
  }
  return found[0][1].trim();
}

/** A declared number without its C suffix: 1.0f is 1. */
function declaredNumber(file: string, name: string): number {
  const raw = declared(file, name);
  const m = /^(\d+(?:\.\d+)?)[fFuUlL]*$/.exec(raw);
  if (!m) throw new Error(`${name} in firmware/patternflow/${file} is ${raw}, not a number`);
  return Number(m[1]);
}

// FIRMWARE keys copied from a constant of the same value.
const NAMED: [keyof FirmwareConstants, string, string][] = [
  ["brightnessIdleExitMs", "patternflow.ino", "BRIGHTNESS_IDLE_MS"],
  ["brightnessSaveDelayMs", "patternflow.ino", "BRIGHTNESS_SAVE_DELAY_MS"],
  ["networkIdleExitMs", "patternflow.ino", "OSC_INFO_IDLE_MS"],
  ["knobmapIdleExitMs", "patternflow.ino", "KNOB_MAP_IDLE_MS"],
  ["knobmapHighlightMs", "patternflow.ino", "KNOB_MAP_HILITE_MS"],
  ["updateIdleExitMs", "patternflow.ino", "UPDATE_IDLE_MS"],
  ["infoRedrawMs", "patternflow.ino", "NET_INFO_REDRAW_MS"],
  ["selectDetentsPerStep", "patternflow.ino", "SELECT_DETENTS_PER_STEP"],
  ["selectSettleMs", "patternflow.ino", "SELECT_SETTLE_MS"],
  ["patternSaveDelayMs", "patternflow.ino", "PATTERN_SAVE_DELAY_MS"],
  ["networkMaxFeatureRows", "patternflow.ino", "MAX_FEATURE_ROWS"],
  ["wakeGuardMs", "src/core_sleep.h", "WAKE_GUARD_MS"],
  ["defaultBrightness", "config.h", "DEFAULT_BRIGHTNESS"],
];

// The sim's own module constants, under the name each has in the firmware.
const LOOSE: [string, string, string, number][] = [
  ["MODULE_NAME_BYTES in panelScreens.ts", "pattern_registry.h", "MODULE_NAME_BYTES", MODULE_NAME_BYTES],
  ["BUS_RELEASE_GRACE_MS in deviceSim.ts", "src/core_bus.h", "ABSOLUTE_RELEASE_GRACE_MS", BUS_RELEASE_GRACE_MS],
  ["LANE_RELEASE_MS in deviceSim.ts", "features/audio/core_audio_ws.h", "AUDIO_TIMEOUT_MS", LANE_RELEASE_MS],
  ["LANE_HAND_HOLD_MS in deviceSim.ts", "patternflow.ino", "LANE_HANDS_OFF_MS", LANE_HAND_HOLD_MS],
];

describe("the guide's panel against the firmware", () => {
  it.each(NAMED)("FIRMWARE.%s is %s's %s", (key, file, name) => {
    expect(FIRMWARE[key]).toBe(declaredNumber(file, name));
  });

  it.each(LOOSE)("%s is %s's %s", (_sim, file, name, value) => {
    expect(value).toBe(declaredNumber(file, name));
  });

  it("shows the name card as long as CONTENT_NOTICE_SECONDS, which counts seconds", () => {
    expect(FIRMWARE.contentNoticeMs).toBe(declaredNumber("patternflow.ino", "CONTENT_NOTICE_SECONDS") * 1000);
  });

  it("turns brightness in the step and between the bounds loop() clamps to", () => {
    const turns = [
      ...firmwareSource("patternflow.ino").matchAll(
        /constrain\(\s*\(int\)\s*currentBrightness\s*\+\s*\w+\s*\*\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g,
      ),
    ];
    expect(turns, "constrain((int)currentBrightness + d * step, min, max) in patternflow.ino").toHaveLength(1);
    const [step, min, max] = turns[0].slice(1).map(Number);
    expect(FIRMWARE.brightnessStepPerDetent).toBe(step);
    expect(FIRMWARE.brightnessMin).toBe(min);
    expect(FIRMWARE.brightnessMax).toBe(max);
  });

  it("prints a brightness byte as the percent the panel prints, for every byte", () => {
    const formulas = [
      ...firmwareSource("patternflow.ino").matchAll(/\(\s*currentBrightness\s*\*\s*(\d+)\s*\+\s*(\d+)\s*\)\s*\/\s*(\d+)/g),
    ].map((m) => m.slice(1).join(" "));
    // The BRIGHTNESS screen and the serial line both print it.
    expect(formulas.length).toBeGreaterThan(0);
    expect(new Set(formulas).size, `patternflow.ino rounds the percent ${formulas.length} ways`).toBe(1);
    const [scale, round, full] = formulas[0].split(" ").map(Number);
    for (let level = 0; level <= 255; level++) {
      expect(brightnessPercent(level)).toBe(Math.trunc((level * scale + round) / full));
    }
    expect(FIRMWARE.defaultBrightnessPercent).toBe(brightnessPercent(FIRMWARE.defaultBrightness));
  });

  it("takes the long press, the debounce and the edges per detent from shared/constants.json, as the firmware does", () => {
    expect(declared("patternflow.ino", "MODE_HOLD_MS")).toBe("PF_SHARED_LONG_PRESS_MS");
    const encoders = firmwareSource("src/core_encoders.h");
    expect(encoders).toMatch(/>\s*PF_SHARED_BUTTON_DEBOUNCE_MS\b/);
    expect(encoders).toMatch(/knobSubSteps\[4\]\s*=\s*\{\s*PF_SHARED_EDGES_PER_DETENT\b/);
  });

  it("checks every FIRMWARE key, so a new one comes with a row here", () => {
    const checked = [
      ...NAMED.map(([key]) => key),
      "contentNoticeMs",
      "brightnessStepPerDetent",
      "brightnessMin",
      "brightnessMax",
      "defaultBrightnessPercent",
      "longPressMs",
      "buttonDebounceMs",
      "edgesPerDetent",
    ];
    expect(checked.sort()).toEqual(Object.keys(FIRMWARE).sort());
  });
});
