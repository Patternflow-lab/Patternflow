import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useAppStore } from '@/store/useAppStore';
import type { SectionContent } from '@/lib/content';
import BuildPanel from './BuildPanel';

// The Build panel's case switch: three tabs over one card, the official case
// first; switching changes the card, step 01 and the Start here row, writes
// ?case= while /build is on screen, and a ?case= link opens on that case.

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const capture = vi.fn();
vi.mock('@/lib/posthogEvents', () => ({
  captureEvent: (...args: unknown[]) => capture(...args),
}));

const content: SectionContent = {
  title: 'Build your own.',
  subtitle: 'Around US$100–200 and an hour of hands-on work.',
  content: 'Every case here holds the same v3 board.',
};

const GH = 'https://github.com/engmung/Patternflow';

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  useAppStore.setState({ buildStep: 0, explode: 1 });
  window.history.replaceState(null, '', '/build');
  capture.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const card = () => within(screen.getByRole('tabpanel'));
const tab = (name: RegExp) => screen.getByRole('tab', { name });
const stepOne = () => screen.getAllByRole('button').find((el) => el.textContent?.startsWith('01'));

describe('the case switch', () => {
  it('opens on the official case, with the build.md lead above it', () => {
    render(<BuildPanel content={content} isActive />);
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(tab(/Official/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Besoiobiy/)).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByText('Every case here holds the same v3 board.')).toBeInTheDocument();
    expect(card().getByRole('heading', { name: 'The official printed case' })).toBeInTheDocument();
    expect(card().getByRole('link', { name: /One-click print profiles/ })).toHaveAttribute(
      'href',
      expect.stringContaining('makerworld.com/en/models/3072492'),
    );
    expect(card().queryByText(/The 3D model on this page is the official case/)).not.toBeInTheDocument();
    // Start here keeps the MakerWorld shortcut while the official case is on.
    expect(screen.getByRole('link', { name: /Print the case\s*MakerWorld/ })).toBeInTheDocument();
    expect(stepOne()).toHaveTextContent('Print the body in white PLA and the knobs in black');
  });

  it("shows Besoiobiy's author, material, fit, photos and files at once", () => {
    render(<BuildPanel content={content} isActive />);
    fireEvent.click(tab(/Besoiobiy/));
    expect(tab(/Besoiobiy/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Official/)).toHaveAttribute('tabindex', '-1');
    const panel = card();
    expect(panel.getByRole('heading', { name: 'Besoiobiy’s printed case' })).toBeInTheDocument();
    expect(panel.getByText('Community remix')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: 'Besoiobiy' })).toHaveAttribute('href', 'https://discord.gg/Vr9QtsxeTk');
    expect(panel.getByText(/Bambu Lab P1S/)).toBeInTheDocument();
    expect(panel.getByText(/M3 sockets on Besoiobiy’s hole pattern/)).toBeInTheDocument();
    expect(panel.getByText(/takes M4 screws on a different pattern/)).toBeInTheDocument();
    expect(panel.getByText(/The 3D model on this page is the official case/)).toBeInTheDocument();
    expect(panel.getAllByRole('img')).toHaveLength(2);
    expect(panel.getByRole('link', { name: /README and every file/ })).toHaveAttribute(
      'href',
      `${GH}/tree/main/hardware/case/remixes/besoiobiy-printed`,
    );
    expect(panel.getByRole('link', { name: /print_layout\.3mf/ })).toHaveAttribute(
      'href',
      `${GH}/blob/main/hardware/case/remixes/besoiobiy-printed/print_layout.3mf`,
    );
    for (const link of panel.getAllByRole('link')) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
    }
    // Step 01 and the Start here row follow the switch.
    expect(stepOne()).toHaveTextContent('Print eight parts and four knob caps');
    expect(screen.getByRole('link', { name: /Print the case\s*besoiobiy-printed\// })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /MakerWorld/ })).not.toBeInTheDocument();
    expect(capture).toHaveBeenCalledWith('build_case_selected', {
      case_id: 'besoiobiy-printed',
      interaction: 'click',
      surface: 'build_panel',
    });
  });

  it('moves along the tabs with the arrow keys, Home and End', () => {
    render(<BuildPanel content={content} isActive />);
    const official = tab(/Official/);
    official.focus();
    fireEvent.keyDown(official, { key: 'ArrowRight' });
    expect(tab(/Besoiobiy/)).toHaveAttribute('aria-selected', 'true');
    expect(tab(/Besoiobiy/)).toHaveFocus();
    fireEvent.keyDown(tab(/Besoiobiy/), { key: 'End' });
    expect(tab(/SimonePDA/)).toHaveAttribute('aria-selected', 'true');
    expect(card().getByRole('heading', { name: 'Simone Majocchi’s laser-cut case' })).toBeInTheDocument();
    expect(card().getByRole('link', { name: 'Simone Majocchi' })).toHaveAttribute('href', 'https://github.com/SimonePDA');
    expect(card().getByText(/2\.8 mm MDF, laser cut/)).toBeInTheDocument();
    expect(card().getByRole('link', { name: /lasercut_layout\.pdf/ })).toHaveAttribute(
      'href',
      `${GH}/blob/main/hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf`,
    );
    expect(stepOne()).toHaveTextContent('Cut the case');
    fireEvent.keyDown(tab(/SimonePDA/), { key: 'ArrowRight' });
    expect(tab(/Official/)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab(/Official/), { key: 'ArrowLeft' });
    expect(tab(/SimonePDA/)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab(/SimonePDA/), { key: 'Home' });
    expect(tab(/Official/)).toHaveAttribute('aria-selected', 'true');
    expect(capture).toHaveBeenCalledWith('build_case_selected', expect.objectContaining({ interaction: 'key' }));
  });

  it('writes ?case= while /build is on screen, and drops it for the official case', () => {
    render(<BuildPanel content={content} isActive />);
    fireEvent.click(tab(/SimonePDA/));
    expect(window.location.pathname + window.location.search).toBe('/build?case=simonepda-lasercut');
    fireEvent.click(tab(/Official/));
    expect(window.location.pathname + window.location.search).toBe('/build');
  });

  it('leaves the URL alone when the panel is mounted behind another tab', () => {
    window.history.replaceState(null, '', '/pattern');
    render(<BuildPanel content={content} isActive={false} />);
    fireEvent.click(tab(/Besoiobiy/));
    expect(window.location.pathname + window.location.search).toBe('/pattern');
  });

  it('opens on the case a /build?case= link names, and ignores one it does not know', () => {
    window.history.replaceState(null, '', '/build?case=besoiobiy-printed');
    const { unmount } = render(<BuildPanel content={content} isActive />);
    expect(tab(/Besoiobiy/)).toHaveAttribute('aria-selected', 'true');
    unmount();
    window.history.replaceState(null, '', '/build?case=steel');
    render(<BuildPanel content={content} isActive />);
    expect(tab(/Official/)).toHaveAttribute('aria-selected', 'true');
  });

  it('opens every photo of the case in the viewer', () => {
    render(<BuildPanel content={content} isActive />);
    fireEvent.click(tab(/SimonePDA/));
    fireEvent.click(card().getByRole('button', { name: 'All 4 photos' }));
    const dialog = screen.getByRole('dialog', { name: 'Build photos' });
    expect(within(dialog).getAllByRole('button', { name: /MDF|acrylic|board/ }).length).toBeGreaterThanOrEqual(4);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close gallery' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the rest of the panel', () => {
  it('keeps the hover preview and points at the current routes', () => {
    render(<BuildPanel content={content} isActive />);
    fireEvent.click(screen.getByRole('button', { name: /Print the case/ }));
    expect(useAppStore.getState().buildStep).toBe(1);
    expect(screen.getByText('~10 hr')).toBeInTheDocument();
    expect(screen.queryByText(/~10–12 hr/)).not.toBeInTheDocument();
    expect(screen.getByText(/ESP32-S3 ~\$13/)).toBeInTheDocument();
    expect(screen.getByText(/Hand-solder the v3\.9 board/)).toBeInTheDocument();
    expect(screen.getByText(/power up through the screw terminal/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Before you buy the panel/ })).toHaveAttribute(
      'href',
      `${GH}/blob/main/docs/panel-compatibility.md`,
    );
    expect(screen.getByRole('link', { name: 'Breadboard guide' })).toHaveAttribute('href', '/build/breadboard');
    expect(screen.getByRole('link', { name: 'v2 board guide' })).toHaveAttribute('href', `${GH}/blob/main/BUILD_GUIDE_v2.md`);
    expect(screen.queryByText(/laser-cut, or an older/)).not.toBeInTheDocument();
  });
});
