// The community routes' rate limiter keeps every key in one map and sweeps out
// idle keys once the map passes 10,000. The sweep used to judge every key by
// the window of the call that set it off. A minute-long like then emptied the
// hour-long build window, and somebody who had used their 30 builds for the
// hour got a 31st once enough other keys had piled up.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const START = Date.parse("2026-10-21T12:00:00Z");

/** Moves the clock to `ms` after the start of the test. */
const at = (ms: number) => vi.setSystemTime(START + ms);

// The buckets are module state, so each test starts from a fresh copy.
async function freshLimiter() {
  vi.resetModules();
  return (await import("./ratelimit")).rateLimit;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  at(0);
});

afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("lets `limit` calls through in a window and refuses the next", async () => {
    const rateLimit = await freshLimiter();
    for (let i = 0; i < 5; i++) expect(rateLimit("publish:ana", 5, MINUTE)).toBe(true);
    expect(rateLimit("publish:ana", 5, MINUTE)).toBe(false);
  });

  it("frees a call once its own window has passed, and refused calls do not count", async () => {
    const rateLimit = await freshLimiter();
    expect(rateLimit("publish:ana", 2, MINUTE)).toBe(true);
    at(30_000);
    expect(rateLimit("publish:ana", 2, MINUTE)).toBe(true);
    at(45_000);
    expect(rateLimit("publish:ana", 2, MINUTE)).toBe(false);

    // The first call drops out of the window a minute after it was made, not
    // a minute after the refusal.
    at(MINUTE - 1);
    expect(rateLimit("publish:ana", 2, MINUTE)).toBe(false);
    at(MINUTE);
    expect(rateLimit("publish:ana", 2, MINUTE)).toBe(true);
    expect(rateLimit("publish:ana", 2, MINUTE)).toBe(false);
  });

  it("counts each key on its own", async () => {
    const rateLimit = await freshLimiter();
    for (let i = 0; i < 5; i++) rateLimit("report:ana", 5, MINUTE);
    expect(rateLimit("report:ana", 5, MINUTE)).toBe(false);
    expect(rateLimit("report:ben", 5, MINUTE)).toBe(true);
    expect(rateLimit("post:ana", 5, MINUTE)).toBe(true);
  });

  it("keeps an hour of builds through a sweep that minute-long keys set off", async () => {
    const rateLimit = await freshLimiter();
    for (let i = 0; i < 30; i++) expect(rateLimit("build:ana", 30, HOUR)).toBe(true);
    expect(rateLimit("build:ana", 30, HOUR)).toBe(false);

    // Two minutes on, 10,000 people like a pattern. The last like takes the
    // map past 10,000 keys and sweeps it with a one-minute window.
    at(2 * MINUTE);
    for (let i = 0; i < 10_000; i++) rateLimit(`like:u${i}`, 60, MINUTE);

    expect(rateLimit("build:ana", 30, HOUR)).toBe(false);
  });

  it("still sweeps out the keys whose own window has passed", async () => {
    const rateLimit = await freshLimiter();
    for (let i = 0; i < 10_000; i++) rateLimit(`like:u${i}`, 60, MINUTE);
    rateLimit("build:ana", 30, HOUR);

    at(2 * MINUTE);
    const deleted = vi.spyOn(Map.prototype, "delete");
    rateLimit("like:late", 60, MINUTE);
    const keys = deleted.mock.calls.map(([key]) => key);
    deleted.mockRestore();

    expect(keys).toHaveLength(10_000);
    expect(keys).toContain("like:u0");
    expect(keys).not.toContain("build:ana");
    expect(keys).not.toContain("like:late");
  });
});
