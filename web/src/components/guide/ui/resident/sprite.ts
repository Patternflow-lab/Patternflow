// The resident: a small figure that lives in the guide, drawn the way the
// panel draws — square lit cells, seven across and six up. A round body, two
// eyes that are two dark cells, two feet. Nothing is downloaded: a frame is a
// pose (five of them) with a row of eyes set into it (four), a few rows of
// text each, and it is turned into one SVG path the first time it is shown.
//
// Why this one. Three were drawn at the sizes it is seen at (14 px on a
// guide's chapter rail, 21 px on the hub): a 5-cell-wide person, a square
// "LED with legs", and this. The person's head is three cells — no room for
// eyes, and at 14 px it is a twig. The square read as a robot, and its eyes
// closed up at 2 px a cell. This one keeps two eyes at both sizes, and its
// head is seven cells wide, so the eyes have somewhere to go: one cell left
// or right is a glance.

export const COLS = 7;
export const ROWS = 6;

export type Pose = "stand" | "stepA" | "stepB" | "hop" | "sit";
export type Eyes = "mid" | "left" | "right" | "shut";

const EYES: Record<Eyes, string> = {
  mid: "##.#.##",
  left: "#.#.###",
  right: "###.#.#",
  shut: "#######",
};

// "E" is the row the eyes go in.
const BODY = ["..###..", ".#####.", "E", "#######", ".#####."];
const POSES: Record<Pose, string[]> = {
  stand: [...BODY, ".##.##."],
  // Walking: one foot down, then the other.
  stepA: [...BODY, ".##...."],
  stepB: [...BODY, "....##."],
  // In the air: feet out.
  hop: [...BODY, "#.....#"],
  // Sat down: a row lower, feet tucked under.
  sit: [".......", "..###..", ".#####.", "E", "#######", "#######"],
};

const made = new Map<string, string>();

/** A frame as an SVG path, a unit a cell (runs of lit cells along a row are one box). */
export function framePath(pose: Pose, eyes: Eyes): string {
  const key = `${pose}:${eyes}`;
  const had = made.get(key);
  if (had !== undefined) return had;
  let d = "";
  POSES[pose].forEach((line, y) => {
    const row = line === "E" ? EYES[eyes] : line;
    for (let x = 0; x < COLS; x++) {
      if (row[x] !== "#") continue;
      let end = x;
      while (end + 1 < COLS && row[end + 1] === "#") end++;
      d += `M${x} ${y}h${end - x + 1}v1h${x - end - 1}z`;
      x = end;
    }
  });
  made.set(key, d);
  return d;
}
