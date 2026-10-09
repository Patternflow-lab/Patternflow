import type { CaseModel } from '../caseModels';

// Simone Majocchi's laser-cut case: tools/case-models/simonepda.py, from the
// drawing in hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf.
// One sheet carries everything: the LED panel on its front inside four strips
// standing on edge, the board behind it under a finger-jointed acrylic box,
// and three open cubes on its back as feet.
export const SIMONEPDA_MODEL: CaseModel = {
  id: 'simonepda-lasercut',
  url: '/cases/simonepda-lasercut/model.glb',
  // Drawn apart around the sheet, which stays put: the knobs and the panel
  // come off the front, the strips open out round where the panel was, and
  // behind the sheet the board, the DevKit, the box's walls, its lid and the
  // feet come away in that order, each clear of the one in front of it. The
  // walls also step outward so their finger joints show.
  explode: {
    c1: [0, 0, 14],
    c2: [0, 0, 14],
    c3: [0, 0, 14],
    c4: [0, 0, 14],
    l: [0, 0, 6],
    strip_left: [-2.5, 0, 3],
    strip_right: [2.5, 0, 3],
    strip_top: [0, 2.5, 3],
    strip_bottom: [0, -2.5, 3],
    pcb_v39: [0, 0, -2.5],
    devkit: [0, 0, -5],
    box_wall_left: [-1.2, 0, -9],
    box_wall_right: [1.2, 0, -9],
    box_wall_top: [0, 1.2, -9],
    box_wall_bottom: [0, -1.2, -9],
    box_lid: [0, 0, -11],
    foot_1: [0, 0, -12],
    foot_2: [0, 0, -12],
    foot_3: [0, 0, -12],
  },
  // The file is the clear acrylic build. The MDF one is the same drawing cut
  // from 2.8 mm board: a light tan face, and edges the laser burns dark brown
  // (the colours of the remix's photos). The box over the board is acrylic in
  // both, so only the sheet's own materials change.
  finishes: [
    { id: 'acrylic', label: 'Acrylic' },
    {
      id: 'mdf',
      label: 'MDF',
      looks: {
        sheet_face: { color: '#dcc19c', roughness: 0.9 },
        sheet_edge: { color: '#3d2b1d', roughness: 0.95 },
      },
    },
  ],
};
