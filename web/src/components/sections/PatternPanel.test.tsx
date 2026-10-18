import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { SectionContent } from '@/lib/content';
import { useAppStore } from '@/store/useAppStore';
import PatternPanel from './PatternPanel';

// The Live Editor on /pattern. The preview reports why pasted code is not
// running (components/3d/LedMatrixTexture.ts); the panel shows it under the
// editor.

vi.mock('@monaco-editor/react', () => ({ default: () => <textarea aria-label="Code" /> }));
vi.mock('next/script', () => ({ default: () => null }));
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
    render(<PatternPanel content={content} />);
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    act(() => useAppStore.getState().setCustomJsError('missing is not defined\nline 6: const v = missing * 2;'));
    expect(status).toHaveTextContent('missing is not defined line 6: const v = missing * 2;');

    act(() => useAppStore.getState().setCustomJsError(null));
    expect(status).toBeEmptyDOMElement();
  });
});
