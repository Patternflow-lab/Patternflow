"use client";

import { useSyncExternalStore } from "react";

// Whether the reader has asked their system for less motion, followed as they
// change it. The server cannot know, so it answers yes: the page it sends
// holds still, and anything that moves by itself arrives with the client.
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(REDUCED_MOTION).matches;
const getServerSnapshot = () => true;

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
