"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { DeskAppProps } from "../types";
import { deskSignal, registerDeskApp } from "../deskStore";
import { AI_PRESETS, AI_WORDS, answer, recognize, type PromptKind, type SetAnswer } from "./answers";
import styles from "./PracticeAi.module.css";

// The practice AI (06 Pattern Lab): a small, generic chat in a window on the
// make page's desk — no logos, no product names, no brand colours; its title
// bar says it gives set answers. The reader pastes the Lab's prompt (a real
// paste, Ctrl/⌘ V) and presses Send or Enter; it answers, typing, with a real
// preset's JavaScript or firmware header in a code block with a Copy button
// (answers.ts). Nothing goes over the network.
//
// Mounted once for the whole visit (DeskStage keeps practice windows alive),
// so the conversation carries from 02's prompt to 05's.
//
// The tutorial (tutorials/lab.ts) finds its parts by data attributes —
// data-ai-input, data-ai-send, data-ai-thread, data-ai-last (the newest
// answer, or the "writing…" line before it), data-ai-copy="js" | "h" — and
// asks it, through the handle it registers (AiHandle), what the reader has
// done in it: a beat can tell from that that the reader was quicker than the
// pointer, or did a step's middle before its start.

/** What a beat can ask the practice AI (ctx.app<AiHandle>("ai")). */
export type AiHandle = {
  /** Writing an answer (from Send until the last character is on screen). */
  busy: () => boolean;
  /** How many answers it has finished. */
  answered: () => number;
  /** Which of the Lab's prompts is in the message box now ("empty": nothing). */
  draftKind: () => PromptKind | "empty";
  /** When (performance.now()) the reader last sent a prompt of this kind; 0: never. */
  sentAt: (kind: PromptKind) => number;
  /** When the reader last copied an answer's code, by what it is; 0: never. */
  copiedAt: (kind: "js" | "h") => number;
  /** The text carries the JavaScript this practice AI last gave (it's in the Lab now, say). */
  carriesAnswer: (text: string) => boolean;
};

type Said = SetAnswer["kind"] | "hello";

type Msg =
  | { id: number; from: "you"; text: string; lines: number }
  | { id: number; from: "ai"; said: Said; code?: string; lang?: "javascript" | "cpp" };

/** Answer time, in ms per character, and its bounds: a real answer streams in, not instantly, nor for ages. */
const THINK_MS = 700;
const SAY_MS = 450;
const CODE_MS = { min: 1600, max: 3200, perChar: 0.34 };
/** A pasted text longer than this is shown collapsed. */
const LONG = { chars: 240, lines: 4 };

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

function lineCount(s: string) {
  return s.split(/\r\n?|\n/).length;
}

export default function PracticeAi({ lang, reduced }: DeskAppProps) {
  const w = AI_WORDS[lang];
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: "ai", said: "hello" }]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  /** The answer being typed out: its id and how many characters are on screen. */
  const [typing, setTyping] = useState<{ id: number; n: number } | null>(null);
  const [copied, setCopied] = useState<{ id: number; byHand: boolean } | null>(null);

  const thread = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const nextId = useRef(1);
  const lastJs = useRef<string | null>(null);
  const busy = useRef(false);
  const answered = useRef(0);
  const draftNow = useRef("");
  const sentAt = useRef<Partial<Record<PromptKind, number>>>({});
  const copiedAt = useRef<{ js: number; h: number }>({ js: 0, h: 0 });
  const timers = useRef(new Set<number>());
  const raf = useRef(0);
  const codeEls = useRef(new Map<number, HTMLElement>());
  const reducedRef = useRef(reduced);
  useLayoutEffect(() => {
    reducedRef.current = reduced;
  });

  const later = useCallback((ms: number, fn: () => void) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of t) window.clearTimeout(id);
      t.clear();
      cancelAnimationFrame(raf.current);
    };
  }, []);

  useLayoutEffect(() => {
    draftNow.current = draft;
  });

  // The tutorial's handle.
  useEffect(() => {
    const handle: AiHandle = {
      busy: () => busy.current,
      answered: () => answered.current,
      draftKind: () => (draftNow.current.trim() ? recognize(draftNow.current) : "empty"),
      sentAt: (kind) => sentAt.current[kind] ?? 0,
      copiedAt: (kind) => copiedAt.current[kind],
      carriesAnswer: (text) => {
        const p = AI_PRESETS.find((x) => x.id === lastJs.current);
        return Boolean(p && p.title.test(text));
      },
    };
    return registerDeskApp("ai", handle);
  }, []);

  // Keep the newest line in view while it's being written, unless the reader scrolled up to read.
  useLayoutEffect(() => {
    const el = thread.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
    if (typing) {
      const code = codeEls.current.get(typing.id);
      const pre = code?.parentElement;
      if (pre) pre.scrollTop = pre.scrollHeight;
    }
  }, [msgs, thinking, typing]);

  const finish = useCallback(() => {
    busy.current = false;
    answered.current += 1;
    setTyping(null);
    deskSignal("ai:answered");
  }, []);

  /** Type an answer out: its words, then its code. */
  const typeOut = useCallback(
    (m: Extract<Msg, { from: "ai" }>, sayLen: number) => {
      const codeLen = m.code?.length ?? 0;
      const total = sayLen + codeLen;
      if (reducedRef.current) {
        setTyping(null);
        finish();
        return;
      }
      const codeMs = codeLen ? Math.max(CODE_MS.min, Math.min(CODE_MS.max, codeLen * CODE_MS.perChar)) : 0;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = now - t0;
        const n = t < SAY_MS ? Math.round((t / SAY_MS) * sayLen) : sayLen + (codeMs ? Math.round(((t - SAY_MS) / codeMs) * codeLen) : 0);
        if (n >= total) {
          finish();
          return;
        }
        setTyping({ id: m.id, n });
        raf.current = requestAnimationFrame(step);
      };
      setTyping({ id: m.id, n: 0 });
      raf.current = requestAnimationFrame(step);
    },
    [finish],
  );

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || busy.current) return;
    busy.current = true;
    stick.current = true;
    const you: Msg = { id: nextId.current++, from: "you", text, lines: lineCount(text) };
    setMsgs((list) => [...list, you]);
    setDraft("");
    setThinking(true);
    const a = answer(text, lastJs.current);
    sentAt.current[a.kind] = performance.now();
    deskSignal("ai:sent");
    if (a.kind === "variation") lastJs.current = a.preset.id;
    later(reducedRef.current ? 350 : THINK_MS, () => {
      const m: Msg =
        a.kind === "other" || a.kind === "layer"
          ? { id: nextId.current++, from: "ai", said: a.kind }
          : { id: nextId.current++, from: "ai", said: a.kind, code: a.code, lang: a.lang };
      setThinking(false);
      setMsgs((list) => [...list, m]);
      typeOut(m, AI_WORDS[lang][m.said].length);
    });
  }, [draft, lang, later, typeOut]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  /** The reader has the code: stamped for the tutorial, and said. */
  const copiedCode = useCallback((m: Extract<Msg, { from: "ai" }>) => {
    copiedAt.current[m.said === "conversion" ? "h" : "js"] = performance.now();
    deskSignal("ai:copied");
  }, []);

  const copy = async (m: Extract<Msg, { from: "ai" }>) => {
    if (!m.code) return;
    let byHand = false;
    try {
      await navigator.clipboard.writeText(m.code);
      copiedCode(m);
    } catch {
      // The clipboard said no: select the code, for the reader's own Ctrl C.
      byHand = true;
      const el = codeEls.current.get(m.id);
      const sel = window.getSelection();
      if (el && sel) sel.selectAllChildren(el);
    }
    setCopied({ id: m.id, byHand });
    later(byHand ? 4000 : 1600, () => setCopied((c) => (c && c.id === m.id ? null : c)));
  };

  const lastAi = [...msgs].reverse().find((m) => m.from === "ai");

  return (
    <div className={styles.root} data-practice-ai="">
      <div
        ref={thread}
        className={styles.thread}
        data-ai-thread=""
        role="log"
        aria-label={w.thread}
        aria-busy={thinking || typing ? true : undefined}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
        }}
        // The reader's own Ctrl/⌘ C on a code block counts as copying it (the clipboard refused the button, say).
        onCopy={() => {
          const node = window.getSelection()?.anchorNode ?? null;
          for (const [id, el] of codeEls.current) {
            if (!node || !el.contains(node)) continue;
            const m = msgs.find((x) => x.id === id);
            if (m && m.from === "ai") copiedCode(m);
          }
        }}
      >
        {msgs.map((m) => {
          if (m.from === "you") {
            const long = m.text.length > LONG.chars || m.lines > LONG.lines;
            return (
              <div key={m.id} className={styles.you}>
                {long ? (
                  <div className={styles.pasted}>
                    <span className={styles.pastedHead}>{m.text.split(/\r\n?|\n/, 1)[0]}</span>
                    <span className={styles.pastedMeta}>{w.pasted(m.lines)}</span>
                  </div>
                ) : (
                  <p className={styles.youText}>{m.text}</p>
                )}
              </div>
            );
          }
          const say = w[m.said];
          const live = typing && typing.id === m.id ? typing.n : null;
          const sayShown = live === null ? say : say.slice(0, Math.min(live, say.length));
          const codeShown = m.code === undefined ? undefined : live === null ? m.code : m.code.slice(0, Math.max(0, live - say.length));
          const isLast = !thinking && m === lastAi;
          const done = live === null;
          const kind = m.said === "conversion" ? "h" : "js";
          return (
            <div key={m.id} className={styles.ai} data-ai-last={isLast ? "" : undefined} data-typing={done ? undefined : ""}>
              <span className={styles.mark} aria-hidden="true" />
              <div className={styles.aiBody}>
                <p className={styles.aiText}>{sayShown}</p>
                {codeShown !== undefined && (live === null || live > say.length) && (
                  <div className={styles.code}>
                    <div className={styles.codeBar}>
                      <span className={styles.codeLang}>{m.lang}</span>
                      {done && (
                        <button
                          type="button"
                          className={styles.copy}
                          data-ai-copy={kind}
                          data-state={copied?.id === m.id ? (copied.byHand ? "hand" : "done") : undefined}
                          onClick={() => void copy(m)}
                        >
                          {copied?.id === m.id ? (copied.byHand ? w.copyByHand(isMac() ? "⌘ C" : "Ctrl C") : w.copied) : w.copy}
                        </button>
                      )}
                    </div>
                    <pre className={styles.pre} tabIndex={0}>
                      <code
                        ref={(el) => {
                          if (el) codeEls.current.set(m.id, el);
                          else codeEls.current.delete(m.id);
                        }}
                      >
                        {codeShown}
                      </code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div className={styles.ai} data-ai-last="" data-thinking="">
            <span className={styles.mark} aria-hidden="true" />
            <div className={styles.aiBody}>
              <p className={styles.dots} aria-label={w.thinking}>
                <i />
                <i />
                <i />
              </p>
            </div>
          </div>
        )}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <textarea
          className={styles.input}
          data-ai-input=""
          value={draft}
          rows={2}
          placeholder={w.placeholder}
          aria-label={w.input}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className={styles.send} data-ai-send="" disabled={!draft.trim() || thinking || Boolean(typing)}>
          {w.send}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>
    </div>
  );
}
