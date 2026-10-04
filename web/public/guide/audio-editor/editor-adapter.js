// Patternflow Audio — editor adapter, extension flavor.
//
// The editor module (editor.js) knows nothing about Chrome, the panel, or
// where audio comes from: it talks to exactly window.PFAdapter. The panel's
// /audio-in page is the same editor over another adapter
// (firmware/patternflow/console/_audio_in_adapter.js, which speaks
// fetch('/api/audio-in')). That boundary is the whole architecture; do not
// let editor.js grow a chrome.* call. The contract both adapters keep is
// written at the top of editor.js.
//
// This file is also the extension's SOURCE BAR: the <header> in editor.html
// (what is feeding the editor, where it is going, Stop). The editor never
// looks in there; every state that arrives is drawn here first and then
// handed on.
//
// Without chrome.* (opened as a plain file, or from a static server) it runs
// a demo: a synthesized music-ish spectrum mapped by the same model, the
// mapping kept in memory. That is a preview of the editor, not of the
// product: nothing persists and nothing is captured.

(function () {
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.runtime;
  const $ = (id) => document.getElementById(id);

  // What this source is: tab audio through an AnalyserNode. The numbers are
  // the model's (PFMap.SOURCE), the two edge rules are its minimum window, and
  // a band is never narrower than the 10 Hz the model keeps on load.
  const CAPS = {
    hzMin: PFMap.SOURCE.hzMin,
    hzMax: PFMap.SOURCE.hzMax,
    db: PFMap.SOURCE.db,
    levelMax: 1,
    hzGap: 10,
    top: (lo) => lo + PFMap.MIN_WINDOW,
    bottom: (hi) => hi - PFMap.MIN_WINDOW
  };

  // ── the source bar ────────────────────────────────────────────────────
  //
  // The chip is the capture's own phase (offscreen.js phase()), in the same
  // word the popup prints for it, so the two cannot disagree about whether
  // the panel is being driven: a socket that is open to a panel whose
  // Audio-React switch is off is not "live". Beside it, one sentence when
  // there is something to do or something wrong:
  //   error       the capture's own sentence, and both it and the chip in red
  //   aud off     what is off and where its switch is (Turn on is the popup's)
  //   idle        why the last capture ended, if it ended by itself (the tab
  //               was closed), then how to start one
  //   otherwise   nothing: a capture or the popup's test connection is up,
  //               and "start a capture" is not what to say beside it
  const WORDS = { connecting: 'connecting', off: 'aud off', live: 'live', test: 'test', error: 'error' };

  function drawBar(state, idleHint) {
    const chip = $('sourceChip');
    const hint = $('captureHint');
    const bad = state.phase === 'error';
    chip.textContent = state.demo ? 'demo source' : WORDS[state.phase] || 'idle';
    chip.className = state.phase === 'live' ? 'chip okChip' : bad ? 'chip badChip' : 'chip';
    // Where the capture is being sent, as the socket has it. Nothing is
    // connected: no chip, rather than an address nothing is using.
    $('hostChip').textContent = state.host || '';
    $('hostChip').hidden = !state.host;
    hint.textContent = state.demo ? ''
      : state.phase === 'off' ? 'Connected, but Audio-React is off on the panel. Turn it on in the extension popup.'
      : state.error || (state.running || state.manual ? '' : (state.note ? state.note + ' ' : '') + idleHint);
    hint.classList.toggle('badText', bad);
    $('stopBtn').disabled = !state.running || !!state.demo;
  }

  // An envelope that is at its minimum span has learned nothing: the band has
  // been silent, or has sat at one level, for as long as an envelope
  // remembers. The editor is told there is none (see `env` in its contract),
  // so it draws the band's own window, and a drag that takes the four windows
  // over by hand leaves that one as it was. Seeded from such an envelope it
  // became a 4 dB sliver at the floor, and the first sound pegged that knob at
  // its top. (A band that has heard a single click does have an envelope, and
  // is seeded from it: this guards silence, not thinness.)
  const learned = (env) => (env || []).map((e) =>
    e && e.hi - e.lo > PFMap.ENV_MIN_SPAN + 1e-6 ? e : null);

  if (hasChrome) {
    const HINT = 'Start capture from the extension popup, on the tab that is playing.';
    let frameFn = null;

    const take = (state) => {
      state = state || {};
      drawBar(state, HINT);
      if (frameFn) frameFn({ ...state, env: learned(state.env) });
    };
    const ask = () => chrome.runtime.sendMessage({ type: 'status' }, (response) => {
      void chrome.runtime.lastError;
      if (response && response.state) take(response.state);
    });

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'state') take(message.state);
    });
    $('stopBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'stop' }, () => void chrome.runtime.lastError);
    });

    window.PFAdapter = {
      caps() {
        return CAPS;
      },
      loadConfig() {
        return new Promise((resolve) =>
          chrome.storage.local.get(PFMap.CONFIG_KEY, (stored) =>
            resolve(stored[PFMap.CONFIG_KEY] || null)));
      },
      // Stored, then told to the capture: that message is how a running
      // capture gets the edit (nothing listens to storage).
      saveConfig(config) {
        return new Promise((resolve) =>
          chrome.storage.local.set({ [PFMap.CONFIG_KEY]: config }, () => {
            chrome.runtime.sendMessage({ type: 'config', config }, () => {
              void chrome.runtime.lastError;  // background may be asleep; storage holds
              resolve();
            });
          }));
      },
      resetBand(index, config) {
        config.bands[index] = PFMap.defaultBand(index, CAPS);
        return this.saveConfig(config).then(() => config);
      },
      // The editor is up: one state now, without waiting for the next push.
      onFrame(fn) {
        frameFn = fn;
        ask();
      }
    };
    ask();
    return;
  }

  // ── demo adapter ──────────────────────────────────────────────────────
  const HINT = 'Demo mode — open this page from the extension for live audio.';
  let demoConfig = PFMap.normalizeConfig(null, CAPS);
  let frameFn = null;
  let t = 0;

  function demoSpectrum() {
    t += 0.08;
    const values = [];
    for (let i = 0; i < 64; i++) {
      const frac = i / 63;
      const hz = 20 * Math.pow(1000, frac);
      const lg = Math.log10(hz);
      let v = 0.05;
      const beat = 0.5 + 0.5 * Math.max(0, Math.sin(t * 2.2));
      v += (0.45 + 0.35 * beat) * Math.exp(-Math.pow(lg - Math.log10(70), 2) / 0.05);
      v += 0.32 * (0.7 + 0.3 * Math.sin(t * 1.1 + 1)) * Math.exp(-Math.pow(lg - Math.log10(900), 2) / 0.16);
      v += 0.2 * (0.6 + 0.4 * Math.sin(t * 3.1 + 2)) * Math.exp(-Math.pow(lg - Math.log10(3500), 2) / 0.06);
      v += 0.16 * Math.max(0, Math.sin(t * 4.4)) * Math.exp(-Math.pow(lg - Math.log10(9500), 2) / 0.035);
      if (hz > 12000) v *= Math.max(0.25, 1 - (hz - 12000) / 16000);
      v += (Math.sin(i * 7.3 + t * 5) * 0.02);
      values.push(Math.max(0.02, Math.min(0.95, v)));
    }
    return values;
  }

  // The same envelope and the same level-to-knob chain the capture runs
  // (offscreen.js), so the demo's cursor and readout are the model's too.
  const envelopes = [0, 1, 2, 3].map(() => PFMap.newEnvelope());

  function demoFrame() {
    const spectrum = demoSpectrum();
    const auto = demoConfig.autoRange;
    const levels = [], pos = [], outputs = [];
    demoConfig.bands.forEach((band, i) => {
      const lo = Math.log10(band.hzMin / 20) / 3 * 64;
      const hi = Math.log10(band.hzMax / 20) / 3 * 64;
      let sum = 0, n = 0;
      for (let k = Math.max(0, Math.floor(lo)); k <= Math.min(63, Math.ceil(hi)); k++) { sum += spectrum[k]; n++; }
      levels[i] = n ? sum / n : 0;
      PFMap.trackEnvelope(envelopes[i], levels[i], 0.01);
      pos[i] = PFMap.position(levels[i], band, auto ? envelopes[i] : null);
      outputs[i] = PFMap.output(band, pos[i]);
    });
    const state = {
      running: true, connected: false, demo: true,
      levels, pos, outputs, spectrum,
      env: auto ? learned(envelopes.map((e) => ({ lo: e.lo, hi: e.hi }))) : [],
      autoRange: auto
    };
    drawBar(state, HINT);
    if (frameFn) frameFn(state);
  }

  window.PFAdapter = {
    caps() { return CAPS; },
    // Nothing is stored: the editor starts as a first run does.
    loadConfig() { return Promise.resolve(null); },
    saveConfig(config) { demoConfig = config; return Promise.resolve(); },
    resetBand(index, config) {
      config.bands[index] = PFMap.defaultBand(index, CAPS);
      demoConfig = config;
      return Promise.resolve(config);
    },
    onFrame(fn) { frameFn = fn; demoFrame(); setInterval(demoFrame, 120); }
  };
  drawBar({ demo: true }, HINT);
})();
