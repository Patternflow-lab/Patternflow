import type { DeskApp } from "../types";
import PracticeAi from "../ai/PracticeAi";

// The practice AI (Make · 02): a small generic chat that gives set answers — no
// logos, no product names, no brand colours. Its content is desk/ai/
// (PracticeAi.tsx, and answers.ts for what it says). OWNED BY THE PATTERN LAB
// CHAPTER; desk/apps.ts registers it.

export const AI_APP: DeskApp = {
  chrome: {
    title: { en: "Practice AI · set answers", ko: "연습용 AI · 정해진 답만 해요" },
  },
  Component: PracticeAi,
};
