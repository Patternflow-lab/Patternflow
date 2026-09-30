"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import styles from "./Guide.module.css";
import { COPY, type Extra } from "./copy";
import { getSim, useGuideStore, type GuideLang } from "./store";
import { communityHref } from "@/lib/community/apiBase";
import { PatternRuntime } from "@/lib/pattern/harness";
import { parseRampAnnotation } from "@/lib/pattern/ramp";
import { hexToRgb } from "@/lib/pattern/color";
import { knobSetupFromCode, normalizedKnobs } from "@/lib/community/knobs";
import { livePresets } from "@/lib/presets";
import { BASICS_PACK } from "@/lib/pattern/packs";

// The small moving pieces that sit inside a step's card: a flasher going
// through its screens, BOOT and RST in order, a Wi-Fi name being typed, a
// deck fanning out, the board's own page installing a pack, a laptop and a
// phone opening the console. And the control pad, for hands on the knobs.

const EspWebInstallButton = "esp-web-install-button" as unknown as React.ElementType<{
  children: React.ReactNode;
  manifest: string;
}>;

/** Runs `fn(elapsedMs)` on an interval while the element is on screen. */
function useVisibleTicker(ref: React.RefObject<HTMLElement | null>, ms: number, fn: (t: number) => void) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer = 0;
    const start = performance.now();
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = window.setInterval(() => fnRef.current(performance.now() - start), ms);
      } else if (!entry.isIntersecting && timer) {
        window.clearInterval(timer);
        timer = 0;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) window.clearInterval(timer);
    };
  }, [ref, ms]);
}

/** Index into a list of stage durations, looping. */
function stageAt(t: number, durations: number[]) {
  const total = durations.reduce((a, b) => a + b, 0);
  let local = t % total;
  for (let i = 0; i < durations.length; i++) {
    if (local < durations[i]) return { index: i, within: local / durations[i] };
    local -= durations[i];
  }
  return { index: 0, within: 0 };
}

// ── flashing ────────────────────────────────────────────────────────────────

function FlashBlock({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ index: 0, within: 0 });
  useVisibleTicker(ref, 60, (t) => setStage(stageAt(t, [1400, 1400, 3200, 1600])));
  const pct = stage.index === 2 ? Math.round(stage.within * 100) : stage.index > 2 ? 100 : 0;

  return (
    <div className={styles.extra} ref={ref}>
      <Script type="module" src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module" strategy="lazyOnload" />
      <div className={styles.mockWindow} aria-hidden="true">
        <div className={styles.mockBar}>
          <span />
          <span />
          <span />
          <b>Patternflow</b>
        </div>
        <div className={styles.mockBody}>
          {stage.index === 0 && <p className={styles.mockLine}>USB JTAG/serial debug unit (COM4)</p>}
          {stage.index === 1 && <p className={styles.mockLine}>Install Patternflow</p>}
          {stage.index === 2 && (
            <>
              <p className={styles.mockLine}>Installing… {pct}%</p>
              <div className={styles.mockProgress}>
                <span style={{ width: `${pct}%` }} />
              </div>
            </>
          )}
          {stage.index === 3 && <p className={styles.mockLine}>Installation complete! → Next</p>}
        </div>
      </div>
      <EspWebInstallButton manifest="/flash/manifest.json">
        <button slot="activate" type="button" className={styles.action}>
          Flash Patternflow
        </button>
        <span slot="unsupported" className={styles.muted}>
          {ui.flashUnsupported}
        </span>
      </EspWebInstallButton>
    </div>
  );
}

function BootSeq({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  const ref = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  // Same clock as the module on stage: a 2.8 s loop off performance.now().
  useVisibleTicker(ref, 50, () => {
    const t = performance.now() % 2800;
    setActive(t < 500 ? 0 : t < 1000 ? 1 : t < 1700 ? 2 : -1);
  });
  return (
    <ol className={styles.seq} ref={ref}>
      {ui.bootSteps.map((s, i) => (
        <li key={s} data-on={active === i ? "1" : "0"}>
          <span>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

function WifiForm({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui.wifi;
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  useVisibleTicker(ref, 60, (ms) => setT(ms % 6200));
  const ssid = "Studio_2.4G";
  const typed = ssid.slice(0, Math.max(0, Math.min(ssid.length, Math.floor((t - 300) / 110))));
  const dots = Math.max(0, Math.min(10, Math.floor((t - 1800) / 90)));
  const pressed = t > 3000 && t < 3400;
  const done = t > 3600;
  return (
    <div className={styles.extra} ref={ref} aria-hidden="true">
      <div className={styles.mockWindow}>
        <div className={styles.mockBar}>
          <span />
          <span />
          <span />
          <b>{ui.title}</b>
        </div>
        <div className={styles.mockBody}>
          <label className={styles.mockField}>
            <em>{ui.ssid}</em>
            <span>
              {typed}
              {!done && t < 1800 && <i className={styles.caret} />}
            </span>
          </label>
          <label className={styles.mockField}>
            <em>{ui.password}</em>
            <span>
              {"•".repeat(dots)}
              {!done && t >= 1800 && t < 3000 && <i className={styles.caret} />}
            </span>
          </label>
          <div className={styles.mockActions}>
            <span className={styles.mockButton} data-pressed={pressed ? "1" : "0"}>
              {done ? "✓ Visit Device" : ui.connect}
            </span>
            <span className={styles.mockTag}>2.4 GHz · Aa</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── patterns ────────────────────────────────────────────────────────────────

const FAN_SLUGS = ["wave_saw", "0510", "0513", "0516", "0520"];

function LiveThumbs({ slugs }: { slugs: string[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    const presets = slugs
      .map((slug) => {
        const num = BASICS_PACK.presets[slug];
        return livePresets.find((p) => p.num === num);
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p));
    const runtimes = presets.map((preset) => {
      const rt = new PatternRuntime(128, 64);
      const a = parseRampAnnotation(preset.code);
      if (a) {
        rt.setRamp({
          stops: a.stops.map((s) => ({ position: s.position, color: hexToRgb(s.color) })),
          mode: a.mode,
          wrap: a.wrap,
        });
        rt.recolor = a.recolor;
      } else {
        rt.setRamp({
          stops: [
            { position: 0, color: [8, 24, 64] },
            { position: 0.55, color: [255, 77, 0] },
            { position: 1, color: [255, 232, 154] },
          ],
          mode: "linear",
          wrap: false,
        });
      }
      rt.loadCode(preset.code);
      const setup = knobSetupFromCode(preset.code);
      return { rt, setup };
    });
    let raf = 0;
    let visible = false;
    let last = 0;
    let time = 0;
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    if (wrap.current) io.observe(wrap.current);
    function loop(now: number) {
      raf = 0;
      if (!visible) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 30;
      last = now;
      time += dt;
      runtimes.forEach(({ rt, setup }, i) => {
        rt.renderFrame(dt, time, {
          knobDeltas: [0, 0, 0, 0],
          knobValues: setup.values,
          knobNormalized: normalizedKnobs(setup.values, setup.ranges),
          knobRanges: setup.ranges,
          btnPressed: [false, false, false, false],
          btnHeld: [false, false, false, false],
        });
        const c = canvases.current[i];
        const ctx = c?.getContext("2d");
        if (!ctx) return;
        const img = new ImageData(128, 64);
        const d = rt.data;
        for (let j = 0; j < d.length; j += 4) {
          img.data[j] = d[j];
          img.data[j + 1] = d[j + 1];
          img.data[j + 2] = d[j + 2];
          img.data[j + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      });
      raf = requestAnimationFrame(loop);
    }
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [slugs]);

  return (
    <div className={styles.fan} ref={wrap} aria-hidden="true">
      {slugs.map((slug, i) => (
        <div key={slug} className={styles.fanCard} style={{ "--i": i - (slugs.length - 1) / 2 } as React.CSSProperties}>
          <canvas
            ref={(el) => {
              canvases.current[i] = el;
            }}
            width={128}
            height={64}
          />
        </div>
      ))}
    </div>
  );
}

function DeckFan({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  return (
    <div className={styles.extra}>
      <LiveThumbs slugs={FAN_SLUGS} />
      <div className={styles.deckMeta}>
        <span className={styles.deckName}>Basics</span>
        <span className={styles.deckCount}>33</span>
      </div>
      <a className={styles.action} href={communityHref("/community/decks")}>
        {ui.openDecks} <span aria-hidden="true">↗</span>
      </a>
    </div>
  );
}

function InstallFlow({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui.install;
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ index: 0, within: 0 });
  useVisibleTicker(ref, 60, (t) => setSt(stageAt(t, [1800, 700, 3400, 2000])));
  const count = st.index === 2 ? Math.max(1, Math.round(st.within * 33)) : st.index === 3 ? 33 : 0;
  return (
    <div className={styles.extra} ref={ref} aria-hidden="true">
      <div className={styles.mockWindow}>
        <div className={styles.mockBar}>
          <span />
          <span />
          <span />
          <b>patternflow.local/patterns</b>
        </div>
        <div className={styles.mockBody}>
          {st.index === 0 && (
            <>
              <p className={styles.mockLine}>{ui.formatting}</p>
              <span className={styles.mockButton} data-pressed={st.within > 0.75 ? "1" : "0"}>
                {ui.format}
              </span>
            </>
          )}
          {st.index === 1 && <p className={styles.mockLine}>…</p>}
          {st.index === 2 && (
            <>
              <p className={styles.mockLine}>
                {ui.installing} {count} / 33
              </p>
              <div className={styles.mockProgress}>
                <span style={{ width: `${(count / 33) * 100}%` }} />
              </div>
            </>
          )}
          {st.index === 3 && <p className={styles.mockLine}>✓ {ui.done}</p>}
        </div>
      </div>
    </div>
  );
}

// ── console ─────────────────────────────────────────────────────────────────

function Laptop() {
  return (
    <div className={styles.extra} aria-hidden="true">
      <div className={styles.laptop}>
        <div className={styles.laptopScreen}>
          <div className={styles.addr}>patternflow.local</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/guide/console/home-desktop.webp" alt="" loading="lazy" />
        </div>
        <div className={styles.laptopBase} />
      </div>
    </div>
  );
}

function Phone() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  useVisibleTicker(ref, 70, (ms) => setT(ms % 7000));
  const ip = "192.168.0.42";
  const typed = ip.slice(0, Math.max(0, Math.min(ip.length, Math.floor((t - 1500) / 120))));
  const open = t > 3300;
  return (
    <div className={styles.extra} ref={ref} aria-hidden="true">
      <div className={styles.phone}>
        <div className={styles.phoneAddr}>
          {typed}
          {!open && <i className={styles.caret} />}
        </div>
        <div className={styles.phoneScreen} data-open={open ? "1" : "0"}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/guide/console/home-phone.webp" alt="" loading="lazy" />
        </div>
      </div>
    </div>
  );
}

function ConsolePages({ lang }: { lang: GuideLang }) {
  const pages = COPY[lang].ui.pages;
  return (
    <div className={`${styles.extra} ${styles.pages}`}>
      {pages.map((p) => (
        <figure key={p.title} className={styles.pageCard}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.img} alt="" loading="lazy" />
          <figcaption>
            <b>{p.title}</b> {p.body}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

// ── the pad ─────────────────────────────────────────────────────────────────

// Laid out as on the device: K2 K1 over K4 K3.
const PAD_ORDER = [1, 0, 3, 2];

function PadKnob({ knob, lang }: { knob: number; lang: GuideLang }) {
  const ui = COPY[lang].ui.pad;
  const repeat = useRef(0);
  const turn = (d: number) => {
    getSim().turn(knob, d);
    useGuideStore.getState().setHandsOn(true);
  };
  const startRepeat = (d: number) => {
    turn(d);
    window.clearInterval(repeat.current);
    repeat.current = window.setInterval(() => turn(d), 90);
  };
  const stopRepeat = () => window.clearInterval(repeat.current);
  useEffect(() => () => window.clearInterval(repeat.current), []);

  return (
    <div className={styles.padKnob}>
      <button
        type="button"
        aria-label={`K${knob + 1} ${ui.left}`}
        onPointerDown={() => startRepeat(-1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
      >
        ‹
      </button>
      <button
        type="button"
        className={styles.padPress}
        aria-label={`K${knob + 1} ${ui.press}`}
        onPointerDown={() => {
          getSim().press(knob);
          useGuideStore.getState().setHandsOn(true);
        }}
        onPointerUp={() => getSim().release(knob)}
        onPointerLeave={() => getSim().cancel(knob)}
      >
        K{knob + 1}
      </button>
      <button
        type="button"
        aria-label={`K${knob + 1} ${ui.right}`}
        onPointerDown={() => startRepeat(1)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
      >
        ›
      </button>
    </div>
  );
}

function Pad({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui.pad;
  return (
    <div className={styles.extra}>
      <div className={styles.pad} role="group" aria-label={ui.title}>
        {PAD_ORDER.map((k) => (
          <PadKnob key={k} knob={k} lang={lang} />
        ))}
      </div>
      <p className={styles.padHint}>{ui.hint}</p>
    </div>
  );
}

export default function Extras({ kind, lang }: { kind: Extra; lang: GuideLang }) {
  switch (kind) {
    case "flashButton":
      return <FlashBlock lang={lang} />;
    case "bootSeq":
      return <BootSeq lang={lang} />;
    case "wifiForm":
      return <WifiForm lang={lang} />;
    case "deckFan":
      return <DeckFan lang={lang} />;
    case "installFlow":
      return <InstallFlow lang={lang} />;
    case "laptop":
      return <Laptop />;
    case "phone":
      return <Phone />;
    case "consolePages":
      return <ConsolePages lang={lang} />;
    case "pad":
      return <Pad lang={lang} />;
  }
}
