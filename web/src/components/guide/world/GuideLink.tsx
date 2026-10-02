"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { pagePath, placeAnchor } from "../pages";
import { useGuideStore, type GuideLang, type GuideScreen } from "../store";

// A way from one page of the guide to another: the hub's three choices, a
// guide's way back to the hub, the way on at its end, the language switch.
//
// It is a real link (its address is right for a new tab, a copied link, a
// reader without scripts). Followed in place, the page does not just swap:
// the words leave first (store.leaveFor — Guide.module.css fades the story
// on .world[data-leaving], and the stage holds what it is showing: on the
// hub, the chosen guide's answer), and then the next page comes in over a
// stage that never went away and plays its way there.
//
// `keepPlace` is for the same guide in the other language: the address
// carries the step the reader is on, so they land where they were and the
// stage carries on with what it was doing.

/** How long the words take to leave before the next page is asked for, ms (the fade is Guide.module.css's). */
export const LEAVE_MS = 200;

let pending = 0;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  to: GuideScreen;
  lang: GuideLang;
  /** Land on the step the reader is on now (the language switch). */
  keepPlace?: boolean;
};

export default function GuideLink({ to, lang, keepPlace, onNavigate, ...rest }: Props) {
  const router = useRouter();
  const href = pagePath(to, lang);
  return (
    <Link
      href={href}
      {...rest}
      onNavigate={(e) => {
        onNavigate?.(e);
        const s = useGuideStore.getState();
        const target = keepPlace ? href + placeAnchor(s.scene, s.step, s.cardIn) : href;
        if (reducedMotion()) {
          // Nothing leaves: straight there (by hand only when the address is not the link's own).
          if (target !== href) {
            e.preventDefault();
            router.push(target);
          }
          return;
        }
        e.preventDefault();
        s.leaveFor(to);
        window.clearTimeout(pending);
        pending = window.setTimeout(() => router.push(target), LEAVE_MS);
      }}
    />
  );
}
