import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { SectionContent } from '@/lib/content';
import { useAppStore } from '@/store/useAppStore';
import { showcasePresets } from '@/lib/presets';
import PatternPanel from './PatternPanel';

// The Live Editor on /pattern. The preview reports why pasted code is not
// running (components/3d/LedMatrixTexture.ts); the panel shows it under the
// editor. The panel is mounted on every tab of the home view, but the editor
// and the flasher script only once the Pattern tab has been opened.

vi.mock('@monaco-editor/react', () => ({
  default: ({ height }: { height?: string | number }) => <textarea aria-label="Code" data-height={height} />,
}));
vi.mock('next/script', () => ({ default: ({ src }: { src: string }) => <span data-script={src} /> }));
vi.mock('@/lib/posthogEvents', () => ({ captureEvent: () => {} }));

const content: SectionContent = { title: 'Pattern', subtitle: '', content: '' };

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  useAppStore.getState().setCustomJsError(null);
});

describe('PatternPanel', () => {
  it('shows why the code is not running under the editor, and clears it', () => {
    render(<PatternPanel content={content} isActive />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    act(() => useAppStore.getState().setCustomJsError('missing is not defined\nline 6: const v = missing * 2;'));
    expect(status).toHaveTextContent('missing is not defined line 6: const v = missing * 2;');

    act(() => useAppStore.getState().setCustomJsError(null));
    expect(status).toBeEmptyDOMElement();
  });

  it('leaves the editor and the flasher script out until the tab first opens, then keeps them', () => {
    const flasher = () => document.querySelector('[data-script*="esp-web-tools"]');
    const { rerender } = render(<PatternPanel content={content} isActive={false} />);
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
    expect(flasher()).toBeNull();

    rerender(<PatternPanel content={content} isActive />);
    expect(screen.getByRole('textbox', { name: 'Code' })).toBeInTheDocument();
    expect(flasher()).not.toBeNull();

    rerender(<PatternPanel content={content} isActive={false} />);
    expect(screen.getByRole('textbox', { name: 'Code' })).toBeInTheDocument();
    expect(flasher()).not.toBeNull();
  });

  // The height lives in CSS (.editorBox), where the phone rule can shrink it
  // to fit under the pinned 3D preview. A pixel height on the editor itself
  // would win over that rule.
  it('fills one box with the editor, the same box before and after the tab first opens', () => {
    const { container, rerender } = render(<PatternPanel content={content} isActive={false} />);
    const box = container.querySelector('.editorBox');
    expect(box).toBeEmptyDOMElement();

    rerender(<PatternPanel content={content} isActive />);
    const editor = screen.getByRole('textbox', { name: 'Code' });
    expect(editor.parentElement).toBe(box);
    expect(editor).toHaveAttribute('data-height', '100%');
  });

  it('copies a creation prompt with the code in the editor and the step one detent moves Knob 2', () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    vi.stubGlobal('alert', vi.fn());
    try {
      render(<PatternPanel content={content} isActive />);
      act(() => useAppStore.getState().setCustomJsCode('export function draw(display) {}'));
      screen.getByRole('button', { name: 'Copy creation prompt' }).click();

      const prompt = writeText.mock.calls[0]?.[0] as string;
      expect(prompt).toContain('- Knob 2: 0.1 to 10.0, clamps at edges, step 0.206 per detent.');
      expect(prompt).toContain('```javascript\nexport function draw(display) {}\n```');
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  // The build server bakes a .pfm on its own machine; nothing compiles in the
  // browser. Firmware is a PlatformIO build, which the firmware README puts
  // first.
  it('says where the build server compiles, and sends firmware builds to PlatformIO', () => {
    render(<PatternPanel content={content} isActive />);
    const link = screen.getByRole('link', { name: 'PlatformIO' });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/engmung/Patternflow/blob/main/firmware/README.md#build-with-platformio-recommended',
    );
    const note = link.closest('p');
    expect(note).toHaveTextContent('compiles your pattern into a module on its own machine');
    expect(note).not.toHaveTextContent('in the browser');
  });

  it('points the hero preview at Origin while the tab is still closed', () => {
    useAppStore.getState().setActivePatternId('patternFlowOriginal');
    useAppStore.getState().setCustomJsCode('');
    render(<PatternPanel content={content} isActive={false} />);
    expect(useAppStore.getState().activePatternId).toBe('custom');
    expect(useAppStore.getState().customJsCode).toBe(showcasePresets.find((p) => p.id === 'origin')?.code);
  });
});
