import { create } from 'zustand';
import type { CaseId } from '@/components/sections/build-cases-data';

export type SectionType = 'hero' | 'case' | 'pcb' | 'assembly' | 'firmware' | 'inside';

// Which top-level home tab is open. Mirrored from RightPanel so sibling
// components (e.g. the 3D viewer panel) can react without prop drilling.
export type HomeTabType = 'hero' | 'build' | 'pattern' | 'inside';

interface AppState {
  activeSection: SectionType;
  setActiveSection: (section: SectionType) => void;
  homeTab: HomeTabType;
  setHomeTab: (tab: HomeTabType) => void;
  // Which build pin is open on the globe. Lifted out of the globe itself so
  // the Inside panel can show the details as a card — on mobile the viewer is
  // only 44vh, far too little room for photos and a description.
  selectedBuildId: string | null;
  setSelectedBuildId: (id: string | null) => void;
  insideFilter: 'all' | 'builds' | 'projects' | 'in-use';
  setInsideFilter: (filter: AppState['insideFilter']) => void;
  knobValues: {
    c1: number;
    c2: number;
    c3: number;
    c4: number;
  };
  setKnobValue: (knobId: 'c1' | 'c2' | 'c3' | 'c4', value: number) => void;
  isDraggingKnob: boolean;
  setIsDraggingKnob: (isDragging: boolean) => void;
  activeKnobId: 'c1' | 'c2' | 'c3' | 'c4' | null;
  setActiveKnobId: (id: 'c1' | 'c2' | 'c3' | 'c4' | null) => void;
  isBloomEnabled: boolean;
  setIsBloomEnabled: (enabled: boolean) => void;
  activePatternId: string;
  setActivePatternId: (id: string) => void;
  customJsCode: string;
  setCustomJsCode: (code: string) => void;
  buildStep: number;
  setBuildStep: (step: number) => void;
  // How far the device is pulled apart on build step 3, 0 (assembled) to 1
  // (fully exploded). Continuous rather than a flag so the panel can hand the
  // separation to the reader instead of animating it at them.
  explode: number;
  setExplode: (explode: number) => void;
  // Which case the Build panel's switch is on. The product preview shows the
  // device in it (components/3d/caseModels.ts), on every tab that shows the
  // product, so the case a reader picked stays the one they look at.
  buildCase: CaseId;
  setBuildCase: (id: CaseId) => void;
  // For a case that comes in more than one finish (caseModels.ts: finishes),
  // which one the preview shows. Kept per case, so going back to it keeps the
  // reader's pick; a case without an entry shows its first finish.
  caseFinish: Partial<Record<CaseId, string>>;
  setCaseFinish: (id: CaseId, finish: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeSection: 'hero',
  setActiveSection: (section) => set({ activeSection: section }),
  homeTab: 'hero',
  setHomeTab: (tab) => set({ homeTab: tab }),
  selectedBuildId: null,
  setSelectedBuildId: (id) => set({ selectedBuildId: id }),
  insideFilter: 'all',
  setInsideFilter: (filter) => set({ insideFilter: filter }),
  knobValues: {
    c1: 0.00, // Hue
    c2: 2.00, // Speed
    c3: 0.06, // Freq/Offset
    c4: 0.00, // Mode
  },
  setKnobValue: (knobId, value) =>
    set((state) => ({
      knobValues: {
        ...state.knobValues,
        [knobId]: value,
      },
    })),
  isDraggingKnob: false,
  setIsDraggingKnob: (isDragging) => set({ isDraggingKnob: isDragging }),
  activeKnobId: null,
  setActiveKnobId: (id) => set({ activeKnobId: id }),
  isBloomEnabled: true,
  setIsBloomEnabled: (enabled) => set({ isBloomEnabled: enabled }),
  activePatternId: 'patternFlowOriginal',
  setActivePatternId: (id) => set({ activePatternId: id }),
  customJsCode: `// Patternflow live editor starter.
// input.knobValues contains the 4 absolute knob values from the preview.

export function setup(params) {
  params.time = 0;
}

export function update(dt, input, params) {
  const knobs = input.knobValues || [0.5, 2.0, 1.0, 0.6];
  params.hue = knobs[0] * 360;
  params.speed = Math.max(0.05, knobs[1]);
  params.spread = 0.5 + knobs[2] * 0.75;
  params.pulse = 0.4 + knobs[3] * 1.8;
  params.time += dt * params.speed;
}

export function draw(display, params, globalTime) {
  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      let h = params.hue * 0.017 + x * 0.045 * params.spread + y * 0.035 + params.time;
      let wave = Math.sin(h * 2 + params.time * 1.5) * 0.5 + 0.5;
      let bright = 0.35 + wave * 0.65 * params.pulse;

      display.setPixel(
        x, y,
        (Math.sin(h) * 0.5 + 0.5) * 255 * bright,
        (Math.sin(h + 2.1) * 0.5 + 0.5) * 255 * bright,
        (Math.sin(h + 4.2) * 0.5 + 0.5) * 255 * bright
      );
    }
  }
}`,
  setCustomJsCode: (code) => set({ customJsCode: code }),
  buildStep: 0,
  setBuildStep: (step) => set({ buildStep: step }),
  explode: 1,
  setExplode: (val) => set({ explode: val }),
  buildCase: 'official',
  setBuildCase: (id) => set({ buildCase: id }),
  caseFinish: {},
  setCaseFinish: (id, finish) =>
    set((state) => ({ caseFinish: { ...state.caseFinish, [id]: finish } })),
}));
