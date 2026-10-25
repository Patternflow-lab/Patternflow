// ── The zoomed viewport ──────────────────────────────────────────────────────
// Zoom, middle-drag panning, the hover cell, and the one mapping everything
// hangs on: a pointer position → a pixel cell, read off the overlay canvas's
// box. The refs belong to the panel (it renders the elements); this hook is
// handed them.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { PixelLayer } from "@/lib/lab/types";
import type { Cell } from "./tools";
import { WHEEL_NOTCH_PX, wheelPixels } from "./wheel";

export const ZOOM_MIN = 1;
const ZOOM_MAX = 32;

/**
 * The largest whole zoom that shows the picture entire inside a viewport of
 * this size: 16 px of padding a side and 4 px of air. Never below 1×. For
 * 128×64 that is 2× in a 390×844 phone's 372×177 viewport, and 4× in the
 * 649×648 one at 1440×900.
 */
export function zoomToFit(viewportWidth: number, viewportHeight: number, width: number, height: number) {
  return Math.max(ZOOM_MIN, Math.floor(Math.min((viewportWidth - 40) / width, (viewportHeight - 40) / height)));
}

export function usePixelViewport({
  pixel,
  viewportRef,
  overlayCanvasRef,
}: {
  pixel: PixelLayer | undefined;
  viewportRef: RefObject<HTMLDivElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
}) {
  const [zoom, setZoom] = useState(6);
  // The zoom the wheel listener reads: it runs between renders, and two wheel
  // events can land before React commits the first.
  const zoomRef = useRef(zoom);
  const [panning, setPanning] = useState(false);
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);
  // Middle-drag panning of the zoomed viewport.
  const panRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);

  /**
   * The cell under a pointer, or null off the canvas. Clamped: selection and
   * move drags keep tracking past the edge instead of dropping out.
   */
  const cellFromEvent = useCallback(
    (event: React.PointerEvent, clamp = false): Cell | null => {
      if (!pixel) return null;
      const canvas = overlayCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * pixel.width);
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * pixel.height);
      if (clamp) {
        return {
          x: Math.max(0, Math.min(pixel.width - 1, x)),
          y: Math.max(0, Math.min(pixel.height - 1, y)),
        };
      }
      if (x < 0 || x >= pixel.width || y < 0 || y >= pixel.height) return null;
      return { x, y };
    },
    [pixel, overlayCanvasRef],
  );

  // Where a zoom holds still: a spot on the picture (as a fraction of it)
  // and the screen point it sat under, so the layout effect below can scroll
  // that spot back there. The wheel holds the spot under the cursor, the ±
  // buttons the one in the middle of the viewport.
  const zoomAnchor = useRef<{ fx: number; fy: number; clientX: number; clientY: number } | null>(null);
  const anchorAt = useCallback(
    (clientX: number, clientY: number) => {
      const rect = overlayCanvasRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const fraction = (offset: number, size: number) => Math.max(0, Math.min(1, offset / size));
      zoomAnchor.current = {
        fx: fraction(clientX - rect.left, rect.width),
        fy: fraction(clientY - rect.top, rect.height),
        clientX,
        clientY,
      };
    },
    [overlayCanvasRef],
  );

  // The ± buttons keep the middle of what the viewport shows in the middle,
  // as Director's ± does (useTimelineZoom). Zooming from the top-left corner
  // moved the middle from column 64 to 58 on one + at 10× in the 649 px
  // desktop panel.
  const zoomBy = useCallback(
    (delta: number) => {
      const current = zoomRef.current;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + delta));
      if (next === current) return;
      const viewport = viewportRef.current;
      if (viewport) {
        const box = viewport.getBoundingClientRect();
        anchorAt(
          box.left + viewport.clientLeft + viewport.clientWidth / 2,
          box.top + viewport.clientTop + viewport.clientHeight / 2,
        );
      }
      zoomRef.current = next;
      setZoom(next);
    },
    [viewportRef, anchorAt],
  );

  const fitZoom = useCallback(() => {
    if (!pixel) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    setZoom(zoomToFit(viewport.clientWidth, viewport.clientHeight, pixel.width, pixel.height));
  }, [pixel, viewportRef]);

  // The first time the viewport has a size, a picture that does not fit at
  // 6× opens fitted. A 390 px phone showed 56 of 128 columns and 19 of 64
  // rows, and there a finger drag paints, so the rest was out of reach. The panel can mount
  // before it is laid out (a tab behind another), hence the observer. Once
  // only: after that the zoom is the user's, and Fit is one press.
  const fitted = useRef(false);
  const pictureWidth = pixel?.width ?? 0;
  const pictureHeight = pixel?.height ?? 0;
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (fitted.current || !viewport || pictureWidth === 0) return;
    const fitOnce = () => {
      if (viewport.clientWidth <= 0 || viewport.clientHeight <= 0) return false;
      fitted.current = true;
      const next = zoomToFit(viewport.clientWidth, viewport.clientHeight, pictureWidth, pictureHeight);
      if (next < zoomRef.current) {
        zoomRef.current = next;
        setZoom(next);
      }
      return true;
    };
    if (fitOnce()) return;
    const observer = new ResizeObserver(() => {
      if (fitOnce()) observer.disconnect();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [pictureWidth, pictureHeight, viewportRef]);

  // The wheel zooms. A native listener, because React delegates wheel
  // passively and preventDefault there would let the viewport and the dock
  // scroll under the zoom (useTimelineZoom does the same). A sideways wheel
  // has no deltaY and stays a scroll. The viewport is only rendered while a
  // pixel layer is selected, so the listener goes on when one is.
  //
  // One notch is one step, the step the ± buttons take. The travel adds up
  // across events, so a trackpad swipe of thirty 4 px events is one step
  // too, not thirty. Turning the other way drops what was left over.
  const wheelRest = useRef(0);
  const hasPixel = pixel !== undefined;
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      const notches = -wheelPixels(event) / WHEEL_NOTCH_PX;
      const rest = Math.sign(wheelRest.current) === -Math.sign(notches) ? 0 : wheelRest.current;
      const total = rest + notches;
      const steps = Math.trunc(total);
      wheelRest.current = total - steps;
      const current = zoomRef.current;
      const next = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, current + steps));
      if (next === current) {
        // At either end the travel past it would otherwise wait there.
        if (steps !== 0) wheelRest.current = 0;
        return;
      }
      anchorAt(event.clientX, event.clientY);
      zoomRef.current = next;
      setZoom(next);
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [hasPixel, viewportRef, anchorAt]);

  // After a zoom: scroll the anchored spot back under its screen point. The
  // browser clamps the scroll, so a picture smaller than the viewport stays
  // centred.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
    const anchor = zoomAnchor.current;
    zoomAnchor.current = null;
    const viewport = viewportRef.current;
    const canvas = overlayCanvasRef.current;
    if (!anchor || !viewport || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    viewport.scrollLeft += rect.left + anchor.fx * rect.width - anchor.clientX;
    viewport.scrollTop += rect.top + anchor.fy * rect.height - anchor.clientY;
  }, [zoom, viewportRef, overlayCanvasRef]);

  /** Middle button: start panning. True when the press was taken. */
  const beginPan = useCallback(
    (event: React.PointerEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return false;
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      panRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      setPanning(true);
      return true;
    },
    [viewportRef],
  );

  /** True while a pan is in progress (and the move was consumed by it). */
  const movePan = useCallback(
    (event: React.PointerEvent) => {
      const pan = panRef.current;
      if (!pan) return false;
      const viewport = viewportRef.current;
      if (viewport) {
        viewport.scrollLeft = pan.left - (event.clientX - pan.startX);
        viewport.scrollTop = pan.top - (event.clientY - pan.startY);
      }
      return true;
    },
    [viewportRef],
  );

  /** True when a pan just ended. */
  const endPan = useCallback(() => {
    if (!panRef.current) return false;
    panRef.current = null;
    setPanning(false);
    return true;
  }, []);

  return {
    zoom,
    zoomBy,
    fitZoom,
    panning,
    hoverCell,
    setHoverCell,
    cellFromEvent,
    beginPan,
    movePan,
    endPan,
  };
}

export type PixelViewport = ReturnType<typeof usePixelViewport>;
