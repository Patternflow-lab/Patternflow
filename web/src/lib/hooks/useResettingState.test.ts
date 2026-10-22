// useResettingState: the "Copied ✓" a Pattern Lab button wears for a moment.
// What matters is the timer, so the clock is fake and every case ends by
// counting the timers still waiting.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useResettingState } from "./useResettingState";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useResettingState", () => {
  it("goes back to idle once the time is up", () => {
    const { result } = renderHook(() => useResettingState("idle", 1200));
    act(() => result.current[1]("copied"));
    expect(result.current[0]).toBe("copied");
    act(() => vi.advanceTimersByTime(1199));
    expect(result.current[0]).toBe("copied");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe("idle");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a second set starts the wait over instead of ending with the first", () => {
    const { result } = renderHook(() => useResettingState<string | null>(null, 1200));
    act(() => result.current[1]("header"));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current[1]("header"));
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current[0]).toBe("header");
    act(() => vi.advanceTimersByTime(200));
    expect(result.current[0]).toBeNull();
  });

  it("leaves no timer behind when the component goes away mid-wait", () => {
    const { result, unmount } = renderHook(() => useResettingState(false, 1200));
    act(() => result.current[1](true));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a set that lands after the component went away starts nothing", () => {
    const { result, unmount } = renderHook(() => useResettingState(false, 1200));
    const set = result.current[1];
    unmount();
    set(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
