// Patternflow Audio — popup: the capture console.
//
// What a popup is good at: start and stop the capture, say where the panel
// is, see that audio is flowing, and one button to the tab where mapping
// happens (editor.html). Two things are this file's and nobody else's.
//
//   The panel's address. It has a storage key of its own, so the editor,
//   which owns the mapping (PFMap.CONFIG_KEY), and the popup never write the
//   same value, and an editor tab left open cannot put an old address back.
//   It is committed on Enter, on leaving the field and on Start. Committing
//   per keystroke dropped a live socket for every character and tried
//   192.168.0.4 on the way to 192.168.0.42.
//
//   Asking for the capture. The tab's stream id needs the click that opened
//   this popup.
//
// The mapping is read at Start and handed over as it is stored; nothing here
// edits it or writes it. What is running, what it is connected to, whether
// the panel is listening and why a capture ended belong to the offscreen
// document: it sums them up as one `phase`, and this file prints that. Every
// control here follows it too, so none is offered that has nothing to act on.

const HOST_KEY = 'patternflowAudioHost';
const DEFAULT_HOST = 'patternflow.local';

let host = DEFAULT_HOST;   // the committed address
let hostError = '';        // why the field's text is not an address
let failure = '';          // what the last thing asked for here could not do
let state = null;

const $ = (id) => document.getElementById(id);

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function sendMessage(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function tabQuery(query) {
  return new Promise((resolve) => chrome.tabs.query(query, resolve));
}

function getStreamId(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(streamId);
    });
  });
}

// What someone typed, as the address to store: a host name or an IP, with a
// port only if they gave one. A pasted URL loses its scheme and path. Returns
// null when what is left is not an address.
//
// The shape is checked here and not left to `new URL`: Chrome's parser turns
// "not a host" into not%20a%20host and calls it valid.
const ADDRESS = /^(\[[0-9a-f:.]+\]|[\p{L}\p{N}](?:[\p{L}\p{N}._-]*[\p{L}\p{N}])?)(?::(\d+))?$/iu;

function parseHost(text) {
  const value = String(text || '').trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .replace(/[/?#].*$/, '');
  if (!value) return DEFAULT_HOST;

  const parts = ADDRESS.exec(value);
  if (!parts) return null;
  const [, name, port] = parts;
  if (port !== undefined && !(Number(port) >= 1 && Number(port) <= 65535)) return null;
  try {
    // The parser's spelling of it: lower case, 192.168.1 written out in full.
    return new URL(`ws://${name}`).hostname + (port === undefined ? '' : `:${Number(port)}`);
  } catch (error) {
    return null;
  }
}

// state.host is the address as the socket uses it, port included. In a
// sentence the port every panel has is left off: the address as it was typed.
function shown(socketHost) {
  return String(socketHost || '').replace(/:81$/, '');
}

// Chrome's own words for the two ways it refuses a capture, in plain ones.
// Anything else is passed on as it came.
function plain(message) {
  const text = String(message || '');
  if (/active stream/i.test(text)) {
    return 'This tab is already being captured. Press Stop first.';
  }
  if (/activeTab|cannot be captured/i.test(text)) {
    return 'Chrome does not let this page be captured. Go to the tab that is playing, open this popup there and press Start.';
  }
  return text;
}

// Take the field's text as the address. Returns it, or null when the text is
// not one; then nothing is stored and nothing connects.
function commitHost() {
  const field = $('host');
  const next = parseHost(field.value);
  if (!next) {
    hostError = `"${field.value.trim()}" is not an address. Use a name or an IP, like patternflow.local or 192.168.0.42.`;
    field.setAttribute('aria-invalid', 'true');
    renderState();
    return null;
  }

  hostError = '';
  field.removeAttribute('aria-invalid');
  field.value = next;
  if (next !== host) {
    host = next;
    chrome.storage.local.set({ [HOST_KEY]: host });
    // A capture or a test connection that is up follows the address.
    if (state && (state.running || state.manual)) {
      sendMessage({ type: 'host', host }).then((response) => {
        if (response && response.state) state = response.state;
        renderState();
      });
    }
  }
  renderState();
  return host;
}

// `tone`: 'ok' is green, 'bad' is red, nothing is neutral.
function setStatus(text, tone) {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (tone ? ' ' + tone : '');
}

// The status, the sentence under the address and every control, from the
// state. The words are per phase (offscreen.js phase()); the editor's chip
// uses the same ones.
function renderState() {
  const s = state || {};
  const at = shown(s.host);

  let label = 'Idle';
  let tone = '';
  let detail = s.note || 'Open the tab you want to hear, then press Start.';

  if (failure) {
    label = 'Error';
    tone = 'bad';
    detail = failure;
  } else if (s.phase === 'error') {
    label = 'Error';
    tone = 'bad';
    detail = plain(s.error);
  } else if (s.phase === 'connecting') {
    label = 'Connecting';
    detail = `Connecting to ${at}.`;
  } else if (s.phase === 'off') {
    // The socket is open and the panel ignores every frame: not live.
    label = 'Aud off';
    detail = 'Connected, but Audio-React is off on the panel.';
  } else if (s.phase === 'live') {
    label = 'Live';
    tone = 'ok';
    if (!s.silent) detail = s.tabTitle ? `Capturing: ${s.tabTitle}` : 'Capturing this tab.';
    else detail = s.heard ? 'No sound from this tab right now.' : 'No sound from this tab yet.';
  } else if (s.phase === 'test') {
    label = 'Test';
    tone = 'ok';
    detail = `Test without audio: connected to ${at}. Move a slider.`;
  }

  // Text in the field that is not an address is about the field, which has
  // its red border. Nothing was stored and nothing reconnected, so the status
  // word stays what is true: a capture to the old address is still Live.
  if (hostError) detail = hostError;

  setStatus(label, tone);
  $('detail').textContent = detail;

  // One button: Start until a tab is captured, Stop while one is.
  $('connect').textContent = s.running ? 'Stop' : 'Start';
  $('panelOn').hidden = s.phase !== 'off' || !!hostError;

  // The test connection and a capture are one or the other. Its button
  // disconnects what it connected; its sliders move a panel only while the
  // test is up and the panel listens.
  $('manualConnect').textContent = s.manual ? 'Disconnect' : 'Connect';
  $('manualConnect').disabled = !!s.running;
  $('manualConnect').title = s.running ? 'Stop the capture first.' : '';
  document.querySelectorAll('.manual').forEach((input) => {
    input.disabled = s.phase !== 'test';
    // A knob that is being held shows where it is held, also in a popup
    // opened later. Not under the hand that is moving it.
    const held = s.held && s.held[Number(input.dataset.knob)];
    if (typeof held === 'number' && input !== document.activeElement) {
      input.value = held;
      input.parentElement.querySelector('output').textContent = held.toFixed(2);
    }
  });

  drawSpectrum(s.spectrum || []);
}

function drawSpectrum(values) {
  const canvas = $('spectrum');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fbf7ef';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#d9d1c0';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = Math.round((height / 4) * i) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const barCount = Math.max(1, values.length);
  const barWidth = width / barCount;
  for (let i = 0; i < barCount; i++) {
    const v = PFMap.clamp01(values[i]);
    const h = Math.max(1, v * (height - 12));
    ctx.fillStyle = i % 2 ? '#6b655a' : '#141414';
    ctx.fillRect(i * barWidth, height - h, Math.max(1, barWidth - 1), h);
  }
}

// The frequency labels under the plot. Its bars are equal steps of log
// frequency from the source's lowest to its highest (offscreen.js
// computeSpectrum), so a label belongs at the same fraction of the width.
function placeScale() {
  const { hzMin, hzMax } = PFMap.SOURCE;
  const span = Math.log(hzMax / hzMin);
  for (const [hz, text] of [[20, '20'], [100, '100'], [1000, '1k'], [10000, '10k'], [20000, '20k']]) {
    const mark = document.createElement('span');
    mark.textContent = text;
    mark.style.left = `${(Math.log(hz / hzMin) / span * 100).toFixed(2)}%`;
    $('scale').append(mark);
  }
}

// The reply to a request: the state to draw, or the reason there is none.
function adopt(response, fallback) {
  if (response && response.state) state = response.state;
  if (!response || !response.ok) throw new Error((response && response.error) || fallback);
  renderState();
}

async function startCapture() {
  const address = commitHost();
  if (!address) return;

  const [tab] = await tabQuery({ active: true, currentWindow: true });
  if (!tab || !tab.id) throw new Error('No active tab to capture.');

  const streamId = await getStreamId(tab.id);
  const stored = await storageGet(PFMap.CONFIG_KEY);
  adopt(await sendMessage({
    type: 'start',
    streamId,
    tabTitle: tab.title || '',
    host: address,
    config: stored[PFMap.CONFIG_KEY] || null
  }), 'Failed to start capture.');
}

async function startManual() {
  const address = commitHost();
  if (!address) return;
  adopt(await sendMessage({ type: 'manual-connect', host: address }), 'Failed to connect.');
}

async function stopAll() {
  const response = await sendMessage({ type: 'stop' });
  if (response && response.state) state = response.state;
  renderState();
}

// Something asked for here did not happen. The state is still the offscreen
// document's; this is said over it until the next thing is asked.
function showFailure(error) {
  failure = plain(error.message || error);
  renderState();
}

function bindManualControls() {
  document.querySelectorAll('.manual').forEach((input) => {
    const output = input.parentElement.querySelector('output');
    const update = async () => {
      output.textContent = Number(input.value).toFixed(2);
      const response = await sendMessage({
        type: 'manual-value',
        knob: parseInt(input.dataset.knob, 10),
        value: parseFloat(input.value)
      });
      // Not drawn (nothing else changed), but kept: it carries where each
      // knob is now held.
      if (response && response.state) state = response.state;
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });
}

async function init() {
  const stored = await storageGet([HOST_KEY, PFMap.CONFIG_KEY]);
  if (typeof stored[HOST_KEY] === 'string') {
    host = parseHost(stored[HOST_KEY]) || DEFAULT_HOST;
  } else {
    // Before the address had a key of its own it rode inside the mapping.
    // Move it across once; the copy left behind is never read again.
    const legacy = stored[PFMap.CONFIG_KEY] && stored[PFMap.CONFIG_KEY].host;
    const moved = typeof legacy === 'string' ? parseHost(legacy) : null;
    if (moved) {
      host = moved;
      chrome.storage.local.set({ [HOST_KEY]: host });
    }
  }
  $('host').value = host;

  // `change` is Enter and leaving the field. The popup closing is neither (it
  // closes with the field still focused), so that is asked for by name.
  $('host').addEventListener('change', commitHost);
  window.addEventListener('pagehide', commitHost);
  // "Not an address" was about the text as it stood. Once it is being typed
  // over, the sentence goes; the next commit judges the new text.
  $('host').addEventListener('input', () => {
    if (!hostError) return;
    hostError = '';
    $('host').removeAttribute('aria-invalid');
    renderState();
  });

  // The form makes Enter in the address a submit, the same event as a click
  // on the button, and the two are not always the same wish.
  let typedEnter = false;
  $('host').addEventListener('keydown', (event) => {
    typedEnter = event.key === 'Enter';
  });

  $('device').addEventListener('submit', async (event) => {
    event.preventDefault();
    const entered = typedEnter;
    typedEnter = false;
    failure = '';
    const s = state || {};
    // A capture is running and the button reads Stop. A click on it stops.
    // Enter in the address never does: there it means "this address", and
    // the capture moves to it.
    if (s.running) {
      if (entered) commitHost();
      else await stopAll();
      return;
    }
    // Enter over a test connection means the same, not "capture".
    if (entered && s.manual) {
      commitHost();
      return;
    }
    try {
      setStatus('Starting');
      await startCapture();
    } catch (error) {
      showFailure(error);
    }
  });

  $('manualConnect').addEventListener('click', async () => {
    failure = '';
    if (state && state.manual) {
      await stopAll();
      return;
    }
    try {
      setStatus('Connecting');
      await startManual();
    } catch (error) {
      showFailure(error);
    }
  });

  // Audio-React is a switch on the panel (the AUD row of its NETWORK screen);
  // this throws it from here.
  $('panelOn').addEventListener('click', async () => {
    failure = '';
    $('panelOn').disabled = true;
    const response = await sendMessage({ type: 'panel-on' });
    $('panelOn').disabled = false;
    if (response && response.state) state = response.state;
    if (!response || !response.ok) failure = (response && response.error) || 'The panel did not answer.';
    renderState();
  });

  // The mapping editor gets a real tab: boxes dragged on a spectrum need
  // more room than a popup that closes the moment focus leaves it.
  //
  // One tab. Every editor tab holds its own copy of the mapping and saves the
  // whole of it, so a second tab's next edit put its older copy over the
  // first one's work. If the editor is open anywhere, that tab comes forward.
  $('openEditor').addEventListener('click', async () => {
    const url = chrome.runtime.getURL('editor.html');
    let open = [];
    try {
      const tabs = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
      open = tabs.filter((tab) => String(tab.documentUrl).split(/[?#]/)[0] === url);
    } catch (error) {}
    if (!open.length) {
      chrome.tabs.create({ url });
      return;
    }
    // Both asked for before either lands: the popup closes as soon as focus
    // leaves it, and takes whatever was still waiting with it.
    chrome.windows.update(open[0].windowId, { focused: true });
    chrome.tabs.update(open[0].tabId, { active: true });
  });

  bindManualControls();
  placeScale();
  drawSpectrum([]);

  const response = await sendMessage({ type: 'status' });
  state = response?.state || null;
  // A test connection that is up is what this popup is about: show it.
  if (state && state.manual) $('test').open = true;
  renderState();

  // Whether the panel listens was learned when the socket opened, and the
  // switch is on the panel (its AUD row, its console), where it may have been
  // thrown either way since: "off" that is on again, or Live over a panel
  // that now ignores every frame. Opening the popup is the moment someone
  // looks, so ask once more: one request per popup, never a poll.
  if (state && ['off', 'live', 'test'].includes(state.phase)) {
    const again = await sendMessage({ type: 'panel-check' });
    if (again && again.state) state = again.state;
    renderState();
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'state') return;
  state = message.state;
  renderState();
});

init();
