import type { CaseModel } from '../caseModels';

// The official printed case, v3.9: tools/case-models/assemble.mjs official,
// from the guide's case-v39.glb (exported from
// hardware/case/source/patternflow_case.blend).
export const OFFICIAL_MODEL: CaseModel = {
  id: 'official',
  url: '/cases/official/model.glb',
  // The guide's exploded device (components/guide/stage/explodeParts.ts):
  // each part along the way it really goes on or comes off, told from the
  // body, which stays. The knobs and the panel come off the front, the lid
  // slides out sideways over the power-bank tray, and behind the body the
  // board, the DevKit and the back plate with its cover come away in that
  // order.
  explode: {
    c1: [0, 0, 4.2],
    c2: [0, 0, 4.2],
    c3: [0, 0, 4.2],
    c4: [0, 0, 4.2],
    l: [0, 0, 6.4],
    top_lid: [7.2, 0, 2.2],
    pcb_v39: [0, 0, -6.8],
    devkit: [0, 0, -11.2],
    back_plate: [0, 0, -15.5],
    back_slider: [5.4, 0, -15.5],
  },
};
