"use client";

import { useEffect, type RefObject } from "react";

// What arrives when the reader reaches it — a chapter's number, its title's
// words, the end's — arrives once. A block marked [data-reveal] gets
// [data-in] the first time it comes onto the screen and keeps it: scrolling
// away and back, or back and forth across its edge, plays nothing again.
//
// A block that is already above the screen when the page opens (a link to a
// step further down, the other language at the same place) is marked
// "still": it is there, with no arriving, when the reader scrolls up to it.
//
// What is watched is the block's [data-reveal-at] (its title) when it has
// one, not the block: a chapter's head is most of a screen tall, and its
// words are not at its top.

export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const blocks = Array.from(el.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (typeof IntersectionObserver === "undefined") {
      blocks.forEach((b) => b.setAttribute("data-in", "still"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const block = (entry.target as HTMLElement).closest<HTMLElement>("[data-reveal]");
          if (!block) continue;
          if (entry.isIntersecting) {
            block.setAttribute("data-in", "1");
            io.unobserve(entry.target);
          } else if (entry.boundingClientRect.bottom < 0) {
            // Passed before it was ever seen.
            block.setAttribute("data-in", "still");
            io.unobserve(entry.target);
          }
        }
      },
      // A little inside the bottom of the screen, so it starts where it can be seen starting.
      { rootMargin: "0px 0px -12% 0px" },
    );
    for (const block of blocks) {
      if (block.hasAttribute("data-in")) continue;
      io.observe(block.querySelector<HTMLElement>("[data-reveal-at]") ?? block);
    }
    return () => io.disconnect();
  }, [root]);
}
