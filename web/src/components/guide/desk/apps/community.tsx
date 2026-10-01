"use client";

import type { DeskApp } from "../types";
import CommunityApp from "../community/CommunityApp";

// The practice community (Make · 01): a small replica of the community's real UI,
// holding placeholder patterns, connected to nothing. Its content is
// desk/community/ (CommunityApp and its parts); this file only gives the
// window its chrome, for desk/apps.ts to register. Owned by the community
// chapter.

export const COMMUNITY_APP: DeskApp = {
  chrome: {
    title: { en: "Community / Patternflow", ko: "Community / Patternflow" },
    address: { host: "community.patternflow.work", path: "/community/patterns" },
    badge: { en: "Practice", ko: "연습용" },
  },
  Component: CommunityApp,
};
