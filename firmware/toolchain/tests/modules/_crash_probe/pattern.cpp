// Bench probe for the crash record (src/core_crash.h), not a showable
// pattern. It is a dim green field until a knob moves, and then it writes
// through a null pointer from inside draw() - one panic, on demand, at a
// known place, which is what it takes to check that /api/status afterwards
// names this module, says "draw", and gives the PC as an offset that lands in
// fall() below.
//
//   python firmware/toolchain/build_module.py --out <dir> firmware/toolchain/tests/modules/_crash_probe
//   xtensa-esp32s3-elf-nm -n <dir>/_crash_probe.pfm      # where fall() and draw() are
//
// Triggered rather than timed, on purpose. A probe that dies N seconds after
// it starts dies again after the reboot restores it, and whether that ends is
// then up to the boot latch - a second thing under test in an experiment
// about the first. This one comes back from the reboot resident and quiet,
// so the record can be read at leisure. Turn K1, K2 or K3, or from the desk:
//
//   curl -X POST "http://<panel>/api/params?d1=1"
#include "pf_module.h"

namespace CrashProbe {

const char* NAME = "Crash Probe";
const char* const KNOB_LABELS[4] = {"DIE", "DIE", "DIE", "-"};

bool armed = false;

// Read at run time so the compiler cannot see the null. A store through a
// constant null is undefined behaviour it is entitled to delete, or to
// replace with a trap of its own - and then the exception under test is not
// the one that happens.
int* volatile nowhere = nullptr;

void setup() {}

void update(float dt, const InputFrame& input) {
  (void)dt;
  for (int i = 0; i < 3; ++i) {
    if (input.knobDeltas[i] != 0) armed = true;
  }
}

// Its own frame, so the backtrace has two addresses inside the module - the
// fault here and the return into draw() - and both have to come out as
// offsets.
__attribute__((noinline)) void fall() {
  *nowhere = 1;
}

void draw() {
  PFCanvas::clear();
  for (int y = 0; y < PANEL_RES_H; ++y) {
    for (int x = 0; x < PANEL_RES_W; ++x) {
      PFCanvas::setPixel(x, y, 0, 24, 0);
    }
  }
  if (armed) fall();
  PFCanvas::present();
}

}  // namespace CrashProbe

PF_REGISTER_PATTERN(CrashProbe)
