"use client";

// Text layer editor — what the layer says, its font, size, place, alignment
// and fill. The letters are drawn into the layer's bitmap on every change
// (lib/lab/text.ts); moving them is a drag on the Preview, or X and Y here.
//
// Fonts come from the site, the device or a file the person picks
// (lib/lab/textFonts.ts). A file is read in this browser and goes nowhere.
//
// Copy as code takes the letters as they are drawn now, the way Pixel's does
// a drawing (lib/lab/pixelToCode.ts): a pattern that needs no font.
//
// An effect moves the letters every frame at a speed one knob sets
// (lib/lab/textEffects.ts), and the export and the firmware header carry it.
// That knob turns here too, beside its picker: the same store value the Knobs
// panel turns, so on a phone, where the two are tabs of one group, setting a
// speed needs no trip to Knobs and back.

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useResettingState } from "@/lib/hooks/useResettingState";
import { buildPixelPatternCode } from "@/lib/lab/pixelToCode";
import { useActiveLayer, useLabStore } from "@/lib/lab/store";
import {
  FONT_FILE_ACCEPT,
  addFontFile,
  fontLabel,
  fontOptions,
  forgetFont,
  isFileFont,
  isFontRemembered,
  loadRememberedFonts,
  resolveFont,
  subscribeFonts,
  type FontGroup,
  type FontOption,
} from "@/lib/lab/textFonts";
import {
  TEXT_ALIGNS,
  TEXT_EFFECTS,
  TEXT_MAX_CHARS,
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  isTextLayer,
  type TextEffect,
  type TextFill,
  type TextLayer,
} from "@/lib/lab/types";
import { knobArrowValue } from "@/lib/pattern/controls";
import type { CodeCopyState } from "./pixel/PixelToolbars";
import local from "./TextPanel.module.css";
import dock from "../LabPanels.module.css";

const GROUP_LABEL: Record<FontGroup, string> = {
  site: "On this site",
  system: "This device",
  file: "Your font files",
};

const FILL_LABEL: Record<TextFill, string> = {
  solid: "One color",
  rampX: "Ramp across",
  rampY: "Ramp down",
};

const ALIGN_LABEL = { left: "Left", center: "Center", right: "Right" } as const;

const EFFECT_LABEL: Record<TextEffect, string> = {
  none: "None",
  scroll: "Scroll",
  twinkle: "Twinkle",
  ramp: "Run the ramp",
};

/** What the knob does to each effect, said after the knob's name. */
const EFFECT_SPEED: Record<Exclude<TextEffect, "none">, string> = {
  scroll: "sets how fast the letters run out to the left and come back from the right, up to a panel's width a second",
  twinkle: "sets how fast each LED dims and comes back",
  ramp: "sets how fast the colors run along this layer's Color Ramp and back",
};

/** Where a knob sits in its range, 0..1, the way the effect reads it. */
function knobShare(value: number | undefined, range: [number, number] | undefined): number {
  if (value === undefined || !range) return 0;
  const share = (value - range[0]) / Math.max(0.0001, range[1] - range[0]);
  return Math.max(0, Math.min(1, share));
}

const COPY_LABEL: Record<CodeCopyState, string> = {
  idle: "Copy as code",
  copied: "Copied ✓",
  empty: "No letters on the frame",
  failed: "Copy failed",
};

/** The font picker's entries, kept up as fonts are added, remembered or arrive. */
function useFontOptions(): FontOption[] {
  const [options, setOptions] = useState(fontOptions);
  useEffect(() => {
    const refresh = () => setOptions(fontOptions());
    const off = subscribeFonts(refresh);
    void loadRememberedFonts().then(refresh);
    return off;
  }, []);
  return options;
}

/**
 * A whole-number field that commits as soon as what is typed is a number in
 * range, and shows the stored value again on blur. Committing "1" on the way
 * to "16" would clamp the size to 4 and turn the next keystroke into "46".
 */
function NumberField({
  label,
  value,
  min,
  max,
  title,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  title?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={local.field} title={title}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={min}
        max={max}
        value={draft ?? String(value)}
        onFocus={() => setDraft(String(value))}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.target.value);
          const number = Number(event.target.value);
          if (event.target.value.trim() !== "" && Number.isFinite(number) && number >= min && number <= max) {
            onCommit(Math.round(number));
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

export default function TextPanel() {
  const layer = useActiveLayer();
  const addTextLayer = useLabStore((state) => state.addTextLayer);
  const text = isTextLayer(layer) ? layer : undefined;

  if (!text) {
    return (
      <div className={dock.panel}>
        <div className={dock.panelHint}>
          {layer ? "The selected layer isn't text. Select a text layer, or add one." : "Select a text layer."}
          <button type="button" onClick={addTextLayer}>
            + Add text layer
          </button>
        </div>
      </div>
    );
  }
  return <TextEditor key={text.id} layer={text} />;
}

function TextEditor({ layer }: { layer: TextLayer }) {
  const setTextSpec = useLabStore((state) => state.setTextSpec);
  const setKnob = useLabStore((state) => state.setKnob);
  const knobLabels = useLabStore((state) => state.knobLabels);
  const knobValue = useLabStore((state) => state.knobs[layer.spec.effectKnob] ?? 0);
  const knobRange = useLabStore((state) => state.ranges[layer.spec.effectKnob]);
  const speed = Math.round(knobShare(knobValue, knobRange) * 100);
  const options = useFontOptions();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [codeCopy, flashCodeCopy] = useResettingState<CodeCopyState>("idle", 1400);
  const { spec } = layer;
  const set = (patch: Parameters<typeof setTextSpec>[1]) => setTextSpec(layer.id, patch);

  const copyAsCode = () => {
    const code = buildPixelPatternCode(layer);
    if (!code) {
      flashCodeCopy("empty");
      return;
    }
    navigator.clipboard
      .writeText(code)
      .then(() => flashCodeCopy("copied"))
      .catch(() => flashCodeCopy("failed"));
  };

  const missing = resolveFont(spec.font).missing;
  const groups = (["site", "system", "file"] as const).map((group) => ({
    group,
    options: options.filter((option) => option.group === group),
  }));
  const remembered = isFileFont(spec.font) && isFontRemembered(spec.font);
  const knobName = knobLabels[spec.effectKnob] || `Knob ${spec.effectKnob + 1}`;

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const option = await addFontFile(file, remember);
      set({ font: option.id });
      setMessage(
        remember
          ? `${option.label} is kept in this browser for next time.`
          : `${option.label} is loaded for this visit.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That font couldn't be read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={dock.panel}>
      <div className={dock.panelBar}>
        <span className={local.barLabel}>Align</span>
        {TEXT_ALIGNS.map((align) => (
          <button
            key={align}
            type="button"
            data-active={spec.align === align}
            aria-pressed={spec.align === align}
            onClick={() => set({ align })}
            title={`${ALIGN_LABEL[align]}: X is the ${align === "center" ? "middle" : `${align} edge`} of each line`}
          >
            {ALIGN_LABEL[align]}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => set({ align: "center", x: Math.round(layer.width / 2), y: Math.round(layer.height / 2) })}
          title="Put the text in the middle of the frame"
        >
          Center on frame
        </button>
      </div>

      <div className={`${dock.panelBody} ${local.body}`}>
        <label className={local.textField}>
          <span>Text</span>
          <textarea
            value={spec.text}
            rows={2}
            maxLength={TEXT_MAX_CHARS}
            spellCheck={false}
            onChange={(event) => set({ text: event.target.value })}
          />
        </label>

        <div className={local.row}>
          <label className={`${local.field} ${local.grow}`}>
            <span>Font</span>
            <select value={spec.font} onChange={(event) => set({ font: event.target.value })}>
              {missing && <option value={spec.font}>{fontLabel(spec.font)} (not in this browser)</option>}
              {groups.map(({ group, options: entries }) =>
                entries.length === 0 ? null : (
                  <optgroup key={group} label={GROUP_LABEL[group]}>
                    {entries.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </select>
          </label>
          <NumberField
            label="Size"
            value={spec.size}
            min={TEXT_SIZE_MIN}
            max={TEXT_SIZE_MAX}
            title={`Font size in LED pixels, ${TEXT_SIZE_MIN}–${TEXT_SIZE_MAX}`}
            onCommit={(size) => set({ size })}
          />
        </div>

        <div className={local.fontFile}>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Reading…" : "Add a font file…"}
          </button>
          <label className={local.check}>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
            remember in this browser
          </label>
          {remembered && (
            <button
              type="button"
              onClick={() => {
                void forgetFont(spec.font).then((ok) =>
                  setMessage(ok ? `${fontLabel(spec.font)} won't be here next visit.` : "This browser kept no copy."),
                );
              }}
              title="Remove the saved copy from this browser. It stays loaded until the tab closes."
            >
              Forget it
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={FONT_FILE_ACCEPT}
            className={local.hiddenInput}
            aria-label="Font file"
            onChange={onFile}
          />
        </div>
        <p className={local.note} role="status">
          {missing
            ? `${fontLabel(spec.font)} isn't loaded in this browser. The layer keeps its letters as they were drawn; add the font file again to change them in it.`
            : (message ?? "A .ttf, .otf, .woff or .woff2 from your device. It is read here in the browser and never uploaded.")}
        </p>

        <div className={local.row}>
          <NumberField
            label="X"
            value={spec.x}
            min={-layer.width * 4}
            max={layer.width * 4}
            title="Where each line starts, centers or ends, by the alignment. Drag the text in Preview to move it."
            onCommit={(x) => set({ x })}
          />
          <NumberField
            label="Y"
            value={spec.y}
            min={-layer.height * 4}
            max={layer.height * 4}
            title="The middle of the text block, in LED pixels from the top"
            onCommit={(y) => set({ y })}
          />
          <label className={local.field}>
            <span>Fill</span>
            <select value={spec.fill} onChange={(event) => set({ fill: event.target.value as TextFill })}>
              {(Object.keys(FILL_LABEL) as TextFill[]).map((fill) => (
                <option key={fill} value={fill}>
                  {FILL_LABEL[fill]}
                </option>
              ))}
            </select>
          </label>
          {spec.fill === "solid" && spec.effect !== "ramp" && (
            <label className={local.field}>
              <span>Color</span>
              <input
                type="color"
                className={dock.colorWell}
                value={spec.color}
                onChange={(event) => set({ color: event.target.value })}
              />
            </label>
          )}
        </div>

        <label className={local.check}>
          <input type="checkbox" checked={spec.sharp} onChange={(event) => set({ sharp: event.target.checked })} />
          sharp edges: each LED fully on or off
        </label>
        <p className={local.note}>
          {spec.fill === "solid" && spec.effect !== "ramp"
            ? "Drag the text in Preview to move it."
            : "Drag the text in Preview to move it. The colors are this layer's Color Ramp."}
        </p>

        <div className={local.row}>
          <label className={local.field}>
            <span>Effect</span>
            <select value={spec.effect} onChange={(event) => set({ effect: event.target.value as TextEffect })}>
              {TEXT_EFFECTS.map((effect) => (
                <option key={effect} value={effect}>
                  {EFFECT_LABEL[effect]}
                </option>
              ))}
            </select>
          </label>
          {spec.effect !== "none" && (
            <label className={local.field}>
              <span>Speed knob</span>
              <select value={spec.effectKnob} onChange={(event) => set({ effectKnob: Number(event.target.value) })}>
                {knobLabels.map((label, index) => (
                  <option key={index} value={index}>
                    {label || `Knob ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {spec.effect !== "none" && knobRange && (
            <label className={`${local.field} ${local.grow}`} title="The same knob as in Knobs: turning one turns the other">
              <span>{knobName}</span>
              <input
                type="range"
                min={knobRange[0]}
                max={knobRange[1]}
                step="0.001"
                value={knobValue}
                onChange={(event) => setKnob(spec.effectKnob, Number(event.target.value))}
                onKeyDown={(event) => {
                  const next = knobArrowValue(event, knobValue, knobRange);
                  if (next === null) return;
                  event.preventDefault();
                  setKnob(spec.effectKnob, next);
                }}
              />
            </label>
          )}
        </div>
        {spec.effect !== "none" && (
          <p className={local.note}>
            {`${knobName} ${EFFECT_SPEED[spec.effect]}. `}
            {speed === 0
              ? "It is all the way down, so nothing moves yet: turn it up here or in Knobs."
              : `It is at ${speed}% now. All the way down stands the effect still.`}
          </p>
        )}

        <div className={local.actions}>
          <button
            type="button"
            onClick={copyAsCode}
            title="Copy the letters as a standalone pattern (JS) that needs no font. Paste it into an AI chat and ask it to scroll, wave or twinkle them. The text layer stays as it is."
          >
            {COPY_LABEL[codeCopy]}
          </button>
          <span className={local.note}>
            {spec.effect === "none"
              ? "The letters as pixels: the code needs no font. Change the words and copy again."
              : "The letters as pixels, standing still: the effect goes with Export and To hardware."}
          </span>
        </div>
      </div>
    </div>
  );
}
