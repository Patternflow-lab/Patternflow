"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import styles from "./Guide.module.css";
import { COPY, type Extra } from "./copy";
import type { GuideLang } from "./store";
import { communityHref } from "@/lib/community/apiBase";
import { PatternRuntime } from "@/lib/pattern/harness";
import { parseRampAnnotation } from "@/lib/pattern/ramp";
import { hexToRgb } from "@/lib/pattern/color";
import { knobSetupFromCode, normalizedKnobs } from "@/lib/community/knobs";
import { livePresets } from "@/lib/presets";
import { BASICS_PACK } from "@/lib/pattern/packs";
import { BASICS_NAMES } from "@/lib/guide/basicsNames";
import { bootPhase } from "./timing";
import FlasherShots from "./FlasherShots";
import ConsoleWindow, { type ConsolePage } from "./ConsoleWindow";
import CommunityShots from "./CommunityShots";
import LabShots from "./LabShots";
import LabWindow from "./LabWindow";
import BuildCards from "./build/BuildCards";
import type { BuildCard } from "./build/cards";

// The small moving pieces that sit inside a step's card: the flasher's real
// screens and its real button, BOOT and RST in order, a deck fanning out, the
// board's own page installing a pack, the console itself — working, on a
// simulated board.

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

// The flasher's own screens (FlasherShots: ESP Web Tools' real dialog,
// captured), then the real button: it opens the same dialog, for real.
function FlashBlock({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  return (
    <div className={styles.extra}>
      <Script type="module" src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module" strategy="lazyOnload" />
      {/* The button first — it is the step — then what it opens, screen by screen. */}
      <EspWebInstallButton manifest="/flash/manifest.json">
        <button slot="activate" type="button" className={`${styles.action} ${styles.actionFirst}`}>
          Flash Patternflow
        </button>
        <span slot="unsupported" className={styles.muted}>
          {ui.flashUnsupported}
        </span>
      </EspWebInstallButton>
      <FlasherShots set="install" lang={lang} waitForKit />
    </div>
  );
}

function BootSeq({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui;
  const ref = useRef<HTMLOListElement>(null);
  // Which chips are lit, as bits. The module on stage (KitFx) reads the same
  // loop off the same clock (timing.ts), so the chips and the buttons agree:
  // "Hold BOOT" stays lit for as long as BOOT is down, "Tap RST" while RST is.
  const [lit, setLit] = useState(0);
  useVisibleTicker(ref, 50, () => {
    const { chips } = bootPhase();
    setLit((chips[0] ? 1 : 0) | (chips[1] ? 2 : 0) | (chips[2] ? 4 : 0));
  });
  return (
    <ol className={styles.seq} ref={ref}>
      {ui.bootSteps.map((s, i) => (
        <li key={s} data-on={lit & (1 << i) ? "1" : "0"}>
          <span>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}

// Straight after the install, and — the card's callout — after RST.
function WifiShots({ lang }: { lang: GuideLang }) {
  return <FlasherShots set={["wifi", "dashboard"]} lang={lang} waitForKit />;
}

// ── patterns ────────────────────────────────────────────────────────────────

// Five of the pack's own modules (web/public/packs/basics.json), front card last.
const FAN_SLUGS = ["wave_saw", "0510", "0513", "0518", "0520"];

function LiveThumbs({ slugs }: { slugs: string[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    // One runtime per card, kept on that card's index: a slug with no JS twin
    // leaves its own card dark rather than shifting every card after it.
    const presets = slugs.map((slug) => {
      const num = BASICS_PACK.presets[slug];
      return num === undefined ? null : (livePresets.find((p) => p.num === num) ?? null);
    });
    const runtimes = presets.map((preset) => {
      if (!preset) return null;
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
      runtimes.forEach((entry, i) => {
        if (!entry) return;
        const { rt, setup } = entry;
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

// The board's Patterns page as the pack arrives, in its own words: the
// format prompt, the browser's confirm, then the upload queue — a row per
// file, each fetched from the community and handed to the board.
// The pack's order: each module's .pfm, then its .json.
const QUEUE = Object.keys(BASICS_NAMES).flatMap((slug) => [`${slug}.pfm`, `${slug}.json`]);
// The page's own row states: the transfer counts to 90 %, then the row reads
// "verifying…" until the board confirms the file (patterns.html runQ).
const UPLOAD_SHARE = 0.72;

function InstallFlow({ lang }: { lang: GuideLang }) {
  const ui = COPY[lang].ui.install;
  const ref = useRef<HTMLDivElement>(null);
  const [st, setSt] = useState({ index: 0, within: 0 });
  useVisibleTicker(ref, 60, (t) => setSt(stageAt(t, [2000, 1500, 900, 3800, 2200])));
  // The queue: the file uploading now, the one before it done, the next waiting.
  const pos = st.index === 3 ? st.within * QUEUE.length : st.index === 4 ? QUEUE.length : 0;
  const cur = Math.min(QUEUE.length - 1, Math.floor(pos));
  const f = pos - Math.floor(pos);
  const verifying = f >= UPLOAD_SHARE;
  const pct = verifying ? 90 : Math.round((f / UPLOAD_SHARE) * 90);
  const rows =
    st.index === 4
      ? QUEUE.slice(-3).map((name) => ({ name, state: "✓ done", on: false }))
      : [cur - 1, cur, cur + 1].map((i) => ({
          name: QUEUE[i] ?? "",
          state: i < cur ? "✓ done" : i === cur ? (verifying ? "verifying…" : `uploading ${pct}%`) : "waiting",
          on: i === cur,
        }));
  return (
    <div className={styles.extra} ref={ref} aria-hidden="true">
      <div className={styles.mockWindow}>
        <div className={styles.mockBar}>
          <span />
          <span />
          <span />
          <b>patternflow.local/patterns</b>
        </div>
        <div className={`${styles.mockBody} ${styles.mockTall}`}>
          {st.index === 0 && (
            <>
              <p className={styles.mockLine}>Storage needs formatting</p>
              <span className={styles.mockButton} data-pressed={st.within > 0.72 ? "1" : "0"}>
                Format storage
              </span>
            </>
          )}
          {st.index === 1 && (
            <>
              <p className={styles.mockLine}>Format pattern storage?</p>
              <p className={styles.mockSub}>{ui.confirm}</p>
              <span className={styles.mockButtons}>
                <span className={styles.mockButton} data-quiet="1">
                  Cancel
                </span>
                <span className={styles.mockButton} data-pressed={st.within > 0.7 ? "1" : "0"}>
                  OK
                </span>
              </span>
            </>
          )}
          {st.index === 2 && <p className={styles.mockLine}>formatting…</p>}
          {st.index >= 3 && (
            <ul className={styles.mockQueue}>
              {rows.map((r, i) =>
                r.name ? (
                  <li key={i} data-on={r.on ? "1" : "0"}>
                    <span>{r.name}</span>
                    <em>{r.state}</em>
                    {r.on && (
                      <i className={styles.mockProgress}>
                        <span style={{ width: `${pct}%` }} />
                      </i>
                    )}
                  </li>
                ) : (
                  <li key={i} />
                ),
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── console ─────────────────────────────────────────────────────────────────

// The device's real console pages on a simulated board (ConsoleWindow): a
// click lifts the window beside the 3D board, and both act on the same one.
function ConsoleTour({ lang }: { lang: GuideLang }) {
  const pages = COPY[lang].ui.pages;
  const [page, setPage] = useState<ConsolePage>(pages[0].id);
  return (
    <div className={styles.extra}>
      <div className={styles.tour} role="group" aria-label={COPY[lang].ui.tourLabel}>
        {pages.map((p) => (
          <button key={p.id} type="button" className={styles.tourTab} aria-pressed={p.id === page} onClick={() => setPage(p.id)}>
            {p.title}
          </button>
        ))}
      </div>
      <ConsoleWindow variant="desktop" page={page} lang={lang} />
      {/* Every page's line in one grid cell: the block is as tall as the
          longest, so the card (and the tabs under the pointer) doesn't move
          when a shorter one comes up. */}
      <div className={styles.tourNotes}>
        {pages.map((p) => (
          <p key={p.id} className={styles.tourNote} data-on={p.id === page ? "1" : "0"} aria-hidden={p.id !== page}>
            {p.body}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * The extra a step's copy names (copy.ts `extra`), inside that step's card.
 * `step` is the step's index in its chapter, for an extra that more than one
 * step uses and shows something different in each.
 */
export default function Extras({ kind, lang, step }: { kind: Extra; lang: GuideLang; step: number }) {
  // The build page's cards (build/BuildCards.tsx): the parts list, the
  // terminals' polarity, the checklists, the way to Play's flashing.
  if (kind.startsWith("build:")) return <BuildCards card={kind.slice(6) as BuildCard} lang={lang} step={step} />;
  switch (kind) {
    case "flashButton":
      return <FlashBlock lang={lang} />;
    case "bootSeq":
      return <BootSeq lang={lang} />;
    case "wifiShots":
      return <WifiShots lang={lang} />;
    case "deckFan":
      return <DeckFan lang={lang} />;
    case "installFlow":
      return <InstallFlow lang={lang} />;
    case "consoleDesktop":
      return <ConsoleWindow variant="desktop" lang={lang} />;
    case "consolePhone":
      return <ConsoleWindow variant="phone" lang={lang} />;
    case "consoleTour":
      return <ConsoleTour lang={lang} />;
    // The make page: 01 Community and 02 Pattern Lab. On a screen with the
    // desk (desk/DeskStage) the real thing is beside the card, so these —
    // screenshots, and the Lab in a tab — are for screens without it
    // (Guide.module.css .offDesk).
    case "communityShots":
      return (
        <div className={styles.offDesk}>
          <CommunityShots lang={lang} step={step} />
        </div>
      );
    case "labShots":
      return (
        <div className={styles.offDesk}>
          <LabShots lang={lang} step={step} />
        </div>
      );
    case "labWindow":
      return (
        <div className={styles.offDesk}>
          <LabWindow lang={lang} step={step} />
        </div>
      );
  }
}
