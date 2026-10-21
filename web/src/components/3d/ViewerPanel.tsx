'use client';

import dynamic from 'next/dynamic';
import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import HeroScene from './HeroScene';
import { useAppStore } from '@/store/useAppStore';
import { hasWebGL } from '@/lib/webgl';

// The hero and the Inside section show the build globe; Build and Pattern
// show the product preview.
const GlobeViewer = dynamic(
  () => import('@/components/sections/InsideGlobe/GlobeViewer'),
  { ssr: false },
);

const FADE_MS = 200;

// What stands where the 3D view would be, in a browser that cannot draw it.
// The tabs beside it never depended on it.
function ViewerOff() {
  return <div className="viewer-off mono">This browser can&rsquo;t draw the 3D view.</div>;
}

/**
 * A scene that throws as it is made or drawn (the context refused after all,
 * on settings the 1×1 probe did not ask for) is taken off, and the line above
 * stands in its place. Uncaught, the error went up to the site's error screen
 * and took the tabs with it.
 */
class SceneGuard extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? <ViewerOff /> : this.props.children;
  }
}

// Wraps the 3D scene so it can react to the active home tab.
// On desktop the panel is always shown (sticky left column). On mobile it stays
// hidden while the hero is full-screen and only "drops down" once a section tab
// (Build / Pattern / Inside) is opened from the bottom nav.
export default function ViewerPanel() {
  const homeTab = useAppStore((state) => state.homeTab);
  const isOpen = homeTab !== 'hero';
  // The server cannot ask for a context, so it answers yes and sends the page
  // as it was. The client asks while hydrating, before either scene's canvas
  // is measured, let alone made. The answer cannot change, hence no subscribe.
  const webgl = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => true,
  );

  // Only two distinct scenes exist: the globe (hero, inside) and the product
  // preview (build, pattern). The hero used to open on the product, with the
  // map a link below the buttons; but the hero's own video already shows the
  // device in motion, and a globe of people who built one is the proof the
  // page never showed first. Switching between tabs that share a scene never
  // swaps the canvas, so we only fade when the scene itself changes.
  const targetScene = homeTab === 'inside' || homeTab === 'hero' ? 'globe' : 'product';
  const [shownScene, setShownScene] = useState(targetScene);
  // Fading whenever the shown scene lags behind the target; the timeout below
  // swaps the scene, which ends the fade without extra state.
  const fading = targetScene !== shownScene;

  // Fade the current scene out, swap while invisible, then fade the new one in.
  // Keeping a single scene mounted at a time preserves the original (cheap)
  // memory profile — this is a fade-through, not a true overlapping crossfade.
  useEffect(() => {
    if (targetScene === shownScene) return;
    const timer = setTimeout(() => {
      setShownScene(targetScene);
    }, FADE_MS);
    return () => clearTimeout(timer);
  }, [targetScene, shownScene]);

  return (
    <div className={`viewer-panel ${isOpen ? 'is-open' : ''}`}>
      <div className={`viewer-fade ${fading ? 'is-fading' : ''}`}>
        {/* Keyed by scene: one that failed is tried again only after the other has been shown. */}
        {webgl ? (
          <SceneGuard key={shownScene}>
            {shownScene === 'globe' ? <GlobeViewer /> : <HeroScene />}
          </SceneGuard>
        ) : (
          <ViewerOff />
        )}
      </div>
    </div>
  );
}
