'use client';

import { useEffect, useRef } from 'react';
import { orderedBuilds, matchesBuildFilter } from './builds';
import { buildIdFromPath, buildPath, useBuildSelection } from './useBuildSelection';
import { useAppStore } from '@/store/useAppStore';
import styles from './BuildIndex.module.css';

// Real links keep every entry shareable and crawlable. A normal click updates
// selection in place, preserving the globe; modified clicks open the URL.
export default function BuildIndex() {
  const { selectedId, select, filter, visibleBuilds } = useBuildSelection();
  const activeRef = useRef<HTMLAnchorElement>(null);
  // The build the page itself was opened on (/inside/<slug>), until it has
  // been seen selected once.
  const pageBuild = useRef<string | null | undefined>(undefined);

  // A build picked on the globe, or stepped to with the arrows, marks its row
  // here, and at 1440x900 only ten of the eighteen rows are on screen. The
  // row is brought into view, by the least scroll that does it, so the mark
  // can be seen. Not on a phone, where a pick scrolls to the card instead
  // (BuildCard). Not for a pin picked from the hero or for the build a link
  // opened the page on: both show this panel from its top.
  useEffect(() => {
    if (pageBuild.current === undefined) pageBuild.current = buildIdFromPath(window.location.pathname);
    const row = activeRef.current;
    if (!selectedId || !row) return;
    const opening = selectedId === pageBuild.current;
    pageBuild.current = null;
    if (opening || typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(min-width: 901px)').matches) return;
    if (useAppStore.getState().homeTab !== 'inside') return;
    const box = row.getBoundingClientRect();
    if (box.height === 0 || (box.top >= 0 && box.bottom <= window.innerHeight)) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }, [selectedId]);

  return (
    <>
      <ul className={styles.list} aria-label="Patternflow around the world">
        {orderedBuilds.map((build) => (
          <li key={build.id} hidden={!matchesBuildFilter(build, filter)}>
            <a
              ref={selectedId === build.id ? activeRef : undefined}
              className={`${styles.item} ${selectedId === build.id ? styles.itemActive : ''}`}
              href={buildPath(build.id)}
              aria-current={selectedId === build.id ? 'true' : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                select(build.id);
              }}
            >
              <span className={styles.title}>{build.title}</span>
              <span className={styles.meta}>{build.maker} · {build.location.label}</span>
            </a>
          </li>
        ))}
      </ul>
      {visibleBuilds.length === 0 && <p className={styles.empty}>No entries in this category yet.</p>}
    </>
  );
}
