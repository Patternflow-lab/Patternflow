// Bench probe for the module SDK's inline libm (abi/pf_libm.h), not a showable
// pattern. check_libm.py proves on a PC that floorf, ceilf, truncf, roundf,
// fminf, fmaxf and fmodf compute what libm computes - given arithmetic that
// behaves as IEEE 754 says. Whether the panel's does is the part a PC cannot
// see: that MSUB.S multiplies and subtracts with ONE rounding (fmod's
// remainder is wrong in half of all cases if it does not), that TRUNC.S and
// FLOAT.S convert exactly, that the compares treat zeros and NaN properly,
// and that __divsf3 rounds to nearest (the reciprocal the compiler folds for
// `fmodf(x, TWO_PI)` is the one the board would compute). This module runs
// the inline code and the firmware's own libm side by side, on the board,
// and compares bits.
//
//   python firmware/toolchain/build_module.py --out <dir> firmware/toolchain/tests/modules/_math_probe
//   curl -X PUT --data-binary @<dir>/_math_probe.pfm -H "X-PF-Name: _math_probe.pfm" http://<panel>/api/patterns
//   curl "http://<panel>/api/patterns/select?index=<N>"     # N: its index in GET /api/patterns
//   curl http://<panel>/api/status                           # "active": "math ok 9/9 1532k"
//
// setup() spends 1.3 s on it, by the clock - a setup past 5 s trips the
// loader's watchdog, and a call into libm is 0.2-0.8 us, so that is on the
// order of two million comparisons, not the twenty billion a PC does - and
// writes the verdict into the pattern's NAME, which the registry copies once
// setup() returns:
//
//   math ok 9/9 1532k          nine checks, 1,532,000 comparisons, all equal
//   math FAIL fmodf 1234       the first check that differed and how often
//   math FAIL fmodf 1234 +2    ... and two more checks differed as well
//
// It then keeps going, a few thousand comparisons a frame with fresh inputs:
// the panel is green while everything has matched and red from the first
// mismatch on, the bar across the top fills at eight million comparisons,
// and the serial log gets a line every few seconds with the totals and the
// first mismatches as bits.
//
// The nine: floorf ceilf truncf roundf fminf fmaxf, "fmodf" (any divisor -
// the division path - and the same pairs through the reciprocal path with
// the reciprocal divided on the board), "fmodf const" (divisors written as
// literals, so the compiler folds the reciprocal: 1, 2*pi, 360, 0.1 ...), and
// "div" (__divsf3 rounds to nearest, and gives the folded reciprocals).
#include "pf_module.h"

#include <stdio.h>

// The firmware's libm, under names the SDK has not put inline code behind.
extern "C" {
float host_floorf(float) __asm__("floorf");
float host_ceilf(float) __asm__("ceilf");
float host_truncf(float) __asm__("truncf");
float host_roundf(float) __asm__("roundf");
float host_fminf(float, float) __asm__("fminf");
float host_fmaxf(float, float) __asm__("fmaxf");
float host_fmodf(float, float) __asm__("fmodf");
}

namespace MathProbe {

char verdict[40] = "math probe (not run)";
const char* NAME = verdict;
const char* const KNOB_LABELS[4] = {"-", "-", "-", "-"};

enum Check { FLOOR, CEIL, TRUNC, ROUND, FMIN, FMAX, FMOD, FMOD_CONST, DIV, CHECKS };
const char* const CHECK_NAMES[CHECKS] = {
    "floorf", "ceilf", "truncf", "roundf", "fminf", "fmaxf", "fmodf", "fmodf const", "div",
};

uint32_t done[CHECKS];
uint32_t wrong[CHECKS];
int logged = 0;
uint32_t lastLogMs = 0;

uint32_t bitsOf(float f) {
  uint32_t u;
  memcpy(&u, &f, sizeof u);
  return u;
}

float fromBits(uint32_t u) {
  float f;
  memcpy(&f, &u, sizeof f);
  return f;
}

// xorshift32, fixed seed: every board runs the same inputs in setup().
uint32_t randomState = 0x9E3779B9u;
uint32_t randomBits() {
  uint32_t x = randomState;
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return randomState = x;
}

void same(Check check, float x, float y, float got, float want) {
  ++done[check];
  if (bitsOf(got) == bitsOf(want)) return;
  ++wrong[check];
  if (logged < 12) {
    ++logged;
    Serial.printf("[MATH] %s(%08x, %08x) inline %08x, libm %08x\n", CHECK_NAMES[check],
                  (unsigned)bitsOf(x), (unsigned)bitsOf(y), (unsigned)bitsOf(got),
                  (unsigned)bitsOf(want));
  }
}

float withExponent(int field) {
  if (field < 0) field = 0;
  if (field > 254) field = 254;
  return fromBits((randomBits() & 0x807fffffu) | ((uint32_t)field << 23));
}

int exponentOf(float f) {
  return (int)((bitsOf(f) >> 23) & 0xffu);
}

// d units in the last place away, by magnitude.
float stepped(float x, int d) {
  const uint32_t u = bitsOf(x);
  int32_t magnitude = (int32_t)(u & 0x7fffffffu) + d;
  if (magnitude < 0) magnitude = 0;
  if (magnitude > 0x7f7fffff) magnitude = 0x7f7fffff;
  return fromBits((u & 0x80000000u) | (uint32_t)magnitude);
}

const uint32_t EDGES[] = {
    0x00000000u, 0x80000000u, 0x00000001u, 0x80000001u, 0x007fffffu, 0x00800000u,
    0x3effffffu, 0x3f000000u, 0xbf000000u, 0x3f000001u, 0x3f7fffffu, 0xbf7fffffu,
    0x3f800000u, 0xbf800000u, 0x3f800001u, 0x3fc00000u, 0xbfc00000u, 0x40200000u,
    0xc0200000u, 0x4a800000u, 0x4affffffu, 0xcaffffffu, 0x4b000000u, 0xcb000000u,
    0x4b000001u, 0x4b800000u, 0x4f000000u, 0xcf000000u, 0x7f7fffffu, 0xff7fffffu,
    0x7f800000u, 0xff800000u, 0x7fc00000u, 0xffc00000u, 0x7f800001u, 0x7fffffffu,
};
const int EDGE_COUNT = (int)(sizeof EDGES / sizeof EDGES[0]);

// What a pattern feeds these functions, and what breaks an implementation.
float anyInput() {
  const uint32_t r = randomBits();
  switch (r & 7u) {
    case 0:  // any bit pattern: huge, tiny, NaN, infinity
      return fromBits(randomBits());
    case 1:  // a whole number and the floats beside it
      return stepped((float)((int)(randomBits() >> 9) - (1 << 22)), (int)((r >> 3) % 5u) - 2);
    case 2:  // n + 0.5 and the floats beside it: where round() decides
      return stepped((float)((int)(randomBits() >> 10) - (1 << 21)) + 0.5f,
                     (int)((r >> 3) % 5u) - 2);
    case 3:  // around 2^23, where the inline range ends
      return withExponent(148 + (int)((r >> 3) % 5u));
    case 4:  // under 4: fractions, and the zero results whose sign matters
      return withExponent(110 + (int)((r >> 3) % 19u));
    default:  // 2^-23 .. 2^24, all of pixel arithmetic
      return withExponent(104 + (int)((r >> 3) % 48u));
  }
}

void unary(float x) {
  same(FLOOR, x, 0.0f, floorf(x), host_floorf(x));
  same(CEIL, x, 0.0f, ceilf(x), host_ceilf(x));
  same(TRUNC, x, 0.0f, truncf(x), host_truncf(x));
  same(ROUND, x, 0.0f, roundf(x), host_roundf(x));
}

void minMax(float x, float y) {
  same(FMIN, x, y, fminf(x, y), host_fminf(x, y));
  same(FMAX, x, y, fmaxf(x, y), host_fmaxf(x, y));
}

void minMaxInput() {
  const float x = anyInput();
  const uint32_t r = randomBits();
  switch (r & 7u) {
    case 0: minMax(x, x); break;
    case 1: minMax(x, -x); break;
    case 2: minMax(x, stepped(x, 1)); break;
    case 3: minMax(stepped(x, 1), x); break;
    case 4: minMax(x, fromBits(EDGES[(r >> 3) % (uint32_t)EDGE_COUNT])); break;
    case 5: minMax(fromBits(EDGES[(r >> 3) % (uint32_t)EDGE_COUNT]), x); break;
    default: minMax(x, anyInput()); break;
  }
}

// A multiplier for "x is k times y": anywhere in the fast path, small, or on
// the boundaries the proof turns on.
uint32_t multiplier() {
  static const uint32_t BOUNDARY[] = {
      1u, 2u, 3u, 255u, 65536u, (1u << 22) - 2, (1u << 22) - 1, (1u << 22),
      (1u << 22) + 1, (1u << 23) - 1, (1u << 23), (1u << 24) - 1,
  };
  const uint32_t r = randomBits();
  switch (r & 3u) {
    case 0: return 1u + (randomBits() >> 10);                   // up to 2^22
    case 1: return 1u + (randomBits() >> (10 + (r >> 2) % 22u));  // small
    case 2: return 1u + (randomBits() >> 8);                    // up to 2^24, past the limit
    default: return BOUNDARY[(r >> 2) % (uint32_t)(sizeof BOUNDARY / sizeof BOUNDARY[0])];
  }
}

void mod(float x, float y) {
  const float want = host_fmodf(x, y);
  same(FMOD, x, y, fmodf(x, y), want);  // y is not a constant here: the division path
  same(FMOD, x, y, PFLibm::fmodRecip(x, y, 1.0f / fabsf(y)), want);
}

void modInput() {
  const uint32_t r = randomBits();
  if ((r & 3u) == 0) {  // any divisor at all, quotients from under 1 to 2^25
    const float y = withExponent((int)((r >> 2) % 255u));
    mod(withExponent(exponentOf(y) - 1 + (int)((r >> 10) % 27u)), y);
    return;
  }
  // x = k*y and its neighbours, for a y a pattern might hold.
  const float y = withExponent(100 + (int)((r >> 2) % 40u));
  mod(stepped((float)multiplier() * y, (int)((r >> 10) % 9u) - 4), y);
}

// A divisor written as a literal: the shadow sees a constant and multiplies by
// a reciprocal the compiler folded (and, for 1.0f, takes the fraction).
#define PROBE_LITERAL(C)                                                        \
  do {                                                                          \
    const uint32_t r = randomBits();                                            \
    float x = stepped((float)multiplier() * (C), (int)((r >> 2) % 9u) - 4);     \
    if ((r & 3u) == 0) x = withExponent(exponentOf(C) - 2 + (int)((r >> 6) % 27u)); \
    if ((r & 0x100u) != 0) x = -x;                                              \
    same(FMOD_CONST, x, (C), fmodf(x, (C)), host_fmodf(x, (C)));                \
    same(FMOD_CONST, x, -(C), fmodf(x, -(C)), host_fmodf(x, -(C)));             \
  } while (0)

void modLiterals() {
  PROBE_LITERAL(1.0f);
  PROBE_LITERAL(6.2831853f);
  PROBE_LITERAL(3.14159265f);
  PROBE_LITERAL(360.0f);
  PROBE_LITERAL(0.1f);
  PROBE_LITERAL(2.0f);
  PROBE_LITERAL(255.0f);
  PROBE_LITERAL(0.001f);
}

// The folded reciprocal is the one this board's divider gives.
#define PROBE_RECIPROCAL(C)                                    \
  do {                                                         \
    volatile float one = 1.0f, divisor = (C);                  \
    same(DIV, 1.0f, (C), one / divisor, 1.0f / (C));           \
  } while (0)

void reciprocals() {
  PROBE_RECIPROCAL(6.2831853f);
  PROBE_RECIPROCAL(3.14159265f);
  PROBE_RECIPROCAL(360.0f);
  PROBE_RECIPROCAL(0.1f);
  PROBE_RECIPROCAL(255.0f);
  PROBE_RECIPROCAL(0.001f);
}

// q = a / b is the nearest float to the quotient exactly when neither float
// beside it leaves a smaller remainder a - q*b. The remainders are taken
// fused; rounding them cannot reorder them.
void division() {
  volatile float a = withExponent(100 + (int)(randomBits() % 50u));
  volatile float b = withExponent(100 + (int)(randomBits() % 50u));
  const float x = a, y = b;
  const float q = a / b;
  const float here = fabsf(PFLibm::fnma(q, y, x));
  const float above = fabsf(PFLibm::fnma(stepped(q, 1), y, x));
  const float below = fabsf(PFLibm::fnma(stepped(q, -1), y, x));
  ++done[DIV];
  if (here <= above && here <= below) return;
  ++wrong[DIV];
  if (logged < 12) {
    ++logged;
    Serial.printf("[MATH] div %08x / %08x gave %08x, not the nearest float\n",
                  (unsigned)bitsOf(x), (unsigned)bitsOf(y), (unsigned)bitsOf(q));
  }
}

// Run `body` in batches until `ms` have passed.
template <class Body>
void spend(uint32_t ms, Body body) {
  const uint32_t start = millis();
  do {
    for (int i = 0; i < 32; ++i) body();
  } while (millis() - start < ms);
}

void run(uint32_t unaryMs, uint32_t minMaxMs, uint32_t modMs, uint32_t literalMs,
         uint32_t divisionMs) {
  spend(unaryMs, [] { unary(anyInput()); });
  spend(minMaxMs, minMaxInput);
  spend(modMs, modInput);
  spend(literalMs, modLiterals);
  spend(divisionMs, division);
}

uint32_t total(const uint32_t* counts) {
  uint32_t sum = 0;
  for (int c = 0; c < CHECKS; ++c) sum += counts[c];
  return sum;
}

void writeVerdict() {
  int failed = 0, first = -1;
  for (int c = 0; c < CHECKS; ++c) {
    if (!wrong[c]) continue;
    if (first < 0) first = c;
    ++failed;
  }
  if (first < 0) {
    snprintf(verdict, sizeof verdict, "math ok %d/%d %uk", (int)CHECKS, (int)CHECKS,
             (unsigned)(total(done) / 1000u));
  } else if (failed == 1) {
    snprintf(verdict, sizeof verdict, "math FAIL %s %u", CHECK_NAMES[first],
             (unsigned)wrong[first]);
  } else {
    snprintf(verdict, sizeof verdict, "math FAIL %s %u +%d", CHECK_NAMES[first],
             (unsigned)wrong[first], failed - 1);
  }
}

void logTotals() {
  Serial.printf("[MATH] %s - %u comparisons, %u differ\n", verdict, (unsigned)total(done),
                (unsigned)total(wrong));
  for (int c = 0; c < CHECKS; ++c) {
    Serial.printf("[MATH]   %-11s %8u  differ %u\n", CHECK_NAMES[c], (unsigned)done[c],
                  (unsigned)wrong[c]);
  }
}

void setup() {
  for (int i = 0; i < EDGE_COUNT; ++i) {
    const float x = fromBits(EDGES[i]);
    unary(x);
    for (int j = 0; j < EDGE_COUNT; ++j) {
      const float y = fromBits(EDGES[j]);
      minMax(x, y);
      mod(x, y);
    }
  }
  reciprocals();
  run(450, 200, 350, 250, 80);
  writeVerdict();
  logTotals();
  lastLogMs = millis();
}

void update(float dt, const InputFrame& input) {
  (void)dt;
  (void)input;
}

void draw() {
  // The inputs carry on from where setup() left the generator. NAME is not
  // rewritten here: the registry took its copy when setup() returned, and a
  // name that changed afterwards would only be seen by half the readers.
  run(2, 1, 2, 2, 1);
  const bool ok = total(wrong) == 0;
  const uint32_t comparisons = total(done);
  const int bar = comparisons >= (8u << 20) ? PANEL_RES_W : (int)(comparisons >> 16);
  for (int y = 0; y < PANEL_RES_H; ++y) {
    for (int x = 0; x < PANEL_RES_W; ++x) {
      const bool lit = y < 4 && x < bar;
      const uint8_t level = lit ? 200 : 40;
      PFCanvas::setPixel(x, y, ok ? 0 : level, ok ? level : 0, 0);
    }
  }
  PFCanvas::present();
  if (millis() - lastLogMs >= 5000) {
    lastLogMs = millis();
    Serial.printf("[MATH] %s so far: %u comparisons, %u differ\n", ok ? "ok" : "FAIL",
                  (unsigned)comparisons, (unsigned)total(wrong));
  }
}

}  // namespace MathProbe

PF_REGISTER_PATTERN(MathProbe)
