// The Build guide's parts can be touched: a mouse over a part on the bench or
// the board lifts it a hair and names it, and lights its line in the parts
// list; a line of the list pointed at lifts and lights its part on the stage.
// This is what the two sides share — the card (build/BuildCards.tsx, the
// page's code) and the stage (stage/build/touch.ts, the canvas's) — kept free
// of three.js so the card does not pull the stage in.
//
// A part goes by its line's key in the BOM (build/bom.ts bomKey: the board's
// reference, "SW1-SW4", or the part's name where it has none).

/**
 * The lines that have a part on the stage: every line of the BOM
 * (stage/build/build.test.ts keeps the two in step — a line added to the
 * file, or renamed, shows up there and not as a part that silently stopped
 * answering).
 */
export const TOUCH_KEYS = [
  "U1",
  "U1 (sockets)",
  "SW1-SW4",
  "J1",
  "J3",
  "J4",
  "C11",
  "LED matrix panel",
  "M4 screw",
  "USB cable (sacrificial)",
  "USB power bank",
] as const;
export type TouchKey = (typeof TOUCH_KEYS)[number];

type Listener = () => void;

const listeners = new Set<Listener>();
const labels = new Map<string, string>();
let fromStage: string | null = null;
let fromCard: string | null = null;

/** Where the hand's light goes for the part the card points at (world units); `on` while there is one on stage. */
export const touchSpot = { on: false, x: 0, y: 0, z: 0 };

function changed() {
  listeners.forEach((l) => l());
}

export function subscribeTouch(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The card: what its lines are called on the stage, in the page's language ("J4 · Screw terminal"). */
export function nameParts(names: Record<string, string>) {
  for (const [key, label] of Object.entries(names)) labels.set(key, label);
}

export function partLabel(key: string): string {
  return labels.get(key) ?? key;
}

/** The part under the pointer on the stage, or null. */
export function touchFromStage(key: string | null) {
  if (fromStage === key) return;
  fromStage = key;
  changed();
}

/** The line pointed at in the card (mouse or keyboard), or null. */
export function touchFromCard(key: string | null) {
  if (fromCard === key) return;
  fromCard = key;
  if (!key) touchSpot.on = false;
  changed();
}

export function stageTouch(): string | null {
  return fromStage;
}

export function cardTouch(): string | null {
  return fromCard;
}
