/**
 * The device state half of docs/rest-api.md: /api/status, /api/params, /api/sleep, /api/display, /api/knobs,
 * DELETE /api/crash and the favicon. The spec where it speaks, the firmware where it is silent: an argument's
 * bound or how a number is read come from core_status_http.h, core_display_http.h and core_knobs_http.h.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SIM_HOTSPOT, SIM_IP } from "@/lib/guide/deviceSim";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { BUS_MAX, EDGES_PER_DETENT, KNOB_COUNT } from "@/lib/shared/constants";

import type { Reply } from "../http";
import type { Transport } from "../panel";

const SKETCH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../firmware/patternflow");
/** A #define or a constexpr as the tree builds it, so the panel reports the firmware it stands in for. */
function firmware(file: string, name: string) {
  const found = fs.readFileSync(path.join(SKETCH, file), "utf8").match(new RegExp(`(?:#define\\s+${name}\\s+|${name}\\s*=\\s*)"?([\\w.]+)`));
  if (!found) throw new Error(`no ${name} in firmware/patternflow/${file}`);
  return found[1].replace(/f$/, "");
}

const CAPS = ["patterns", "params", "sleep"]; // the core's own, first as in handleStatus
const VERSION = firmware("net_config.h", "PF_IMPROV_FW_VERSION");
const HOST = firmware("net_config.h", "PF_OTA_HOSTNAME");
const FRAME_US = Math.round(1e6 / 60); // the frame panel.ts ticks DeviceSim at
const GRACE_MS = 250; // ABSOLUTE_RELEASE_GRACE_MS, core_bus.h: rN does not free a channel written this recently
const IMMUTABLE = "public, max-age=31536000, immutable";

// Arduino's String::toInt() and toFloat(): leading digits, else 0.
const toInt = (v: string) => parseInt(v.trim(), 10) || 0;
const toFloat = (v: string) => parseFloat(v.trim()) || 0;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const zeros = <K extends string>(...keys: K[]) => Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
const fail = (error: string, status = 400): Reply => ({ status, body: { ok: false, error } });

/** PFSend::hostCacheable: an IPv4 address, a name with no dot or a .local name, port or not, can only be the panel. */
function panelHost(host = "") {
  const name = host.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
  const ipv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(name) && name.split(".").every((n) => Number(n) <= 255);
  return name !== "" && (ipv4 || !name.includes(".") || (name.endsWith(".local") && name.length > 6));
}

export default {
  feature: null,
  caps: CAPS,
  attach({ sim, clock, routes, caps, status }) {
    // The board has no radio, heap or flash to measure: those read 0, and the NETWORK screen's address is the ip.
    const build = createHash("sha256").update(`virtual-panel ${VERSION}`).digest("hex").slice(0, 8);
    let timingFrom = 0;
    routes("GET", "/api/status", ({ args }) => {
      const [s, { patternCount }, now] = [sim.consoleState(), sim.snapshot(), clock.now()];
      const loops = Math.floor(((now - timingFrom) * 1000) / FRAME_US);
      if (args.get("resetTiming") === "1") timingFrom = now;
      const body: Record<string, unknown> = {
        version: VERSION, build, variant: "core", caps: [...new Set([...CAPS, ...caps])], featureNav: [],
        uptime: Math.floor(now / 1000), resetReason: "poweron", panel: `${PANEL_W}x${PANEL_H}`,
        wifi: true, ssid: "", ip: SIM_IP, rssi: 0, host: HOST, hostAlias: SIM_HOTSPOT,
        hotspot: { mode: "off", up: false, ssid: SIM_HOTSPOT, ip: "", channel: 0, clients: 0, dns: 0 },
        viaHotspot: false,
        network: { ...zeros("disconnects", "retries", "reconnectMs", "announcements"), namesReady: false },
        ...zeros("heapInternal", "heapLargest", "heapPsram"),
        fsMounted: true, ...zeros("fsTotal", "fsUsed"), fsError: "", flashId: "000000",
        patterns: patternCount, presets: 1, modules: patternCount - 1,
        active: s.patternName, activeIsModule: s.patternIndex > 0, loading: false,
        sleep: s.sleeping, brightness: s.level,
        ...sim.knobState(),
        consolePaused: false, busy: "",
        frameUs: FRAME_US, presentUs: 0, loopCore: 1, httpCore: 0,
        netMaintenance: zeros("calls", "maxGapMs"),
        runtime: { loops, lastUs: FRAME_US, maxUs: FRAME_US, ...zeros("over50ms", "housekeepingMaxUs", "syncMaxUs") },
        ...zeros("loopStackMin", "netStackMin", "loopSyncServed", "loopSyncMaxUs", "loopAgeMs", "loopSyncGaveUp"),
        loopStalled: false,
        colorBits: 8, refreshHz: 60, loadError: "",
        load: {
          ...zeros("total", "read", "relocate", "setup", "internal", "psram", "resumeUs"),
          code: s.patternIndex > 0 ? "psram" : "internal", resumed: false,
        },
        moduleMemory: {
          reserve: Number(firmware("src/core_module_memory.h", "PF_MODULE_INTERNAL_RESERVE")), runtimeLimit: 4 * 1024 * 1024,
          ...zeros("serviceFree", "execLargest", "runtimeBytes", "runtimePeakBytes", "refusals", "loaderRetries"),
          ...zeros("loaderStackBytes", "loaderStackMin"), codePolicy: 2,
          resident: { slots: 16, ...zeros("count", "bytes", "resumes", "evictions") },
        },
        thumbs: zeros("captures", "reads", "writes", "captureMaxUs", "ioMaxUs"),
      };
      // What the other transports add, last, as extraStatus is.
      return { body: Object.assign(body, ...status.map((add) => add())) };
    });

    // Every argument is read before any is applied. rN=1 is the firmware's, and the spec does not name it.
    const writtenAt = Array<number>(KNOB_COUNT).fill(-Infinity);
    routes("POST", "/api/params", ({ args }) => {
      const writes: (() => void)[] = [];
      for (let i = 0; i < KNOB_COUNT; i++) {
        const [p, d, r] = ["p", "d", "r"].map((x) => args.get(`${x}${i + 1}`));
        if (p !== null) {
          const v = toInt(p);
          if (!p.trim() || v < 0 || v > BUS_MAX) return fail(`p${i + 1} must be 0..${BUS_MAX}`);
          writes.push(() => {
            sim.applyRemoteParam(i, v);
            writtenAt[i] = clock.now();
          });
        }
        if (d !== null) {
          const v = toInt(d);
          if (v < -100 || v > 100) return fail(`d${i + 1} must be -100..100`);
          writes.push(() => sim.nudge(i, v));
        }
        if (r !== null && r !== "0") writes.push(() => void (clock.now() - writtenAt[i] >= GRACE_MS && sim.releaseRemoteParam(i)));
      }
      if (!writes.length) return fail("send at least one of p1..p4");
      writes.forEach((write) => write());
      const { params, paramActive } = sim.knobState();
      return { body: { ok: true, params, active: paramActive } };
    });

    // Queued for the next frame, as loop() does it, so the reply carries the state before.
    routes("POST", "/api/sleep", ({ args }) => {
      const [on, before] = [(args.get("on") ?? "1").trim().toLowerCase(), sim.consoleState().sleeping];
      const wanted = on === "toggle" ? !before : ["1", "true", "sleep"].includes(on) ? true : ["0", "false", "wake"].includes(on) ? false : null;
      if (wanted === null) return fail("on must be 1, 0, or toggle");
      clock.after(0, () => sim.setSleeping(wanted));
      return { body: { ok: true, requested: wanted, sleep: before } };
    });

    // The colour and the test card are kept and reported; the frame does not show them.
    const tune: Record<string, number> = { sat: Number(firmware("config.h", "LED_SAT_BOOST")) };
    for (const c of "RGB") {
      tune[`wb_${c.toLowerCase()}`] = Number(firmware("config.h", `LED_WB_${c}`));
      tune[`gamma_${c.toLowerCase()}`] = Number(firmware("config.h", `LED_GAMMA_${c}`));
    }
    const card = { calib: 0, screen: 0, level: 255, power_limit: 1, power_budget: Number(firmware("src/core_power.h", "BUDGET_DEFAULT_MA")) };
    routes("GET", "/api/display", ({ args }) => {
      const has = (k: string) => args.get(k) !== null;
      const read = (k: string, lo: number, hi: number) => void (has(k) && (tune[k] = clamp(toFloat(args.get(k)!), lo, hi)));
      for (const c of "rgb") {
        read(`wb_${c}`, 0, 1.5);
        read(`gamma_${c}`, 0.2, 5);
      }
      read("sat", 0, 4);
      if (has("screen")) {
        const screen = toInt(args.get("screen")!); // -1 takes the card away and leaves the screen it showed
        card.calib = Number(screen >= 0);
        if (screen >= 0) card.screen = Math.min(screen, 3);
      }
      if (has("level")) card.level = clamp(toInt(args.get("level")!), 8, 255);
      const [brightness, budget] = [toInt(args.get("brightness") ?? ""), toInt(args.get("power_budget") ?? "")];
      if (brightness >= 5 && brightness <= 255) sim.setBrightnessLevel(brightness);
      if (budget >= 800 && budget <= 5000) card.power_budget = budget; // core_power.h's BUDGET_MIN_MA and BUDGET_MAX_MA
      if (has("power_limit")) card.power_limit = Number(args.get("power_limit") !== "0");
      const { level, sleeping } = sim.consoleState();
      const { wb_r, wb_g, wb_b, gamma_r, gamma_g, gamma_b, sat } = tune;
      const reply = { wb_r, wb_g, wb_b, gamma_r, gamma_g, gamma_b, sat, brightness: level, ...card, sleep: Number(sleeping) };
      const power = { power_ma: 0, power_demand: 0, power_limiting: 0, power_applied: level }; // no LEDs draw current here
      return { headers: { "Access-Control-Allow-Origin": "*" }, body: { ...reply, ...power } };
    });

    // A setting changes how the next turn counts and leaves the clicks where they are.
    const inv = Array<boolean>(KNOB_COUNT).fill(firmware("config.h", "INVERT_ENCODER") !== "0");
    const sub = Array<number>(KNOB_COUNT).fill(EDGES_PER_DETENT);
    const knobs = (): Reply => {
      const raw = sim.consoleState().knobs.map((detents) => detents * EDGES_PER_DETENT);
      return { body: { ok: true, inv, sub, clicks: sim.knobState().knobs, raw } };
    };
    routes("GET", "/api/knobs", knobs);
    routes("POST", "/api/knobs", ({ args }) => {
      const [nextInv, nextSub] = [[...inv], [...sub]];
      let any = false;
      for (let i = 0; i < KNOB_COUNT; i++) {
        const [iv, sv] = [args.get(`inv${i}`) ?? args.get("inv"), args.get(`sub${i}`) ?? args.get("sub")];
        if (iv !== null) nextInv[i] = ["1", "true", "on"].includes(iv);
        if (sv !== null && ![4, 2, 1].includes((nextSub[i] = toInt(sv)))) return fail("sub must be 4, 2 or 1");
        any ||= iv !== null || sv !== null;
      }
      if (!any) return fail("nothing to set: invN, subN, inv or sub");
      inv.splice(0, KNOB_COUNT, ...nextInv);
      sub.splice(0, KNOB_COUNT, ...nextSub);
      sim.setKnobSettings(inv, sub);
      return knobs();
    });

    // A panel that has never crashed has no record to clear.
    routes("DELETE", "/api/crash", () => fail("no crash recorded", 404));
    routes("GET", "/favicon.ico", ({ headers }) => ({ status: 204, headers: { "Cache-Control": panelHost(headers.host) ? IMMUTABLE : "no-store" } }));
  },
} satisfies Transport;
