import { describe, expect, it } from 'vitest';
import { DETENTS_PER_TURN, TURNS_PER_FULL_RANGE } from '@/lib/shared/constants';
import { getVariantPrompt } from './variantPrompt';

// The prompt "Copy creation prompt" hands a model. Its knob lines have to say
// what one detent does to each knob, the same rule the preview's knobs and the
// encoder follow: a knob's whole range in two turns of 24 detents.

const knobLines = (prompt: string) => prompt.split('\n').filter((line) => line.startsWith('- Knob '));

describe('getVariantPrompt', () => {
  it("gives each knob the step one detent moves it, from the knob's range", () => {
    const detentsPerRange = DETENTS_PER_TURN * TURNS_PER_FULL_RANGE;
    const step = (span: number) => Math.round((span / detentsPerRange) * 1000) / 1000;

    // 48 detents a range today: 0.021, 0.206, 0.102 and 0.021. The lines said
    // 0.05, 0.10, 0.05 and 0.05.
    expect(knobLines(getVariantPrompt(''))).toEqual([
      `- Knob 1: 0.0 to 1.0, wraps at edges, step ${step(1)} per detent.`,
      `- Knob 2: 0.1 to 10.0, clamps at edges, step ${step(9.9)} per detent.`,
      `- Knob 3: 0.0 to 4.9, clamps at edges, step ${step(4.9)} per detent.`,
      `- Knob 4: 0.0 to 1.0, wraps at edges, step ${step(1)} per detent.`,
    ]);
  });

  it('says how many detents make a turn and a range', () => {
    expect(getVariantPrompt('')).toContain(
      `The encoder has ${DETENTS_PER_TURN} detents a turn, and ${TURNS_PER_FULL_RANGE} turns cross a knob's whole range:`,
    );
  });

  it('ends with the seed pattern in a javascript block', () => {
    const code = 'export function draw(display) {}';
    expect(getVariantPrompt(code).endsWith(`\`\`\`javascript\n${code}\n\`\`\``)).toBe(true);
  });
});
