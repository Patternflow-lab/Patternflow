"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  logicalKnobUnitsPerTurn,
  LOGICAL_KNOB_WRAP,
} from "@/lib/pattern/controls";
import { PATTERN_SANDBOX_URL } from "@/lib/community/sandboxUrl";

// Live pattern preview for community (i.e. untrusted) code.
// The iframe's load event, its pf-ready and one blind send at mount between
// them always reach the sandbox, so the pattern is loaded by the time a hover
// asks it to play.

type Props = {
  code: string;
  knobValues: number[];
  knobRanges: Array<[number, number]>;
  running?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Called with (ok, error) after each load and on runtime errors. */
  onStatus?: (ok: boolean, error?: string) => void;
};

export default function SandboxPreview({
  code,
  knobValues,
  knobRanges,
  running = true,
  className,
  style,
  onStatus,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Latest props for callbacks that fire outside the render cycle
  const stateRef = useRef({ code, knobValues, knobRanges, running, onStatus });
  useEffect(() => {
    stateRef.current = { code, knobValues, knobRanges, running, onStatus };
  });

  // One load per pattern. A load used to be sent from five places in the first
  // 200ms (the mount, two timers, the iframe's load event, its pf-ready) and
  // again by the code effect, because any of them might be the first to find
  // the sandbox listening. When it already was, all of them landed: every
  // iframe compiled its pattern and ran setup() five times, 60 loads for the
  // wall's first 12 cards, and the pattern page's preview restarted four times
  // before it settled.
  //
  // A message posted before the sandbox document exists is lost, and nothing
  // says so. What can be known is this. The listener below is registered in
  // the same effect as the first send, so either the sandbox was up by then
  // and that send reached it, or it comes up later and its pf-ready is heard.
  // So a send made blind is made once, and a send made after the sandbox is
  // known to be listening (its load event, its pf-ready, or its answer to an
  // earlier load) is the one that counts. A sandbox that came up between the
  // iframe's mount and this effect gets both: two loads, where it had five.
  const listeningRef = useRef(false);
  /** The code in the last pf-load posted, whether or not anything heard it. */
  const sentRef = useRef<string | null>(null);
  /** The code posted to a sandbox that was known to be listening. */
  const deliveredRef = useRef<string | null>(null);

  const sendLoad = useCallback((retry = false) => {
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    const state = stateRef.current;
    if (sentRef.current === state.code) {
      if (deliveredRef.current === state.code) return;
      // Sent blind, and nothing has been heard since. A second one changes
      // nothing: if the first was lost, pf-ready is still to come.
      if (!listeningRef.current && !retry) return;
    }
    sentRef.current = state.code;
    if (listeningRef.current) deliveredRef.current = state.code;
    target.postMessage(
      {
        type: "pf-load",
        code: state.code,
        knobValues: state.knobValues,
        knobRanges: state.knobRanges,
        knobWrap: [...LOGICAL_KNOB_WRAP],
        knobUnitsPerTurn: logicalKnobUnitsPerTurn(state.knobRanges),
        running: state.running,
      },
      "*",
    );
  }, []);

  // Ready handshake + status relay
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      const msg = event.data as { type?: string; ok?: boolean; error?: string };
      if (msg?.type === "pf-ready") {
        listeningRef.current = true;
        sendLoad();
      } else if (msg?.type === "pf-status") {
        if (!listeningRef.current) {
          // Its pf-ready came before this listener did (the pattern page's
          // iframe is in the server's HTML and loads before React does), and
          // the blind send has just been answered.
          listeningRef.current = true;
          deliveredRef.current = sentRef.current;
        }
        if (msg.ok) {
          setIsReady(true);
        }
        stateRef.current.onStatus?.(Boolean(msg.ok), msg.error);
      }
    };

    window.addEventListener("message", handleMessage);
    sendLoad();
    // The reasoning above leaves no gap, and this is here in case it is wrong:
    // a sandbox that has said nothing at all after 1.5s is sent the load again.
    const retry = window.setTimeout(() => {
      if (!listeningRef.current) sendLoad(true);
    }, 1500);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(retry);
    };
  }, [sendLoad]);

  // Reload on code change. On mount this finds the code already sent.
  useEffect(() => {
    const timeout = window.setTimeout(() => sendLoad(), 150);
    return () => window.clearTimeout(timeout);
  }, [code, sendLoad]);

  // Knob turns go straight through
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage(
      { type: "pf-knobs", values: knobValues, ranges: knobRanges },
      "*",
    );
  }, [knobValues, knobRanges]);

  // Toggle running state
  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "pf-run", running }, "*");
  }, [running]);

  return (
    <iframe
      ref={frameRef}
      src={PATTERN_SANDBOX_URL}
      sandbox="allow-scripts"
      className={className}
      onLoad={() => {
        // The sandbox registers its listener in an inline script, which has
        // run by the time the document's load event fires.
        listeningRef.current = true;
        sendLoad();
      }}
      style={{
        opacity: isReady ? 1 : 0,
        transition: "opacity 100ms ease-out",
        ...style,
      }}
      title="Pattern preview (sandboxed)"
    />
  );
}
