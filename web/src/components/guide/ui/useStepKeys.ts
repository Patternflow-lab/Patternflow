"use client";

import { useEffect, type RefObject } from "react";

// The guide by keyboard: → or J to the next stop, ← or K to the one before.
// A stop is what the scroll would stop on: the opening, each chapter's title,
// each step's card, the end. The page is scrolled there — the same thing a
// wheel does, so the stage follows as it always does — and nothing takes the
// focus: Tab still walks the links from where it was.
//
// The keys are left alone while they are someone else's: typing in a field
// or the Lab's editor, a window on Make's desk (its patterns scroll and its
// deck is rearranged with the arrows), the device's console, a held modifier.

/** Where the keyboard is busy with something of its own. */
export function busy(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("input, textarea, select, iframe, [contenteditable], [role='slider'], [role='tablist'], [data-win], [data-keys-own]"));
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** The page's stops, top to bottom, as scroll positions. */
function stops(root: HTMLElement): number[] {
  const vh = window.innerHeight;
  const max = Math.max(0, document.documentElement.scrollHeight - vh);
  const out: number[] = [0];
  const centre = (el: Element) => {
    const r = el.getBoundingClientRect();
    return Math.round(Math.min(max, Math.max(0, window.scrollY + r.top + r.height / 2 - vh / 2)));
  };
  root.querySelectorAll<HTMLElement>("[data-scene]").forEach((scene) => {
    const id = scene.dataset.scene;
    if (id === "opening") return;
    if (id === "next") {
      out.push(centre(scene));
      return;
    }
    const head = scene.querySelector("header");
    if (head) out.push(centre(head));
    scene.querySelectorAll("[data-step]").forEach((step) => out.push(centre(step)));
  });
  // In order, and no two on top of each other (a short page's last stops all clamp to its end).
  return out.sort((a, b) => a - b).filter((y, i, all) => i === 0 || y - all[i - 1] > 8);
}

export function useStepKeys(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const dir = e.key === "ArrowRight" || e.key === "j" || e.key === "J" ? 1 : e.key === "ArrowLeft" || e.key === "k" || e.key === "K" ? -1 : 0;
      if (!dir || busy(e.target) || busy(document.activeElement)) return;
      // A window lifted off the page (the console, a practice dialog) holds the page still.
      if (document.querySelector("[role='dialog']")) return;
      const el = root.current;
      if (!el) return;
      const all = stops(el);
      const y = window.scrollY;
      // From between two stops, the next one in that direction; from on one, the one after.
      const next = dir > 0 ? all.find((s) => s > y + 8) : [...all].reverse().find((s) => s < y - 8);
      if (next === undefined) return;
      e.preventDefault();
      window.scrollTo({ top: next, behavior: reducedMotion() ? "auto" : "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [root]);
}
