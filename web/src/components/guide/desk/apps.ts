import type { DeskApp, DeskWin } from "./types";
import { COMMUNITY_APP } from "./apps/community";
import { AI_APP } from "./apps/ai";

// The practice windows, by window: their chrome and their content. The Lab
// window is not in here — it is the real /pattern-lab, and the desk frames
// it itself (DeskStage.tsx LabFrame).
//
// Each app is owned by its chapter: apps/community.tsx by 01 Community,
// apps/ai.tsx by 02 Pattern Lab. This file only registers them.

export const DESK_APPS: Record<Exclude<DeskWin, "lab">, DeskApp> = {
  community: COMMUNITY_APP,
  ai: AI_APP,
};
