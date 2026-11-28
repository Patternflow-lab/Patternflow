'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { fetchesAhead } from './builds';
import type { BuildImage } from './builds';
import gallery from './PhotoLightbox.module.css';

interface PhotoLightboxProps {
  images: BuildImage[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}

// How many of these are open, for whatever sits behind one: the globe stops
// drawing while a photo covers it (Globe.tsx).
let openCount = 0;
const watchers = new Set<() => void>();

function setOpenCount(next: number) {
  openCount = next;
  watchers.forEach((watcher) => watcher());
}

export const isLightboxOpen = () => openCount > 0;

export function watchLightbox(watcher: () => void): () => void {
  watchers.add(watcher);
  return () => {
    watchers.delete(watcher);
  };
}

// The photo is never wider than 1200px (see .galleryMain), which is 92vw of
// a 1304px window. Said as a media condition and not as min(92vw, 1200px):
// a min() there parses as CSS, but the browser ignores it when picking from
// the srcset and quietly falls back to the largest variant there is.
const MAIN_SIZES = '(max-width: 640px) 94vw, (max-width: 1300px) 92vw, 1200px';

// How far a finger has to travel sideways before it counts as a swipe.
const SWIPE_PX = 48;

// Full-screen photo viewer for a build's images. Shared by the globe overlay
// and the Inside panel's mobile build card.
export default function PhotoLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: PhotoLightboxProps) {
  const count = images.length;
  const image = images[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number } | null>(null);
  // The photo that has arrived. Until the one asked for has, the one before
  // it stays up, dimmed, so a step that is still loading does not look like
  // a button that did nothing.
  const [arrived, setArrived] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Marked as handled, so the map behind does not also take this Esc
        // as "let the selected build go" (GlobeViewer).
        event.preventDefault();
        onClose();
      } else if (event.key === 'ArrowRight') {
        onIndexChange((index + 1) % count);
      } else if (event.key === 'ArrowLeft') {
        onIndexChange((index - 1 + count) % count);
      } else if (event.key === 'Tab') {
        // Tab stays among the popup's own buttons. It used to walk off into
        // the page underneath, which the popup covers.
        const dialog = dialogRef.current;
        const stops = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button')) : [];
        if (!dialog || stops.length === 0) return;
        const first = stops[0];
        const last = stops[stops.length - 1];
        const active = document.activeElement;
        const wrapTo = !dialog.contains(active)
          ? first
          : event.shiftKey && active === first
            ? last
            : !event.shiftKey && active === last
              ? first
              : null;
        if (!wrapTo) return;
        event.preventDefault();
        wrapTo.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [index, count, onClose, onIndexChange]);

  // Opening takes the focus and closing gives it back to the tile that was
  // opened, so the keyboard carries on from where it was.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    closeRef.current?.focus({ preventScroll: true });
    document.body.style.overflow = 'hidden';
    setOpenCount(openCount + 1);
    return () => {
      document.body.style.overflow = overflow;
      setOpenCount(openCount - 1);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  if (typeof document === 'undefined') return null;

  const step = (delta: number) => onIndexChange((index + delta + count) % count);

  // A finger dragged sideways steps through the photos. Touch only: with a
  // mouse the arrows are right there, and a drag is how a photo is saved.
  const swipeStart = (event: ReactPointerEvent) => {
    swipe.current = event.pointerType === 'mouse' || count < 2
      ? null
      : { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const swipeEnd = (event: ReactPointerEvent) => {
    const from = swipe.current;
    swipe.current = null;
    if (!from || from.id !== event.pointerId) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  };

  // The photos either side of this one, fetched ahead at the size they will
  // be shown at, so a step does not start from nothing.
  const neighbours = count < 2 || !fetchesAhead()
    ? []
    : Array.from(new Set([(index + 1) % count, (index - 1 + count) % count]))
      .filter((other) => other !== index);

  return createPortal(
    <div
      ref={dialogRef}
      className={gallery.gallery}
      role="dialog"
      aria-modal="true"
      aria-label="Build photos"
      onClick={onClose}
      onPointerDown={swipeStart}
      onPointerUp={swipeEnd}
      onPointerCancel={() => {
        swipe.current = null;
      }}
    >
      <button
        ref={closeRef}
        className={gallery.galleryClose}
        type="button"
        aria-label="Close gallery"
        onClick={onClose}
      >
        close
      </button>
      {/* No stopPropagation on the stage itself — only the photo, the arrows
          and the thumbnails swallow the click, so clicking the space around
          them closes the popup. */}
      <div className={gallery.galleryStage}>
        <div className={gallery.galleryFrame}>
          {count > 1 && (
            <button
              type="button"
              className={`${gallery.galleryNav} ${gallery.galleryPrev}`}
              aria-label="Previous photo"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 4 7 12l8 8" />
              </svg>
            </button>
          )}
          {/* The source photos are phone-camera originals — several megabytes
              each — so this goes through the optimizer rather than serving the
              file as-is. The nominal width/height only give it a ratio to work
              with: the CSS sets both back to auto, so the real one takes over
              once it loads. */}
          <Image
            className={`${gallery.galleryMain} ${arrived === image.src ? '' : gallery.galleryMainLoading}`}
            src={image.src}
            alt={image.alt}
            width={1600}
            height={1200}
            sizes={MAIN_SIZES}
            loading="eager"
            fetchPriority="high"
            draggable={false}
            onLoad={() => setArrived(image.src)}
            onError={() => setArrived(image.src)}
            onClick={(event) => event.stopPropagation()}
          />
          {count > 1 && (
            <button
              type="button"
              className={`${gallery.galleryNav} ${gallery.galleryNext}`}
              aria-label="Next photo"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 4l8 8-8 8" />
              </svg>
            </button>
          )}
        </div>
        {count > 1 && (
          <div className={gallery.galleryThumbs} onClick={(event) => event.stopPropagation()}>
            {images.map((thumb, thumbIndex) => (
              <button
                key={thumb.src}
                type="button"
                className={`${gallery.galleryThumb} ${thumbIndex === index ? gallery.galleryThumbActive : ''}`}
                onClick={() => onIndexChange(thumbIndex)}
                aria-label={thumb.alt}
                aria-current={thumbIndex === index}
              >
                <Image src={thumb.src} alt="" fill sizes="42px" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={gallery.galleryAhead} aria-hidden>
        {neighbours.map((other) => (
          <Image
            key={images[other].src}
            src={images[other].src}
            alt=""
            width={1600}
            height={1200}
            sizes={MAIN_SIZES}
            loading="eager"
            fetchPriority="low"
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}
