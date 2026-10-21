import { useEffect, useState } from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { SectionContent } from '@/lib/content';
import Script from 'next/script';
import { useAppStore } from '@/store/useAppStore';
import Editor from '@monaco-editor/react';
import { showcasePresets } from '@/lib/presets';
import { captureEvent } from '@/lib/posthogEvents';
import { communityHref } from '@/lib/community/apiBase';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import styles from './PatternPanel.module.css';
import { getVariantPrompt } from './variantPrompt';

type EspWebInstallButtonProps = {
  children: React.ReactNode;
  manifest: string;
};

const EspWebInstallButton = 'esp-web-install-button' as unknown as React.ElementType<EspWebInstallButtonProps>;

interface PatternPanelProps {
  content: SectionContent;
  isActive: boolean;
}

const EDITOR_LINE_HEIGHT = 20;

// Phones show a sliding window of preset numbers around the active one instead
// of the whole library — all 42 would wrap into a wall of rows. Keep in sync
// with the `.presetNumbers` column count in the 720px media query.
const MOBILE_PRESET_WINDOW = 7;

// Patterns in the Basics pack, which a freshly flashed board installs in one
// click from the community's decks shelf. Keep in sync with
// web/public/packs/basics.json.
//
// This used to be the count of presets baked into the image, and said 34 long
// after the firmware kept only Origin — which read as a promise the flash did
// not deliver, and got filed as a bug. The image ships one pattern on purpose
// now; the rest arrive as modules.
const NUM_BASICS_PATTERNS = 33;

export default function PatternPanel({ content, isActive }: PatternPanelProps) {
  // Start with Origin selected; the effect below loads it into the editor.
  const [activePresetId, setActivePresetId] = useState<string | null>(() =>
    showcasePresets.some((p) => p.id === 'origin') ? 'origin' : null,
  );
  const customJsCode = useAppStore(state => state.customJsCode);
  const setCustomJsCode = useAppStore(state => state.setCustomJsCode);
  const customJsError = useAppStore(state => state.customJsError);

  // The Live Editor renders through the 'custom' pattern, so the 3D preview
  // reflects the editor (and loaded presets). Load Origin into the editor
  // (zustand store) once on mount.
  useEffect(() => {
    useAppStore.getState().setActivePatternId('custom');
    const origin = showcasePresets.find((p) => p.id === 'origin');
    if (origin) {
      setCustomJsCode(origin.code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The panel is mounted on /, /build and /inside too, folded away, so the
  // effect above can point the hero preview at Origin. The editor and the
  // flasher are not: Monaco comes from jsdelivr, 4.2 MB once its loader is
  // in, and the flasher from unpkg. Both wait for the first time the tab
  // opens. After that they stay, so going back to the tab finds the editor
  // as it was left, undo history included. Latched while rendering, so the
  // editor is there in the render that opens the tab.
  const [opened, setOpened] = useState(isActive);
  if (isActive && !opened) {
    setOpened(true);
  }

  const handleLoadPreset = (presetId: string) => {
    const preset = showcasePresets.find((p) => p.id === presetId);
    if (!preset) return;
    setCustomJsCode(preset.code);
    setActivePresetId(preset.id);
    // Make sure the 3D preview is showing the editor output, not a flash preset.
    useAppStore.getState().setActivePatternId('custom');
    captureEvent('live_preset_loaded', {
      preset_id: preset.id,
      preset_name: preset.name,
      surface: 'live_editor',
    });
  };

  const activePresetIndex = showcasePresets.findIndex((p) => p.id === activePresetId);

  // Which numbered cells to render: everything on desktop, a window centred on
  // the active preset (clamped at both ends) on phones. Tapping near the edge
  // of the window re-centres it, so the whole library stays reachable.
  const isNarrow = useMediaQuery('(max-width: 720px)');
  const windowStart = isNarrow
    ? Math.max(
        0,
        Math.min(
          (activePresetIndex >= 0 ? activePresetIndex : 0) - Math.floor(MOBILE_PRESET_WINDOW / 2),
          showcasePresets.length - MOBILE_PRESET_WINDOW,
        ),
      )
    : 0;
  const visiblePresets = isNarrow
    ? showcasePresets.slice(windowStart, windowStart + MOBILE_PRESET_WINDOW)
    : showcasePresets;

  const handleStepPreset = (dir: number) => {
    if (showcasePresets.length === 0) return;
    const base = activePresetIndex >= 0 ? activePresetIndex : dir > 0 ? -1 : 0;
    const next = (base + dir + showcasePresets.length) % showcasePresets.length;
    handleLoadPreset(showcasePresets[next].id);
  };

  const handleRandomPreset = () => {
    if (showcasePresets.length === 0) return;
    let nextPreset = showcasePresets[Math.floor(Math.random() * showcasePresets.length)];
    if (activePresetId && showcasePresets.length > 1) {
      while (nextPreset.id === activePresetId) {
        nextPreset = showcasePresets[Math.floor(Math.random() * showcasePresets.length)];
      }
    }
    handleLoadPreset(nextPreset.id);
  };

  // The 42-cell number wall is folded away by default — it was the loudest
  // thing in the panel and said nothing about which preset you were on.
  const [showAllPresets, setShowAllPresets] = useState(false);
  const activePreset = activePresetIndex >= 0 ? showcasePresets[activePresetIndex] : null;

  const handleCopyVariantPrompt = () => {
    navigator.clipboard.writeText(getVariantPrompt(customJsCode));
    captureEvent('copy_variants_prompt_clicked', {
      surface: 'live_editor',
    });
    alert('Creation prompt copied to clipboard! Paste it in ChatGPT/Claude to get 5 pattern variations.');
  };

  return (
    <div className="panel-content pf-section-panel" id="pattern">
      <div className="panel-header">
        <h2 className="pf-h2">{content.title}</h2>
        <p className="pf-sub">{content.subtitle}</p>
      </div>
      <div className="panel-body">
        {content.meta && content.meta.length > 0 && (
          <div className={`pf-block ${styles.metaRows}`}>
            <span className="pf-kicker">Details</span>
            {content.meta.map((item, idx) => (
              <div key={idx} className="pf-row">
                <span className="pf-ghost">{String(idx + 1).padStart(2, '0')}</span>
                <div className="pf-row-t">{item.value}</div>
                <div className="pf-row-d">{item.label}</div>
              </div>
            ))}
          </div>
        )}
        
        {content.content.trim().length > 0 && (
          <div className={`prose ${styles.introCopy}`}>
            <ReactMarkdown>{content.content}</ReactMarkdown>
          </div>
        )}

        {opened && (
          <Script
            type="module"
            src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"
            strategy="lazyOnload"
          />
        )}

        <div className={styles.workspace}>
          {/* No tab bar: two of its three cells navigated to other pages, so it
              promised tabs and delivered links. The editor is this panel, and
              the way out is one block below it. */}
          <div className={styles.liveEditor}>
              {/* Which preset you are on, by name — the numbered wall said
                  nothing about that and is folded behind "All 42" now. */}
              <div className={styles.presetBar} aria-label="Live editor presets">
                <button type="button" onClick={() => handleStepPreset(-1)} aria-label="Previous preset">
                  ‹
                </button>
                <div className={styles.presetNow}>
                  <span className={styles.presetIndex}>
                    {String(activePresetIndex >= 0 ? activePresetIndex + 1 : 0).padStart(2, '0')}
                    {/* Dropped on phones, where "All 42" sits right under it. */}
                    <span className={styles.presetTotal}> / {showcasePresets.length}</span>
                  </span>
                  <span className={styles.presetName}>{activePreset?.name ?? 'Custom'}</span>
                  {/* The one accent in this panel: it means "this is what the
                      preview is running right now", not decoration. */}
                  <span className={styles.presetLive}>on the device</span>
                </div>
                <button type="button" onClick={() => handleStepPreset(1)} aria-label="Next preset">
                  ›
                </button>
                <button type="button" onClick={handleRandomPreset} aria-label="Random preset" title="Random preset">
                  Random
                </button>
                <button
                  type="button"
                  aria-expanded={showAllPresets}
                  onClick={() => setShowAllPresets((open) => !open)}
                >
                  All {showcasePresets.length}
                </button>
              </div>
              {showAllPresets && (
                <div className={styles.presetNumbers} role="group" aria-label="Jump to preset">
                  {visiblePresets.map((preset, i) => {
                    const idx = windowStart + i;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={idx === activePresetIndex ? styles.presetNumActive : undefined}
                        title={preset.name}
                        aria-label={`Preset ${idx + 1}: ${preset.name}`}
                        aria-current={idx === activePresetIndex ? 'true' : undefined}
                        onClick={() => handleLoadPreset(preset.id)}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              )}
              {/* The box holds the editor's height, before Monaco loads and
                  after, so the page does not jump when the tab first opens.
                  The CSS shrinks it on phones (.editorBox). */}
              <div className={styles.editorBox}>
                {opened && (
                  <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    theme="vs-dark"
                    value={customJsCode}
                    onChange={(val) => {
                      const next = val || '';
                      setCustomJsCode(next);
                      // Deselect the chip once the code is edited away from the preset.
                      if (activePresetId) {
                        const preset = showcasePresets.find((p) => p.id === activePresetId);
                        if (!preset || preset.code !== next) setActivePresetId(null);
                      }
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineHeight: EDITOR_LINE_HEIGHT,
                      scrollBeyondLastLine: false,
                      scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        handleMouseWheel: true,
                      },
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      automaticLayout: true,
                    }}
                  />
                )}
              </div>
              {/* Why the code above is not what the preview shows. Pasted code
                  that threw used to reach the browser console and nothing
                  else. The region stays mounted so a reader hears it change. */}
              <div role="status">
                {customJsError && <pre className={styles.editorError}>{customJsError}</pre>}
              </div>
              {/* The four numbered steps collapsed to this: what the editor is
                  for, and the one button that belongs next to it. Everything
                  about hardware moved to its own block below. */}
              <div className={styles.editorFoot}>
                <span>
                  Paste AI-generated code here, or edit the preset. The preview updates as
                  you type.
                </span>
                <button type="button" onClick={handleCopyVariantPrompt}>
                  Copy creation prompt
                </button>
              </div>
          </div>

          {/* Two branches, one row: where the pattern goes, and what to do if
              you already own a board. Previously the exits were scattered
              across the tab bar, these cards, and a trailing paragraph. */}
          <div className={styles.branches}>
            <div className={styles.nextSteps} aria-label="Next steps">
              <span className="pf-kicker">Where it goes next</span>
              <Link href="/pattern-lab" className={styles.nextCard}>
                <span className={styles.nextKicker}>01</span>
                <h3>Pattern Lab ↗</h3>
                <p>The full studio — batch generation, color ramps, and ESP32 C++ compile.</p>
              </Link>
              <Link href={communityHref()} className={styles.nextCard}>
                <span className={styles.nextKicker}>02</span>
                <h3>Community ↗</h3>
                <p>Share what you make, fork what everyone else made.</p>
              </Link>
              {/* The build server makes a .pfm on its own machine
                  (lib/community/server/buildJobs.ts) and the board's Patterns
                  page installs it. Firmware still has to be built for a new
                  feature or a panel other than the stock one (PANEL_GEOMETRY
                  and PANEL_PROFILE in firmware/patternflow/config.h), and the
                  firmware README puts PlatformIO before the Arduino IDE. */}
              <p className={styles.advancedNote}>
                The build server compiles your pattern into a module on its own machine, and
                your board installs it over Wi-Fi. You build the firmware yourself, with{' '}
                <a
                  href="https://github.com/engmung/Patternflow/blob/main/firmware/README.md#build-with-platformio-recommended"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PlatformIO
                </a>
                , only for a new firmware feature or a panel other than the stock 128×64.
              </p>
            </div>

            <div className={styles.hardwareBlock}>
              <span className="pf-kicker">Got the hardware?</span>
              <strong className={styles.hardwareTitle}>Do this once</strong>
              <EspWebInstallButton manifest="/flash/manifest.json">
                <button
                  slot="activate"
                  type="button"
                  className={styles.flashButton}
                  onClick={() => captureEvent('flash_patternflow_clicked', {
                    manifest: '/flash/manifest.json',
                    surface: 'pattern_panel',
                  })}
                >
                  Flash Patternflow
                </button>
                <div slot="unsupported" className={styles.unsupported}>
                  Browser flashing works in desktop Chrome or Edge.
                </div>
              </EspWebInstallButton>
              {/* Kept short. A first install goes wrong in three places: the
                  port, the order (download mode before the button, every first
                  flash) and the Wi-Fi step, which usually doesn't appear after
                  a download-mode install. A note under a button can name the
                  moves, in order, but is the wrong place to walk through them —
                  the guide holds that, and the link is how you get there. "A
                  first flash" because download mode erases everything,
                  patterns and saved Wi-Fi too: a board already running
                  Patternflow updates over Wi-Fi from its console's Update page
                  instead. */}
              <p className={styles.hardwareNote}>
                For a first flash, before you press it: the ESP32-S3 out of the board, a data cable
                in its <b>left</b> USB-C port. Hold <b>BOOT</b>, tap <b>RST</b>, let go of BOOT,
                then press Flash Patternflow. You get Origin, and{' '}
                <a href="https://community.patternflow.work/community/decks">the Basics pack</a>{' '}
                adds {NUM_BASICS_PATTERNS} more in one click.
              </p>
              <p className={styles.hardwareNote}>
                The Wi-Fi step usually doesn&rsquo;t appear after the install, and that&rsquo;s
                expected: press <b>RST</b>, press Flash Patternflow again, pick the port and choose
                Connect to Wi-Fi. <Link href="/guide/play#flash">The guide</Link> shows every screen
                on a board you can turn (
                <a
                  href="https://github.com/engmung/Patternflow/blob/main/BUILD_GUIDE.md#8-firmware"
                  target="_blank"
                  rel="noreferrer"
                >
                  written version ↗
                </a>
                ).
              </p>
              <span className={styles.hardwareReq}>Chrome / Edge only</span>
            </div>
          </div>
        </div>

        {content.cta && (
          <div className="pf-block">
            <span className="pf-kicker">Links</span>
            <div className={styles.ctaLinks}>
            {content.cta.primary && (
              <a href={content.cta.primary.href} className="pf-link">
                {content.cta.primary.label}
              </a>
            )}
            {content.cta.secondary && (
              <a href={content.cta.secondary.href} className="pf-link">
                {content.cta.secondary.label}
              </a>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
