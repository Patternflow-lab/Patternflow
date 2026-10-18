import { describe, expect, it, vi } from 'vitest';
import { LedMatrixTexture } from './LedMatrixTexture';

// The landing page's Live Editor preview. Code pasted into the editor that
// threw used to go to console.error and nowhere else: sixty lines a second in
// the console, nothing on the page.

const knobs = { c1: 0, c2: 2, c3: 0.06, c4: 0 };

const RED = `export function draw(display) {
  display.setPixel(0, 0, 255, 0, 0);
}`;

const THROWS_IN_DRAW = `export function setup(params) {
  params.t = 0;
}

export function draw(display, params) {
  const v = missing * 2;
  display.setPixel(0, 0, v, v, v);
}`;

function frames(texture: LedMatrixTexture, count: number) {
  for (let i = 0; i < count; i++) texture.render(1 / 60, i / 60, knobs, knobs);
}

/** Pixel (0, 0) on the panel: the texture stores rows bottom-up. */
function topLeft(texture: LedMatrixTexture) {
  const data = texture.texture.image.data as Uint8Array;
  const idx = 63 * 128 * 4;
  return [data[idx], data[idx + 1], data[idx + 2]];
}

function setup() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const onError = vi.fn<(message: string | null) => void>();
  return { texture: new LedMatrixTexture(onError), onError };
}

describe('LedMatrixTexture errors', () => {
  it('reports a draw() that throws once, not on every frame, with its line', () => {
    const { texture, onError } = setup();
    texture.loadCode(THROWS_IN_DRAW);
    frames(texture, 60);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('missing is not defined\nline 6: const v = missing * 2;');
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('keeps the last pattern that ran while the code does not parse', () => {
    const { texture, onError } = setup();
    texture.loadCode(RED);
    frames(texture, 1);
    texture.loadCode('export function draw(display) {\n  display.setPixel(0, 0,');
    frames(texture, 1);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/^Unexpected/);
    expect(topLeft(texture)).toEqual([255, 0, 0]);
  });

  it('keeps the last pattern when setup() throws, and quotes the setup line', () => {
    const { texture, onError } = setup();
    texture.loadCode(RED);
    texture.loadCode(`export function setup(params) {
  params.grid = params.cells.map(() => 0);
}

export function draw(display) {
  display.setPixel(0, 0, 0, 0, 255);
}`);
    frames(texture, 1);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toMatch(/\nline 2: params\.grid = params\.cells\.map\(\(\) => 0\);$/);
    expect(topLeft(texture)).toEqual([255, 0, 0]);
  });

  it('says what is missing when the code has no draw()', () => {
    const { texture, onError } = setup();
    texture.loadCode('export function setup(params) {}');

    expect(onError).toHaveBeenCalledWith('Pattern must export draw(display, params, time).');
  });

  it('clears the message once the code runs again', () => {
    const { texture, onError } = setup();
    texture.loadCode(THROWS_IN_DRAW);
    frames(texture, 2);
    texture.loadCode(RED);
    frames(texture, 2);

    expect(onError.mock.calls.map(([message]) => message === null)).toEqual([false, true]);
    expect(topLeft(texture)).toEqual([255, 0, 0]);
  });

  it('says nothing for code that runs', () => {
    const { texture, onError } = setup();
    texture.loadCode(RED);
    frames(texture, 60);

    expect(onError).not.toHaveBeenCalled();
  });
});
