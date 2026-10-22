'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import HeroJournalLink from "@/components/journal/HeroJournalLink";
import { captureEvent } from "@/lib/posthogEvents";
import { CROWD_SUPPLY_URL } from "@/lib/crowdSupply";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

// How many people have made a Patternflow, by the nearest thing to a count
// there is: the community's membership, which tracks it closely. Rounded and
// said as "around", because it is an estimate.
const PEOPLE_WHO_MADE_ONE = 40;

// One play of the video, from the start.
function HeroEmbed({ onEnded }: { onEnded: () => void }) {
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  useEffect(() => {
    // Show the video after 3 seconds (allowing it to initialize and hide controls)
    const showTimer = setTimeout(() => {
      setIsVideoVisible(true);
    }, 3000);

    // Hide the video and return to static image after the video ends (3s delay + 89s video duration = 92s)
    const hideTimer = setTimeout(() => {
      setIsVideoVisible(false);
      onEnded();
    }, 92000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [onEnded]);

  return (
    <iframe
      src="https://www.youtube.com/embed/OXt-yg_7qdk?autoplay=1&mute=1&controls=0&modestbranding=1&disablekb=1&playsinline=1&rel=0"
      title="Patternflow Demo Video"
      frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none',
        opacity: isVideoVisible ? 1 : 0,
        transition: 'opacity 0.6s ease-in-out',
      }}
    />
  );
}

// Mounted only while motion is welcome. Turning reduced motion off again
// mounts a fresh one, which hides for its first three seconds like the first.
// The embed takes no clicks, so the button over it is the one way to stop the
// video before its 89 seconds are up (WCAG 2.2.2). Stop takes the embed away
// and the poster under it stays. Play mounts a fresh embed, which starts from
// the top, and so does Play after the video has ended.
function HeroVideo() {
  const [state, setState] = useState<'playing' | 'ended' | 'stopped'>('playing');
  const [take, setTake] = useState(0);
  const onEnded = useCallback(() => setState('ended'), []);
  const playing = state === 'playing';

  return (
    <>
      {state !== 'stopped' && <HeroEmbed key={take} onEnded={onEnded} />}
      <button
        type="button"
        className="hero-video-toggle"
        aria-label={playing ? 'Stop the video' : 'Play the video'}
        onClick={() => {
          if (playing) {
            setState('stopped');
          } else {
            setTake((n) => n + 1);
            setState('playing');
          }
        }}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
          {playing ? (
            <rect x="1" y="1" width="10" height="10" fill="currentColor" />
          ) : (
            <path d="M2 0.5 11.5 6 2 11.5Z" fill="currentColor" />
          )}
        </svg>
      </button>
    </>
  );
}

export default function Hero() {
  // The embed starts by itself, so someone who has asked their system for less
  // motion gets the poster and no embed at all. The server cannot know, so it
  // sends the poster alone and the client adds the video after hydration.
  const reducedMotion = useReducedMotion();

  return (
    <section className="hero">
      <HeroJournalLink />
      <div className="hero-copy">
        <h1>
          <em className="wordmark">Patternflow</em>
        </h1>
        <div className="kicker">An open-source LED synthesizer. Play light with your fingertips.</div>
        {/* The one thing the page never said: what you actually do with it.
            Sits above the video so it reads before the picture, not after. */}
        <p className="hero-spec">Four knobs. The pattern answers as you turn them.</p>
        <div style={{
          /* 14, not 24: the last few pixels that put the CTA row above the
             fold on an 820px-tall laptop. */
          marginBottom: '14px',
          overflow: 'hidden', 
          border: '1px solid var(--pf-rule)',
          position: 'relative',
          paddingBottom: '56.25%',
          height: 0
        }}>
          {/* Static fallback and loading placeholder. The file is the 4032-wide
              camera original, 2.1 MB, drawn at 340px on a phone and 578px at
              most on a desktop, so it goes through the image optimizer at the
              column's width. The column is the viewport less the deck's 24px
              gutters up to 900px, and the copy's 580px cap above. It is the
              largest thing on the first screen, so it loads at once. */}
          <Image
            src="/product_v2.jpg"
            alt="Patternflow physical device"
            fill
            sizes="(max-width: 900px) calc(100vw - 48px), 580px"
            loading="eager"
            fetchPriority="high"
            style={{ objectFit: 'cover' }}
          />
          {!reducedMotion && <HeroVideo />}
        </div>
        {/* L3 — the strongest line we have, per the manifesto: a description of
            how the system works, with nothing in it to disbelieve. */}
        <p className="lede">Every Patternflow plays every pattern we make.</p>
        {/* The second fact, in the same voice as the first: how many have. */}
        <p className="lede">Around {PEOPLE_WHO_MADE_ONE} people have made one so far.</p>
        {/* Get One leads: it is the action that costs the reader something, so
            it takes the solid weight. The note sits under it — not under both —
            so it is unambiguous which button ships worldwide. */}
        <div className="hero-cta-row" aria-label="Patternflow actions">
          <a
            className="hero-cta hero-cta-primary"
            href={CROWD_SUPPLY_URL}
            target="_blank"
            rel="noopener"
            onClick={() => captureEvent('crowd_supply_clicked', {
              surface: 'hero',
              destination: 'crowd_supply',
              via: 'direct',
            })}
          >
            Get One
          </a>
          <a
            className="hero-cta hero-cta-secondary"
            href="https://github.com/engmung/Patternflow"
            target="_blank"
            rel="noopener"
            onClick={() => captureEvent('github_cta_clicked', {
              surface: 'hero',
              destination: 'github_repository',
            })}
          >
            Build it — GitHub
          </a>
          <p className="hero-cta-note">Crowd Supply · ships worldwide</p>
        </div>
      </div>
    </section>
  );
}
