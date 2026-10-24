"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * What a modal owes the keyboard. Esc closes it, the focus moves into it when
 * it opens, and the focus goes back to whatever opened it when it closes.
 *
 * The ref goes on an element inside the dialog with tabIndex={-1}. Esc is
 * heard on the window, so it still works after a step change took the focused
 * button away and left the focus on the body. An Esc that something inside
 * already used (preventDefault), or one that ends an IME composition, is left
 * alone.
 *
 * A dialog that opens another on top passes an onClose that closes the top
 * one first: one Esc, one window.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const close = useRef(onClose);

  // In the commit, not after it: the render that opens a window on top hands
  // over the onClose that closes it, and an Esc that came before the passive
  // effects ran closed the window underneath.
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      close.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return ref;
}
