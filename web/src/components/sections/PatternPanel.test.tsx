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

vi.mock('@monaco-editor/react', () => ({ default: () => <textarea aria-label="Code" /> }));
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

  it('points the hero preview at Origin while the tab is still closed', () => {
    useAppStore.getState().setActivePatternId('patternFlowOriginal');
    useAppStore.getState().setCustomJsCode('');
    render(<PatternPanel content={content} isActive={false} />);
    expect(useAppStore.getState().activePatternId).toBe('custom');
    expect(useAppStore.getState().customJsCode).toBe(showcasePresets.find((p) => p.id === 'origin')?.code);
  });
});
