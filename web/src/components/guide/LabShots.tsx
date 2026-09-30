"use client";

// 06 Pattern Lab — the Lab's own screens inside a step's card, one after
// another the way FlasherShots shows the flasher's dialog, with a ring on the
// control each one is about and the Lab's own words quoted under it.
//
// Nothing here is redrawn. Every image in /guide/lab/ is a crop of the
// running Lab (/pattern-lab) in a fresh browser profile, or of the live
// community site logged out, taken at 2x by the scratchpad script
// lab_shots.py — which also writes the GEO block below (each image's size in
// CSS px, and the ring as % of the image). If the Lab's UI changes, re-run
// the script; the captions (WORDS) are by hand and quote the UI exactly
// (English in both languages).
//
// One screen at a time, stepping on its own only while its step is on stage
// (useGuideStore: page "make", scene "lab", step `step`), never under the
// pointer or keyboard focus, and not at all for reduced motion.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useGuideStore, type GuideLang } from "./store";
import styles from "./LabShots.module.css";

type ShotId =
  | "name"
  | "saved"
  | "recent"
  | "copyPrompt"
  | "paste"
  | "gallery"
  | "bw"
  | "ramp"
  | "rampRandom"
  | "color"
  | "knobs"
  | "push"
  | "convert"
  | "pasted"
  | "apply"
  | "layers"
  | "mask"
  | "blend"
  | "hwLayers"
  | "previewLayers"
  | "exportSize"
  | "exportGo"
  | "director"
  | "upload"
  | "port"
  | "perf";

/** An image in /guide/lab/: its size in CSS px (the file is 2x), and the ring as [left, top, width, height] in % of it. */
type Geo = { src: string; w: number; h: number; ring: [number, number, number, number] | null };

// lab_shots.py:begin — written by the capture script; re-run it, don't edit by hand.
const GEO: Record<ShotId, Geo> = {
  apply: { src: "ready-apply.webp", w: 456, h: 196, ring: [2.85, 71.99, 94.3, 21.43] },
  blend: { src: "layers-blend.webp", w: 423, h: 240, ring: [3.31, 72.1, 96.69, 24.99] },
  bw: { src: "preview-bw.webp", w: 401, h: 206, ring: null },
  color: { src: "preview-color.webp", w: 401, h: 206, ring: null },
  convert: { src: "convert.webp", w: 456, h: 256, ring: [2.85, 63.1, 94.3, 16.41] },
  copyPrompt: { src: "code.webp", w: 485, h: 236, ring: [59.65, 15.68, 20.89, 15.25] },
  director: { src: "director.webp", w: 480, h: 292, ring: [25.21, 12.67, 35.35, 12.33] },
  exportGo: { src: "export.webp", w: 476, h: 176, ring: [1.05, 76.93, 97.2, 20.45] },
  exportSize: { src: "export.webp", w: 476, h: 176, ring: [1.05, 21.02, 65.76, 20.45] },
  gallery: { src: "gallery.webp", w: 485, h: 236, ring: [62.91, 15.68, 25.4, 15.25] },
  hwLayers: { src: "hw-layers.webp", w: 456, h: 188, ring: [71.96, 60.77, 22.77, 20.21] },
  knobs: { src: "knobs.webp", w: 345, h: 186, ring: [4.06, 76.55, 93.91, 18.28] },
  layers: { src: "layers.webp", w: 423, h: 240, ring: [2.84, 0.83, 30.66, 15.0] },
  mask: { src: "layers.webp", w: 423, h: 240, ring: [3.31, 87.11, 57.06, 9.97] },
  name: { src: "name.webp", w: 400, h: 64, ring: [14.0, 6.25, 72.0, 56.25] },
  paste: { src: "code.webp", w: 485, h: 236, ring: [37.05, 15.68, 11.87, 15.25] },
  pasted: { src: "pasted.webp", w: 456, h: 224, ring: [2.85, 62.31, 94.3, 31.96] },
  perf: { src: "ports.webp", w: 464, h: 149, ring: [21.79, 76.96, 32.49, 21.93] },
  port: { src: "ports.webp", w: 464, h: 149, ring: [24.92, 8.72, 29.55, 21.93] },
  previewLayers: { src: "preview-layers.webp", w: 401, h: 206, ring: null },
  push: { src: "knobs.webp", w: 345, h: 186, ring: [82.78, 20.64, 15.19, 18.28] },
  ramp: { src: "ramp.webp", w: 345, h: 231, ring: [4.06, 20.35, 30.45, 16.45] },
  rampRandom: { src: "ramp-random.webp", w: 345, h: 231, ring: [4.06, 46.29, 93.91, 18.18] },
  recent: { src: "recent.webp", w: 440, h: 151, ring: [13.43, 7.95, 45.0, 85.29] },
  saved: { src: "name-saved.webp", w: 400, h: 64, ring: [14.0, 6.25, 72.0, 87.5] },
  upload: { src: "ready-upload.webp", w: 456, h: 162, ring: [2.85, 37.33, 94.3, 25.93] },
};
// lab_shots.py:end

/** The UI's own words for the shot (quoted as the Lab shows them), and a line about it. */
type Words = { title: string; en: string; ko: string };

const WORDS: Record<ShotId, Words> = {
  name: {
    title: "name this pattern",
    en: "At the top of the Lab. To hardware writes this name into the .h; the Director and Share start from it.",
    ko: "랩 맨 위에 있어요. To hardware가 이 이름을 .h에 적고, Director와 Share도 이 이름에서 시작해요.",
  },
  saved: {
    title: "Saved locally",
    en: "Saved as you go — in this browser only, not on a server or in your other browsers.",
    ko: "하는 대로 저장돼요. 이 브라우저에만요. 서버에도, 다른 브라우저에도 없어요.",
  },
  recent: {
    title: "Recent ▾",
    en: "Earlier work, parked when something replaced it. Share and To hardware sit beside it.",
    ko: "무언가에 밀려난 이전 작업이 여기 있어요. 옆에 Share와 To hardware가 있어요.",
  },
  copyPrompt: {
    title: "Copy prompt",
    en: "Copies the AI prompt for this layer, with its code in it.",
    ko: "이 레이어의 코드가 담긴 AI 프롬프트를 복사해요.",
  },
  paste: {
    title: "Paste",
    en: "Swaps this layer's code for what you copied. ‹ 1/6 › steps through the Lab's own examples.",
    ko: "복사한 코드로 이 레이어를 바꿔요. ‹ 1/6 ›은 랩에 든 예제를 넘겨요.",
  },
  gallery: {
    title: "Generate · Key",
    en: "Key takes your Gemini key, kept in this browser and sent only to Google. Generate asks for n variations; click a card to load one.",
    ko: "Key에 Gemini 키를 넣어요. 이 브라우저에만 저장되고 구글로만 가요. Generate를 누르면 n개를 받고, 카드를 누르면 불러와요.",
  },
  bw: {
    title: "Preview",
    en: "A v-field on the default ramp: each pixel's value, 0 to 1, shown black to white.",
    ko: "기본 램프 위의 v-field예요. 픽셀마다 0에서 1 사이 값이 검정에서 흰색으로 보여요.",
  },
  ramp: {
    title: "Random ramp",
    en: "Two to twelve stops in new colours, every press.",
    ko: "누를 때마다 새 색으로 2~12개의 지점이 생겨요.",
  },
  rampRandom: {
    title: "Color Ramp",
    en: "Click the bar to add a stop, drag one to move it, pick its colour below. Undo steps back.",
    ko: "바를 클릭하면 지점이 생기고, 끌면 옮겨지고, 색은 아래에서 골라요. Undo로 되돌려요.",
  },
  color: {
    title: "Preview",
    en: "The same values through that ramp. Want the AI to pick colours instead? Set the Gallery's v-field to rgb before copying the prompt.",
    ko: "같은 값이 그 램프를 거친 모습이에요. 색을 AI에게 맡기려면, 프롬프트를 복사하기 전에 Gallery의 v-field를 rgb로 바꿔요.",
  },
  knobs: {
    title: "Knobs",
    en: "The boxes either side of a slider are its range. Drag a digit sideways, or double-click and type.",
    ko: "슬라이더 양옆 칸이 범위예요. 숫자를 옆으로 끌거나, 두 번 클릭해 입력해요.",
  },
  push: {
    title: "Push",
    en: "A short press, as on the board. Holding a knob belongs to the board.",
    ko: "보드에서 짧게 누르는 것과 같아요. 꾹 누르기는 보드 몫이에요.",
  },
  convert: {
    title: "Copy the conversion prompt",
    en: "The prompt for your AI: the pattern with its name, knobs and ranges, the ramp as a finished colour table, and how Patternflow's C++ is written.",
    ko: "AI에게 줄 프롬프트예요. 패턴과 그 이름, 노브와 범위, 완성된 색 표로 바뀐 램프, 그리고 패턴플로우 C++를 쓰는 법이 들어 있어요.",
  },
  pasted: {
    title: "Looks like a header ✓",
    en: "Here, the real .h of the pattern the Lab opens with. Copy .h and Download .h keep a copy; Next → goes on.",
    ko: "여기 붙인 건 랩이 처음 여는 패턴의 실제 .h예요. Copy .h와 Download .h로 사본을 남기고, Next →로 넘어가요.",
  },
  apply: {
    title: "↗ Apply to my Patternflow",
    en: "Builds the module in a second or two, then offers Send over Wi-Fi and Download .zip instead. Needs you signed in to the community.",
    ko: "1~2초 만에 모듈을 만들고, Send over Wi-Fi와 Download .zip instead를 보여 줘요. 커뮤니티에 로그인해야 해요.",
  },
  layers: {
    title: "+ Code · + Pixel",
    en: "The top of the list is the top of the stack. Drag to reorder, double-click to rename.",
    ko: "목록 맨 위가 맨 위 레이어예요. 끌어서 순서를 바꾸고, 두 번 클릭해 이름을 바꿔요.",
  },
  mask: {
    title: "masks layer below",
    en: "Code 2 here is a mask: it draws nothing, and Code 1 shows only where Code 2 is bright. invert flips it.",
    ko: "여기 Code 2는 마스크예요. 직접 그리지 않고, Code 2가 밝은 곳에서만 Code 1이 보여요. invert는 반대로요.",
  },
  blend: {
    title: "Opacity · Blend",
    en: "For a layer that paints: how much of it shows, and how it mixes with what's under it — normal, add, multiply or screen.",
    ko: "그리는 레이어라면 얼마나 보일지, 아래와 어떻게 섞일지를 정해요. normal, add, multiply, screen이 있어요.",
  },
  hwLayers: {
    title: "Copy prompt",
    en: "A stack gets one prompt per code layer. A layer not done yet keeps a stub, so a half-done port still builds.",
    ko: "레이어를 쌓으면 코드 레이어마다 프롬프트가 하나씩이에요. 아직 안 한 레이어는 빈 자리로 남아서, 반만 해도 빌드돼요.",
  },
  previewLayers: {
    title: "Preview",
    en: "Code 1 through Code 2's mask.",
    ko: "Code 2의 마스크를 거친 Code 1이에요.",
  },
  exportSize: {
    title: "Business card 3.5 × 2 in @ 300 dpi (1050 × 600)",
    en: "A size preset, like the frame × 4 to × 16, Full HD or 4K. Custom… goes up to 4096 px a side.",
    ko: "크기 프리셋이에요. 프레임의 4~16배, Full HD, 4K 같은 것들이 있고, Custom…은 한 변 4096px까지 돼요.",
  },
  exportGo: {
    title: "Save PNG · ● Record",
    en: "A still, or a clip of up to a minute at 24, 30 or 60 fps, as MP4 or WebM.",
    ko: "정지 이미지, 또는 24·30·60fps로 1분까지 녹화한 MP4나 WebM이에요.",
  },
  director: {
    title: ".pfs · .mid · Render…",
    en: "Keyframes on Glitch's lane, a smooth curve between them; ▶ plays it. .pfs is the show for a Performance-edition board, .mid the same moves as MIDI for Ableton, Render… a video.",
    ko: "Glitch 줄에 찍은 키프레임과 그 사이 곡선이에요. ▶로 재생해요. .pfs는 퍼포먼스 에디션 보드용 쇼, .mid는 에이블톤용 MIDI, Render…는 영상이에요.",
  },
  upload: {
    title: "Upload to the community",
    en: "Under Apply. The pattern and its .h go up together. Opened from someone's pattern, it goes up as their fork: the top of the Lab says forking from …, and its × undoes that.",
    ko: "Apply 아래에 있어요. 패턴과 .h가 함께 올라가요. 남의 패턴에서 시작했다면 그 패턴의 포크로 올라가요. 랩 맨 위에 forking from …이 뜨고, ×로 뗄 수 있어요.",
  },
  port: {
    title: "Port this pattern (.h)",
    en: "On a pattern with no header yet. Propose the .h you made, signed in, and it goes live at once, credited to you.",
    ko: "아직 헤더가 없는 패턴에 있어요. 만든 .h를 로그인해서 제안하면 바로 올라가고, 내 이름이 붙어요.",
  },
  perf: {
    title: "Publish a performance",
    en: "Adds a Director show, the .pfs you saved, to anyone's pattern. Signed in, and live at once, credited to you.",
    ko: "디렉터 쇼, 저장해 둔 .pfs를 누구의 패턴에든 붙여요. 로그인해야 하고, 바로 올라가며 내 이름이 붙어요.",
  },
};

/** Which screens each step of the chapter shows (copy/lab.ts steps with extra: "labShots"). */
const STEPS: Record<number, ShotId[]> = {
  1: ["name", "saved", "recent"],
  2: ["copyPrompt", "paste", "gallery"],
  3: ["bw", "ramp", "rampRandom", "color"],
  4: ["knobs", "push"],
  5: ["convert"],
  6: ["pasted", "apply"],
  7: ["layers", "mask", "previewLayers", "blend", "hwLayers"],
  8: ["exportSize", "exportGo"],
  9: ["director"],
  10: ["upload", "port", "perf"],
};

const BASE = "/guide/lab/";
const STEP_MS = 3400;
const LAST_HOLD_MS = 1400;
// Space around the screens inside the frame, in the screens' CSS px.
const PAD = 12;
// Never taller than this share of the viewport: the card has to fit on
// screen with its text (desktop), or under the stage (phone).
const MAX_VH = 30;
const MAX_VH_NARROW = 25;

const UI = {
  en: { label: "Pattern Lab, screen by screen", step: "Screen" },
  ko: { label: "패턴 랩 화면 순서", step: "화면" },
} as const;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// On the server nothing moves; the client decides after hydration.
const getReducedMotionServer = () => true;

const pct = (n: number) => `${n.toFixed(3)}%`;

export default function LabShots({ lang, step }: { lang: GuideLang; step: number }) {
  // Only shots the capture script has written: a list that names one it
  // hasn't (a stale checkout) shows the rest rather than a broken image.
  const ids = (STEPS[step] ?? []).filter((id) => GEO[id]);
  const n = ids.length;
  const ui = UI[lang];

  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);
  const onStage = useGuideStore((s) => s.page === "make" && s.scene === "lab" && s.step === step);

  const active = n ? index % n : 0;
  const running = onStage && n > 1 && !hovered && !focused && !reduced;

  // Off stage it goes back to its first screen, so a reader who comes to it
  // sees the sequence from the start. Adjusted while rendering (React's
  // "storing information from previous renders"), not in an effect.
  const [wasOnStage, setWasOnStage] = useState(onStage);
  if (wasOnStage !== onStage) {
    setWasOnStage(onStage);
    if (!onStage) setIndex(0);
  }

  // One timeout per screen, so a click restarts the clock on the new screen.
  useEffect(() => {
    if (!running) return;
    const ms = STEP_MS + (active === n - 1 ? LAST_HOLD_MS : 0);
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % n), ms);
    return () => window.clearTimeout(t);
  }, [running, active, n]);

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }, []);

  if (!n) return null;

  // Every screen of the step at one scale, in a frame sized for the largest,
  // so a small toolbar looks small next to a dialog — as it does.
  const geos = ids.map((id) => GEO[id]);
  const unitW = Math.max(...geos.map((g) => g.w)) + PAD * 2;
  const unitH = Math.max(...geos.map((g) => g.h)) + PAD * 2;
  // Distinct images, once each: consecutive shots of the same screen only move the ring.
  const images = geos.filter((g, i) => geos.findIndex((o) => o.src === g.src) === i);
  const cur = geos[active];
  const onSrc = cur.src;
  const words = WORDS[ids[active]];

  // Where the current screen sits in the frame, and its ring, in % of the frame.
  const left = (unitW - cur.w) / 2;
  const top = (unitH - cur.h) / 2;
  const ringStyle = cur.ring
    ? {
        left: pct(((left + (cur.ring[0] / 100) * cur.w) / unitW) * 100),
        top: pct(((top + (cur.ring[1] / 100) * cur.h) / unitH) * 100),
        width: pct((((cur.ring[2] / 100) * cur.w) / unitW) * 100),
        height: pct((((cur.ring[3] / 100) * cur.h) / unitH) * 100),
      }
    : null;

  return (
    <figure
      className={styles.shots}
      aria-label={ui.label}
      data-reduced={reduced ? "1" : "0"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div
        className={styles.frame}
        style={
          {
            aspectRatio: `${unitW} / ${unitH}`,
            "--cap": `${((unitW / unitH) * MAX_VH).toFixed(2)}vh`,
            "--cap-narrow": `${((unitW / unitH) * MAX_VH_NARROW).toFixed(2)}vh`,
          } as React.CSSProperties
        }
      >
        {images.map((g) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={g.src}
            src={BASE + g.src}
            width={g.w}
            height={g.h}
            alt={g.src === onSrc ? words.title : ""}
            aria-hidden={g.src === onSrc ? undefined : true}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={styles.shot}
            data-on={g.src === onSrc ? "1" : "0"}
            style={{ width: pct((g.w / unitW) * 100) }}
          />
        ))}
        {/* Keyed by screen, so it comes in again with each one. */}
        {ringStyle && <span key={active} className={styles.ring} style={ringStyle} aria-hidden="true" />}
      </div>

      <figcaption className={styles.caption}>
        {n > 1 && (
          <div className={styles.dots} role="group" aria-label={ui.label}>
            {ids.map((id, i) => (
              <button
                key={id}
                type="button"
                className={styles.dot}
                data-on={i === active ? "1" : "0"}
                data-done={i < active ? "1" : "0"}
                aria-label={`${ui.step} ${i + 1}: ${WORDS[id].title}`}
                aria-current={i === active ? "step" : undefined}
                onClick={() => setIndex(i)}
              >
                <span>{i + 1}</span>
              </button>
            ))}
            <span className={styles.count} aria-hidden="true">
              {active + 1} / {n}
            </span>
          </div>
        )}
        {/* Every caption of the step in one grid cell: the block is as tall
            as the longest, whichever screen is up. */}
        <div className={styles.texts} aria-live={running ? "off" : "polite"}>
          {ids.map((id, i) => {
            const on = i === active;
            return (
              <p key={id} className={styles.text} data-on={on ? "1" : "0"} aria-hidden={on ? undefined : true}>
                <b>{WORDS[id].title}</b>
                <span>{WORDS[id][lang]}</span>
              </p>
            );
          })}
        </div>
      </figcaption>
    </figure>
  );
}
