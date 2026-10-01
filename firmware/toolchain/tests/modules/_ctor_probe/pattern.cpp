// Build-time probe for the loader's .init_array support, not a showable
// pattern. Every stock preset is POD and links an empty .init_array, so
// nothing in the normal catalog exercises runInitArray(); this module exists
// so that path has at least one case that fails loudly when it regresses.
//
//   python firmware/toolchain/build_module.py firmware/toolchain/tests/modules/_ctor_probe
//   xtensa-esp32s3-elf-readelf -S .../_ctor_probe.pfm   # expect .init_array
//
// On device it draws a red vertical ramp when the constructor ran and stays
// black when it did not. The ramp turns yellow when the constructor could also
// reach the host: it allocates and logs, which is what a community pattern's
// namespace-scope initialiser does (`float* trail = PFMem::allocFloats(n);`).
// Constructors once ran before the module had its host API pointer, and this
// probe then took the board down at load instead of drawing anything; the log
// line below is how a bench reads the result without looking at the panel.
#include "pf_module.h"

namespace CtorProbe {

const char* NAME = "Ctor Probe";
const char* const KNOB_LABELS[4] = {"-", "-", "-", "-"};

// volatile so the initialisation cannot be constant-folded into .data — that
// is what forces GCC to emit a dynamic initialiser, which is the thing under
// test.
volatile int probeSeed = 4;

struct Probe {
  uint8_t ramp[PANEL_RES_H];
  bool ready;
  float* fromHost;

  Probe() {
    for (int y = 0; y < PANEL_RES_H; ++y) {
      ramp[y] = (uint8_t)((y * probeSeed) & 0xff);
    }
    fromHost = PFMem::allocFloats(PANEL_RES_H);
    Serial.printf("[CTOR] constructor ran, host alloc %s\n", fromHost ? "ok" : "refused");
    ready = true;
  }
};

Probe probe;

void setup() {}

void update(float dt, const InputFrame& input) {
  (void)dt;
  (void)input;
}

void draw() {
  PFCanvas::clear();
  if (probe.ready) {
    for (int y = 0; y < PANEL_RES_H; ++y) {
      for (int x = 0; x < PANEL_RES_W; ++x) {
        PFCanvas::setPixel(x, y, probe.ramp[y], probe.fromHost ? probe.ramp[y] : 0, 0);
      }
    }
  }
  PFCanvas::present();
}

}  // namespace CtorProbe

PF_REGISTER_PATTERN(CtorProbe)
