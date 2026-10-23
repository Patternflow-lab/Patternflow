/**
 * The map's axes and grid, shared by the page (gallery.ts draws them) and
 * study.ts --gaps (prints the empty cells), so a round reads the same empty
 * cells the page draws dashed.
 */
export const AXES: Record<string, { label: string; low: string; high: string; log?: boolean }> = {
  edges: { label: "가장자리", low: "번짐", high: "또렷" },
  motion: { label: "움직임", low: "고요", high: "바쁨", log: true },
  detail: { label: "촘촘함", low: "굵음", high: "잘다" },
  complexity: { label: "복잡도", low: "단순", high: "복잡" },
  coverage: { label: "채움", low: "비어 있음", high: "꽉 참" },
  colour: { label: "색", low: "한 색", high: "여러 색" },
  drift: { label: "모양 바뀜", low: "제자리", high: "흘러감" },
};

export const GRID = 4;

/** Where a value of `key` falls along its axis, 0..1, given every pattern's measures. */
export function scale(key: string, all: Record<string, number>[]) {
  const axis = AXES[key];
  const tf = (v: number) => (axis.log ? Math.log10(Math.max(v, 1e-3)) : v);
  const values = all.map((m) => tf(m[key] ?? 0));
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < 1e-6) {
    lo -= 0.5;
    hi += 0.5;
  }
  const pad = (hi - lo) * 0.08;
  return (v: number) => (tf(v) - (lo - pad)) / (hi - lo + 2 * pad);
}

/**
 * The cells of the x × y map no pattern stands in, as [column, row] counted
 * from the low end of each axis, 0..GRID-1. The page counts the same cells
 * from the top of the screen.
 */
export function emptyCells(x: string, y: string, all: Record<string, number>[]): [number, number][] {
  const sx = scale(x, all);
  const sy = scale(y, all);
  const filled = new Set(
    all.map((m) => {
      const gx = Math.min(GRID - 1, Math.floor(sx(m[x] ?? 0) * GRID));
      const gy = GRID - 1 - Math.min(GRID - 1, Math.floor((1 - sy(m[y] ?? 0)) * GRID));
      return `${gx},${gy}`;
    }),
  );
  const empty: [number, number][] = [];
  for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) if (!filled.has(`${gx},${gy}`)) empty.push([gx, gy]);
  return empty;
}
