"use client";

import GuideCanvas from "../stage/GuideCanvas";
import StageLoadReport from "../ui/StageLoadReport";
import HubAnswers from "./HubAnswers";

// The 3D stage and what plays on it between the pages, as one piece to load:
// three.js, the models and the simulated board come in here, after the page's
// words (GuideWorld loads this on its own, the first time a page with a
// device is on screen). Everything in it lives as long as the reader stays in
// the guide.
//
// StageLoadReport says how far the stage is from being on the page (the
// preloader shows it, ui/Preloader) and keeps the canvas out until the device
// has been drawn.

export default function WorldStage() {
  return (
    <>
      <StageLoadReport />
      <HubAnswers />
      <GuideCanvas />
    </>
  );
}
