"use client";

import { useState } from "react";

// One submission at a time, decided in the same tick as the click (#455).
//
// A `busy` flag in React state cannot do that on its own. It disables the
// button on the NEXT render — a double-click, or a mouse switch that bounces,
// lands its second click before that render, and the handler's closure still
// reads `busy === false`. Two requests go out and the server makes two of
// whatever was being created: the same pattern side by side on the wall,
// created in the same second. A plain flag outside the render cycle changes
// at once.
//
//   const latch = useSubmitLatch();
//   const submit = async () => {
//     if (!latch.take()) return;
//     setBusy(true);
//     try { … } finally { latch.release(); setBusy(false); }
//   };
//
// `busy` stays for what the button shows; the latch is what refuses. A form
// that navigates away on success keeps the latch held rather than releasing
// it: the next page is on its way, and a press in that gap is a second post.

export type SubmitLatch = {
  /** True when this call may submit; false while another one is in flight. */
  take: () => boolean;
  /** Let the next submission through. */
  release: () => void;
};

export function useSubmitLatch(): SubmitLatch {
  // Made once per component; the flag lives in the closure, so it flips the
  // moment take() runs and survives every re-render in between.
  const [latch] = useState<SubmitLatch>(() => {
    let held = false;
    return {
      take: () => {
        if (held) return false;
        held = true;
        return true;
      },
      release: () => {
        held = false;
      },
    };
  });
  return latch;
}
