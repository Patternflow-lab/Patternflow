"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Component, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import styles from "../Guide.module.css";
import { useDarkDocument } from "../darkDocument";
import { screenAt } from "../pages";
import { useGuideStore, type GuideScreen } from "../store";
import { stageLoad } from "../ui/stageLoad";

// The guide's world: one stage for /guide, /guide/build, /guide/play and
// /guide/make, in both languages. app/guide/layout.tsx mounts this once and
// the pages come and go inside it, so moving between them is a scene on the
// same stage and not a page load: the canvas is never taken down, the board,
// the camera and the loaded models carry over.
//
//   <div .world data-screen data-leaving data-going data-foot data-cut>
//     <div .stage>   the room's glow · the canvas (world/WorldStage) · grain
//     {children}     the page: GuideHub or GuideExperience
//
// What is here and what is the page's:
//   - A page says it is on screen with useGuidePage (world/usePage.ts →
//     store.enterPage). The stage plays that page's script from then on.
//   - The stage reads everything else from the store: the hub's pointed-at
//     guide (store.preview), a way out being taken (store.leaving, from
//     world/GuideLink).
//   - The room's light and the canvas's mask are CSS on [data-screen], which
//     is read off the address, so the server's first paint already has them.
//   - Make has a desk instead of the device: the canvas stays mounted but
//     fades and rests (Guide.module.css, GuideCanvas). A reader who arrives
//     on Make never loads the stage at all until they go to a page with it.

// three.js, the models and the simulated board: after the page's words.
const WorldStage = dynamic(() => import("./WorldStage"), { ssr: false });

// A browser that cannot give the stage a WebGL 2 context (turned off, an old
// machine, a blocked GPU) gets the guide without it: the words, the cards and
// the pictures are all there. Asked once, before the stage's chunk is; the
// stage used to be loaded regardless, throw as it made its renderer, and
// leave the page waiting on a canvas that would never draw.
let webgl: boolean | null = null;
function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    // (A 1×1 canvas nobody holds: its context goes with it.)
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    webgl = !!probe.getContext("webgl2");
  } catch {
    webgl = false;
  }
  return webgl;
}

/**
 * The stage is the guide's picture, not the guide. If it throws as it is
 * made or drawn — the context refused after all, a model that did not arrive
 * — it is taken off and the page stays whole: the words, the cards and the
 * figures never depended on it. (Uncaught, the error went up to the site's
 * error screen and took the page with it.) Whoever waits for the stage is
 * told, as where there is no WebGL at all.
 */
class StageGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    stageLoad.set({ failed: true });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** How long the hub's floor fade stays on the canvas after the hub is left: its ease down off the screen (Guide.module.css), ms. */
const FOOT_LINGER_MS = 1000;
/** A cut (store.requestCut): how long the canvas stays out before it comes back, ms. Its fade out is 0.14 s; the stage jumps at 0.17 s. */
const CUT_MS = 300;
/** A page that was asked for and never came (offline, a failed load): the words come back after this, ms. */
const LEAVE_GIVE_UP_MS = 6000;

export default function GuideWorld({ children }: { children: ReactNode }) {
  const screen = screenAt(usePathname() ?? "")?.page ?? null;
  // An address under /guide that is no page of the guide (the site's own
  // "not found"): no stage, no dark room — the site's page as it is.
  if (!screen) return <>{children}</>;
  return <World screen={screen}>{children}</World>;
}

function World({ screen, children }: { screen: GuideScreen; children: ReactNode }) {
  const page = useGuideStore((s) => s.page);
  const entered = useGuideStore((s) => s.entered);
  const leaving = useGuideStore((s) => s.leaving);
  const hubTop = useGuideStore((s) => s.hubTop);

  // The stage loads the first time a page with the device is on screen, and stays.
  const [staged, setStaged] = useState(false);
  if (!staged && entered && page !== "make" && hasWebGL()) setStaged(true);
  // No stage is coming: whoever waits for it (the first visit's counter) is told.
  useEffect(() => {
    if (entered && page !== "make" && !hasWebGL()) stageLoad.set({ failed: true });
  }, [entered, page]);

  // The hub's floor fade: on with the hub, and until its ease away has run.
  const [foot, setFoot] = useState(screen === "hub");
  if (screen === "hub" && !foot) setFoot(true);
  useEffect(() => {
    if (screen === "hub" || !foot) return;
    const timer = window.setTimeout(() => setFoot(false), FOOT_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [screen, foot]);

  // A cut: the canvas dips to dark while the stage jumps, and comes back.
  const cut = useGuideStore((s) => s.cut);
  const [cutShown, setCutShown] = useState(cut);
  useEffect(() => {
    if (cut === cutShown) return;
    const timer = window.setTimeout(() => setCutShown(cut), CUT_MS);
    return () => window.clearTimeout(timer);
  }, [cut, cutShown]);

  // The document goes dark while the guide is open (darkDocument.ts).
  useDarkDocument();

  // Narrow screen: the stage sits above the text instead of beside it.
  useEffect(() => {
    const onResize = () => useGuideStore.getState().setNarrow(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // The words left for a page that never arrived: back they come.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => useGuideStore.getState().leaveFor(null), LEAVE_GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  // Out of the guide altogether: the next visit starts from nothing.
  useEffect(
    () => () => {
      useGuideStore.setState({ entered: false, preview: null, leaving: null, buildLive: false });
    },
    [],
  );

  return (
    <div
      className={styles.world}
      data-guide-world=""
      data-screen={screen}
      data-leaving={leaving ? "1" : undefined}
      data-going={leaving ?? undefined}
      data-foot={foot ? "1" : undefined}
      data-cut={cut !== cutShown ? "1" : undefined}
    >
      <div className={styles.stage} aria-hidden="true" style={hubTop > 0 ? ({ "--hub-top": `${hubTop}px` } as CSSProperties) : undefined}>
        <div className={styles.stageGlow} />
        <div className={styles.hubGlow} />
        <div className={styles.canvasBox}>
          {staged && (
            <StageGuard>
              <WorldStage />
            </StageGuard>
          )}
        </div>
        <div className={styles.grain} />
      </div>
      {children}
    </div>
  );
}
