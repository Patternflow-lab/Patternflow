import type { CaseModel } from '../caseModels';

// Besoiobiy's printed case: tools/case-models/besoiobiy.py, from the parts in
// hardware/case/remixes/besoiobiy-printed/source/patternbox.stl put together.
// A frame round the LED panel and a box beside it for the board, each printed
// as a top and a bottom half and glued, closed at the back by four flat
// covers. The knobs are Besoiobiy's own caps.
export const BESOIOBIY_MODEL: CaseModel = {
  id: 'besoiobiy-printed',
  url: '/cases/besoiobiy-printed/model.glb',
  // Drawn apart the way it goes together. The four halves open a little at
  // their glue joints, top from bottom and box from frame, so the joints and
  // their keys show; whatever is held in the box (the knobs, the board, the
  // DevKit, its covers) moves with the box's half. The panel goes into the
  // frame from the front and the knobs onto the shafts from the front, so
  // both come off that way. Behind the box the board comes out, the DevKit
  // comes off its sockets, and the covers come off last, all four together
  // as the back of the case, each clear of what is in front of it.
  explode: {
    frame_top: [0, 1, 0],
    frame_bottom: [0, -1, 0],
    box_top: [1, 1, 0],
    box_bottom: [1, -1, 0],
    l: [0, 0, 6.4],
    c1: [1, 1, 4.2],
    c2: [1, 1, 4.2],
    c3: [1, 1, 4.2],
    c4: [1, 1, 4.2],
    pcb_v39: [1, 1, -6.8],
    devkit: [1, 1, -11.2],
    cover_frame_top: [0, 1, -15.5],
    cover_frame_bottom: [0, -1, -15.5],
    cover_box_top: [1, 1, -15.5],
    cover_box_bottom: [1, -1, -15.5],
  },
};
