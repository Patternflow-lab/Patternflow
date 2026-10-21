"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A state that goes back to `idle` by itself, `ms` after it was last set:
 * the "Copied ✓" a button wears for a second and a bit.
 *
 * Setting it again starts the wait over, so a second click is not cut short
 * by the first click's timer. The timer goes with the component: a panel
 * closed inside that second leaves nothing behind, and a set that lands after
 * it closed (a clipboard write resolving late) starts no timer at all. A
 * timer left behind used to fire after the Pattern Lab tests had torn their
 * DOM down, and failed a run in which every test had passed.
 */
export function useResettingState<T>(idle: T, ms: number): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(idle);
  const timer = useRef<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);

  const set = useCallback(
    (next: T) => {
      if (!mounted.current) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      setValue(next);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        setValue(idle);
      }, ms);
    },
    [idle, ms],
  );

  return [value, set];
}
