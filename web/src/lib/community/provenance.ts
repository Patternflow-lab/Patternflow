import { applyKnobEntries, defaultKnobState, knobStateIsDefault } from "@/lib/lab/annotations";
import { DEFAULT_RAMP_STATE } from "@/lib/lab/types";
import { parseKnobsAnnotation } from "@/lib/pattern/knobs";
import { DEFAULT_MATRIX, formatMatrix, matrixesEqual, parseMatrixAnnotation } from "@/lib/pattern/matrix";
import { parseRampAnnotation, type RampAnnotation } from "@/lib/pattern/ramp";
import { MADE_HOW_BLURBS, MADE_HOW_LABELS, type MadeHow } from "./validate";

// ─────────────────────────────────────────────────────────────────────────────
// Provenance — what is on the record about how a pattern came to exist.
//
// Two sources, and the difference matters.
//
// The author's `made_how` declaration is a *claim*. The signals below are
// *evidence*: they are read out of the pattern's own source, where Pattern Lab
// wrote them while the author worked. A `@ramp` line means somebody chose
// colours. `@knobs` means somebody decided what the four knobs should reach. A
// verified `.h` means somebody ran it on real hardware. None of that can be
// produced by asking a model for a pattern and pressing publish.
//
// This is deliberately not a score. It is a list of things that happened, shown
// as they are, and a pattern with none of them is not accused of anything.
//
// A line is only evidence when it says something other than what Pattern Lab
// writes on its own. The Lab puts `@matrix` on everything it publishes, `@ramp`
// on every value-field layer and, when it flattens a stack, `@knobs` too, so
// until 21 October 2026 an untouched Gemini variant came out "Framed" and
// "Colour shaped". Each line is read with its own parser and set against the
// Lab's own defaults: a 128×64 frame, the black-to-white linear ramp a new code
// layer gets with recolor off, and Knob 1–4 on their stock ranges.
// ─────────────────────────────────────────────────────────────────────────────

export type ProvenanceSignal = {
  id: string;
  label: string;
  /** Why this counts as a human decision, for the tooltip. */
  detail: string;
};

const STACK_RE = /^\s*\/\/\s*@stack\b/m;

/** The ramp a new code layer gets (lib/lab/store/shared.ts), as `@ramp` writes it. */
function isLabDefaultRamp(ramp: RampAnnotation): boolean {
  if (ramp.mode !== DEFAULT_RAMP_STATE.mode || ramp.wrap !== DEFAULT_RAMP_STATE.wrap) return false;
  if (ramp.recolor) return false;
  const stops = [...ramp.stops].sort((a, b) => a.position - b.position);
  return (
    stops.length === DEFAULT_RAMP_STATE.stops.length &&
    stops.every((stop, index) => {
      const base = DEFAULT_RAMP_STATE.stops[index];
      return stop.position === base.position && stop.color === base.color.toLowerCase();
    })
  );
}

export function provenanceSignals(code: string, hasHeader: boolean): ProvenanceSignal[] {
  const signals: ProvenanceSignal[] = [];

  const ramp = parseRampAnnotation(code);
  if (ramp && !isLabDefaultRamp(ramp)) {
    signals.push({
      id: "ramp",
      label: "Colour shaped",
      detail: "Carries a colour ramp — the stops and blend mode were chosen by the author.",
    });
  }
  const knobEntries = parseKnobsAnnotation(code);
  const knobs = knobEntries ? applyKnobEntries(knobEntries, defaultKnobState()) : null;
  if (knobs && !knobStateIsDefault(knobs.labels, knobs.ranges)) {
    signals.push({
      id: "knobs",
      label: "Knobs tuned",
      detail: "Declares its own knob names and ranges, rather than leaving the defaults.",
    });
  }
  if (STACK_RE.test(code)) {
    signals.push({
      id: "stack",
      label: "Layered",
      detail: "Composed from a layer stack in Pattern Lab, not a single generated file.",
    });
  }
  const frame = parseMatrixAnnotation(code);
  if (frame && !matrixesEqual(frame, DEFAULT_MATRIX)) {
    signals.push({
      id: "matrix",
      label: "Framed",
      detail: `Composed for ${formatMatrix(frame)}. Every new pattern starts at ${formatMatrix(DEFAULT_MATRIX)}.`,
    });
  }
  if (hasHeader) {
    signals.push({
      id: "hardware",
      label: "Hardware verified",
      detail: "Ships a firmware header the author ported and ran on a real board.",
    });
  }

  return signals;
}

export type Provenance = {
  madeHow: MadeHow | null;
  madeHowLabel: string | null;
  madeHowBlurb: string | null;
  signals: ProvenanceSignal[];
};

export function provenanceFor(
  code: string,
  hasHeader: boolean,
  madeHow: string | null,
): Provenance {
  const declared = madeHow && madeHow in MADE_HOW_LABELS ? (madeHow as MadeHow) : null;
  return {
    madeHow: declared,
    madeHowLabel: declared ? MADE_HOW_LABELS[declared] : null,
    madeHowBlurb: declared ? MADE_HOW_BLURBS[declared] : null,
    signals: provenanceSignals(code, hasHeader),
  };
}
