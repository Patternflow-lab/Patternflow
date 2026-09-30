"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { lastLabDraft } from "./labFeed";
import { getSim, useGuideStore, type GuideLang } from "../store";
import { stepOf } from "../scenes";
import { NO_POINTER, forgetPillSize, placeTag } from "./tags";
import styles from "./MirrorTag.module.css";

// A pill over the device while it plays the reader's own Pattern Lab draft
// (a step with `mirror`, scenes/lab.ts): what is on the panel is theirs, not
// one of the board's patterns, and — when nothing is saved in this browser —
// that it is the pattern the lab opens with. It goes as soon as the board
// plays one of its own again (a pick on SELECT), or the step ends.
//
// A draft that doesn't run (a syntax error, a draw() that throws — the lab
// saves mid-edit, so one is easy to leave behind) keeps the pill, and the
// pill says so: the board meanwhile plays its own pattern (DeviceSim), and
// without a word it would look as if the guide itself had broken.
//
// Its words are here for now, in both languages (the copy's owner may move
// them to copy/make.ts); the page's language is read off the page, as the
// stage has no copy of its own.

type TagWords = { draft: string; starter: string; broken: string };

export const MIRROR_TAG_WORDS: Record<GuideLang, TagWords> = {
  en: { draft: "Your Lab draft", starter: "Pattern Lab's first pattern", broken: "doesn't run yet. Fix it in the Lab." },
  ko: { draft: "내 랩 초안", starter: "패턴 랩의 첫 패턴", broken: "아직 안 돌아가요. 랩에서 고쳐 주세요." },
};

// The top of the case, over its middle (views.ts DEVICE: x −1.23…1.23, top 1.58).
const ANCHOR = new THREE.Vector3(0, 1.58, 0.1);

/** The knob pills (Device.tsx), found once they are in the page. */
function knobTags(cache: { list: HTMLElement[] }): HTMLElement[] {
  if (cache.list.length === 0 || !cache.list[0].isConnected) {
    cache.list = Array.from(document.querySelectorAll<HTMLElement>(".guide-knob-tag[data-knob]"));
  }
  return cache.list;
}

/** A knob's readout is up where this tag is (K2's, above the case, on a phone). */
function underKnobTag(tag: HTMLElement, knobs: HTMLElement[]): boolean {
  let r: DOMRect | null = null;
  for (const k of knobs) {
    if (k.dataset.on !== "1") continue;
    r ??= tag.getBoundingClientRect();
    const q = k.getBoundingClientRect();
    if (r.right > q.left - 4 && r.left < q.right + 4 && r.bottom > q.top - 4 && r.top < q.bottom + 4) return true;
  }
  return false;
}

export default function MirrorTag() {
  const el = useRef<HTMLDivElement>(null);
  const shown = useRef({ on: false, text: "" });
  const knobs = useRef({ list: [] as HTMLElement[] });
  const gl = useThree((st) => st.gl);
  const size = useThree((st) => st.size);
  const lang = useMemo<GuideLang>(
    () => (gl.domElement.closest("[lang]")?.getAttribute("lang") === "ko" ? "ko" : "en"),
    [gl],
  );

  useFrame((state) => {
    const tag = el.current;
    if (!tag) return;
    const { scene, step } = useGuideStore.getState();
    const s = stepOf(scene, step);
    const sim = getSim();
    // The draft is on: running, or set and not running.
    const draft = s.mirror && s.power ? sim.mirrorState() : null;
    // It steps out of the way of a knob's readout while that is up — the
    // readout is the thing that moment.
    const on = draft !== null && !underKnobTag(tag, knobTags(knobs.current));
    if (on !== shown.current.on) {
      shown.current.on = on;
      tag.dataset.on = on ? "1" : "0";
    }
    if (!draft) return;
    const words = MIRROR_TAG_WORDS[lang];
    const what = lastLabDraft()?.source === "starter" ? words.starter : words.draft;
    const note = draft.broken ? words.broken : "";
    const text = `${what}\u0000${draft.name}\u0000${note}`;
    if (text !== shown.current.text) {
      shown.current.text = text;
      const w = tag.querySelector<HTMLElement>("[data-what]");
      const n = tag.querySelector<HTMLElement>("[data-name]");
      const b = tag.querySelector<HTMLElement>("[data-note]");
      if (w) w.textContent = what;
      if (n) n.textContent = draft.name;
      if (b) b.textContent = note;
      tag.dataset.broken = draft.broken ? "1" : "0";
      forgetPillSize(tag);
    }
    placeTag(tag, state.camera, size, ANCHOR, 0, "up", 12);
  });

  return (
    <Html position={ANCHOR} center zIndexRange={[20, 0]} style={NO_POINTER}>
      <div ref={el} className={styles.tag} data-on="0" data-broken="0">
        <span className={styles.row}>
          <i className={styles.dot} aria-hidden="true" />
          <span data-what="" className={styles.what} />
          <b data-name="" className={styles.name} />
        </span>
        <span data-note="" className={styles.note} />
      </div>
    </Html>
  );
}
