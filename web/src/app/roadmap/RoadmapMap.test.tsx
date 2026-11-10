import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RoadmapMap from './RoadmapMap';
import { NODES } from './roadmap-data';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ json: async () => ({ issues: [] }) })),
  );
});

function mount() {
  const { container } = render(<RoadmapMap />);
  // Let the /api/roadmap answer land before the test looks around.
  return waitFor(() => expect(fetch).toHaveBeenCalled()).then(() => container.firstElementChild as HTMLElement);
}

describe('Project map language', () => {
  it('opens in Korean and says so, under an English document', async () => {
    const map = await mount();
    expect(map).toHaveAttribute('lang', 'ko');
    expect(screen.getByRole('heading', { name: 'Project map' })).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('link', { name: '← Patternflow' })).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('group', { name: '언어' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Patternflow 프로젝트 지도/ })).toBeInTheDocument();
  });

  it('names each language in its own language', async () => {
    await mount();
    expect(screen.getByRole('button', { name: '한글' })).toHaveAttribute('lang', 'ko');
    expect(screen.getByRole('button', { name: 'ENG' })).toHaveAttribute('lang', 'en');
  });

  it('switches the map to English and marks the pressed button', async () => {
    const map = await mount();
    const ko = screen.getByRole('button', { name: '한글' });
    const en = screen.getByRole('button', { name: 'ENG' });
    expect(ko).toHaveAttribute('aria-pressed', 'true');
    expect(en).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(en);
    expect(map).toHaveAttribute('lang', 'en');
    expect(ko).toHaveAttribute('aria-pressed', 'false');
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Patternflow project map/ })).toBeInTheDocument();
  });
});

describe('Project map detail level', () => {
  it('marks the overview pressed and shows the level-2 nodes once detailed is pressed', async () => {
    await mount();
    const overview = screen.getByRole('button', { name: '개요' });
    const detailed = screen.getByRole('button', { name: '상세보기' });
    const nodeCount = () =>
      screen.getAllByRole('button').filter((el) => el.tagName.toLowerCase() === 'g').length;

    expect(overview).toHaveAttribute('aria-pressed', 'true');
    expect(detailed).toHaveAttribute('aria-pressed', 'false');
    expect(nodeCount()).toBe(NODES.filter((n) => n.level === 1).length);

    fireEvent.click(detailed);
    expect(overview).toHaveAttribute('aria-pressed', 'false');
    expect(detailed).toHaveAttribute('aria-pressed', 'true');
    expect(nodeCount()).toBe(NODES.length);
  });
});

describe('Project map nodes in Korean', () => {
  it('reads each node state in Korean and closes the popup with 닫기', async () => {
    await mount();
    const done = NODES.find((n) => n.level === 1 && n.status === 'done' && n.titleKo);
    const planned = NODES.find((n) => n.level === 1 && n.status === 'planned' && n.titleKo);
    expect(done && planned).toBeTruthy();
    expect(screen.getByRole('button', { name: `${done!.titleKo}, 완료` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `${planned!.titleKo}, 계획` })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: `${done!.titleKo}, 완료` }));
    expect(screen.getByRole('heading', { name: done!.titleKo })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('heading', { name: done!.titleKo })).not.toBeInTheDocument();
  });
});
