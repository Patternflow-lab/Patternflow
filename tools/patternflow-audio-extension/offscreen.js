// Patternflow Audio — offscreen document: the analysis, the socket, and the
// truth about both.
//
// Tab capture hands over a MediaStream, and a MediaStream needs a document to
// live in; a service worker has none and is put to sleep besides. So this
// page holds the capture, runs the mapping (mapping.js) 30 times a second and
// writes the four knob lanes to the panel.
//
// It is also the one place that KNOWS whether a capture is running, which
// address the socket points at, whether that socket opened, whether the panel
// on the other end is listening, and why a capture ended. Every state message
// it sends carries all of that (see status()), so the service worker, which
// Chrome restarts with empty memory whenever it likes, can rebuild from any
// single one of them, or ask.
//
// An offscreen document has chrome.runtime and nothing else. No
// chrome.storage: the mapping arrives in messages (the popup reads it at
// Start, the editor sends every save) and is normalised HERE, on receipt,
// whoever sent it. A `host` inside a mapping is ignored; the address comes
// only with start, manual-connect and host, which only the popup sends.

const WS_PORT = 81;       // where the panel's audio socket listens
const TICK_MS = 33;       // analyse and send at about 30 Hz
const REPORT_MS = 120;    // levels and spectrum to the popup and the editor

// The panel hands a lane back to its encoder 500 ms after the last message
// that set it, and docs/audio-ws-spec.md asks for a resend at least every 250.
// A frame that has not changed is resent on the first tick past this. The
// timer's 33 ms come out nearer 35, so that is six ticks, about 210 ms; at
// 200 it was seven, 245, and once in eight minutes 251.
const HOLD_MS = 180;

const QUIET_MS = 2000;    // a spectrum flat for this long is "no sound"
const ASK_MS = 4000;      // how long the panel gets to answer over HTTP

let config = null;        // the mapping: PFMap.normalizeConfig() of what arrived
let address = '';         // as the popup sent it: a name or an IP, a port if one was typed
let host = '';            // 'name:port' the socket is pointed at, '' when idle
let tabTitle = '';
let error = '';           // what is wrong right now
let note = '';            // why the last capture ended, when nobody pressed Stop
let running = false;      // a tab is being analysed
let manual = false;       // the test connection: a socket, no audio

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let mediaStream = null;
let freqBuf = null;
let ws = null;
let tickTimer = null;
let reconnectTimer = null;
let lastLevelReport = 0;
let wsWanted = false;
let wsSerial = 0;

// What the panel was last told, and when. `driven` is the lanes this socket
// has set and not yet handed back.
let lastSentBody = '';
let lastSentAt = 0;
let driven = [false, false, false, false];

// The test connection's sliders: a knob that was moved is held where it was
// put, null is a knob nobody touched.
let manualLanes = [null, null, null, null];

// Audio-React on the panel (the AUD row of its NETWORK screen): true, false,
// or null when the panel has not said. The socket opens either way and the
// panel ignores every frame while it is off, so an open socket alone is not
// "live".
let panelAudio = null;
let checking = false;     // that question is on its way

// Socket attempts in a row that never opened. The first one asks the panel's
// HTTP side what is there, once; `streak` changes whenever the answer to that
// would no longer be about the current attempt.
let failures = 0;
let streak = 0;

// Per band: the smoothed level, and the envelope auto range maps it through.
let levels = [0, 0, 0, 0];
let envelopes = [0, 1, 2, 3].map(PFMap.newEnvelope);

// Per band, the loudest tick since the last report: its level, where that sat
// in the window and what the knob got. A report every 120 ms that carried the
// latest tick showed a kick at anything from 42% to 100% of its height.
let peakLevels = [-1, -1, -1, -1];
let peakPos = [0, 0, 0, 0];
let peakOutputs = [0, 0, 0, 0];

let heard = false;        // this capture has had sound at least once
let heardAt = 0;          // when it last had

function connected() {
  return !!ws && ws.readyState === WebSocket.OPEN;
}

// The one word for all of it. The popup and the editor both print from this,
// so they cannot disagree about what "live" means:
//   idle        nothing is running
//   connecting  no open socket yet, or the panel has not yet said whether it listens
//   off         connected, and Audio-React is switched off on the panel
//   live        a tab is captured and the panel is being driven
//   test        the test connection is up
//   error       see `error`
function phase() {
  if (error) return 'error';
  if (!running && !manual) return 'idle';
  if (!connected() || checking) return 'connecting';
  if (panelAudio === false) return 'off';
  return running ? 'live' : 'test';
}

function status() {
  return {
    running,
    manual,
    connected: connected(),
    phase: phase(),
    host,
    tabTitle,
    error,
    note,
    panelAudio,
    heard,
    silent: running && performance.now() - heardAt > QUIET_MS,
    held: manual ? manualLanes.slice() : []
  };
}

// Always the whole status, plus whatever is live. A patch that carried only
// `connected` left the service worker to remember the rest, and after a
// restart it remembered nothing: the popup said Idle over a running capture.
function patchState(live) {
  chrome.runtime.sendMessage({ type: 'offscreen-state', patch: { ...status(), ...live } }).catch(() => {});
}

// The popup sends a checked address, with a port only if one was typed.
function wsHost() {
  return /:\d+$/.test(address) ? address : `${address}:${WS_PORT}`;
}

// The same panel over HTTP. Never the socket's port: a port that was typed is
// where the audio socket is, and the panel's API is on 80 whatever that says.
function httpName() {
  return address.replace(/:\d+$/, '');
}

// One question to the panel's HTTP API. Returns null when nobody answered in
// time, else { status, json } with json null for anything that is not JSON.
// The panel serves one HTTP connection at a time, so these are single
// requests at moments that matter, never a poll.
async function ask(path, options) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ASK_MS);
  try {
    const reply = await fetch(`http://${httpName()}${path}`, { ...options, cache: 'no-store', signal: abort.signal });
    return { status: reply.status, json: reply.ok ? await reply.json().catch(() => null) : null };
  } catch (failure) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Is the panel listening? Asked once when the socket opens (`opening`: until
// the answer is in, nobody is told "live"), and again each time the popup
// opens onto an open socket: the switch is on the panel and may have been
// thrown either way since, so "off" and "live" are both old news by then.
// Anything but a clear yes or no (no answer, a 404 from firmware that has no
// such route) is "not known": nothing is claimed about it, and an earlier
// answer stands.
async function checkPanel(opening) {
  const serial = wsSerial;
  if (opening) {
    checking = true;
    patchState();
  }
  const answer = await ask('/api/audio');
  if (serial !== wsSerial) return;
  const on = answer && answer.json && answer.json.audioRuntime;
  if (typeof on === 'boolean') panelAudio = on;
  checking = false;
  patchState();
}

// The popup's Turn on. Returns what to tell the person when it did not work.
async function turnOn() {
  const serial = wsSerial;
  const answer = await ask('/api/audio', {
    method: 'POST',
    // The panel's web server reads a body as arguments only under this type.
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'on=1'
  });
  const on = answer && answer.json && answer.json.audioRuntime;
  if (typeof on !== 'boolean') {
    return 'The panel did not answer. Audio-React can also be switched on at the panel: the AUD row of its NETWORK screen.';
  }
  if (serial === wsSerial) panelAudio = on;
  return '';
}

// A socket that will not open says nothing about why. One look at the
// panel's HTTP side does: nobody there, a panel without the audio feature, or
// something that answers and still refuses the socket. Asked once per run of
// failures: the socket retries every 1.2 s, and a question per retry would
// queue up on an address that never answers.
async function diagnose() {
  const mine = streak;
  const name = httpName();
  const answer = await ask('/api/status');
  if (mine !== streak) return;
  const caps = answer && answer.json && answer.json.caps;
  if (!answer) {
    error = `No panel at ${name}. Check the address (the panel's NETWORK screen shows its IP) and that this computer is on the same Wi-Fi. Retrying.`;
  } else if (Array.isArray(caps) && !caps.includes('audio')) {
    error = `The panel at ${name} does not run the Audio edition. Get it at patternflow.work/editions.`;
  } else {
    // Firmware from before `caps`, a wrong port, or not a panel at all: no
    // more is known than that the socket stays shut.
    error = `${Array.isArray(caps) ? 'The panel' : 'Something'} at ${name} answers, but the audio connection to ${host} does not open. Retrying.`;
  }
  patchState();
}

// A new target, or the current one answered: what was learned about the last
// run of failures no longer applies.
function newStreak() {
  failures = 0;
  streak++;
}

function connectWs() {
  clearTimeout(reconnectTimer);

  const previous = ws;
  ws = null;
  try {
    if (previous) {
      previous.onopen = null;
      previous.onclose = null;
      previous.close();
    }
  } catch (failure) {}

  const serial = ++wsSerial;
  panelAudio = null;
  checking = false;

  let socket;
  try {
    socket = new WebSocket(`ws://${host}`);
  } catch (failure) {
    // Not something a socket can be opened to. The popup checks what is
    // typed, so this came from elsewhere; trying again would fail the same.
    error = `"${host}" is not an address a connection can be made to.`;
    patchState();
    return;
  }
  ws = socket;
  let opened = false;

  socket.onopen = () => {
    if (socket !== ws || serial !== wsSerial) return;
    opened = true;
    error = '';
    newStreak();
    // The panel let go of every lane when the last socket closed: it has been
    // told nothing, so the next tick says everything again.
    resetWire();
    checkPanel(true);
  };

  socket.onclose = () => {
    if (socket !== ws || serial !== wsSerial) return;
    if (!opened && ++failures === 1) diagnose();
    patchState();
    if (wsWanted) reconnectTimer = setTimeout(connectWs, 1200);
  };

  // The old socket is gone and this one is not open yet: say so now, before
  // anyone reads a `connected` that was about the old address.
  patchState();
}

function send(msg, options = {}) {
  if (!connected()) return false;
  if (!options.control && ws.bufferedAmount > 0) return false;
  ws.send(msg);
  return true;
}

// The panel on the other end has been told nothing (a new socket, or `off`).
function resetWire() {
  lastSentBody = '';
  lastSentAt = 0;
  driven = [false, false, false, false];
}

// Absolute, not a delta.
//
// `d=lane,change` became virtual encoder clicks in firmware, so a band level
// never set anything — it nudged, and the parameter drifted wherever the sum
// of nudges went. The same music gave a different result depending on what had
// already happened, and any message the one-connection server dropped stayed
// wrong forever. `k=lane,level` lands the band inside the parameter's own
// range, and the next frame corrects whatever the last one lost.
// All four lanes, one message per frame.
//
// Sending them one at a time did not work and failed in the least visible way
// possible: `send()` refuses while `ws.bufferedAmount > 0`, which after the
// first send of a frame it always is, so lanes 1..3 were dropped every frame
// in index order. Knob 1 moved, knob 2 flickered, knob 4 never moved at all —
// and it looked like a signal problem, because the band that never worked was
// also the quietest one.
//
// A '-' leaves a lane alone, which is what a muted band sends.
//
// An unchanged frame is NOT news, but it still has to be said: the panel
// releases a lane 500 ms after the last message that set it. Skipping
// unchanged frames handed the knobs back half a second into any silence, any
// pause, any curve resting on one step, while the popup said Live. So a frame
// goes out when it differs from the last one or when HOLD_MS have passed.
function sendLanes(values) {
  // A lane this socket set and no longer drives is handed back now, once,
  // and not left to the panel's timeout.
  for (let i = 0; i < 4; i++) {
    if (values[i] === null && driven[i] && send(`off=${i}`, { control: true })) driven[i] = false;
  }
  if (values.every((v) => v === null)) return;

  const body = values
    .map((v) => (v === null ? '-' : Math.max(0, Math.min(1, v)).toFixed(3)))
    .join(',');
  const now = performance.now();
  if (body === lastSentBody && now - lastSentAt < HOLD_MS) return;
  if (!send(`a=${body}`)) return;
  lastSentBody = body;
  lastSentAt = now;
  for (let i = 0; i < 4; i++) {
    if (values[i] !== null) driven[i] = true;
  }
}

// Everything off and forgotten. `why` is for a capture that ended by itself.
async function stop(why = '') {
  running = false;
  manual = false;
  wsWanted = false;
  clearInterval(tickTimer);
  clearTimeout(reconnectTimer);
  tickTimer = null;
  reconnectTimer = null;
  wsSerial++;
  newStreak();

  send('off', { control: true });
  resetWire();

  try {
    if (ws) {
      ws.onopen = null;
      ws.onclose = null;
      ws.close();
    }
  } catch (failure) {}
  ws = null;

  try {
    if (sourceNode) sourceNode.disconnect();
  } catch (failure) {}
  sourceNode = null;

  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    mediaStream = null;
  }

  if (audioCtx) {
    await audioCtx.close().catch(() => {});
    audioCtx = null;
  }

  analyser = null;
  freqBuf = null;
  config = null;
  address = '';
  host = '';
  tabTitle = '';
  error = '';
  note = why;
  panelAudio = null;
  checking = false;
  heard = false;
  manualLanes = [null, null, null, null];
  levels = [0, 0, 0, 0];
  peakLevels = [-1, -1, -1, -1];
  envelopes = [0, 1, 2, 3].map(PFMap.newEnvelope);
  patchState({ levels: [], pos: [], outputs: [], spectrum: [], env: [] });
}

async function start(message) {
  await stop();
  try {
    config = PFMap.normalizeConfig(message.config, PFMap.SOURCE);
    address = String(message.host || '').trim();
    host = wsHost();
    tabTitle = message.tabTitle || '';
    running = true;
    wsWanted = true;

    audioCtx = new AudioContext();
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: message.streamId
        }
      },
      video: false
    });

    // The stream ends when its tab is closed. Nothing else says so: the
    // analyser keeps returning silence and the socket stays open, so the popup
    // went on reading Live over a tab that no longer existed.
    mediaStream.getAudioTracks().forEach((track) => {
      track.onended = () => stop('The captured tab was closed.');
    });

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.3;
    freqBuf = new Float32Array(analyser.frequencyBinCount);

    sourceNode = audioCtx.createMediaStreamSource(mediaStream);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    // "No sound yet" is said after QUIET_MS of nothing, counted from here.
    heardAt = performance.now();

    connectWs();
    tickTimer = setInterval(tick, TICK_MS);
  } catch (failure) {
    // Half a capture is not one: undo what was set up, then let the caller
    // say why.
    await stop();
    throw failure;
  }
}

async function manualConnect(target) {
  await stop();
  address = String(target || '').trim();
  host = wsHost();
  manual = true;
  wsWanted = true;
  connectWs();
  tickTimer = setInterval(tick, TICK_MS);
}

// The popup committed another address while something is connected: follow it.
function retarget(target) {
  if (!wsWanted) return;
  const was = host;
  address = String(target || '').trim();
  host = wsHost();
  if (host === was) return;
  error = '';
  newStreak();
  resetWire();              // a different panel has been told nothing yet
  connectWs();
}

function hzToBin(hz) {
  return Math.round(Number(hz) * analyser.fftSize / audioCtx.sampleRate);
}

// Raw level only. Gain used to be folded in here, which meant it scaled the
// signal BEFORE the input window clipped it — so raising boost also slid the
// band out of its own window, and the two controls fought. It shapes the
// curve now (PFMap.curveValue), which is the curve the editor draws.
function binsLevel(minBin, maxBin) {
  minBin = Math.max(0, minBin);
  maxBin = Math.min(freqBuf.length - 1, maxBin);
  if (maxBin < minBin) return 0;

  let sum = 0;
  for (let i = minBin; i <= maxBin; i++) sum += freqBuf[i];
  return PFMap.normalizeDb(sum / (maxBin - minBin + 1));
}

function computeSpectrum() {
  const count = 64;
  const values = [];
  const logMin = Math.log10(PFMap.SOURCE.hzMin);
  const logMax = Math.log10(PFMap.SOURCE.hzMax);

  for (let i = 0; i < count; i++) {
    const hz0 = 10 ** (logMin + (logMax - logMin) * (i / count));
    const hz1 = 10 ** (logMin + (logMax - logMin) * ((i + 1) / count));
    values.push(binsLevel(hzToBin(hz0), hzToBin(hz1)));
  }

  return values;
}

function tick() {
  // The test connection has no audio: it keeps saying where the sliders are.
  if (manual) {
    sendLanes(manualLanes);
    return;
  }
  if (!running || !analyser || !freqBuf || !config) return;

  analyser.getFloatFrequencyData(freqBuf);
  const bands = config.bands;
  const auto = config.autoRange;

  // Levels first, for every band including muted ones — the editor shows a
  // muted band's level so you can see what it WOULD do, and the auto-range
  // envelopes keep tracking so unmuting does not open on a stale window.
  for (let i = 0; i < 4; i++) {
    const raw = binsLevel(hzToBin(bands[i].hzMin), hzToBin(bands[i].hzMax));
    // Glide ballistics: a hit ATTACKS at its own speed, the fall RELEASES at
    // the damping - two user-set alphas. Symmetric smoothing made percussive
    // music feel late; this is the VU-meter split every reactive light wants.
    const a = raw > levels[i] ? config.attack : config.smoothing;
    levels[i] = a * raw + (1 - a) * levels[i];
    if (auto) PFMap.trackEnvelope(envelopes[i], levels[i]);
  }

  // The mapping itself is PFMap's: where each level sits in its window, and
  // what the knob gets for that. Both go out with the levels, so the editor
  // can draw what was mapped instead of working it out a second time.
  //
  // A lane nothing drives stays null, and goes out as '-'.
  const lanes = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    const pos = PFMap.position(levels[i], bands[i], auto ? envelopes[i] : null);
    const output = PFMap.output(bands[i], pos);
    if (!bands[i].muted) lanes[bands[i].knob] = output;
    if (levels[i] > peakLevels[i]) {
      peakLevels[i] = levels[i];
      peakPos[i] = pos;
      peakOutputs[i] = output;
    }
  }

  sendLanes(lanes);

  const now = performance.now();
  if (now - lastLevelReport > REPORT_MS) {
    lastLevelReport = now;
    const spectrum = computeSpectrum();
    // Flat is what the plot shows as flat: nothing above a hundredth of it.
    if (spectrum.some((v) => v > 0.01)) {
      heard = true;
      heardAt = now;
    }
    patchState({
      levels: peakLevels.slice(),
      pos: peakPos.slice(),
      outputs: peakOutputs.slice(),
      spectrum,
      // The editor draws these as each box's breathing top and bottom edge.
      env: auto ? envelopes.map((e) => ({ lo: e.lo, hi: e.hi })) : [],
      autoRange: auto
    });
    peakLevels = [-1, -1, -1, -1];
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return;

  (async () => {
    // What went wrong with the request itself, for whoever sent it. Not a
    // fault of the capture, so it does not go into `error`.
    let refused = '';

    switch (message.type) {
      case 'start':
        await start(message);
        break;
      case 'manual-connect':
        await manualConnect(message.host);
        break;
      case 'stop':
        await stop();
        break;
      case 'host':
        retarget(message.host);
        break;
      case 'config':
        // Only a running capture has a use for a mapping; the next Start
        // brings its own. What changed goes out with the next tick: a new
        // value as a new frame, a band that was muted as `off=N`.
        if (running) config = PFMap.normalizeConfig(message.config, PFMap.SOURCE);
        break;
      case 'manual-value':
        if (manual) {
          manualLanes[Math.max(0, Math.min(3, Number(message.knob) || 0))] = PFMap.clamp01(message.value);
          sendLanes(manualLanes);
        }
        break;
      case 'panel-on':
        refused = await turnOn();
        break;
      case 'panel-check':
        if (connected() && !checking) await checkPanel(false);
        break;
      case 'status':
        break;
      default:
        sendResponse({ ok: false, error: 'Unknown message', state: status() });
        return;
    }
    sendResponse({ ok: !refused, error: refused || undefined, state: status() });
  })().catch((failure) => {
    error = String(failure.message || failure);
    patchState();
    sendResponse({ ok: false, error, state: status() });
  });

  return true;
});
