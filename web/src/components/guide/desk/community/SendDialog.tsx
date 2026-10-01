"use client";

import { useEffect, useRef, useState } from "react";
import cs from "@/components/community/Community.module.css";
import type { GuideLang } from "../../store";
import { MODULE_KB, patternById } from "./data";
import { PracticeNote } from "./parts";
import { usePractice } from "./state";
import ps from "./Practice.module.css";

// One pattern, onto a board: the send dialog of a published pattern
// (components/community/SendModuleModal.tsx, PatternZipBody, with its
// ZipInstallNote), in its own words. Its two ways out reach a board or a
// file; here each says, in the dialog, what would happen for real.

export default function SendDialog({ lang }: { lang: GuideLang }) {
  const send = usePractice((s) => s.send);
  const [zipped, setZipped] = useState(false);
  const [host, setHost] = useState("patternflow.local");
  const cardRef = useRef<HTMLDivElement>(null);
  const st = usePractice.getState;

  // The keyboard lands in the dialog, and goes back to what opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cardRef.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  const p = send ? patternById(send.id) : undefined;
  if (!send || !p) return null;
  const close = () => st().closeSend();
  const shownHost = host.trim() || "patternflow.local";

  return (
    <div
      className={`${cs.modalOverlay} ${ps.overlay}`}
      role="dialog"
      aria-modal="true"
      aria-label="Send to my Patternflow"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`${cs.modalCard} ${cs.modalCardWide} ${ps.modal}`}
        onClick={(e) => e.stopPropagation()}
        data-pc="send-dialog"
      >
        <div className={cs.modalHeader}>
          <span>Send to my Patternflow</span>
          <button type="button" onClick={close} aria-label="Close">
            ×
          </button>
        </div>
        <div className={cs.modalBody}>
          <p className={cs.buildStatusLine}>
            ✓ {p.title} is ready · {MODULE_KB} KB
          </p>
          <p className={cs.formNote}>
            Send over Wi-Fi opens your board&rsquo;s Patterns page with this pattern linked — it fetches and installs the file itself, and
            the pattern appears in the list immediately. No sign-in, no reflash, no USB. (Needs firmware with loadable-module support —
            v3.2.0 or newer.)
          </p>
          <div className={cs.actionRow}>
            <button
              type="button"
              className={cs.btnAccentLink}
              data-pc="wifi"
              onClick={() => {
                setZipped(false);
                st().sent();
              }}
            >
              Send over Wi-Fi
            </button>
            <button type="button" className={cs.btn} onClick={() => setZipped(true)}>
              Download .zip
            </button>
          </div>
          {zipped ? (
            <PracticeNote lang={lang} noteKey="zip" n={0} inline />
          ) : (
            send.sent && <PracticeNote lang={lang} noteKey="sentOne" n={0} inline />
          )}
          <p className={cs.formNote}>Board not reachable from this network (e.g. VPN)? Use Download .zip.</p>
          <div className={cs.zipNote}>
            <span className={cs.zipNoteTitle}>Install from a file</span>
            <ol className={cs.zipSteps}>
              <li>Download the .zip here.</li>
              <li>
                Open your board&rsquo;s Patterns page — <a>http://{shownHost}/patterns</a> (on a VPN? turn it off first: the board is on your
                home network).
              </li>
              <li>
                Drop the .zip on <strong>Upload</strong>, or tap Upload and choose it — don&rsquo;t unzip it.
              </li>
            </ol>
            <span className={cs.zipNoteLine}>A single pattern&apos;s .zip leaves the board&apos;s order as it is.</span>
            <label className={cs.zipNoteLine}>
              Board address:{" "}
              <input
                type="text"
                className={cs.zipHostField}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                spellCheck={false}
                aria-label="Board address"
              />{" "}
              — Android can&rsquo;t resolve <code>.local</code>; use the IP from the board&rsquo;s NETWORK screen (hold K2).
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
