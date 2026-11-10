"use client";

// Monaco editor bound to the ACTIVE code layer. The toolbar keeps the
// single-pattern workflow: preset stepper, paste/clear, the AI variation
// prompt with the colour model it asks for, and the code guide.

import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import { livePresets } from "@/lib/presets";
import {
  MATRIX_MAX,
  MATRIX_MIN,
  formatMatrix,
  matchMatrixAnnotation,
  matrixesEqual,
  parseMatrixAnnotation,
} from "@/lib/pattern/matrix";
import { COLOR_MODES, type ColorMode } from "@/lib/ai/settings";
import { buildVariantCopyPrompt } from "@/lib/ai/variantPrompt";
import { useResettingState } from "@/lib/hooks/useResettingState";
import { hasStackAnnotation, importCodeIntoLab } from "@/lib/lab/stackShare";
import { useActiveLayer, useLabStore } from "@/lib/lab/store";
import { isCodeLayer, type Layer } from "@/lib/lab/types";
import styles from "../PatternLab.module.css";
import local from "./CodePanel.module.css";
import dock from "../LabPanels.module.css";
import CodeGuideModal from "./CodeGuideModal";

const labPresets = livePresets.filter((preset) => preset.labOnly);

// What the panel says when another kind of layer is selected. Keyed by type,
// so a new layer type has to say where it is edited.
const OTHER_LAYER_HINT: Record<Exclude<Layer["type"], "code">, string> = {
  pixel: "The selected layer is pixel art. Edit it in the Pixel panel, or select a code layer.",
  text: "The selected layer is text. Edit it in the Text panel, or select a code layer.",
};

export default function CodePanel() {
  const layer = useActiveLayer();
  const matrix = useLabStore((state) => state.matrix);
  const knobs = useLabStore((state) => state.knobs);
  const ranges = useLabStore((state) => state.ranges);
  const gen = useLabStore((state) => state.gen);
  const setGen = useLabStore((state) => state.setGen);
  const updateLayerCode = useLabStore((state) => state.updateLayerCode);
  const applyMatrixLine = useLabStore((state) => state.applyMatrixLine);
  const applyCodeToActive = useLabStore((state) => state.applyCodeToActive);
  const addCodeLayer = useLabStore((state) => state.addCodeLayer);
  const error = useLabStore((state) =>
    layer ? (state.layerErrors[layer.id] ?? null) : null,
  );

  const [promptCopy, flashPromptCopy] = useResettingState<"idle" | "copied" | "failed">("idle", 1200);
  const [pasted, setPasted] = useResettingState(false, 1200);
  const [cleared, setCleared] = useResettingState(false, 1200);
  const [guideOpen, setGuideOpen] = useState(false);

  // Typing holds the @matrix line (holdMatrix below). The frame follows it
  // when focus leaves the editor, or the panel leaves the layer.
  const codeLayerId = isCodeLayer(layer) ? layer.id : null;
  const editingId = useRef(codeLayerId);
  useEffect(() => {
    editingId.current = codeLayerId;
    if (!codeLayerId) return;
    return () => applyMatrixLine(codeLayerId);
  }, [codeLayerId, applyMatrixLine]);
  const applyMatrixOnBlur: OnMount = (editor) => {
    editor.onDidBlurEditorWidget(() => {
      if (editingId.current) applyMatrixLine(editingId.current);
    });
  };

  if (!isCodeLayer(layer)) {
    return (
      <div className={dock.panel}>
        <div className={dock.panelHint}>
          {layer ? OTHER_LAYER_HINT[layer.type] : "Select a layer to edit."}
          <button type="button" onClick={addCodeLayer}>
            + Add code layer
          </button>
        </div>
      </div>
    );
  }

  const activeLabIndex = labPresets.findIndex((preset) => preset.code === layer.code);

  const matrixLine = matchMatrixAnnotation(layer.code);
  const lineFrame = parseMatrixAnnotation(layer.code);
  const matrixNote = !matrixLine
    ? null
    : !lineFrame
      ? `The @matrix line needs each side from ${MATRIX_MIN} to ${MATRIX_MAX}. The frame stays ${formatMatrix(matrix)}.`
      : matrixLine !== layer.matrixAnnotationRaw && !matrixesEqual(lineFrame, matrix)
        ? `The frame becomes ${formatMatrix(lineFrame)} when you leave the editor.`
        : null;

  const stepLabPreset = (dir: number) => {
    if (labPresets.length === 0) return;
    const base = activeLabIndex >= 0 ? activeLabIndex : dir > 0 ? -1 : 0;
    const next = (base + dir + labPresets.length) % labPresets.length;
    applyCodeToActive(labPresets[next].code);
  };

  // A browser can refuse the write (no permission, a page served over plain
  // http). The button says so, the way Pixel's "Copy as code" does.
  const copyVariantPrompt = async () => {
    try {
      await navigator.clipboard.writeText(
        buildVariantCopyPrompt(layer.code, knobs, ranges, gen.colorMode, matrix),
      );
      flashPromptCopy("copied");
    } catch {
      flashPromptCopy("failed");
    }
  };

  // Pasted code carrying a @stack line is a whole shared composition —
  // restore its layers instead of overwriting the active layer's code.
  const applyPastedCode = (text: string) => {
    if (hasStackAnnotation(text)) {
      void importCodeIntoLab(text);
    } else {
      applyCodeToActive(text);
    }
    setPasted(true);
  };

  const pasteFromClipboard = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          applyPastedCode(text);
          return;
        }
      }
    } catch {
      // Permission blocked or unsupported in WebView — fall back to window.prompt
    }
    const fallbackText = window.prompt("Paste the pattern code here and press OK.");
    if (fallbackText !== null) {
      applyPastedCode(fallbackText);
    }
  };

  return (
    <div className={dock.panel}>
      <div className={dock.panelBar}>
        <label title="Editing this layer's code">{layer.name}</label>
        <div
          className={local.presetStep}
          title={activeLabIndex >= 0 ? labPresets[activeLabIndex].name : "Lab presets"}
        >
          <button type="button" onClick={() => stepLabPreset(-1)} aria-label="Previous lab preset">
            ‹
          </button>
          <span>
            {activeLabIndex >= 0 ? activeLabIndex + 1 : "–"}/{labPresets.length}
          </span>
          <button type="button" onClick={() => stepLabPreset(1)} aria-label="Next lab preset">
            ›
          </button>
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={pasteFromClipboard}
          title="Replace this layer's code from the clipboard"
        >
          {pasted ? "Pasted ✓" : "Paste"}
        </button>
        <button
          type="button"
          onClick={() => {
            updateLayerCode(layer.id, "");
            setCleared(true);
          }}
          title="Clear this layer's code"
        >
          {cleared ? "Cleared ✓" : "Clear"}
        </button>
        <span className={local.promptGroup}>
          <select
            value={gen.colorMode}
            aria-label="Color mode"
            title="What Copy prompt asks for. v-field: the AI writes a 0..1 value field and the layer's Color Ramp does the coloring. rgb: the AI colors pixels itself."
            onChange={(event) => setGen({ colorMode: event.target.value as ColorMode })}
          >
            {COLOR_MODES.map((option) => (
              <option key={option} value={option}>
                {option === "vfield" ? "v-field" : "rgb"}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={local.promptButton}
            onClick={copyVariantPrompt}
            title="Copy the AI variation prompt for this layer (ChatGPT / Claude / Gemini)"
          >
            {promptCopy === "copied" ? "Copied" : promptCopy === "failed" ? "Copy failed" : "Copy prompt"}
          </button>
        </span>
        <button type="button" onClick={() => setGuideOpen(true)}>
          Code guide
        </button>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}
      {matrixNote && (
        <div className={local.matrixNote} role="status">
          {matrixNote}
        </div>
      )}

      <div className={dock.panelBody}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          path={`layer-${layer.id}.js`}
          value={layer.code}
          onChange={(value) => updateLayerCode(layer.id, value ?? "", { holdMatrix: true })}
          onMount={applyMatrixOnBlur}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            overviewRulerLanes: 0,
          }}
        />
      </div>

      {guideOpen && <CodeGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
