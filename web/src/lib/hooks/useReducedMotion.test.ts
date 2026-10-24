// useReducedMotion: the first screen's video, the 3D device's sway and the
// Inside globe's drift all stop on it, and start again when it turns off.
// The setting is a stub the test flips the way the system settings would.

import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

const REDUCE = "(prefers-reduced-motion: reduce)";

let reduce = false;
const listeners = new Set<() => void>();

beforeEach(() => {
  reduce = false;
  listeners.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return query === REDUCE ? reduce : false;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useReducedMotion", () => {
  it("reads the setting as it is", () => {
    reduce = true;
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it("follows it when it changes, both ways", () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    reduce = true;
    act(() => listeners.forEach((fn) => fn()));
    expect(result.current).toBe(true);
    reduce = false;
    act(() => listeners.forEach((fn) => fn()));
    expect(result.current).toBe(false);
  });

  it("stops listening once nothing uses it", () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("answers yes on the server, which cannot know", () => {
    function Probe() {
      return createElement("i", null, String(useReducedMotion()));
    }
    expect(renderToString(createElement(Probe))).toBe("<i>true</i>");
  });
});
