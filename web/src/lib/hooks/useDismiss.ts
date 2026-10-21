"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * A pop-up menu that closes without a mouse. A finger never leaves a menu the
 * way a pointer does, so a press anywhere outside it closes it. Esc closes it
 * and puts the focus back on its toggle. Tab on past its last item closes it
 * as well.
 *
 * The ref goes on the element that holds both the toggle and the menu, so a
 * press on the toggle stays the toggle's own. The toggle is the element in
 * there that carries aria-expanded.
 *
 * The press is heard in the capture phase. The lab's canvases and the dock
 * take their presses for themselves, and a menu has to hear them first.
 */
export function useDismiss<T extends HTMLElement>(
  open: boolean,
  onDismiss: () => void,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    const wrap = ref.current;
    if (!open || !wrap) return;
    const onPress = (event: PointerEvent) => {
      if (event.target instanceof Node && wrap.contains(event.target)) return;
      dismiss.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
      const hadFocus = wrap.contains(document.activeElement);
      dismiss.current();
      if (hadFocus) wrap.querySelector<HTMLElement>("[aria-expanded]")?.focus();
    };
    // No relatedTarget is the focus falling to the body: a press on nothing,
    // which onPress has, or an item that took itself away.
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && !wrap.contains(event.relatedTarget)) {
        dismiss.current();
      }
    };
    document.addEventListener("pointerdown", onPress, true);
    window.addEventListener("keydown", onKey);
    wrap.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      window.removeEventListener("keydown", onKey);
      wrap.removeEventListener("focusout", onFocusOut);
    };
  }, [open]);

  return ref;
}
