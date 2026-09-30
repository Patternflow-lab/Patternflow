"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import cs from "@/components/community/Community.module.css";
import { registerDeskApp, useDeskStore } from "../deskStore";
import { beatsFor } from "../script";
import { resolveTarget } from "../target";
import type { DeskAppProps } from "../types";
import type { CommunityHandle, PracticePage } from "./handle";
import { patternById } from "./data";
import { setScreensActive } from "./live";
import { DeckPage, DecksPage, Header, PatternPage, ViewContext, Wall } from "./pages";
import { PracticeNote } from "./parts";
import Dock from "./Dock";
import SendDialog from "./SendDialog";
import { usePractice } from "./state";
import { PRACTICE_WORDS } from "./words";
import ps from "./Practice.module.css";

// The practice community (05): a small copy of community.patternflow.work
// inside the desk's community window — the wall, a pattern's page and its
// send dialog, the deck bar, the Decks page and a deck's page — holding
// placeholder patterns (data.ts) and connected to nothing. The chapter's
// tutorial (tutorials/community.ts) points into it and waits for the reader
// to do each thing here themselves.
//
// Rendered once for the whole visit, never unmounted between steps (the desk
// keeps it), so what the reader built in one step is still there in the next.

/** The deck bar's height: what hides the bottom of the page. */
const DOCK_H = 68;

function pathOf(page: PracticePage): string {
  switch (page.kind) {
    case "wall":
      return "/community/patterns";
    case "pattern":
      return `/community/p/${page.id}`;
    case "decks":
      return "/community/decks";
    case "deck":
      return `/community/d/${page.id}`;
  }
}

export default function CommunityApp({ lang, shown, scene, step, reduced, setPath }: DeskAppProps) {
  const page = usePractice((s) => s.page);
  const visit = usePractice((s) => s.visit);
  const send = usePractice((s) => s.send);
  const note = usePractice((s) => s.note);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  const words = PRACTICE_WORDS[lang];

  // The address bar says where the reader is.
  useEffect(() => {
    setPath(pathOf(page));
  }, [page, setPath]);

  // A new page starts at its top, as a navigation does.
  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [visit]);

  // Screens run only while the window is on the desk.
  useEffect(() => {
    setScreensActive(shown);
  }, [shown]);
  useEffect(() => () => setScreensActive(false), []);

  // The window's visible size, for what has to fit without scrolling (read before the first paint).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth < 1 || el.clientHeight < 1) return;
      setView((v) => (v && v.w === el.clientWidth && v.h === el.clientHeight ? v : { w: el.clientWidth, h: el.clientHeight }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The tutorial's way in (desk/types.ts, tutorials/community.ts).
  useEffect(() => {
    const handle: CommunityHandle = {
      page: () => usePractice.getState().page,
      hasCpp: (id) => Boolean(patternById(id)?.hasCpp),
      flashableOnly: () => usePractice.getState().hw,
      deck: () => usePractice.getState().deck,
      sending: () => {
        const s = usePractice.getState().send;
        return !s ? "closed" : s.sent ? "sent" : "open";
      },
      built: () => usePractice.getState().build,
      demoPlay: (id) => {
        const st = usePractice.getState();
        st.setDemo({ id, turning: false });
        const timers: number[] = [];
        // After a moment, the wheel: K1 turns a little, one notch at a time.
        const start = st.knobsOf(id);
        for (let i = 1; i <= 10; i++) {
          timers.push(
            window.setTimeout(() => {
              const s = usePractice.getState();
              const now = s.knobsOf(id).slice();
              now[0] = Number(((start[0] + i * 0.04) % 1).toFixed(3));
              s.setKnobs(id, now);
            }, 1500 + i * 110),
          );
        }
        timers.push(window.setTimeout(() => usePractice.getState().setDemo(null), 4200));
        return () => {
          for (const t of timers) window.clearTimeout(t);
          const s = usePractice.getState();
          if (s.demo?.id === id) s.setDemo(null);
        };
      },
      demoAdd: (id) => {
        usePractice.getState().add(id);
      },
    };
    return registerDeskApp("community", handle);
  }, []);

  // Whatever the pointer is aiming at in this window is scrolled into view
  // (clear of the deck bar), the way a person would scroll to it.
  const run = useDeskStore((s) => s.run);
  const runKey = run?.key;
  const runIndex = run?.index;
  useEffect(() => {
    if (runKey !== `${scene}.${step}` || runIndex === undefined) return;
    const beat = beatsFor(scene, step)[runIndex];
    if (!beat || beat.win !== "community" || !beat.target) return;
    let tries = 0;
    let id = 0;
    const reveal = () => {
      const scroller = scrollRef.current;
      const el = resolveTarget(rootRef.current, beat.target);
      if (!scroller || !el) {
        if (tries++ < 10) id = window.setTimeout(reveal, 120);
        return;
      }
      if (!scroller.contains(el)) return; // the bar, a dialog: always in view
      const box = scroller.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const top = box.top + 12;
      const bottom = box.bottom - DOCK_H - 16;
      let by = 0;
      if (r.top < top) by = r.top - top;
      else if (r.bottom > bottom) by = Math.min(r.top - top, r.bottom - bottom);
      if (Math.abs(by) > 1) scroller.scrollBy({ top: by, behavior: reduced ? "auto" : "smooth" });
    };
    id = window.setTimeout(reveal, 60);
    return () => window.clearTimeout(id);
  }, [runKey, runIndex, scene, step, reduced]);

  // Esc closes the send dialog.
  useEffect(() => {
    if (!send) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && rootRef.current?.contains(document.activeElement)) usePractice.getState().closeSend();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [send]);

  const st = usePractice.getState;
  const style = { "--pc-view-h": `${Math.max(0, (view?.h ?? 640) - DOCK_H)}px` } as CSSProperties;

  return (
    <div ref={rootRef} className={ps.root} style={style} data-pc-root="">
      <ViewContext.Provider value={view}>
        <div ref={scrollRef} className={ps.scroll} data-pc-scroll="">
          {/* Where the real site puts its firmware notice: what this window is. It stays. */}
          <div className={`${cs.fwNotice} ${ps.banner}`}>
            <span className={cs.fwNoticeTag}>{words.tag}</span>
            <span className={cs.fwNoticeText}>{words.banner}</span>
          </div>
          <Header />
          <div className={`${cs.pageBody} ${ps.pageBody}`}>
            {page.kind === "wall" && <Wall />}
            {page.kind === "pattern" && <PatternPage key={page.id} id={page.id} />}
            {page.kind === "decks" && <DecksPage />}
            {page.kind === "deck" && <DeckPage key={page.id} id={page.id} />}
          </div>
          <div className={cs.dockSpacer} aria-hidden="true" />
        </div>
        <Dock />
        {send && <SendDialog key={send.id} lang={lang} />}
        {note && <PracticeNote key={note.seq} lang={lang} noteKey={note.key} n={note.n} onClose={() => st().unsay()} />}
      </ViewContext.Provider>
    </div>
  );
}
