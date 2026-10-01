"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import guide from "../Guide.module.css";
import styles from "./Build.module.css";
import { BUILD_COPY, type BuildLink } from "../copy/build";
import type { GuideLang } from "../store";
import { BOM_URL, bomKey, dashed, type BomRow } from "./bom";
import { useBom } from "./BomContext";
import { CHECK_CARDS, LINK_CARDS, type BuildCard, type CheckCard, type LinkCard } from "./cards";

// The cards inside the Build guide's steps (a step's `extra`, "build:<card>",
// copy/build.ts): the parts list — the BOM file itself, read when the page
// was built — what else is on the bench, which case file to print, the
// soldering order, the two screw terminals' polarity, the checks to tick off,
// and the way to the Play guide for the firmware. Every word is in
// copy/build.ts `cards`.

// ── links ───────────────────────────────────────────────────────────────────

function Links({ links }: { links: BuildLink[] }) {
  return (
    <div className={styles.links}>
      {links.map((l) =>
        l.href.startsWith("/") ? (
          <Link key={l.href} href={l.href} className={styles.link}>
            {l.label}
            <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <a key={l.href} href={l.href} className={styles.link} target="_blank" rel="noopener noreferrer">
            {l.label}
            <span aria-hidden="true">↗</span>
          </a>
        ),
      )}
    </div>
  );
}

// ── ticks, kept in this browser ─────────────────────────────────────────────

// A checklist's ticks live in memory and, where the browser allows it, in
// localStorage — so they survive a reload, and a private window or blocked
// storage only loses that. Read through useSyncExternalStore: the server
// (and the first paint) has no ticks.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readTicks(key: string): string {
  const held = memory.get(key);
  if (held !== undefined) return held;
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeTicks(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage off: the memory copy is enough for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribeTicks(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function useTicks(key: string): [Set<number>, (i: number) => void] {
  const raw = useSyncExternalStore(
    subscribeTicks,
    () => readTicks(key),
    () => "",
  );
  const ticks = new Set(
    raw
      .split(",")
      .filter(Boolean)
      .map(Number)
      .filter((n) => Number.isInteger(n)),
  );
  const toggle = (i: number) => {
    const next = new Set(ticks);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    writeTicks(
      key,
      [...next].sort((a, b) => a - b).join(","),
    );
  };
  return [ticks, toggle];
}

function Checklist({ id, items }: { id: string; items: { label: string; aside?: React.ReactNode }[] }) {
  const [ticks, toggle] = useTicks(`pf.guide.build.${id}`);
  return (
    <ul className={styles.checks}>
      {items.map((item, i) => (
        <li key={item.label} data-done={ticks.has(i) ? "1" : "0"}>
          <label>
            <input type="checkbox" checked={ticks.has(i)} onChange={() => toggle(i)} />
            <span className={styles.box} aria-hidden="true" />
            <span className={styles.checkLabel}>{item.label}</span>
          </label>
          {item.aside}
        </li>
      ))}
    </ul>
  );
}

// ── the parts list ──────────────────────────────────────────────────────────

function BomList({ category, lang }: { category: BomRow["category"]; lang: GuideLang }) {
  const words = BUILD_COPY[lang].cards.bom;
  const rows = useBom()?.filter((r) => r.category === category);
  if (!rows) {
    return (
      <div className={guide.extra}>
        <p className={styles.caption}>{words.missing}</p>
        <Links links={[{ label: words.source, href: BOM_URL }]} />
      </div>
    );
  }
  return (
    <div className={guide.extra}>
      <ul className={styles.bom}>
        {rows.map((r) => {
          const tip = words.tips[bomKey(r)];
          // What to order it by: the part number, where it has one.
          const mpn = r.mpn && r.mpn !== "-" && r.mpn !== "generic" ? r.mpn : null;
          return (
            <li key={bomKey(r)} className={styles.bomRow}>
              <span className={styles.bomRef}>
                {r.ref !== "-" && <b>{dashed(r.ref.replace(" (sockets)", ""))}</b>}
                <span>×{dashed(r.qty)}</span>
              </span>
              <span className={styles.bomMain}>
                <span className={styles.bomPart}>{r.part}</span>
                {tip && <span className={styles.bomTip}>{tip}</span>}
                <span className={styles.bomSpec}>
                  {r.spec}
                  {mpn && (
                    <>
                      {" · "}
                      <code>{mpn}</code>
                    </>
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <Links links={[{ label: words.source, href: BOM_URL }, ...(category === "off-board" ? BUILD_COPY[lang].cards.links.linksPanel : [])]} />
    </div>
  );
}

// ── the bench ───────────────────────────────────────────────────────────────

function Tools({ lang }: { lang: GuideLang }) {
  const words = BUILD_COPY[lang].cards.tools;
  return (
    <div className={guide.extra}>
      <Checklist
        id="tools"
        items={words.items.map((t) => ({
          label: t.label,
          aside: (
            <a className={styles.where} href={t.href} target="_blank" rel="noopener noreferrer">
              {t.where}
            </a>
          ),
        }))}
      />
      <p className={styles.kept}>{words.kept}</p>
    </div>
  );
}

function Figures({ lang }: { lang: GuideLang }) {
  return (
    <dl className={`${guide.extra} ${styles.figures}`}>
      {BUILD_COPY[lang].cards.figures.map((f) => (
        <div key={f.value}>
          <dt>{f.value}</dt>
          <dd>{f.label}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── the case ────────────────────────────────────────────────────────────────

function CaseFiles({ lang }: { lang: GuideLang }) {
  const words = BUILD_COPY[lang].cards.caseFiles;
  return (
    <div className={guide.extra}>
      <ul className={styles.files}>
        {words.rows.map((r) => (
          <li key={r.file}>
            <span className={styles.fileBed}>{r.bed}</span>
            <a className={styles.fileName} href={r.href} target="_blank" rel="noopener noreferrer">
              {r.file}
            </a>
            <span className={styles.fileNote}>{r.note}</span>
          </li>
        ))}
      </ul>
      <p className={styles.caption}>{words.settingsLabel}</p>
      <ul className={styles.chips}>
        {words.settings.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <Links links={words.links} />
    </div>
  );
}

// ── soldering ───────────────────────────────────────────────────────────────

/** The order, with this step's part lit (the solder chapter's steps 1–4); the video on the first. */
function Order({ lang, step }: { lang: GuideLang; step: number }) {
  const words = BUILD_COPY[lang].cards.order;
  return (
    <div className={guide.extra}>
      <ol className={styles.order}>
        {words.steps.map((s, i) => (
          <li key={s} data-on={i === step ? "1" : "0"} data-done={i < step ? "1" : "0"}>
            <span>{i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <>
          <Links links={[words.video]} />
          <p className={styles.kept}>{words.skip}</p>
        </>
      )}
    </div>
  );
}

// ── the two screw terminals ─────────────────────────────────────────────────

// The board's bottom edge, drawn in KiCad's own millimetres (the v3.9 board's
// F side, hardware/pcb/kicad/patternflow.kicad_pcb): J4 at x 66.63/71.63 —
// GND, then +5 V — and J3, turned half round, at 111.5/116.5 — +5 V, then
// GND. Seen from the printed side with the encoders up, that is the view
// through the open back of the case, and the two are mirror images.
//
// Turned half round, J3 is J4 upside down as well: a terminal's wires go in
// on one side (the footprint's +y), and its "+5v" is printed at that edge.
// So J4's wires leave toward the board's bottom edge with its +5v under it
// (gr_text at y 154.69), and J3's leave up the board, toward the panel's
// cable, with its +5v over it (y 150.37). The stage runs them the same way
// (stage/build/BuildStage.tsx J4_ENTRY, J3_ENTRY); a drawing that sent both
// out of the bottom showed J3's the wrong way beside it. The marks are drawn
// beside their wire, not under it, and larger than the board prints them.
const J4 = { gnd: 66.63, plus: 71.63, y: 150.11, body: [64.13, 146.6, 10, 7.4] as const };
const J3 = { plus: 111.5, gnd: 116.5, y: 153.53, body: [109.0, 149.8, 10, 7.4] as const };
/** Where a wire that leaves up the board fades out, and one that leaves down it ends (past the edge). */
const WIRE_UP = 131.5;
const WIRE_DOWN = 161.8;
const C11 = { x: 69.21, y: 138.68, plusX: 71.71 };
const SOCKETS = [78.75, 104.15];
const BOARD = { x0: 60.5, x1: 122.5, y1: 159.5 };

function Screw({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={1.7} className={styles.screw} />
      <line x1={x - 1.1} y1={y + 0.5} x2={x + 1.1} y2={y - 0.5} className={styles.slot} />
    </g>
  );
}

/** A wire out of a terminal: down past the board's edge (J4's), or up the board, fading out (J3's). */
function Wire({ x, from, up, color }: { x: number; from: number; up?: boolean; color: "red" | "black" }) {
  if (up) {
    // A gradient along the wire (a class's stroke would override it).
    return (
      <g className={styles.wireUp}>
        {color === "black" && <line x1={x} y1={from} x2={x} y2={WIRE_UP} stroke="url(#pf-build-wire-halo)" strokeWidth={1.6} />}
        <line x1={x} y1={from} x2={x} y2={WIRE_UP} stroke={`url(#pf-build-wire-${color})`} strokeWidth={1.1} />
      </g>
    );
  }
  return (
    <g>
      {color === "black" && <line x1={x} y1={from} x2={x} y2={WIRE_DOWN} className={styles.wireHalo} />}
      <line x1={x} y1={from} x2={x} y2={WIRE_DOWN} className={color === "red" ? styles.wireRed : styles.wireBlack} />
    </g>
  );
}

function WireFade({ id, color, opacity = 1 }: { id: string; color: string; opacity?: number }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={WIRE_UP} x2={0} y2={WIRE_UP + 9}>
      <stop offset="0" stopColor={color} stopOpacity="0" />
      <stop offset="1" stopColor={color} stopOpacity={opacity} />
    </linearGradient>
  );
}

function Terminals({ lang, lit }: { lang: GuideLang; lit: "j4" | "j3" }) {
  const words = BUILD_COPY[lang].cards.terminals;
  const j4Bottom = J4.body[1] + J4.body[3];
  const j3Top = J3.body[1];
  const label = `J4: GND, +5V (${words.j4}). J3: +5V, GND (${words.j3}). ${words.seen}`;
  return (
    <figure className={`${guide.extra} ${styles.terminals}`} data-lit={lit}>
      <svg viewBox="57 129 69 41" role="img" aria-label={label}>
        <defs>
          <linearGradient id="pf-build-board-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.28" stopColor="#fff" stopOpacity="1" />
          </linearGradient>
          <mask id="pf-build-board-mask">
            <rect x={BOARD.x0 - 1} y={129} width={BOARD.x1 - BOARD.x0 + 2} height={BOARD.y1 - 129 + 1} fill="url(#pf-build-board-fade)" />
          </mask>
          <clipPath id="pf-build-c11">
            <circle cx={C11.x} cy={C11.y} r={5} />
          </clipPath>
          <WireFade id="pf-build-wire-red" color="#e5483b" />
          <WireFade id="pf-build-wire-black" color="#111111" />
          <WireFade id="pf-build-wire-halo" color="#efe9dd" opacity={0.5} />
        </defs>
        <g mask="url(#pf-build-board-mask)">
          <rect x={BOARD.x0} y={129} width={BOARD.x1 - BOARD.x0} height={BOARD.y1 - 129} rx={1.2} className={styles.board} />
          {SOCKETS.map((x) => (
            <rect key={x} x={x - 1.27} y={129} width={2.54} height={25.2} className={styles.socket} />
          ))}
        </g>
        <text x={91.45} y={157.4} className={styles.silk} textAnchor="middle">
          {words.usb}
        </text>
        {/* C11: + toward the sockets, the stripe (−) toward the edge. */}
        <g className={styles.dim}>
          <circle cx={C11.x} cy={C11.y} r={5} className={styles.cap} />
          <rect x={C11.x - 5} y={C11.y - 5} width={2.1} height={10} clipPath="url(#pf-build-c11)" className={styles.capStripe} />
          <text x={C11.plusX + 4.4} y={C11.y + 0.9} className={styles.silk} textAnchor="middle">
            +
          </text>
          <text x={C11.x} y={C11.y - 6.2} className={styles.silkSmall} textAnchor="middle">
            C11
          </text>
        </g>
        {/* J4: GND, +5 V. Its wires leave toward the bottom edge; its +5v is printed under it, by the + screw. */}
        <g className={styles.term} data-on={lit === "j4" ? "1" : "0"}>
          <rect x={J4.body[0] - 1.2} y={J4.body[1] - 1.2} width={J4.body[2] + 6} height={J4.body[3] + 5.6} rx={1.2} className={styles.ring} />
          <text x={J4.plus + 1.5} y={j4Bottom + 2.6} className={styles.silk} textAnchor="start">
            +5v
          </text>
          <Wire x={J4.gnd} from={j4Bottom} color="black" />
          <Wire x={J4.plus} from={j4Bottom} color="red" />
          <rect x={J4.body[0]} y={J4.body[1]} width={J4.body[2]} height={J4.body[3]} rx={0.6} className={styles.block} />
          <Screw x={J4.gnd} y={J4.y} />
          <Screw x={J4.plus} y={J4.y} />
          <text x={J4.gnd} y={164.6} className={styles.pin} textAnchor="middle">
            GND
          </text>
          <text x={J4.plus} y={164.6} className={`${styles.pin} ${styles.pinPlus}`} textAnchor="middle">
            +5V
          </text>
          <text x={BOARD.x0} y={168.9} className={styles.role} textAnchor="start">
            J4 · {words.j4}
          </text>
        </g>
        {/* J3, turned half round: +5 V, GND. Its wires leave up the board; its +5v is printed over it, by the + screw. */}
        <g className={styles.term} data-on={lit === "j3" ? "1" : "0"}>
          <rect x={J3.body[0] - 4.8} y={J3.body[1] - 4.4} width={J3.body[2] + 6} height={J3.body[3] + 5.6} rx={1.2} className={styles.ring} />
          <text x={J3.plus - 1.5} y={j3Top - 1.1} className={styles.silk} textAnchor="end">
            +5v
          </text>
          <Wire x={J3.plus} from={j3Top} up color="red" />
          <Wire x={J3.gnd} from={j3Top} up color="black" />
          <rect x={J3.body[0]} y={J3.body[1]} width={J3.body[2]} height={J3.body[3]} rx={0.6} className={styles.block} />
          <Screw x={J3.plus} y={J3.y} />
          <Screw x={J3.gnd} y={J3.y} />
          <text x={J3.plus} y={164.6} className={`${styles.pin} ${styles.pinPlus}`} textAnchor="middle">
            +5V
          </text>
          <text x={J3.gnd} y={164.6} className={styles.pin} textAnchor="middle">
            GND
          </text>
          <text x={BOARD.x1} y={168.9} className={styles.role} textAnchor="end">
            J3 · {words.j3}
          </text>
        </g>
      </svg>
      <figcaption className={styles.kept}>
        <span className={styles.swatch} data-c="red" aria-hidden="true" />
        {words.red} +5V
        <span className={styles.swatch} data-c="black" aria-hidden="true" />
        {words.black} GND · {words.seen}
      </figcaption>
      {lit === "j3" && <Links links={BUILD_COPY[lang].cards.links.linksWiring} />}
    </figure>
  );
}

// ── firmware, the knobs ─────────────────────────────────────────────────────

// The Play guide in a tab of its own: it has no way back to this page, and
// the build has to be here, at this step, when the flashing is done.
function Handoff({ lang }: { lang: GuideLang }) {
  const words = BUILD_COPY[lang].cards.handoff;
  return (
    <div className={guide.extra}>
      <Link href={words.href} className={`${guide.action} ${guide.actionFirst}`} target="_blank" rel="noopener">
        {words.label}
        <span aria-hidden="true">↗</span>
      </Link>
      <p className={styles.kept}>{words.line}</p>
    </div>
  );
}

// The cluster as the front shows it: K2 K1 over K4 K3.
const KNOB_GRID = [1, 0, 3, 2];

function KnobMap({ lang }: { lang: GuideLang }) {
  const words = BUILD_COPY[lang].cards.knobMap;
  return (
    <div className={guide.extra}>
      <ol className={styles.knobs}>
        {KNOB_GRID.map((k) => (
          <li key={k}>
            <b>K{k + 1}</b>
            {words.screens[k]}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── the card a step names ───────────────────────────────────────────────────

function isCheck(card: BuildCard): card is CheckCard {
  return (CHECK_CARDS as readonly string[]).includes(card);
}

function isLinks(card: BuildCard): card is LinkCard {
  return (LINK_CARDS as readonly string[]).includes(card);
}

/** The card a Build step names (`extra: "build:<card>"`). `step` is the step's index in its chapter. */
export default function BuildCards({ card, lang, step }: { card: BuildCard; lang: GuideLang; step: number }) {
  if (isCheck(card)) {
    return (
      <div className={guide.extra}>
        <Checklist id={card} items={BUILD_COPY[lang].cards.checks[card].map((label) => ({ label }))} />
      </div>
    );
  }
  if (isLinks(card)) {
    return (
      <div className={guide.extra}>
        <Links links={BUILD_COPY[lang].cards.links[card]} />
      </div>
    );
  }
  switch (card) {
    case "bomBoard":
      return <BomList category="pcb" lang={lang} />;
    case "bomOff":
      return <BomList category="off-board" lang={lang} />;
    case "tools":
      return <Tools lang={lang} />;
    case "figures":
      return <Figures lang={lang} />;
    case "caseFiles":
      return <CaseFiles lang={lang} />;
    case "order":
      return <Order lang={lang} step={step} />;
    case "j4":
    case "j3":
      return <Terminals lang={lang} lit={card} />;
    case "handoff":
      return <Handoff lang={lang} />;
    case "knobMap":
      return <KnobMap lang={lang} />;
  }
}
