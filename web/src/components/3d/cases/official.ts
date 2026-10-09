import type { CaseModel } from '../caseModels';

// The official printed case, v3.9: tools/case-models/assemble.mjs official,
// from the guide's case-v39.glb (exported from
// hardware/case/source/patternflow_case.blend).
export const OFFICIAL_MODEL: CaseModel = {
  id: 'official',
  url: '/cases/official/model.glb',
  explode: {
    c1: [0, 0, 14],
    c2: [0, 0, 14],
    c3: [0, 0, 14],
    c4: [0, 0, 14],
    body: [0, 0, 8],
    top_lid: [0, 0, 10],
    l: [0, 0, 3],
    pcb_v39: [0, 0, 0],
    devkit: [0, 0, -5],
    back_plate: [0, 0, -10],
    back_slider: [6, 0, -10],
  },
};
