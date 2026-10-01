"use client";

import { useLayoutEffect } from "react";
import GuideCanvas from "./stage/GuideCanvas";
import { useGuideStore } from "./store";

// The hub's stage: the same 3D device the guides use, playing the hub's
// script (scenes.ts HUB_SCENES — Play's opening, turning slowly beside the
// choices). Loaded on its own, after the page (GuideHub), so the hub's
// words never wait for the board, the simulator or three.js.
//
// The hub has no scroll story, so nothing here tracks the scroll: the stage
// stays on the opening, and the camera fits the device into what the
// choices leave free (GuideCanvas freeArea reads the hub's [data-scene]).

export default function HubStage() {
  useLayoutEffect(() => {
    const store = useGuideStore.getState();
    store.enterPage("hub");
    const onResize = () => useGuideStore.getState().setNarrow(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return <GuideCanvas />;
}
