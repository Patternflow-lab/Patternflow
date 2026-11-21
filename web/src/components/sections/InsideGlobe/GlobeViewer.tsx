'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Globe from './Globe';
import BuildFilters from './BuildFilters';
import PhotoLightbox from './PhotoLightbox';
import PinLink from './PinLink';
import { builds, fetchesAhead, formatBuildDate, CARD_TILES, STRIP_TILES, TILE_SIZES } from './builds';
import type { Build } from './builds';
import { useBuildSelection } from './useBuildSelection';
import { useAppStore } from '@/store/useAppStore';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import styles from './GlobeViewer.module.css';

// The description is set smaller, a step at a time, until it fits the band it
// is given. Never below 60% (about 11px): past that it is cut, as it was.
const DESC_SCALE_STEP = 0.04;
const DESC_SCALE_MIN = 0.6;
// Kept clear above and below the text, in pixels.
const DESC_GAP = 6;
// How long the overlay takes to fade (.overlay in the stylesheet), ms.
const OVERLAY_FADE_MS = 300;

// The Inside section's viewer: an interactive globe with the picked build's
// details overlaid on a translucent scrim. Tap a marker (or empty space, or
// the marker again) to open/close.
//
// The selection lives in the app store rather than here, because on mobile the
// viewer is only 44vh — far too little room for photos and a description — so
// the Inside panel renders those as a card instead. See BuildCard.
export default function GlobeViewer() {
  const { selectedId, select: selectBuild, visibleBuilds } = useBuildSelection();
  // On the hero the globe stands in for the product shot: no filters, and a
  // pin opens the Inside section rather than a detail card beside hero copy.
  const homeTab = useAppStore((state) => state.homeTab);
  const onHero = homeTab === 'hero';
  // Below 901px the 3D view is hidden on the hero (globals.css) and drops
  // down only for a tab, so a phone shows the globe on Inside alone. The
  // photos below are warmed only where the globe is seen: a phone's hidden
  // hero globe sent for all of them, in the large variant a 3× screen picks.
  // The query reads false until measured, so a phone never renders them.
  const wide = useMediaQuery('(min-width: 901px)');
  // Nothing is fetched ahead for somebody who has told their browser to save data.
  const [ahead] = useState(fetchesAhead);
  const warm = ahead && (wide || homeTab === 'inside');
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [hasSelected, setHasSelected] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);

  const selectedIndex = useMemo(
    () => visibleBuilds.findIndex((build) => build.id === selectedId),
    [selectedId, visibleBuilds],
  );
  const selected = selectedIndex === -1 ? null : visibleBuilds[selectedIndex];

  // What the overlay shows: the picked build, and for the third of a second
  // the overlay takes to fade, the build just let go. Its photos and words
  // used to be taken away the moment it was let go, so the fade was of an
  // empty box and the card cut out.
  const [kept, setKept] = useState<{ build: Build; index: number } | null>(null);
  if (selected && (kept?.build !== selected || kept.index !== selectedIndex)) {
    setKept({ build: selected, index: selectedIndex });
  }
  useEffect(() => {
    if (selected || !kept) return;
    const timer = setTimeout(() => setKept(null), OVERLAY_FADE_MS);
    return () => clearTimeout(timer);
  }, [selected, kept]);
  const shown = selected ?? kept?.build ?? null;
  const shownIndex = selected ? selectedIndex : kept?.index ?? -1;

  // Only the tiles a pin shows the moment it opens are warmed up front (see the
  // preloader below). The rest of a build's photos live in the lightbox and can
  // load when it is opened, which keeps the warm-up flat as pins are added
  // instead of growing with every photo posted.
  const warmTiles = Math.max(STRIP_TILES, CARD_TILES);
  const allImages = useMemo(
    () => builds.flatMap((build) => (build.images ?? []).slice(0, warmTiles)),
    [warmTiles],
  );
  const images = selected?.images;
  // The strip only has room for a few; the rest are reachable through any tile.
  const stripImages = shown?.images?.slice(0, STRIP_TILES);
  const galleryOpen = galleryIndex !== null && !!images?.length;

  const select = (id: string | null) => {
    selectBuild(id);
    setGalleryIndex(null);
    if (!id) return;
    setHasSelected(true);
    // selectBuild has just pushed /inside/<slug>. The tabs treat the URL as
    // the truth and re-derive themselves on popstate (RightPanel), so raising
    // one is how anything outside the panel changes the tab — the same path
    // the Back button takes.
    if (useAppStore.getState().homeTab === 'hero') {
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Step to the previous/next build, cycling through the list.
  const step = (delta: number) => {
    if (selectedIndex === -1) return;
    const next = (selectedIndex + delta + visibleBuilds.length) % visibleBuilds.length;
    select(visibleBuilds[next].id);
  };

  // The band under the arrows is a fixed share of the viewer, and a
  // description is as long as its maker wrote it. The longest (487 characters,
  // from Ajman) ran off the bottom edge at 1440x900 and up over its own link,
  // and at 1366x768 half of it was gone. So the text is measured against the
  // band and stepped down in size until it fits, links above it included.
  const selectedKey = selected?.id ?? null;
  const shownKey = shown?.id ?? null;
  useLayoutEffect(() => {
    const band = detailRef.current;
    const text = band?.firstElementChild;
    if (!band || !(text instanceof HTMLElement)) return;

    const fit = () => {
      band.style.removeProperty('--desc-scale');
      // On a phone the band is not shown; the card below has the description.
      if (band.clientHeight === 0) return;
      // The text is centred in the band, so what the links take off the top
      // comes off the bottom as well.
      const linksBottom = linksRef.current?.getBoundingClientRect().bottom ?? 0;
      const taken = Math.max(0, linksBottom - band.getBoundingClientRect().top);
      const room = band.clientHeight - 2 * (taken + DESC_GAP);
      for (let scale = 1; text.offsetHeight > room && scale > DESC_SCALE_MIN;) {
        scale = Math.max(DESC_SCALE_MIN, scale - DESC_SCALE_STEP);
        band.style.setProperty('--desc-scale', scale.toFixed(2));
      }
    };

    fit();
    if (typeof ResizeObserver === 'undefined') return;
    // The band changes with the window, the text with the web font arriving.
    const observer = new ResizeObserver(fit);
    observer.observe(band);
    observer.observe(text);
    return () => observer.disconnect();
  }, [shownKey]);

  // Esc lets the selected build go. With a mouse a click on the bare globe
  // does it, and on a phone the card has a close button; a keyboard on the
  // desktop layout had no way back out. An Esc the photo popup has already
  // used is left alone (PhotoLightbox marks it handled).
  useEffect(() => {
    if (!selectedKey) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      selectBuild(null);
      setGalleryIndex(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKey, selectBuild]);

  return (
    <div className={styles.viewer}>
      {/* Offscreen preloader: fetch each pin's opening tiles (the same optimized
          variant the strip and card use) eagerly the moment the globe is seen, so
          opening a pin shows its photos instantly instead of lazy-loading. Low
          fetch priority so they queue behind the globe itself rather than
          competing with it for bandwidth on first paint. */}
      {warm && (
        <div className={styles.preload} aria-hidden>
          {allImages.map((image) => (
            <span key={image.src} className={styles.preloadBox}>
              <Image src={image.src} alt="" fill sizes={TILE_SIZES} loading="eager" fetchPriority="low" />
            </span>
          ))}
        </div>
      )}

      {/* What was picked, said once for a screen reader: the details land in
          the overlay or the card, away from the link or pin that was used. */}
      <p className={styles.announce} aria-live="polite">
        {selected
          ? `${selected.title}. ${selected.maker}, ${selected.location.label}, ${formatBuildDate(selected.date)}. ${selected.description}`
          : ''}
      </p>

      <Globe entries={visibleBuilds} selectedBuildId={selectedId ?? undefined} onSelectBuild={select} />
      {!onHero && <BuildFilters />}

      {/* Swapped in CSS rather than by measuring the viewport, so the server
          and the client render the same thing. */}
      <div className={`${styles.hint} ${hasSelected || selectedId ? styles.hintHidden : ''}`}>
        <span className={styles.hintPointer}>Click a marker to explore</span>
        <span className={styles.hintTouch}>Tap a marker to explore</span>
      </div>

      <div
        className={`${styles.overlay} ${selected ? styles.overlayOpen : ''}`}
        aria-hidden={!selected}
      >
        {shown && (
          <>
            {/* Photo strip, pinned to the top edge. */}
            {stripImages && stripImages.length > 0 && (
              <div className={styles.thumbs} onClick={(event) => event.stopPropagation()}>
                {stripImages.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    className={styles.thumb}
                    onClick={() => setGalleryIndex(index)}
                    aria-label={image.alt}
                  >
                    <Image src={image.src} alt="" fill sizes={TILE_SIZES} />
                  </button>
                ))}
              </div>
            )}

            {visibleBuilds.length > 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.arrowPrev}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    step(-1);
                  }}
                  aria-label="Previous entry"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 4 7 12l8 8" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.arrowNext}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    step(1);
                  }}
                  aria-label="Next entry"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 4l8 8-8 8" />
                  </svg>
                </button>
              </>
            )}

            {/* The counter row is the anchor for the text group: the name and
                place hang above it and the links below, so the name sits on
                the same line for every build however many links there are. On
                desktop the arrows share its line; on mobile they stay centred
                in the frame while this group moves up out of the way. */}
            <div className={styles.nav}>
              <div className={styles.info}>
                <div>
                  <span className={styles.maker}>{shown.maker}</span>
                </div>
                <div>
                  <span className={styles.meta}>
                    {shown.location.label} · {formatBuildDate(shown.date)}
                  </span>
                </div>
              </div>

              <span className={styles.kicker}>
                {String(shownIndex + 1).padStart(2, '0')} /{' '}
                {String(visibleBuilds.length).padStart(2, '0')}
              </span>

              {shown.links && shown.links.length > 0 && (
                <div className={styles.links} ref={linksRef}>
                  {shown.links.map((link) => (
                    <PinLink
                      key={link.href}
                      className={styles.link}
                      href={link.href}
                      label={link.label}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Description, centred in the band between the arrows and the
                bottom edge. The inner wrapper is what the band centres — put
                the span in directly and being a grid item would blockify it,
                turning the per-line highlight into one big rectangle. */}
            <div className={styles.detail} ref={detailRef}>
              <div className={styles.detailInner}>
                <span className={styles.desc}>{shown.description}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {galleryOpen && images && (
        <PhotoLightbox
          key={selectedId}
          images={images}
          index={galleryIndex}
          onIndexChange={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </div>
  );
}
