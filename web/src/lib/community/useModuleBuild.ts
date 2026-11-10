"use client";

// Queue a build of loadable modules (.pfm) and wait for it, giving up when it
// has been too long.
//
// Three places build: the deck bar along the bottom of the community
// (DeckDock), the deck panel behind the header chip (DeckPanel, the deck's
// only way in on a phone, where the bar is hidden), and "Send to my
// Patternflow" for code that exists only in this browser (SendModuleModal,
// which Pattern Lab's To hardware window opens too). Each used to carry its
// own copy of this, and only the bar's ever stopped asking. With the build
// worker down, the other two kept a spinner turning beside "usually a second
// or two" until the window was closed.

import { useCallback, useEffect, useRef, useState } from "react";
import { COMMUNITY_FETCH_INIT, communityApiUrl } from "@/lib/community/apiBase";
import { captureEvent } from "@/lib/posthogEvents";

export type ModuleBuildState = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  queuePosition: number | null;
  elapsedMs: number | null;
  bytes: number | null;
  error: string | null;
  namespaces: string[];
  modulesUrl: string | null;
};

/** One pattern as POST /api/community/builds takes it. */
export type ModuleBuildPattern = { label: string; code: string };

/**
 * What a build is told to expect, and when to stop believing it.
 *
 * Both scale with the build, because both used to be flat numbers sized for a
 * ten-pattern cap — and a full deck at the current cap would have hit the
 * timeout while the server was still working perfectly well, which reads as a
 * failure and is not one.
 *
 * Each pattern compiles alone in about half a second and there is no firmware
 * image to link. The per-pattern allowance is far more than that on purpose:
 * it covers a cold compiler and a Pi that is also serving the site, without
 * promising something the machine cannot keep.
 *
 * The timeout is the browser giving up on hearing back, not a cancellation —
 * the build may well still be running — so the message says that rather than
 * claiming it failed.
 */
const BUILD_BASE_S = 6;
const BUILD_PER_PATTERN_S = 1.5;
export const buildExpectedS = (patterns: number) =>
  Math.ceil(BUILD_BASE_S + BUILD_PER_PATTERN_S * Math.max(1, patterns));
export const buildTimeoutMs = (patterns: number) => (buildExpectedS(patterns) + 5) * 1000;

const POLL_MS = 1000;

const finished = (state: ModuleBuildState | null) =>
  state !== null && (state.status === "done" || state.status === "error");

export function useModuleBuild() {
  const [build, setBuild] = useState<ModuleBuildState | null>(null);
  // Why there is no build to show: the server would not queue it, the network
  // dropped the request, or it stopped answering. A build the server ran and
  // rejected is `build.status === "error"` instead, with its log.
  const [error, setError] = useState<string | null>(null);
  // The request that queues it is in flight.
  const [busy, setBusy] = useState(false);
  // Whole seconds since the build was queued. Shown while waiting.
  const [waited, setWaited] = useState(0);
  const [patterns, setPatterns] = useState(0);

  const pollRef = useRef<number | null>(null);
  // Bumped by every start and reset, so an answer for an older build is
  // dropped rather than drawn over whatever replaced it.
  const token = useRef(0);
  // Not part of the token: Strict Mode unmounts and mounts once on purpose,
  // and the request a mount effect started has to survive that.
  const mounted = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) window.clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  const start = useCallback(
    async (list: ModuleBuildPattern[]) => {
      if (list.length === 0) return;
      stopPolling();
      const mine = ++token.current;
      const alive = () => mounted.current && token.current === mine;
      setBuild(null);
      setError(null);
      setWaited(0);
      setPatterns(list.length);
      setBusy(true);

      let id: string;
      try {
        const response = await fetch(communityApiUrl("/api/community/builds"), {
          method: "POST",
          ...COMMUNITY_FETCH_INIT,
          headers: { "Content-Type": "application/json" },
          // In the order given, which is the order they appear on the device.
          body: JSON.stringify({ format: "pfm", patterns: list }),
        });
        const payload = (await response.json()) as { id?: string; error?: string };
        if (!alive()) return;
        if (!response.ok || !payload.id) {
          setError(payload.error ?? "Could not queue the build.");
          return;
        }
        id = payload.id;
      } catch {
        if (alive()) setError("Network error — is the build server reachable?");
        return;
      } finally {
        if (alive()) setBusy(false);
      }

      captureEvent("module_build_queued", { patterns: list.length });
      setBuild({
        id,
        status: "queued",
        queuePosition: null,
        elapsedMs: null,
        bytes: null,
        error: null,
        namespaces: [],
        modulesUrl: null,
      });

      // Set once the build has an outcome, so a slow answer from an earlier
      // tick cannot put a finished build back to "running".
      let settled = false;
      const poll = async () => {
        try {
          const response = await fetch(
            communityApiUrl(`/api/community/builds/${id}`),
            COMMUNITY_FETCH_INIT,
          );
          if (!response.ok) return;
          const state = (await response.json()) as ModuleBuildState;
          if (!alive() || settled) return;
          setBuild(state);
          if (finished(state)) {
            settled = true;
            stopPolling();
            captureEvent("module_build_finished", {
              status: state.status,
              patterns: list.length,
              bytes: state.bytes,
            });
          }
        } catch {
          // A dropped poll is not a failed build; the next tick catches up.
        }
      };

      const startedAt = Date.now();
      const limit = buildTimeoutMs(list.length);
      void poll();
      // One timer for both jobs: ask how it is going, and keep the clock the
      // giving-up rule reads. Ticking here rather than in `poll` means a
      // request that hangs cannot also stall the timeout that exists to
      // catch it.
      pollRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setWaited(Math.floor(elapsed / 1000));
        if (elapsed > limit) {
          settled = true;
          stopPolling();
          setBuild(null);
          setError(
            `The build server has not answered in ${Math.round(limit / 1000)} seconds. ` +
              "The build may still be running — give it a moment and try again, and if it keeps " +
              "happening the build worker is probably down.",
          );
          captureEvent("module_build_finished", { status: "timeout", patterns: list.length });
          return;
        }
        void poll();
      }, POLL_MS);
    },
    [stopPolling],
  );

  /** Forget the build. One still running on the server is not cancelled. */
  const reset = useCallback(() => {
    token.current += 1;
    stopPolling();
    setBuild(null);
    setError(null);
    setBusy(false);
    setWaited(0);
  }, [stopPolling]);

  return {
    build,
    error,
    busy,
    /** Queueing, or queued and not yet done or failed. */
    running: busy || (build !== null && !finished(build)),
    waited,
    /** What the build in hand was told to expect, in seconds. */
    expectedS: buildExpectedS(patterns),
    start,
    reset,
  };
}
