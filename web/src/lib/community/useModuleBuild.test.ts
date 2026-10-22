// useModuleBuild — queueing a .pfm build and waiting for it, which the deck
// bar, the deck panel and the Send window all do. The route is the server
// smokes' business; this is the waiting. It stops when the build settles, and
// stops when the server has been quiet for longer than the build was promised.
// An old build's answer never lands on top of a newer one.

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureEvent } from "@/lib/posthogEvents";
import { buildExpectedS, buildTimeoutMs, useModuleBuild, type ModuleBuildState } from "./useModuleBuild";

vi.mock("@/lib/posthogEvents", () => ({ captureEvent: vi.fn() }));

function answer(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function state(status: ModuleBuildState["status"], extra: Partial<ModuleBuildState> = {}) {
  return {
    id: "b1",
    status,
    queuePosition: null,
    elapsedMs: null,
    bytes: null,
    error: null,
    namespaces: [],
    modulesUrl: null,
    ...extra,
  } satisfies ModuleBuildState;
}

/** A fetch that answers when the test says so. */
function deferred() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return {
    promise,
    answer: (body: unknown) => resolve(new Response(JSON.stringify(body), { status: 200 })),
  };
}

const WAVE = { label: "Wave", code: "// wave" };
const deckOf = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `P${i + 1}`, code: `// ${i}` }));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Let pending promises settle, then move the clock. */
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const polls = () => fetchMock.mock.calls.filter((call) => String(call[0]).includes("/builds/")).length;

describe("module build", () => {
  it("expects longer of a bigger build and waits five seconds past that", () => {
    expect(buildExpectedS(1)).toBe(8);
    expect(buildTimeoutMs(1)).toBe(13_000);
    expect(buildExpectedS(10)).toBe(21);
    expect(buildTimeoutMs(10)).toBe(26_000);
    // An empty list is never sent, but the sum still treats it as one.
    expect(buildExpectedS(0)).toBe(buildExpectedS(1));
  });

  it("queues the patterns in order and stops asking once the build is done", async () => {
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }, 202))
      .mockImplementationOnce(() => answer(state("running")))
      .mockImplementationOnce(() =>
        answer(state("done", { namespaces: ["p1", "p2"], bytes: 12_288, modulesUrl: "/m" })),
      );
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start(deckOf(2));
    });
    expect(result.current.busy).toBe(true);
    expect(result.current.running).toBe(true);
    await tick();
    expect(result.current.busy).toBe(false);
    expect(result.current.build?.status).toBe("running");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/community/builds");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(String(init.body))).toEqual({ format: "pfm", patterns: deckOf(2) });

    await tick(1000);
    expect(result.current.build?.status).toBe("done");
    expect(result.current.running).toBe(false);
    expect(result.current.error).toBeNull();

    await tick(30_000);
    expect(polls()).toBe(2);
    expect(captureEvent).toHaveBeenCalledWith("module_build_queued", { patterns: 2 });
    expect(captureEvent).toHaveBeenCalledWith("module_build_finished", {
      status: "done",
      patterns: 2,
      bytes: 12_288,
    });
  });

  it("counts the seconds and says when the build is past what it was promised", async () => {
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }))
      .mockImplementation(() => answer(state("running")));
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick();
    expect(result.current.waited).toBe(0);
    expect(result.current.expectedS).toBe(8);
    await tick(3000);
    expect(result.current.waited).toBe(3);
    await tick(5000);
    expect(result.current.waited).toBeGreaterThanOrEqual(result.current.expectedS);
    expect(result.current.running).toBe(true);
  });

  it.each([
    [1, 13],
    [10, 26],
  ])("gives up on a %i-pattern build after %i seconds of a server that keeps saying running", async (n, seconds) => {
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }))
      .mockImplementation(() => answer(state("running")));
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start(deckOf(n));
    });
    await tick();
    await tick(seconds * 1000);
    // Exactly at the limit it is still listening.
    expect(result.current.running).toBe(true);
    expect(result.current.error).toBeNull();

    await tick(1000);
    expect(result.current.running).toBe(false);
    expect(result.current.build).toBeNull();
    expect(result.current.error).toContain(`has not answered in ${seconds} seconds`);
    expect(result.current.error).toContain("may still be running");
    expect(captureEvent).toHaveBeenCalledWith("module_build_finished", { status: "timeout", patterns: n });

    const asked = polls();
    await tick(60_000);
    expect(polls()).toBe(asked);
  });

  it("gives up on time even when the requests themselves hang", async () => {
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }))
      .mockImplementation(() => new Promise<Response>(() => {}));
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick();
    await tick(14_000);
    expect(result.current.running).toBe(false);
    expect(result.current.error).toContain("has not answered in 13 seconds");
  });

  it("says why the server would not queue it, and does not start asking", async () => {
    fetchMock.mockImplementationOnce(() => answer({ error: "Too many builds — wait a minute." }, 429));
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick(5000);
    expect(result.current.error).toBe("Too many builds — wait a minute.");
    expect(result.current.build).toBeNull();
    expect(result.current.running).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reads a request that never arrived as the network, not the build", async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError("Failed to fetch")));
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick();
    expect(result.current.error).toBe("Network error — is the build server reachable?");
    expect(result.current.running).toBe(false);
  });

  it("keeps a finished build when a slower answer from an earlier tick arrives after it", async () => {
    const slow = deferred();
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }))
      .mockImplementationOnce(() => slow.promise)
      .mockImplementationOnce(() => answer(state("done", { modulesUrl: "/m" })));
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick();
    await tick(1000);
    expect(result.current.build?.status).toBe("done");

    await act(async () => {
      slow.answer(state("running"));
    });
    expect(result.current.build?.status).toBe("done");
  });

  it("forgets a build on reset, and an answer still on its way does not bring it back", async () => {
    const late = deferred();
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }))
      .mockImplementationOnce(() => late.promise);
    const { result } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick();
    act(() => {
      result.current.reset();
    });
    await act(async () => {
      late.answer(state("done", { modulesUrl: "/m" }));
    });
    expect(result.current.build).toBeNull();
    expect(result.current.running).toBe(false);

    await tick(30_000);
    expect(polls()).toBe(1);
  });

  it("stops asking when the window that started it goes away", async () => {
    fetchMock
      .mockImplementationOnce(() => answer({ id: "b1" }))
      .mockImplementation(() => answer(state("running")));
    const { result, unmount } = renderHook(() => useModuleBuild());

    act(() => {
      void result.current.start([WAVE]);
    });
    await tick(2000);
    const asked = polls();
    unmount();
    await tick(30_000);
    expect(polls()).toBe(asked);
  });
});
