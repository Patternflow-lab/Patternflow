'use client';

import { useEffect, useRef } from 'react';
import { builds, buildPageTitle, INSIDE_PAGE_TITLE } from './builds';
import { buildIdFromPath, useBuildSelection } from './useBuildSelection';
import { useAppStore } from '@/store/useAppStore';

// Seeds the picked pin from the URL the page was served at, and follows the
// browser's back/forward buttons afterwards. Selecting a pin only pushes
// history (see useBuildSelection), so nothing else brings the two back in step.
export default function BuildRouteSync({ buildId }: { buildId: string | null }) {
  const { syncSelection } = useBuildSelection();
  const selectedId = useAppStore((state) => state.selectedBuildId);

  useEffect(() => {
    syncSelection(buildId);
  }, [buildId, syncSelection]);

  useEffect(() => {
    const handlePopState = () => {
      syncSelection(buildIdFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncSelection]);

  // The tab's title follows the pin, as its address does. Nothing loads when
  // a pin is picked, so the title stayed whatever the page arrived with: a
  // link to slowrush's build, stepped on to the next, still said slowrush in
  // the tab, in the history and in a share sheet.
  // With no pin picked it goes back to what the page came with, or to
  // Inside's own title when the page came as a build's, whose title was that
  // build's. It is left alone until a pin has been picked once.
  const restTitle = useRef<string | null>(null);
  const titled = useRef(false);
  useEffect(() => {
    if (restTitle.current === null) restTitle.current = buildId ? INSIDE_PAGE_TITLE : document.title;
    const build = builds.find((entry) => entry.id === selectedId);
    if (!build && !titled.current) return;
    titled.current = true;
    document.title = build ? buildPageTitle(build) : restTitle.current;
  }, [selectedId, buildId]);

  return null;
}
