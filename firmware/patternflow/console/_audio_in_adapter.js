// /audio-in, the panel's half: window.PFAdapter. A source, not a page:
// firmware/toolchain/build_audio_in_page.py puts it in console/audio-in.html
// where the extension's editor.html loads editor-adapter.js. Edit it here,
// then run console_pages.py build. Whole-line comments and indentation do not
// travel; a template literal has to stay on one line (the build says so).
// Every byte that is not a comment is sent over the panel's Wi-Fi, and the
// page has a budget (BUDGET in the builder): this file is written short.
//
// The editor (editor.js, shared with the extension) reaches the panel only
// through this object; the contract it keeps is written at the top of
// editor.js, and the API it speaks is docs/rest-api.md, "Microphone". Four
// jobs live here:
//
//   - scale conversion. The firmware measures, gates and maps in LINEAR
//     amplitude (every constant in core_audio_in_map.h was measured on that
//     scale and stays); the editor's level axis is dB so boxes drag like
//     hearing works. This file converts both ways at the boundary.
//     DB_FLOOR/DB_SPAN are the calibration: a quiet room sits about 0.15 up
//     the axis, listening-volume peaks about 0.9. The phone app mirrors the
//     two numbers, so they do not move.
//
//   - reading. Nothing is saved until the panel's own mapping has been read
//     (`ack` is null until then): an editor holding defaults must never write
//     them over a mapping it failed to fetch. The read is retried until it
//     answers.
//
//   - saving. ONE path for everything this page writes (the mapping, the
//     microphone switch, its gain): `cur` is what the page wants, `ack` what
//     the panel last acknowledged, both as the text of each POST field. A
//     save sends the fields that differ and nothing else, one request at a
//     time, so two tabs do not write each other's stale copy back and an
//     Attack nudge is `attack=0.650`, not forty arguments.
//
//   - the sources. Who can have the knobs, and how each stands: the
//     microphone's state is the `source` of every levels poll, the
//     extension's switch and socket count are what the chrome's status
//     delivers, kept fresh by the chrome's shared poller (PF.watchStatus).
//     The page fetches neither by itself.
//
// Every request rides the console's lane (README, "Writing a page"): the
// levels and the read are PF.poll, never a timer of this file's own.
(function () {
  var DB_FLOOR = -45, DB_SPAN = 47;
  var $ = (id) => document.getElementById(id);
  var clamp01 = PFMap.clamp01;
  var dbn = (x) => clamp01((20 * Math.log10(Math.max(Number(x) || 0, 1e-4)) - DB_FLOOR) / DB_SPAN);
  var lin = (v) => Math.pow(10, (clamp01(v) * DB_SPAN + DB_FLOOR) / 20);
  var say = (text, kind) => PF.say(text, kind || 'info', $('barMsg'));

  // A curve's name, as the panel stores it beside the table (`meta`, 31
  // bytes, never parsed by the firmware): a, s:N, p:preset, b: six
  // hundredths. The shapes are the model's own (PFMap.PRESETS), not copied.
  function encodeMeta(curve) {
    var c = curve || 0;
    return c.type === 'steps' ? 's:' + c.n
      : c.type === 'arch' ? 'a'
      : c.type !== 'bezier' ? ''
      : (PFMap.PRESETS[c.id] || 0).type === 'bezier' ? 'p:' + c.id
      : 'b:' + [c.y0, c.y1, c.p1x, c.p1y, c.p2x, c.p2y].map((v) => Math.round(clamp01(v) * 100));
  }
  function decodeMeta(m) {
    var q = m.slice(2).split(','), n = parseInt(q[0], 10) || 2, p = PFMap.PRESETS[q[0]] || 0;
    q = q.map((v) => (parseInt(v, 10) || 0) / 100);
    return m === 'a' ? { type: 'arch', id: 'arch' }
      : /^s:/.test(m) ? { type: 'steps', id: n === 2 ? 'gate' : 'steps', n: Math.max(2, Math.min(8, n)) }
      : /^p:/.test(m) && p.type === 'bezier' ? Object.assign({}, p)
      : /^b:/.test(m) && q.length === 6 ? { type: 'bezier', id: 'custom', y0: q[0], y1: q[1], p1x: q[2], p1y: q[3], p2x: q[4], p2y: q[5] }
      : null;
  }

  // ── what the panel has, and what the page wants ───────────────────────
  //
  // Field name -> the text a POST carries for it. `ack` is null until the
  // panel's configuration has been read; while it is, nothing saves.
  var ack = null, cur = {}, luts = [];
  var hz = [31.25, 8000];
  var frameFn, cfgFn, levels;
  // One write to the panel at a time, in the order they were asked for.
  var tail = Promise.resolve();
  // `tries` counts a save's failures, `told` is the failure the slot is showing.
  var tries = 0, told = '', leaving = false;
  // The sources: the last poll's `source` and `ext`, when the microphone
  // switch last moved, the browser path's three facts from the status
  // (`hasAud` is undefined until one has come), and how many switches of that
  // path this page has on their way to the panel.
  var source = '', ext = false, micAt = 0;
  var hasAud, aud = false, clients = 0, busy = 0;

  // A band's numbers and the decimals each is sent with (the firmware's own
  // print precision). The first six are the three pairs, each beside its mate.
  var FIELDS = [['hzMin', 1], ['hzMax', 1], ['inMin', 5], ['inMax', 5], ['outMin', 3], ['outMax', 3], ['gain', 3]];

  // The editor's mapping as POST fields. The acknowledged copy is made with
  // this too, from the mapping as the editor will hold it, so the first edit
  // sends that edit and not every band the round trip through dB moved by a
  // digit. Beside each curve's name, its table, baked if the editor has none.
  function ser(cfg, to) {
    to.auto = cfg.autoRange ? '1' : '0';
    to.smoothing = cfg.smoothing.toFixed(3);
    to.attack = cfg.attack.toFixed(3);
    cfg.bands.forEach((b, i) => {
      FIELDS.forEach((f) => { to[f[0] + i] = (f[1] > 4 ? lin(b[f[0]]) : b[f[0]]).toFixed(f[1]); });
      to['muted' + i] = b.muted ? '1' : '0';
      to['meta' + i] = encodeMeta(b.curve);
      luts[i] = (!b.curve ? [] : b.lut && b.lut.length === 33 ? b.lut : PFMap.bakeLut(b.curve))
        .map((v) => Math.round(clamp01(v) * 255));
    });
  }

  // The fields that differ, as a POST body ('' = the panel has everything),
  // and in `sent` what each was sent as. A pair goes whole when either half
  // moved (hzMin/hzMax, inMin/inMax, outMin/outMax): the range that was
  // touched is stored as the page shows it. That matters where the page's
  // copy is not the panel's to the digit: the model widens a window narrower
  // than its minimum and swaps an output range stored reversed (only another
  // API client can make either), and the half that was not dragged would
  // otherwise stay as the panel had it, under a page showing something else.
  // The price is two tabs on the two edges of ONE box: the later one writes
  // the box it shows. A curve's name never goes without its table, nor a
  // table without its name.
  function diff(sent) {
    var out = [];
    var put = (k) => { out.push(k + '=' + encodeURIComponent(cur[k])); sent[k] = cur[k]; };
    var one = (k, mate) => { if (cur[k] !== ack[k] || cur[mate] !== ack[mate]) put(k); };
    ['mic', 'auto', 'micGain', 'smoothing', 'attack'].forEach((k) => one(k));
    for (let i = 0; i < 4; i++) {
      FIELDS.forEach((f, n) => one(f[0] + i, n < 6 && FIELDS[n ^ 1][0] + i));
      one('muted' + i);
      if (cur['meta' + i] !== ack['meta' + i]) { put('meta' + i); out.push('lut' + i + '=' + luts[i]); }
    }
    return out.join('&');
  }

  // A POST the panel's parser reads (no form Content-Type, no arguments), that
  // cannot hang the queue (twelve seconds, where the browser can count them),
  // and that outlives the page when it is the last one.
  var post = (url, body) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body, keepalive: leaving,
    signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
  }).then((r) => {
    if (!r.ok) throw Error(r.status);
    return r.json();
  });

  // Send what differs. PF.dirty stays up until the panel has acknowledged
  // all of it, so the chrome never reloads the page over an unsaved edit. A
  // save that failed is tried once more, when the next levels poll shows the
  // panel answering; after that it waits for the next change, and says so.
  function save() {
    return tail = tail.then(() => {
      var sent = {}, body = ack && diff(sent);
      PF.dirty = !!body;
      if (!body) return told && say(told = '');
      return post('/api/audio-in', body).then(() => {
        Object.assign(ack, sent);
        if (sent.mic) { micAt = Date.now(); levels.set(100); levels.now(); }
        if (told) say('saved', 'ok');
        told = '';
        tries = 0;
        PF.dirty = !!diff({});
        draw();
      }, () => {
        say(told = ++tries < 2 ? 'not saved yet: the panel did not answer. Trying again.'
          : 'not saved: the panel did not take it. Change it again to retry.', 'err');
        // The slot is at the top of a long page: giving up is also a toast.
        if (tries > 1) PF.say(told, 'err');
      });
    });
  }
  function change() { tries = 0; PF.dirty = true; return save(); }

  // On the way out there is no waiting for the queue: whatever differs goes
  // now, once, and is taken as sent. editor.js flushes its own waiting save
  // from pagehide as well; this listener is registered first, so that save
  // finds `leaving` set and goes the same way.
  function bye() {
    var sent = {}, body = ack && diff(sent);
    if (!body) return;
    post('/api/audio-in', body).catch(() => {});
    Object.assign(ack, sent);
  }
  addEventListener('pagehide', () => { leaving = true; bye(); });
  addEventListener('pageshow', () => { leaving = false; });

  // ── reading ───────────────────────────────────────────────────────────

  // The panel's configuration reply, as the editor's mapping; and from the
  // same reply the acknowledged copy and the device's own controls. A curve
  // is taken only where the panel runs its table (lutSet): a name without a
  // table is a band running its gain, and is shown as that.
  function take(j) {
    hz = j.hzRange || hz;
    var cfg = PFMap.normalizeConfig({
      autoRange: j.autoRange, smoothing: j.smoothing, attack: j.attack,
      bands: j.bands.map((b) => Object.assign({}, b, {
        inMin: dbn(b.inMin), inMax: dbn(b.inMax),
        curve: b.lutSet ? decodeMeta(b.meta) : null
      }))
    }, { hzMin: hz[0], hzMax: hz[1] });
    ack = {};
    ser(cfg, ack);
    ack.mic = j.micOn ? '1' : '0';
    ack.micGain = j.micGain.toFixed(1);
    cur = Object.assign({}, ack);
    source = j.source;
    PF.dirty = false;
    $('micGain').value = ack.micGain;
    $('micToggle').disabled = $('micGain').disabled = false;
    draw();
    return cfg;
  }

  // Read the configuration until the panel answers with one: a reply without
  // four bands (an error page, another device) is not one. On the console's
  // lane, slower after each miss.
  function read() {
    ack = null;
    say('Reading the panel’s mapping…');
    return new Promise((done) => {
      var wait = 2000, rd = PF.poll('/api/audio-in', wait, (j) => {
        if (j && (j.bands || 0).length === 4) {
          rd.stop();
          say('');
          done(take(j));
        } else {
          say('Could not read the panel’s mapping. Trying again.', 'err');
          rd.set(wait = Math.min(wait * 2, 16000));
        }
      });
    });
  }

  // The firmware's own defaults: the page carries no table of them. The reply
  // has no configuration in it, so the mapping is read again and replaces the
  // editor's copy and the acknowledged one before anything saves (a stale
  // copy would write the reset away on the next edit); the editor stands
  // inert while that is open. `body` is 'band=N' or '' for everything.
  function reset(body) {
    return tail = tail.then(() => {
      $('ed').inert = true;
      return post('/api/audio-in/reset', body).then(read, () => {
        say('Reset failed: the panel did not take it.', 'err');
      }).then((cfg) => {
        $('ed').inert = false;
        return cfg;
      });
    });
  }

  // ── the levels ────────────────────────────────────────────────────────

  // One poll, as the editor's frame. Levels are drawn only for a source that
  // is heard: the microphone delivering samples ('pdm') or a phone frame
  // (`ext`). In every other state the poll's arrays are stale (off), the
  // test tones (synth) or a dead pin, and none of them is the room.
  function onLevels(j) {
    var f = {}, conv;
    if (!j) {
      // No answer: ask once a second, not ten times; the chrome says why.
      levels.set(1000);
      frameFn(f);
      return;
    }
    ext = j.ext;
    source = j.source;
    // The switch as the panel has it (another tab may have moved it), except
    // around a change of our own: a poll that left before it would undo it.
    if (ack && cur.mic === ack.mic && Date.now() - micAt > 1500) cur.mic = ack.mic = ext || source === 'off' ? '0' : '1';
    // As often as there is something new to draw. The microphone's levels
    // move ten times a second; the phone app posts a frame every 250 ms, on
    // the one connection this poll also needs. Nothing is drawn from any
    // other state (off, no microphone, not answering), so a slow poll is
    // enough to see a switch moved elsewhere, and still inside the 2.5 s the
    // panel counts a page as watching, which is what keeps the phone app
    // sending. For a second and a half after the switch moves the poll stays
    // fast, so "starting" settles quickly.
    levels.set(ext ? 250 : source === 'pdm' || Date.now() - micAt < 1500 ? 100 : 1500);
    if (ext || source === 'pdm') {
      conv = ext ? clamp01 : dbn;
      f.levels = j.levels.map(conv);
      f.spectrum = j.spectrum.map(conv);
      // An envelope only once one is learned: a panel that has heard nothing
      // sends lo -1.5, hi 0.
      f.env = (j.env || []).map((e) => ext || e.lo >= 0 && e.hi > e.lo ? { lo: conv(e.lo), hi: conv(e.hi) } : null);
      if (ext) {
        // The phone's own axis; levelsN and outputs are the microphone's
        // even here, so the editor does this frame's arithmetic itself.
        f.db = [-80, -10];
      } else if (ack) {
        // Where the mapper has each level: inside its envelope in auto
        // range, linearly between the stored edges by hand. Not while a
        // reset's re-read is open (`ack` is null then): that frame is drawn
        // from its levels alone.
        f.outputs = j.outputs;
        f.pos = j.levels.map((v, i) => {
          var lo = +ack['inMin' + i];
          return clamp01(ack.auto > 0 ? (j.levelsN[i] - 0.10) / 0.85 : (v - lo) / (Math.max(lo + 0.01, ack['inMax' + i]) - lo));
        });
      }
    }
    draw();
    frameFn(f);
    if (tries === 1) save();
  }

  // ── the sources ───────────────────────────────────────────────────────

  var NOTES = {
    'off': 'The microphone is off. The mapping can still be edited.',
    'not detected': 'No microphone found: the data pin (RX) is idle. Check the DAT lead.',
    'not answering': 'The microphone is not answering.'
  };
  function flip(id, on) {
    $(id).classList.toggle('on', on);
    $(id).setAttribute('aria-pressed', on);
  }
  // A chip is its word and how it stands: ' ok' (green), ' pf-err' or ''.
  function chip(id, text, how) {
    $(id).textContent = text;
    $(id).className = 'chip' + how;
  }
  function draw() {
    if (!ack) return;
    // The microphone, in one word. For a second after the switch goes on the
    // firmware has not made up its mind (the first reads say synth, and "no
    // microphone" needs the old levels to decay).
    var on = cur.mic > 0;
    var m = !on ? 'off'
      : Date.now() - micAt < 1500 || /^(off|phone)$/.test(source) ? 'starting'
      : source === 'pdm' ? 'listening'
      : source === 'pdm (no mic - data pin idle)' ? 'not detected'
      : 'not answering';
    var bad = /^not/.test(m) ? ' pf-err' : '', note = !ext && NOTES[m] || '';
    flip('micToggle', on);
    // A fault is in the error colour, on the chip and on the sentence under
    // the switch: it must not look quieter than "listening".
    chip('micChip', m, bad || (m === 'listening' ? ' ok' : ''));
    $('micGainVal').textContent = cur.micGain;
    $('deviceNote').textContent = note;
    $('deviceNote').className = 'hint' + bad;
    // The plot has nothing to draw from a microphone that is not there.
    $('plotWrap').style.opacity = bad ? 0.5 : '';
    // The browser row stands in the page from the first paint, its switch
    // disabled and its chip empty, and goes away only when a status says this
    // build has no such path: the status comes after the mapping, and a row
    // arriving then would push the editor down under a finger.
    $('extRow').hidden = hasAud === false;
    $('audToggle').disabled = !hasAud;
    flip('audToggle', aud);
    chip('extChip', !hasAud ? '' : !aud ? 'off' : ext ? 'phone app' : clients ? 'connected' : 'waiting', aud && ext ? ' ok' : '');
    // Who has the knobs, in words. On the panel a sender on the socket
    // outranks the microphone lane by lane (feature_audio_in.h drives only a
    // lane nobody else has taken), and the page cannot see whether an open
    // socket is sending: so while one is open the microphone is not named as
    // the owner, listening or not, and the browser path is only ever
    // "connected".
    $('st').textContent = hasAud && aud && clients && !ext ? 'a browser or phone is connected'
      : (m === 'listening' ? 'the microphone' : ext ? 'the phone app' : 'nothing') + ' has the knobs';
  }
  // The browser path's switch and how many sockets are open: the chrome's
  // status, and kept fresh (its one shared poller, every 5 s), because the
  // page says "waiting" and "nothing has the knobs" for as long as it is
  // open, and the usual order is this page first and the extension after.
  // Subscribed from onFrame, once the mapping is in, and not at load:
  // subscribing asks for a status at once, and one ahead of the read only
  // makes the editor a round trip later (nothing is drawn from it before the
  // mapping is in). The chrome fetches its first status by itself, and on
  // its lane that lands right behind the read. A reply that was on its way
  // while a switch of this page's own was being sent is older than the
  // switch, and is not taken for it.
  function onStatus(s) {
    hasAud = (s.caps || []).includes('audio');
    if (!busy) aud = s.audioRuntime;
    clients = s.audioClients;
    draw();
  }

  $('micToggle').onclick = () => {
    cur.mic = cur.mic > 0 ? '0' : '1';
    micAt = Date.now();
    draw();
    change();
  };
  // The gain shows as it is dragged and is sent when it is let go.
  $('micGain').oninput = () => {
    cur.micGain = (+$('micGain').value).toFixed(1);
    PF.dirty = true;
    draw();
  };
  $('micGain').onchange = change;
  $('audToggle').onclick = () => {
    var want = aud = !aud;
    busy++;
    draw();
    tail = tail.then(() => post('/api/audio', 'on=' + (want ? 1 : 0)).then((r) => {
      aud = r.audioRuntime;
    }, () => {
      // A lost request must not leave the switch lying until the next status.
      aud = !want;
      say('not switched: the panel did not answer.', 'err');
    }).then(() => {
      busy--;
      draw();
    }));
  };

  // The canvases take their colours from the page's variables on each paint,
  // and a paint comes with a frame. With the microphone off a frame is 1.5 s
  // away, so a theme change repaints by itself (selectBand is editor.js's:
  // the plot, the curve, the shapes and the tab glyphs).
  new MutationObserver(() => { if (frameFn) selectBand(sel); })
    .observe(document.documentElement, { attributeFilter: ['data-theme'] });

  window.PFAdapter = {
    loadConfig: read,
    // Asked once, after the read: the axis and the limits the firmware holds
    // a band to, so nothing the editor stores snaps back. A window is at
    // least 0.01 tall in LINEAR amplitude and tops out at linear 1.0; the
    // model's own 0.02 of the axis applies as well, whichever is stricter.
    caps: () => ({
      hzMin: hz[0], hzMax: hz[1], hzGap: 31.25,
      db: [DB_FLOOR, DB_FLOOR + DB_SPAN],
      levelMax: dbn(1),
      top: (lo) => Math.max(lo + PFMap.MIN_WINDOW, dbn(lin(lo) + 0.01)),
      bottom: (hi) => Math.min(hi - PFMap.MIN_WINDOW, dbn(lin(hi) - 0.01))
    }),
    saveConfig: (cfg) => {
      if (!ack) return;
      ser(cfg, cur);
      return leaving ? bye() : change();
    },
    onConfig: (fn) => { cfgFn = fn; },
    onFrame: (fn) => {
      frameFn = fn;
      levels = PF.poll('/api/audio-in?levels=1', 100, onLevels);
      PF.status(onStatus);
      PF.watchStatus(5000);
    },
    resetBand: (i) => reset('band=' + i),
    // PFConfirm is editor.js's two-press confirmation: the phone app's
    // WebView has no window.confirm. It says exactly what the panel resets.
    resetAll: (button) => {
      if (PFConfirm(button, 'Press again: resets all four knobs, their curves, attack, damping and input gain')) {
        PF.busy(button, reset('').then((cfg) => { if (cfg) cfgFn(cfg); }));
      }
    }
  };
})();
