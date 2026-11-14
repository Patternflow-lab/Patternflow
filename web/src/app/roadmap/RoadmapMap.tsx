'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import styles from './Roadmap.module.css';
import {
  EDGES,
  LANES,
  NODES,
  NOW,
  todaySeoul,
  type LaneId,
  type RoadmapNode,
} from './roadmap-data';

type LiveIssue = {
  number: number;
  title: string;
  url: string;
  subIssues: { total: number; completed: number; percent: number } | null;
};

type RoadmapApiData = { issues: LiveIssue[]; error?: string };

// Density-calibrated time scale: compacts empty early months (Jan–Mar) & May–June
// so nodes flow continuously without empty gaps, reserving room for dense April & July.
const ANCHORS: [number, number][] = [
  [Date.UTC(2026, 0, 1), 0.02],
  [Date.UTC(2026, 1, 1), 0.06],
  [Date.UTC(2026, 2, 1), 0.10],
  [Date.UTC(2026, 3, 1), 0.16],
  [Date.UTC(2026, 4, 1), 0.35],
  [Date.UTC(2026, 5, 1), 0.48],
  [Date.UTC(2026, 6, 1), 0.62],
  [Date.UTC(2026, 7, 1), 0.80],
  [Date.UTC(2026, 8, 1), 0.87],
  [Date.UTC(2026, 9, 1), 0.93],
  [Date.UTC(2026, 10, 1), 0.97],
  [Date.UTC(2026, 11, 1), 1.0],
];

const MONTHS: [string, string][] = [
  ['Jan', '1월'],
  ['Feb', '2월'],
  ['Mar', '3월'],
  ['Apr', '4월'],
  ['May', '5월'],
  ['Jun', '6월'],
  ['Jul', '7월'],
  ['Aug', '8월'],
  ['Sep', '9월'],
  ['Oct', '10월'],
  ['Nov', '11월'],
  ['Dec', '12월'],
];

const isoDay = (utc: number) => new Date(utc).toISOString().slice(0, 10);

// A month gets a tick once the today line has moved far enough past it that the
// label and the line don't sit on top of each other — so the current month
// still gets labelled late in the month, but not on the 2nd.
const TICK_CLEARANCE = 0.03;

function ticksFor(today: string): { label: string; labelKo: string; utc: number }[] {
  const nowT = dateToT(today);
  return MONTHS.map(([label, labelKo], i) => ({
    label,
    labelKo,
    utc: Date.UTC(2026, i, 1),
  })).filter((tick) => nowT - dateToT(isoDay(tick.utc)) >= TICK_CLEARANCE);
}

// The today line reads the real Seoul date on the client and the NOW fallback
// on the server, so it tracks the calendar without a hydration mismatch. The
// date only has to be read once per mount, hence the no-op subscribe; both
// snapshots return plain strings, so Object.is keeps the value stable.
const noopSubscribe = () => () => {};
const serverToday = () => NOW;

function dateToT(date: string): number {
  const ms = new Date(`${date}T00:00:00Z`).getTime();
  if (ms <= ANCHORS[0][0]) return ANCHORS[0][1];
  for (let i = 1; i < ANCHORS.length; i += 1) {
    const [aMs, aT] = ANCHORS[i - 1];
    const [bMs, bT] = ANCHORS[i];
    if (ms <= bMs) return aT + ((ms - aMs) / (bMs - aMs)) * (bT - aT);
  }
  return ANCHORS[ANCHORS.length - 1][1];
}

const GUTTER = 170;
const RIGHT_PAD = 60;
const TOP = 84;
const LANE_H = 112;
const NODE_H = 44;
const HEIGHT = TOP + LANES.length * LANE_H + 120;
const POPUP_W = 360;
// Under this canvas width there is no room for the popup beside a node, so
// it becomes a sheet along the bottom edge. SHEET_PART is how much of the
// canvas height the sheet may take.
const SHEET_BELOW = 560;
const SHEET_PART = 0.55;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.8;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

const laneY = (lane: LaneId) =>
  TOP + LANES.findIndex((l) => l.id === lane) * LANE_H + LANE_H / 2;

const nodeTitle = (n: RoadmapNode, lang: 'ko' | 'en') =>
  lang === 'ko' && n.titleKo ? n.titleKo : n.title;

const nodeDetail = (n: RoadmapNode, lang: 'ko' | 'en') =>
  lang === 'ko' && n.detailKo ? n.detailKo : n.detail;

const nodeWidth = (title: string) => {
  let charLen = 0;
  for (let i = 0; i < title.length; i += 1) {
    const code = title.charCodeAt(i);
    if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x1100 && code <= 0x11ff) ||
      (code >= 0x3130 && code <= 0x318f)
    ) {
      charLen += 14.5;
    } else {
      charLen += 8.2;
    }
  }
  return Math.round(charLen) + 38;
};

type PlacedNode = RoadmapNode & { x: number; y: number; w: number };

// Responsive layout scaling width smoothly to viewport size while preventing overlap.
function layoutNodes(detailed: boolean, lang: 'ko' | 'en', containerW: number): {
  nodes: PlacedNode[];
  width: number;
  innerW: number;
} {
  const baseW = Math.max(containerW * 1.35, detailed ? 3400 : 2100);
  const innerW = baseW - GUTTER - RIGHT_PAD;
  const visible = NODES.filter((n) => detailed || n.level === 1);
  const placed: PlacedNode[] = visible.map((n) => {
    const titleText = nodeTitle(n, lang);
    const w = nodeWidth(titleText);
    return { ...n, w, x: GUTTER + dateToT(n.date) * innerW - w / 2, y: laneY(n.lane) };
  });
  let maxRight = GUTTER + innerW + RIGHT_PAD;
  for (const lane of LANES) {
    // Order by date, not by left edge: nodes are centered on their date, so a
    // wide box a couple of days later can start further left than a narrow one
    // and get resolved into the wrong order — on a timeline that reads as the
    // events having happened in the wrong sequence.
    const row = placed
      .filter((n) => n.lane === lane.id)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (let i = 1; i < row.length; i += 1) {
      const prev = row[i - 1];
      const current = row[i];
      const minX = prev.x + prev.w + 18;
      if (current.x < minX) {
        current.x = minX;
      }
    }
    for (const n of row) {
      maxRight = Math.max(maxRight, n.x + n.w + RIGHT_PAD);
    }
  }
  return { nodes: placed, width: maxRight, innerW };
}

export default function RoadmapMap() {
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const [detailed, setDetailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<RoadmapApiData | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 1200, h: 700 });
  const today = useSyncExternalStore(noopSubscribe, todaySeoul, serverToday);

  const canvasRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  // Set when a node is opened from the keyboard, so the popup takes focus.
  const focusPopupRef = useRef(false);
  const dragRef = useRef({
    active: false,
    moved: false,
    captured: false,
    pointerId: 0,
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });
  // Every pointer that is down on the canvas. Two of them are a pinch.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  // The pinch in progress: the finger distance and zoom it started from, and
  // the map point that was under the midpoint, which stays under it.
  const pinchRef = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const update = () => setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/roadmap')
      .then((res) => res.json())
      .then((payload: RoadmapApiData) => {
        // A host with no /api/roadmap answers JSON without an issues list.
        if (active) setLive(Array.isArray(payload?.issues) ? payload : { issues: [] });
      })
      .catch(() => {
        if (active) setLive({ issues: [] });
      });
    return () => {
      active = false;
    };
  }, []);

  const { nodes, width, innerW } = useMemo(
    () => layoutNodes(detailed, lang, canvasSize.w),
    [detailed, lang, canvasSize.w],
  );
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;

  const nowX = GUTTER + dateToT(today) * innerW;
  const ticks = useMemo(() => ticksFor(today), [today]);

  // Start with "today" around the right third of the viewport so both the
  // recent past and the future zone are visible on load; center vertically.
  // Re-runs once when the real date replaces the SSR fallback.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    setPan({
      x: Math.min(0, Math.round(cw * 0.62 - nowX)),
      y: Math.round((ch - HEIGHT) / 2),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- not on nowX: it moves with the canvas width, and a resize would undo the reader's own pan
  }, [today]);

  const gate = useMemo(() => {
    const gateNodes = nodes.filter((n) => n.gate);
    if (gateNodes.length === 0) return null;
    const left = Math.min(...gateNodes.map((n) => n.x)) - 20;
    const right = Math.max(...gateNodes.map((n) => n.x + n.w)) + 20;
    const laneIdx = gateNodes.map((n) => LANES.findIndex((l) => l.id === n.lane));
    const topLane = Math.min(...laneIdx);
    const bottomLane = Math.max(...laneIdx);
    const y = TOP + topLane * LANE_H + LANE_H / 2 - NODE_H / 2 - 18;
    const h = (bottomLane - topLane) * LANE_H + NODE_H + 36;
    return { x: left, y, w: right - left, h };
  }, [nodes]);

  const clampPan = useCallback((x: number, y: number, z = zoom) => {
    const el = canvasRef.current;
    const cw = el ? el.clientWidth : width;
    const ch = el ? el.clientHeight : HEIGHT;
    const drawW = width * z;
    const drawH = HEIGHT * z;
    // Spacious, free-panning bounds allowing users to move the map
    // up/down/left/right freely without feeling clamped or trapped at borders.
    const slackX = Math.max(800, cw * 0.75);
    const slackY = Math.max(600, ch * 0.75);
    const minX = Math.min(0, cw - drawW) - slackX;
    const maxX = Math.max(0, cw - drawW) + slackX;
    const minY = Math.min(0, ch - drawH) - slackY;
    const maxY = Math.max(0, ch - drawH) + slackY;
    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y)),
    };
  }, [width, zoom]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const cursorY = event.clientY - rect.top;

      const zoomFactor = event.deltaY < 0 ? 1.15 : 0.87;

      setZoom((currentZoom) => {
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(currentZoom * zoomFactor * 100) / 100));
        if (nextZoom === currentZoom) return currentZoom;

        setPan((currentPan) => {
          const newX = cursorX - ((cursorX - currentPan.x) / currentZoom) * nextZoom;
          const newY = cursorY - ((cursorY - currentPan.y) / currentZoom) * nextZoom;
          return clampPan(newX, newY, nextZoom);
        });

        return nextZoom;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [width, zoom, clampPan]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 2) return;
    if (pointers.size === 2) {
      // A second finger: the drag becomes a pinch. The canvas sets
      // touch-action: none, so the browser's own pinch never arrives and a
      // phone had no way to zoom at all.
      const [a, b] = [...pointers.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        zoom,
        cx: ((a.x + b.x) / 2 - rect.left - pan.x) / zoom,
        cy: ((a.y + b.y) / 2 - rect.top - pan.y) / zoom,
      };
      dragRef.current.active = false;
      dragRef.current.moved = true;
      return;
    }
    dragRef.current = {
      active: true,
      moved: false,
      captured: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (pointers.has(event.pointerId)) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const pinch = pinchRef.current;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const rect = event.currentTarget.getBoundingClientRect();
      const nextZoom = clampZoom((pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist);
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      setZoom(nextZoom);
      setPan(clampPan(midX - pinch.cx * nextZoom, midY - pinch.cy * nextZoom, nextZoom));
      return;
    }
    const drag = dragRef.current;
    if (!drag.active) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      drag.moved = true;
      // Capture only once an actual drag starts, so plain clicks still reach
      // the nodes underneath.
      if (!drag.captured) {
        try {
          event.currentTarget.setPointerCapture(drag.pointerId);
          drag.captured = true;
        } catch {
          // pointer may already be gone — panning still works without capture
        }
      }
    }
    if (drag.moved) setPan(clampPan(drag.panX + dx, drag.panY + dy));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    pointers.delete(event.pointerId);
    if (pinchRef.current && pointers.size < 2) {
      pinchRef.current = null;
      const rest = [...pointers.entries()][0];
      if (rest) {
        // One finger stays down after a pinch and carries on as a drag.
        dragRef.current = {
          active: true,
          moved: true,
          captured: true,
          pointerId: rest[0],
          startX: rest[1].x,
          startY: rest[1].y,
          panX: pan.x,
          panY: pan.y,
        };
        return;
      }
    }
    if (pointers.size === 0) dragRef.current.active = false;
  };

  const sheet = canvasSize.w < SHEET_BELOW;

  // Pan until the node is inside the top `visibleH` pixels of the canvas.
  // A node already in view is left where it is.
  const reveal = (n: PlacedNode, visibleH: number) => {
    const pad = 12;
    const left = n.x * zoom + pan.x;
    const right = left + n.w * zoom;
    const cy = n.y * zoom + pan.y;
    const half = (NODE_H / 2) * zoom;
    let { x, y } = pan;
    if (left < pad || right > canvasSize.w - pad) {
      x = Math.round(canvasSize.w / 2 - (n.x + n.w / 2) * zoom);
    }
    if (cy - half < pad || cy + half > visibleH - pad) {
      y = Math.round(visibleH / 2 - n.y * zoom);
    }
    if (x !== pan.x || y !== pan.y) setPan(clampPan(x, y));
  };

  const toggleNode = (id: string, fromKeyboard: boolean) => {
    const opening = selectedId !== id;
    setSelectedId(opening ? id : null);
    focusPopupRef.current = opening && fromKeyboard;
    const node = byId.get(id);
    // The sheet covers the lower part of a narrow canvas. A node tapped
    // there moves up above it.
    if (opening && sheet && node) reveal(node, canvasSize.h * (1 - SHEET_PART));
  };

  const nodeIdAt = (target: EventTarget) =>
    (target as Element).closest('[data-node]')?.getAttribute('data-node') ?? null;

  // One handler each on the canvas for every node, so the nodes carry none
  // of their own and the drawn map can be kept between renders (below).
  const onCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) return;
    const id = nodeIdAt(event.target);
    if (id) toggleNode(id, false);
    else setSelectedId(null);
  };

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const id = nodeIdAt(event.target);
    if (!id) return;
    event.preventDefault();
    toggleNode(id, true);
  };

  // Tabbing to a node that is off the canvas brings it into view. A click
  // focuses a node too, and that one must not move under the pointer.
  const onCanvasFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (!target.matches(':focus-visible')) return;
    const id = nodeIdAt(target);
    const node = id ? byId.get(id) : null;
    if (node) reveal(node, canvasSize.h);
  };

  // Closing from inside the popup hands focus back to the node it came from.
  const closePopup = useCallback(() => {
    const popup = popupRef.current;
    if (popup && selectedId && popup.contains(document.activeElement)) {
      canvasRef.current
        ?.querySelector<SVGGElement>(`[data-node="${selectedId}"]`)
        ?.focus();
    }
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (focusPopupRef.current) {
      focusPopupRef.current = false;
      popupRef.current?.focus();
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopup();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, closePopup]);

  const selectedIssues =
    selected?.issues && live
      ? live.issues.filter((issue) => selected.issues?.includes(issue.number))
      : [];

  // Popup lives outside the zoomed layer (so its text never scales) and is
  // positioned in screen space next to the node. maxHeight is computed in
  // real pixels from the actual viewport size — a percentage-based CSS
  // max-height doesn't reliably resolve inside this flex layout, and the
  // popup would silently get clipped by an ancestor's overflow:hidden
  // instead of scrolling.
  let popupStyle: React.CSSProperties | null = null;
  if (selected) {
    const cw = canvasSize.w;
    const ch = canvasSize.h;
    const margin = 14;
    if (sheet) {
      // A phone: 360 px beside a node is off the screen on one side or the
      // other, so the popup is a sheet along the bottom edge.
      popupStyle = {
        left: margin,
        right: margin,
        bottom: margin,
        maxHeight: Math.round(ch * SHEET_PART),
      };
    } else {
      const rightEdge = (selected.x + selected.w) * zoom + pan.x;
      const leftEdge = selected.x * zoom + pan.x;
      const beside =
        rightEdge + 18 + POPUP_W > cw ? leftEdge - POPUP_W - 18 : rightEdge + 18;
      // Neither side has room when the node is wide or the map is zoomed in.
      // The popup then stays on the canvas and overlaps the node.
      const left = Math.max(margin, Math.min(beside, cw - POPUP_W - margin));
      const top = Math.min(Math.max(selected.y * zoom + pan.y - 90, margin), ch - 160 - margin);
      const maxHeight = Math.max(160, ch - top - margin);
      popupStyle = { left, top, width: POPUP_W, maxHeight };
    }
  }

  // Everything drawn on the map that a pan or a zoom does not change: the
  // grid, the threads, the edges and the nodes. A drag sets pan on every
  // pointer move, and without this each move rebuilt all of it (415
  // elements in the detailed view). Kept as one element, React skips it, and
  // a move redraws the layer's transform and the pinned labels only.
  const drawnMap = useMemo(
    () => (
      <>
        {/* Lane dividers, drawn far past the map on both sides */}
        {Array.from({ length: 24 }, (_, i) => i - 6).map((idx) => {
          const y = TOP + idx * LANE_H;
          return (
            <line
              key={`lane-divider-${idx}`}
              className={styles.gridLineHorizontal}
              x1={-5000}
              y1={y}
              x2={10000}
              y2={y}
            />
          );
        })}

        <rect
          className={styles.futureZone}
          x={nowX}
          y={-2000}
          width={12000}
          height={7000}
        />

        {/* Month ticks, drawn far past the map above and below */}
        {ticks.map((tick) => {
          const x = GUTTER + dateToT(isoDay(tick.utc)) * innerW;
          return (
            <line
              key={`grid-line-${tick.label}`}
              className={styles.gridLineVertical}
              x1={x}
              y1={-2000}
              x2={x}
              y2={5000}
            />
          );
        })}

        <line
          className={styles.nowLine}
          x1={nowX}
          y1={-2000}
          x2={nowX}
          y2={5000}
        />

        {/* 2. Threads & dependency edges BEHIND nodes */}
        {LANES.map((lane) => {
          const row = nodes
            .filter((n) => n.lane === lane.id)
            .sort((a, b) => a.x - b.x);
          return row.slice(1).map((n, i) => {
            const prev = row[i];
            const dashed = prev.status === 'planned' || n.status === 'planned';
            return (
              <line
                key={`${prev.id}-${n.id}`}
                className={dashed ? styles.threadPlanned : styles.thread}
                x1={prev.x + prev.w}
                y1={prev.y}
                x2={n.x}
                y2={n.y}
              />
            );
          });
        })}

        {gate && (
          <g>
            <rect
              className={styles.gateRect}
              x={gate.x}
              y={gate.y}
              width={gate.w}
              height={gate.h}
              rx={16}
            />
            <text className={styles.gateLabel} x={gate.x + 6} y={gate.y - 14}>
              {lang === 'ko' ? 'v3.0.0 — 빌드 릴리스' : 'v3.0.0 — build release'}
            </text>
          </g>
        )}

        {EDGES.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          const sx = from.x + from.w;
          const sy = from.y;
          const tx = to.x;
          const ty = to.y;
          const bend = Math.min(90, Math.abs(tx - sx) / 2 + 28);
          return (
            <path
              key={`${edge.from}-${edge.to}`}
              className={styles.depEdge}
              d={`M ${sx} ${sy} C ${sx + bend} ${sy}, ${tx - bend} ${ty}, ${tx - 4} ${ty}`}
              markerEnd="url(#dep-arrow)"
            />
          );
        })}

        {/* 3. Render Nodes */}
        {nodes.map((n) => {
          const isSelected = n.id === selectedId;
          const titleText = nodeTitle(n, lang);
          const secondary = n.level === 2 && !isSelected;
          const boxClass = isSelected
            ? styles.nodeSelected
            : n.status === 'planned'
              ? secondary
                ? styles.nodePlannedSecondary
                : styles.nodePlanned
              : secondary
                ? styles.nodeDoneSecondary
                : styles.nodeDone;
          const textClass = isSelected
            ? styles.nodeTextSelected
            : n.status === 'planned'
              ? secondary
                ? styles.nodeTextPlannedSecondary
                : styles.nodeTextPlanned
              : secondary
                ? styles.nodeTextSecondary
                : styles.nodeText;
          return (
            <g
              key={n.id}
              className={styles.nodeGroup}
              data-node={n.id}
              role="button"
              tabIndex={0}
              aria-label={`${titleText}, ${lang === 'ko' ? (n.status === 'planned' ? '계획' : '완료') : n.status}`}
              aria-expanded={isSelected}
            >
              <rect
                className={boxClass}
                x={n.x}
                y={n.y - NODE_H / 2}
                width={n.w}
                height={NODE_H}
                rx={10}
              />
              <text
                className={textClass}
                x={n.x + n.w / 2}
                y={n.y + 5}
                textAnchor="middle"
              >
                {titleText}
              </text>
            </g>
          );
        })}
      </>
    ),
    [nodes, byId, gate, ticks, innerW, nowX, lang, selectedId],
  );

  // Sticky elements positioning:
  // Lane labels stay pinned to the left edge of the viewport when panning horizontally
  const stickyLaneX = Math.max(16, (16 - pan.x) / zoom);
  // Timeline ticks and Today/Future labels stay pinned to the top edge of the canvas when panning vertically
  const stickyHeaderY = Math.max(TOP - 32, (18 - pan.y) / zoom);

  // The page opens in Korean under <html lang="en">, so the map says which
  // language it is in; a screen reader otherwise reads the Korean in an
  // English voice. The back link and the title stay English in both.
  return (
    <div className={styles.map} lang={lang}>
      <header className={styles.topBar}>
        <Link className={styles.back} href="/" prefetch={false} lang="en">
          ← Patternflow
        </Link>
        <h1 className={styles.mapTitle} lang="en">Project map</h1>
        <div className={styles.headerRight}>
          <div
            className={styles.toggleGroup}
            role="group"
            aria-label={lang === 'ko' ? '언어' : 'Language'}
          >
            <button
              type="button"
              className={`${styles.toggleBtn} ${lang === 'ko' ? styles.toggleOn : ''}`}
              aria-pressed={lang === 'ko'}
              lang="ko"
              onClick={() => setLang('ko')}
            >
              한글
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${lang === 'en' ? styles.toggleOn : ''}`}
              aria-pressed={lang === 'en'}
              lang="en"
              onClick={() => setLang('en')}
            >
              ENG
            </button>
          </div>
          <div
            className={styles.toggleGroup}
            role="group"
            aria-label={lang === 'ko' ? '지도 보기' : 'Map detail level'}
          >
            <button
              type="button"
              className={`${styles.toggleBtn} ${!detailed ? styles.toggleOn : ''}`}
              aria-pressed={!detailed}
              onClick={() => setDetailed(false)}
            >
              {lang === 'ko' ? '개요' : 'Overview'}
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${detailed ? styles.toggleOn : ''}`}
              aria-pressed={detailed}
              onClick={() => setDetailed(true)}
            >
              {lang === 'ko' ? '상세보기' : 'Detailed'}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.viewport}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onClick={onCanvasClick}
          onKeyDown={onCanvasKeyDown}
          onFocus={onCanvasFocus}
        >
          <div
            className={styles.layer}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {/* A group, not an image: role="img" hides what is inside it, and
                the nodes inside are buttons. */}
            <svg
            className={styles.mapSvg}
            viewBox={`0 0 ${width} ${HEIGHT}`}
            width={width}
            height={HEIGHT}
            role="group"
            aria-label={
              lang === 'ko'
                ? 'Patternflow 프로젝트 지도: 분야별로 시간 순에 놓은 지난 릴리스와 계획한 일'
                : 'Patternflow project map: past releases and planned work by area over time'
            }
          >
            <defs>
              <marker
                id="dep-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L8,4 L0,8 z" className={styles.depArrow} />
              </marker>
            </defs>

            {drawnMap}

            {/* 4. Sticky Timeline Header Text ON TOP of nodes */}
            <text
              className={styles.futureLabel}
              x={nowX + (width - nowX) / 2}
              y={stickyHeaderY}
              textAnchor="middle"
            >
              {lang === 'ko' ? '계획' : 'future'}
            </text>

            {ticks.map((tick) => {
              const x =
                GUTTER + dateToT(isoDay(tick.utc)) * innerW;
              return (
                <text key={`tick-text-${tick.label}`} className={styles.tickText} x={x} y={stickyHeaderY} textAnchor="middle">
                  {lang === 'ko' ? tick.labelKo : tick.label}
                </text>
              );
            })}

            <text className={styles.nowLabel} x={nowX - 10} y={stickyHeaderY} textAnchor="end">
              {lang === 'ko' ? '현재' : 'today'}
            </text>

            {/* 5. Sticky Lane Labels ON TOP of nodes with frosted backdrop */}
            {LANES.map((lane) => {
              const laneName = lang === 'ko' ? lane.labelKo : lane.label;
              const labelW = Math.round(laneName.length * (lang === 'ko' ? 14.5 : 11)) + 20;
              return (
                // The label rides over the nodes and lets a click through
                // to the one under it.
                <g key={`sticky-lane-${lane.id}`} pointerEvents="none">
                  <rect
                    x={stickyLaneX - 8}
                    y={laneY(lane.id) - 15}
                    width={labelW}
                    height={28}
                    rx={6}
                    fill="#fbf8f2"
                    fillOpacity={0.94}
                    stroke="var(--pf-rule)"
                    strokeWidth={0.8}
                  />
                  <text className={styles.laneLabel} x={stickyLaneX} y={laneY(lane.id) + 5}>
                    {laneName}
                  </text>
                </g>
              );
            })}
          </svg>
          </div>
        </div>

        {selected && popupStyle && (
          <div
            ref={popupRef}
            className={styles.popup}
            style={popupStyle}
            role="dialog"
            aria-label={nodeTitle(selected, lang)}
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
          >
              <div className={styles.popupHead}>
                <span className={styles.popupDate}>
                  {selected.status === 'planned' ? (lang === 'ko' ? '계획' : 'future') : selected.date}
                </span>
                {selected.gate && <span className={styles.tagGate}>v3.0.0</span>}
                <button
                  type="button"
                  className={styles.popupClose}
                  onClick={closePopup}
                >
                  {lang === 'ko' ? '닫기' : 'Close'}
                </button>
              </div>
              <h2 className={styles.popupTitle}>{nodeTitle(selected, lang)}</h2>
              <p className={styles.popupBody}>{nodeDetail(selected, lang)}</p>
              {(selected.links?.length || selectedIssues.length > 0) && (
                <div className={styles.popupLinks}>
                  {selected.links?.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                      {link.label} ↗
                    </a>
                  ))}
                  {selectedIssues.map((issue) => (
                    <a key={issue.number} href={issue.url} target="_blank" rel="noreferrer">
                      #{issue.number} {issue.title}
                      {issue.subIssues
                        ? ` — ${issue.subIssues.completed}/${issue.subIssues.total}`
                        : ''}{' '}
                      ↗
                    </a>
                  ))}
                </div>
              )}
          </div>
        )}

      </div>
    </div>
  );
}
