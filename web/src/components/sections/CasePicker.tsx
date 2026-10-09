'use client';

import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import PhotoLightbox from './InsideGlobe/PhotoLightbox';
import type { BuildCase, CaseId } from './build-cases-data';
import styles from './CasePicker.module.css';

interface CasePickerProps {
  cases: BuildCase[];
  selected: BuildCase;
  onSelect: (id: CaseId, interaction: 'click' | 'key') => void;
  onLinkOpen?: (caseId: CaseId, target: string) => void;
  /** The body of content/build.md, shown above the switch. */
  lead?: string;
}

// Two photos on the card; the viewer has all of them. Two is what fits a phone
// at a height you can still read, and it keeps one of each where a case has
// both: a build, and a render or a view from behind.
const STRIP = 2;

// The case, three ways. A tablist rather than a row of toggles: the switch
// replaces the whole card below it, and arrow keys move along the three the
// way they do in any other tab set.
export default function CasePicker({ cases, selected, onSelect, onLinkOpen, lead }: CasePickerProps) {
  const [viewer, setViewer] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, cases.findIndex((item) => item.id === selected.id));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = cases.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    onSelect(cases[next].id, 'key');
    tabRefs.current[next]?.focus();
  };

  const photos = selected.photos.slice(0, STRIP);
  const panelId = 'build-case-panel';

  return (
    <div className={`pf-block ${styles.picker}`}>
      <span className="pf-kicker">The case — three ways to make it</span>
      {lead && lead.trim().length > 0 && (
        <div className={`pf-prose ${styles.lead}`}>
          <ReactMarkdown>{lead}</ReactMarkdown>
        </div>
      )}

      <div className={styles.tabs} role="tablist" aria-label="Case" onKeyDown={handleKeyDown}>
        {cases.map((item, tabIndex) => {
          const isSelected = item.id === selected.id;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabRefs.current[tabIndex] = node;
              }}
              type="button"
              role="tab"
              id={`build-case-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={panelId}
              tabIndex={isSelected ? 0 : -1}
              className={styles.tab}
              onClick={() => {
                if (!isSelected) onSelect(item.id, 'click');
              }}
            >
              <span className={styles.tabName}>{item.tab}</span>
              <span className={styles.tabMethod}>{item.method}</span>
            </button>
          );
        })}
      </div>

      <div
        className={styles.card}
        role="tabpanel"
        id={panelId}
        aria-labelledby={`build-case-tab-${selected.id}`}
      >
        {/* Each photo grows by its own width-to-height ratio from a zero
            basis, so a portrait and a landscape shot end up the same height
            and fill the row together, whatever the card's width. */}
        <div className={styles.photos}>
          {photos.map((photo, photoIndex) => (
            <button
              key={photo.src}
              type="button"
              className={styles.photo}
              style={{
                flexGrow: photo.width / photo.height,
                aspectRatio: `${photo.width} / ${photo.height}`,
              }}
              onClick={() => setViewer(photoIndex)}
            >
              <Image src={photo.src} alt={photo.alt} fill sizes="(max-width: 900px) 70vw, 30vw" />
            </button>
          ))}
        </div>
        <div className={styles.photoMeta}>
          <span>{selected.credit}</span>
          {selected.photos.length > photos.length && (
            <button type="button" onClick={() => setViewer(0)}>
              All {selected.photos.length} photos
            </button>
          )}
        </div>

        <div className={styles.body}>
          <div className={styles.head}>
            <h3 className={styles.name}>{selected.name}</h3>
            <span className={styles.kind}>{selected.kind === 'official' ? 'Official' : 'Community remix'}</span>
          </div>
          <p className={styles.summary}>{selected.summary}</p>

          <dl className={styles.facts}>
            <div>
              <dt>By</dt>
              <dd>
                {selected.author.href ? (
                  <a href={selected.author.href} target="_blank" rel="noreferrer">
                    {selected.author.name}
                  </a>
                ) : (
                  selected.author.name
                )}
                {selected.author.note && <span className={styles.note}>, {selected.author.note}</span>}
              </dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>{selected.material}</dd>
            </div>
            <div>
              <dt>Fits</dt>
              <dd>{selected.fits}</dd>
            </div>
            <div>
              <dt>Make</dt>
              <dd>{selected.make}</dd>
            </div>
            <div>
              <dt>Also needs</dt>
              <dd>{selected.parts}</dd>
            </div>
            <div>
              <dt>Verified</dt>
              <dd>{selected.verified}</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>{selected.license}</dd>
            </div>
          </dl>

          {selected.caution && (
            <p className={styles.caution}>
              <strong>Check your panel first</strong>
              {selected.caution}
            </p>
          )}

          <p className={styles.guide}>
            {selected.guide}
            {selected.kind === 'remix' && ' The 3D model on this page is the official case.'}
          </p>
        </div>

        <div className={styles.links}>
          {selected.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => onLinkOpen?.(selected.id, link.target)}
            >
              <strong>{link.label}</strong>
              <span>{link.target} ↗</span>
            </a>
          ))}
        </div>
      </div>

      {viewer !== null && (
        <PhotoLightbox
          images={selected.photos.map(({ src, alt }) => ({ src, alt }))}
          index={viewer}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
