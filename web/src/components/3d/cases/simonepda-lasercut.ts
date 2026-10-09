import type { CaseModel } from '../caseModels';

// Simone Majocchi's laser-cut case: tools/case-models/simonepda.py, from the
// drawing in hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf.
export const SIMONEPDA_MODEL: CaseModel = {
  id: 'simonepda-lasercut',
  url: '/cases/simonepda-lasercut/model.glb',
  explode: {},
  finishes: [
    { id: 'acrylic', label: 'Acrylic' },
    {
      id: 'mdf',
      label: 'MDF',
      looks: {
        sheet_face: { color: '#c9a77c', roughness: 0.9 },
        sheet_edge: { color: '#4b3324', roughness: 0.95 },
      },
    },
  ],
};
