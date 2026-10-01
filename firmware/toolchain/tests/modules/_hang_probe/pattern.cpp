// Bench probe for a render loop that stops, not a showable pattern: a module
// whose draw() stops returning. Nothing in the catalog does that on purpose,
// and the thing under test - the console outliving a hung loop
// (src/core_loop_sync.h) - cannot be seen on a panel whose patterns all
// behave.
//
//   python firmware/toolchain/build_module.py --out <dir> firmware/toolchain/tests/modules/_hang_probe
//   curl -X PUT --data-binary @<dir>/_hang_probe.pfm -H "X-PF-Name: _hang_probe.pfm" http://<panel>/api/patterns
//   curl "http://<panel>/api/patterns/select?index=<N>"
//
// N is its index in GET /api/patterns, the entry whose "module" is
// "_hang_probe" - by index because it has no sidecar, so the list knows it
// only by its slug until it has been loaded once.
//
// It runs a green bar down for eight seconds, shows one red frame, and never
// comes back from the draw() after that. The panel stays red; /api/status
// keeps answering and its loopAgeMs climbs.
//
// A hang that never ends shows only half of it. What the loop does when it
// COMES BACK to requests that gave up on it is the other half, and the half
// with the dead stack frame in it, so a knob moved while the fuse burns turns
// the stop into one that ends:
//
//   K1 (or  curl -X POST http://<panel>/api/params -d d1=3):  the bar turns
//       blue and draw() holds the loop for thirty seconds. A request waiting
//       on the loop is taken back at twenty; ten seconds later the loop wakes
//       to find nothing posted, and must not run what was withdrawn.
//   K2 (d2=3):  the bar turns amber and the hold is twenty seconds and half
//       a slice - the host's PF_LOOP_STALL_MS, which a module cannot see, so
//       the two are kept in step by hand, plus half of the 25 ms a waiting
//       caller sleeps between looks. The loop comes round inside the slice in
//       which that caller gives up, so each of them should get there first
//       in a fair share of rounds (reasoned from the slice, not yet counted
//       on a board): the hand-off race, on the real core's atomics instead
//       of a desk's. Either may win. Neither may crash.
//
// A hold that ends starts the fuse again in the same colour, so a script can
// keep asking for as many rounds as it likes without a hand on the panel.
//
// Picked within twenty seconds of boot it stays green and never hangs. That
// is what a boot restore of the remembered pattern looks like from in here,
// and a probe that hung there would hang again on every restart: the panel
// would be trapped in the very loop this exists to test the way out of.
// (The boot latch would catch it one restart later - it is armed for the
// first fifteen seconds - but a bench tool should not lean on that.) So a
// restart always ends the hang, and picking another pattern and then this
// one again starts a new countdown.
#include "pf_module.h"

namespace HangProbe {

const char* NAME = "Hang Probe";
const char* const KNOB_LABELS[4] = {"30 s", "20 s", "-", "-"};

constexpr uint32_t BOOT_RESTORE_MS = 20000;
constexpr uint32_t FUSE_MS = 8000;
constexpr uint32_t HOLD_MS = 30000;
constexpr uint32_t EDGE_MS = 20000 + 12;   // PF_LOOP_STALL_MS in src/core_loop_sync.h, and half a slice

enum Stop : uint8_t { FOR_EVER, HOLD, EDGE };

uint32_t startedAtMs = 0;
uint32_t nowMs = 0;
bool started = false;
bool armed = false;
bool stopShown = false;
Stop stop = FOR_EVER;
// volatile so the loops below have a side effect: an empty for(;;) is one the
// compiler is allowed to delete, and a probe that did not hang would pass
// every check for the wrong reason.
volatile uint32_t spins = 0;

void setup() {
  started = false;
  armed = false;
  stopShown = false;
  stop = FOR_EVER;
}

void update(float dt, const InputFrame& input) {
  (void)dt;
  nowMs = input.now;
  if (!started) {
    started = true;
    startedAtMs = input.now;
    armed = input.now >= BOOT_RESTORE_MS;
  }
  if (armed && !stopShown) {
    if (input.knobDeltas[0] != 0) stop = HOLD;
    else if (input.knobDeltas[1] != 0) stop = EDGE;
  }
}

// Green for the stop that never ends, blue for thirty seconds, amber for
// twenty: the fuse says which is coming and the stopped panel says which
// came (red, when it is for ever).
void colour(bool stopped, uint8_t level, uint8_t& r, uint8_t& g, uint8_t& b) {
  r = g = b = 0;
  if (stop == HOLD) { g = level / 3; b = level; }
  else if (stop == EDGE) { r = level; g = level / 2; }
  else if (stopped) r = level;
  else g = level;
}

void draw() {
  const uint32_t ranMs = nowMs - startedAtMs;
  uint8_t r, g, b;
  if (armed && ranMs >= FUSE_MS) {
    if (stopShown) {
      if (stop == FOR_EVER) {
        for (;;) spins = spins + 1;
      }
      const uint32_t holdMs = stop == HOLD ? HOLD_MS : EDGE_MS;
      const uint32_t from = millis();
      while ((uint32_t)(millis() - from) < holdMs) spins = spins + 1;
      // Back. The next update() lights a new fuse, in the same colour.
      stopShown = false;
      started = false;
      return;
    }
    // One whole frame of the colour first, so the frozen panel says it froze
    // here and which way.
    colour(true, 160, r, g, b);
    for (int y = 0; y < PANEL_RES_H; ++y) {
      for (int x = 0; x < PANEL_RES_W; ++x) PFCanvas::setPixel(x, y, r, g, b);
    }
    PFCanvas::present();
    stopShown = true;
    return;
  }
  PFCanvas::clear();
  // The fuse: full width when picked, gone when it hangs. Unarmed it stays
  // full and dim, which is how to tell a boot restore from a countdown.
  const int width = armed ? (int)((uint32_t)PANEL_RES_W * (FUSE_MS - ranMs) / FUSE_MS)
                          : PANEL_RES_W;
  colour(false, armed ? 160 : 40, r, g, b);
  for (int y = PANEL_RES_H / 2 - 4; y < PANEL_RES_H / 2 + 4; ++y) {
    for (int x = 0; x < width; ++x) PFCanvas::setPixel(x, y, r, g, b);
  }
  PFCanvas::present();
}

}  // namespace HangProbe

PF_REGISTER_PATTERN(HangProbe)
