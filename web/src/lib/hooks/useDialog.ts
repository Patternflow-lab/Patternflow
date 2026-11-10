"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * What a modal owes the keyboard. Esc closes it, the focus moves into it when
 * it opens, and the focus goes back to whatever opened it when it closes.
 * While it is open Tab and Shift+Tab go round its own controls, and the page
 * behind it does not scroll.
 *
 * The ref goes on an element inside the dialog with tabIndex={-1}. Esc is
 * heard on the window, so it still works after a step change took the focused
 * button away and left the focus on the body. An Esc that something inside
 * already used (preventDefault), or one that ends an IME composition, is left
 * alone.
 *
 * A dialog that opens another on top passes an onClose that closes the top
 * one first: one Esc, one window. Tab belongs to the one on top, and the page
 * stays still until the last of them closes.
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

  // Before this, Tab from the last control in a window went on to the page
  // under the backdrop, and the wheel scrolled the community wall behind it.
  useEffect(() => {
    const dialog: OpenDialog = {
      root: () => ref.current?.closest<HTMLElement>('[role="dialog"]') ?? ref.current,
    };
    open.push(dialog);
    holdPage();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.defaultPrevented || topDialog() !== dialog) return;
      const root = dialog.root();
      if (!root) return;
      const stops = tabStops(root);
      if (stops.length === 0) {
        event.preventDefault();
        return;
      }
      const first = stops[0];
      const last = stops[stops.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !stops.includes(active)) {
        // On the card, or somewhere outside: start from an end.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      const at = open.indexOf(dialog);
      if (at !== -1) open.splice(at, 1);
      releasePage();
    };
  }, []);

  return ref;
}

type OpenDialog = { root: () => HTMLElement | null };

// Every open dialog, in the order their effects ran.
const open: OpenDialog[] = [];

// The one on top: the newest that has no other open dialog inside it. A
// window drawn inside another (Send inside To hardware) runs its effects
// before the outer one when both appear in the same commit, so the order
// alone is not enough.
function topDialog(): OpenDialog | undefined {
  for (let i = open.length - 1; i >= 0; i--) {
    const root = open[i].root();
    if (!root) continue;
    const holdsAnother = open.some((other) => {
      if (other === open[i]) return false;
      const inner = other.root();
      return inner !== null && inner !== root && root.contains(inner);
    });
    if (!holdsAnother) return open[i];
  }
  return undefined;
}

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function tabStops(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    // A control in a closed branch cannot take the focus. jsdom has no
    // checkVisibility and lays nothing out, so there every control counts.
    (el) => typeof el.checkVisibility !== "function" || el.checkVisibility(),
  );
  // Tab stops once in a radio group, on the checked one when there is one.
  const checkedGroups = new Set(
    all.filter((el) => isRadio(el) && el.checked && el.name).map((el) => (el as HTMLInputElement).name),
  );
  return all.filter((el) => !(isRadio(el) && !el.checked && checkedGroups.has(el.name)));
}

function isRadio(el: HTMLElement): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === "radio";
}

// The page behind holds still while any dialog is open. A window opened over
// another one counts as a second hold, so closing it leaves the page held for
// the window underneath.
let holds = 0;
let released: { overflow: string; paddingRight: string } | null = null;

function holdPage() {
  holds += 1;
  if (holds > 1) return;
  const body = document.body;
  released = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  // The padding stands in for the scrollbar that overflow: hidden takes away,
  // so the page does not move sideways under the backdrop. jsdom measures
  // every box as 0 wide and gets none.
  const inside = document.documentElement.clientWidth;
  const scrollbar = inside > 0 ? window.innerWidth - inside : 0;
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function releasePage() {
  holds = Math.max(0, holds - 1);
  if (holds > 0 || !released) return;
  document.body.style.overflow = released.overflow;
  document.body.style.paddingRight = released.paddingRight;
  released = null;
}
