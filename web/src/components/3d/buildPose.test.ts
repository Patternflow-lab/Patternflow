import { describe, expect, it } from 'vitest';
import { poseFor, shows } from './buildPose';
import type { PartRole } from './heroCase';

// What the preview shows at each Build step: the case's loose pieces (a
// case's feet, CaseModel.loose) come out with the parts to make and on
// Assemble, and stay off the device standing and lit.

const piece = (role: PartRole, loose = false) => ({ role, loose });
const STEPS = { idle: 0, print: 1, solder: 2, assemble: 3, power: 4 };

describe('poseFor and shows', () => {
  it('has the loose pieces out while the case is made and put together', () => {
    for (const step of [STEPS.print, STEPS.assemble]) {
      expect(shows(poseFor(step, 1, 0), piece('shell', true)), `step ${step}`).toBe(true);
    }
  });

  it('keeps them off the device once it is powered, and off the board', () => {
    for (const step of [STEPS.idle, STEPS.solder, STEPS.power]) {
      expect(shows(poseFor(step, 1, 0), piece('shell', true)), `step ${step}`).toBe(false);
    }
  });

  it('leaves every other part to its step', () => {
    for (const step of Object.values(STEPS)) {
      const pose = poseFor(step, 1, 0);
      for (const role of ['shell', 'knob', 'led', 'pcb', 'devkit'] as const) {
        expect(shows(pose, piece(role)), `step ${step}, ${role}`).toBe(pose.show[role]);
      }
    }
    expect(shows(poseFor(STEPS.solder, 1, 0), piece('shell'))).toBe(false);
    expect(shows(poseFor(STEPS.power, 1, 0), piece('led'))).toBe(true);
  });

  it('lights the panel only once the device has power', () => {
    expect(Object.values(STEPS).filter((step) => poseFor(step, 1, 0).lit)).toEqual([STEPS.idle, STEPS.power]);
  });
});
