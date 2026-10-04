// Proves that abi/pf_libm.h returns what libm returns - as bits, not as
// values within a tolerance.
//
// WHY THIS EXISTS. pf_module.h puts the functions in pf_libm.h behind floorf,
// ceilf, truncf, roundf, fminf, fmaxf and fmodf in every .pfm built from now
// on, so that a pattern nobody edits gets inline FPU code where it used to get
// a call into the firmware's libm. The claim that makes that acceptable is
// that each of the seven returns exactly what the library function returns.
// An approximation would be measured in bands (toolchain/check_math.py does
// that for core_math.h); this is not one, so the test is equality of bit
// patterns and any single mismatch fails.
//
// WHAT IT RUNS. The reference is this machine's libm: floorf, fmodf and the
// rest, called as functions - check_libm.py passes -fno-builtin-<name> for each,
// because left alone GCC answers some of them itself on a PC, and its inline
// floor does not quiet a signalling NaN the way glibc's function does.
// pf_libm.h handles inline only inputs whose answer IEEE 754 fixes, and hands
// the rest to libm - so on any machine with a correct libm the two must agree
// everywhere, NaN payloads and signed zeros included, and no NaN is ever
// "treated as equal to any NaN" here: where a NaN comes back it came from the
// same libm call on both sides.
//
//   floor, ceil, trunc, round   every one of the 2^32 float bit patterns.
//   fmin, fmax                  every pair of a set of edge values, random bit
//                               patterns, and for a stride through all floats
//                               x against itself, its neighbour and its
//                               negation - the ties are where the care is.
//   fmod                        the path a variable divisor takes (a division)
//                               AND the path a constant divisor takes (the
//                               reciprocal, instantiated explicitly: the test
//                               passes 1.0f / |y|, which is what the compiler
//                               folds), on the same pairs: edge values,
//                               random bits, quotients spread from under 1 to
//                               past the fast path's 2^22 limit, x = k*y +- 0..4
//                               ulp for k up to 2^24, the divisors patterns
//                               actually write (1, 2*pi, 360, 0.1 ...), divisors
//                               so large their reciprocal is subnormal and so
//                               small it overflows. fmodOne - the y = +-1 path -
//                               over every float in [1, 2^23), both signs.
//
// The run also counts which way each fmod went (returned x, no correction,
// stepped down, stepped up, library), because a correction branch that no
// input reaches is a branch this file has not tested.
//
// WHAT IT CANNOT RUN. The module-only half of the header - the bodies behind
// the C names and the choice between fmod's paths exist only under the Xtensa
// compiler; check_module_libm.py builds a module and reads them out of it. And
// the panel's arithmetic: that the S3's MSUB.S is fused and its conversions
// round as IEEE says. tests/modules/_math_probe checks those on a board,
// against the firmware's own libm.
//
// License: MIT
#include "pf_libm.h"

#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <thread>
#include <vector>

namespace {

uint32_t bitsOf(float f) {
  uint32_t u;
  std::memcpy(&u, &f, sizeof u);
  return u;
}

float fromBits(uint32_t u) {
  float f;
  std::memcpy(&f, &u, sizeof f);
  return f;
}

// SplitMix64: every block of work seeds its own, from its own index, so the
// inputs are the same whatever number of threads happens to run them.
struct Random {
  uint64_t state;
  explicit Random(uint64_t seed) : state(seed * 0x9E3779B97F4A7C15ull + 0x1234567ull) {}
  uint64_t next() {
    uint64_t z = (state += 0x9E3779B97F4A7C15ull);
    z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9ull;
    z = (z ^ (z >> 27)) * 0x94D049BB133111EBull;
    return z ^ (z >> 31);
  }
  uint32_t bits() { return (uint32_t)(next() >> 32); }
  uint32_t below(uint32_t n) { return (uint32_t)((next() >> 32) * (uint64_t)n >> 32); }
};

enum Route { EARLY, PLAIN, DOWN, UP, LIBRARY, ROUTES };

struct Miss {
  const char* what;
  uint32_t x, y, got, want;
};

struct Tally {
  uint64_t checked = 0;
  uint64_t wrong = 0;
  uint64_t inlined = 0;            // unary / min-max inputs the library never saw
  uint64_t divided[ROUTES] = {};   // fmod with a division
  uint64_t multiplied[ROUTES] = {};  // fmod with a reciprocal
  Miss first[6] = {};
  int misses = 0;

  void same(const char* what, float x, float y, float got, float want) {
    ++checked;
    if (bitsOf(got) == bitsOf(want)) return;
    ++wrong;
    if (misses < (int)(sizeof first / sizeof first[0]))
      first[misses++] = Miss{what, bitsOf(x), bitsOf(y), bitsOf(got), bitsOf(want)};
  }

  void merge(const Tally& other) {
    checked += other.checked;
    wrong += other.wrong;
    inlined += other.inlined;
    for (int r = 0; r < ROUTES; ++r) {
      divided[r] += other.divided[r];
      multiplied[r] += other.multiplied[r];
    }
    for (int i = 0; i < other.misses && misses < (int)(sizeof first / sizeof first[0]); ++i)
      first[misses++] = other.first[i];
  }
};

template <class Work>
Tally inParallel(uint64_t blocks, Work work) {
  unsigned count = std::thread::hardware_concurrency();
  if (count == 0) count = 1;
  if (count > 32) count = 32;
  std::atomic<uint64_t> next{0};
  std::vector<Tally> tallies(count);
  std::vector<std::thread> threads;
  for (unsigned t = 0; t < count; ++t) {
    threads.emplace_back([&next, &tallies, &work, blocks, t] {
      Tally mine;  // on this thread's stack: no cache line shared with a neighbour
      for (;;) {
        const uint64_t block = next.fetch_add(1);
        if (block >= blocks) break;
        work(block, mine);
      }
      tallies[t] = mine;
    });
  }
  for (auto& thread : threads) thread.join();
  Tally total;
  for (const Tally& tally : tallies) total.merge(tally);
  return total;
}

int failures = 0;

void report(const char* title, const Tally& tally) {
  std::printf("%-28s %14llu checks, %llu mismatches\n", title,
              (unsigned long long)tally.checked, (unsigned long long)tally.wrong);
  for (int i = 0; i < tally.misses; ++i) {
    const Miss& m = tally.first[i];
    std::printf("    %s(%08x, %08x) = %08x, libm says %08x\n", m.what, m.x, m.y, m.got, m.want);
  }
  if (tally.wrong) ++failures;
}

void require(bool ok, const char* what) {
  if (ok) return;
  std::printf("    NOT COVERED: %s\n", what);
  ++failures;
}

// ── Values every list of floats should contain ──────────────────────
const uint32_t EDGES[] = {
    0x00000000u, 0x80000000u,  // +-0
    0x00000001u, 0x80000001u,  // smallest subnormal
    0x00000002u, 0x00000003u, 0x00400000u, 0x80400000u,
    0x007fffffu, 0x807fffffu,  // largest subnormal
    0x00800000u, 0x80800000u,  // smallest normal
    0x00800001u, 0x00ffffffu, 0x01000000u,
    0x3e800000u, 0x3effffffu, 0x3f000000u, 0xbf000000u,  // 0.25, just under 0.5, +-0.5
    0x3f000001u, 0x3f7fffffu, 0xbf7fffffu,               // just over 0.5, just under 1
    0x3f800000u, 0xbf800000u, 0x3f800001u, 0xbf800001u,  // +-1 and a bit
    0x3fc00000u, 0xbfc00000u, 0x40000000u, 0xc0000000u,  // +-1.5, +-2
    0x40200000u, 0xc0200000u, 0x40490fdbu, 0x40c90fdbu,  // +-2.5, pi, 2*pi
    0x43b40000u, 0x3dcccccdu, 0x3a83126fu,               // 360, 0.1, 0.001
    0x4a7ffffcu, 0x4a7ffffeu, 0x4a800000u, 0xca800000u,  // around 2^22
    0x4a800002u, 0x4afffffeu, 0x4affffffu, 0xcaffffffu,  // ... and under 2^23
    0x4b000000u, 0xcb000000u, 0x4b000001u, 0xcb000001u,  // 2^23 and a bit
    0x4b7fffffu, 0x4b800000u, 0xcb800000u, 0x4b800001u,  // around 2^24
    0x4f000000u, 0xcf000000u, 0x4effffffu, 0x4f800000u,  // 2^31, just under, 2^32
    0x5f000000u, 0x7e800000u, 0x7effffffu, 0x7f000000u,  // 2^63, 2^126, 2^127
    0x7f7fffffu, 0xff7fffffu,  // +-FLT_MAX
    0x7f800000u, 0xff800000u,  // +-inf
    0x7fc00000u, 0xffc00000u,  // quiet NaN, both signs
    0x7f800001u, 0xff800001u,  // signalling NaN
    0x7fa00000u, 0x7fffffffu, 0xffffffffu, 0x7fc12345u,  // payloads
};
const int EDGE_COUNT = (int)(sizeof EDGES / sizeof EDGES[0]);

// A float with every exponent equally likely - random bits already are, but
// this one can be steered.
float anyExponent(Random& random, int exponentField) {
  if (exponentField < 0) exponentField = 0;
  if (exponentField > 254) exponentField = 254;
  return fromBits((random.bits() & 0x807fffffu) | ((uint32_t)exponentField << 23));
}

int exponentFieldOf(float f) {
  return (int)((bitsOf(f) >> 23) & 0xffu);
}

// d units in the last place away, by magnitude; never past zero or FLT_MAX.
float stepped(float x, int d) {
  const uint32_t u = bitsOf(x);
  int64_t magnitude = (int64_t)(u & 0x7fffffffu) + d;
  if (magnitude < 0) magnitude = 0;
  if (magnitude > 0x7f7fffff) magnitude = 0x7f7fffff;
  return fromBits((u & 0x80000000u) | (uint32_t)magnitude);
}

// ── floor, ceil, trunc, round: every float ──────────────────────────
const uint64_t UNARY_BLOCKS = 4096;  // of 2^20 bit patterns each

void unaryBlock(uint64_t block, Tally& tally) {
  const uint32_t base = (uint32_t)(block << 20);
  for (uint32_t i = 0; i < (1u << 20); ++i) {
    const float x = fromBits(base + i);
    tally.same("floor", x, 0.0f, PFLibm::floor(x), ::floorf(x));
    tally.same("ceil", x, 0.0f, PFLibm::ceil(x), ::ceilf(x));
    tally.same("trunc", x, 0.0f, PFLibm::trunc(x), ::truncf(x));
    tally.same("round", x, 0.0f, PFLibm::round(x), ::roundf(x));
    if (std::fabs(x) < PFLibm::WHOLE_FROM) ++tally.inlined;
  }
}

// ── fmin, fmax ──────────────────────────────────────────────────────
void minMax(float x, float y, Tally& tally) {
  tally.same("fmin", x, y, PFLibm::fmin(x, y), ::fminf(x, y));
  tally.same("fmax", x, y, PFLibm::fmax(x, y), ::fmaxf(x, y));
  // What the header's last test decides: equal values with the same sign bit.
  if (x < y || y < x || (x == y && std::signbit(x) == std::signbit(y))) ++tally.inlined;
}

void minMaxEdges(uint64_t, Tally& tally) {
  for (int i = 0; i < EDGE_COUNT; ++i)
    for (int j = 0; j < EDGE_COUNT; ++j) minMax(fromBits(EDGES[i]), fromBits(EDGES[j]), tally);
}

const uint64_t MINMAX_RANDOM_BLOCKS = 64;  // of 2^20 pairs
void minMaxRandomBlock(uint64_t block, Tally& tally) {
  Random random(0x100000 + block);
  for (uint32_t i = 0; i < (1u << 20); ++i) minMax(fromBits(random.bits()), fromBits(random.bits()), tally);
}

const uint64_t MINMAX_NEAR_BLOCKS = 256;  // each a 2^24 slice of the float line, every 61st
void minMaxNearBlock(uint64_t block, Tally& tally) {
  const uint32_t base = (uint32_t)(block << 24);
  for (uint32_t i = (uint32_t)(block % 61); i < (1u << 24); i += 61) {
    const float x = fromBits(base + i);
    minMax(x, x, tally);
    minMax(x, fromBits(base + i + 1), tally);
    minMax(fromBits(base + i + 1), x, tally);
    minMax(x, -x, tally);
    minMax(-x, x, tally);
  }
}

// ── fmod ────────────────────────────────────────────────────────────
// Which branch fmodFrom() takes for this estimate of the quotient. It repeats
// the header's conditions on purpose: this is bookkeeping about coverage, and
// the answers themselves are compared separately, against libm.
Route routeOf(float ax, float ay, float p) {
  if (ax < ay) return EARLY;
  if (!(p < PFLibm::FMOD_QUOTIENT_BELOW)) return LIBRARY;
  const float q = (float)(int)p;
  const float r = PFLibm::fnma(q, ay, ax);
  if (r < 0.0f) return DOWN;
  if (r >= ay) return UP;
  return PLAIN;
}

void mod(float x, float y, Tally& tally) {
  const float want = ::fmodf(x, y);
  const float ax = std::fabs(x);
  const float ay = std::fabs(y);
  const float reciprocal = 1.0f / ay;  // rounded to nearest: what a compiler folds
  tally.same("fmod", x, y, PFLibm::fmod(x, y), want);
  tally.same("fmodRecip", x, y, PFLibm::fmodRecip(x, y, reciprocal), want);
  ++tally.divided[routeOf(ax, ay, ax / ay)];
  ++tally.multiplied[routeOf(ax, ay, ax * reciprocal)];
  if (ay == 1.0f) tally.same("fmodOne", x, y, PFLibm::fmodOne(x, y), want);
}

void modAllSigns(float x, float y, Tally& tally) {
  mod(x, y, tally);
  mod(-x, y, tally);
  mod(x, -y, tally);
  mod(-x, -y, tally);
}

void modEdges(uint64_t, Tally& tally) {
  for (int i = 0; i < EDGE_COUNT; ++i)
    for (int j = 0; j < EDGE_COUNT; ++j) mod(fromBits(EDGES[i]), fromBits(EDGES[j]), tally);
}

// Random bit patterns: mostly |x| < |y| or a quotient far past the limit, so
// mostly a test that those are routed to "return x" and to the library.
const uint64_t MOD_RANDOM_BLOCKS = 16;  // of 2^20 pairs
void modRandomBlock(uint64_t block, Tally& tally) {
  Random random(0x200000 + block);
  for (uint32_t i = 0; i < (1u << 20); ++i) mod(fromBits(random.bits()), fromBits(random.bits()), tally);
}

// Any divisor at all - subnormal to FLT_MAX - and a dividend whose exponent is
// -1 to +25 above it: quotients from under one, through the whole fast path,
// to eight times its limit.
const uint64_t MOD_SPREAD_BLOCKS = 192;  // of 2^20 pairs
void modSpreadBlock(uint64_t block, Tally& tally) {
  Random random(0x300000 + block);
  for (uint32_t i = 0; i < (1u << 20); ++i) {
    const float y = anyExponent(random, (int)random.below(255));
    const float x = anyExponent(random, exponentFieldOf(y) - 1 + (int)random.below(27));
    mod(x, y, tally);
  }
}

// The divisors patterns write.
const float DIVISORS[] = {
    1.0f,        2.0f,     3.0f,          0.5f,        0.25f,   1.5f,       0.1f,
    0.01f,       0.001f,   1e-6f,         3.14159265f, 6.2831853f, 1.57079633f, 2.71828183f,
    360.0f,      180.0f,   255.0f,        256.0f,      100.0f,  1000.0f,    10.0f,
    6.0f,        60.0f,    64.0f,         128.0f,      0.33333334f, 1e6f,   7.0f,
};
const int DIVISOR_COUNT = (int)(sizeof DIVISORS / sizeof DIVISORS[0]);

// x = k*y, and the four floats either side of it. k is drawn three ways:
// anywhere up to 2^24, small, and on the boundaries the proof turns on.
uint32_t multiple(Random& random) {
  static const uint32_t BOUNDARY[] = {
      1u, 2u, 3u, 4u, 5u, 7u, 255u, 256u, 65535u, 65536u,
      (1u << 22) - 3, (1u << 22) - 2, (1u << 22) - 1, (1u << 22), (1u << 22) + 1, (1u << 22) + 2,
      (1u << 23) - 2, (1u << 23) - 1, (1u << 23), (1u << 23) + 1, (1u << 24) - 1, (1u << 24),
  };
  switch (random.below(4)) {
    case 0: return 1u + random.below(1u << 24);
    case 1: return 1u + random.below(1u << 22);  // all of it inside the fast path
    case 2: return 1u + random.below(1u << (1 + random.below(22)));
    default: return BOUNDARY[random.below((uint32_t)(sizeof BOUNDARY / sizeof BOUNDARY[0]))];
  }
}

void nearMultiples(Random& random, float y, uint32_t count, Tally& tally) {
  for (uint32_t i = 0; i < count; ++i) {
    const double product = (double)multiple(random) * (double)y;
    if (!(product < 3.0e38)) continue;
    const float x = (float)product;
    for (int d = -4; d <= 4; ++d) {
      const float beside = stepped(x, d);
      if (random.below(8) == 0) modAllSigns(beside, y, tally);
      else mod(beside, y, tally);
    }
  }
}

const uint64_t MOD_CONSTANT_BLOCKS = (uint64_t)DIVISOR_COUNT * 4;
void modConstantBlock(uint64_t block, Tally& tally) {
  Random random(0x400000 + block);
  nearMultiples(random, DIVISORS[block % DIVISOR_COUNT], 60000, tally);
}

const uint64_t MOD_MULTIPLE_BLOCKS = 96;
void modMultipleBlock(uint64_t block, Tally& tally) {
  Random random(0x500000 + block);
  for (int i = 0; i < 6000; ++i) {
    // Exponents -40..+40: k*y stays finite and x keeps all its bits.
    const float y = anyExponent(random, 87 + (int)random.below(81));
    nearMultiples(random, y, 10, tally);
  }
}

// Every 67th float from y/4 up to y * 2^24, for each written divisor.
const uint64_t MOD_SWEEP_BLOCKS = (uint64_t)DIVISOR_COUNT;
void modSweepBlock(uint64_t block, Tally& tally) {
  const float y = DIVISORS[block];
  const uint32_t from = bitsOf(y * 0.25f);
  const uint32_t to = bitsOf(y * 16777216.0f);
  for (uint32_t u = from + (uint32_t)(block % 67); u < to; u += 67) {
    const float x = fromBits(u);
    if ((u & 0x100u) != 0) mod(-x, y, tally);
    else mod(x, y, tally);
  }
}

// Divisors at the two ends of the range. From 2^126 up, 1/y is subnormal and
// its error is absolute, not relative; below 2^-128 it overflows to infinity.
const uint64_t MOD_EXTREME_BLOCKS = 16;  // of 2^20 pairs
void modExtremeBlock(uint64_t block, Tally& tally) {
  Random random(0x600000 + block);
  for (uint32_t i = 0; i < (1u << 20); ++i) {
    const bool huge = (i & 1u) != 0;
    const float y = anyExponent(random, huge ? 251 + (int)random.below(4) : (int)random.below(4));
    const float x = anyExponent(random, exponentFieldOf(y) + (int)random.below(huge ? 4 : 26));
    mod(x, y, tally);
  }
}

// fmod(x, +-1): every float in [1, 2^23), both signs and both divisors, which
// is all of what fmodOne computes itself; under 1 it returns x, past 2^23 it
// asks the library, and a stride through each is enough to see that it does.
const uint64_t MOD_ONE_BLOCKS = 23 * 8 + 128 + 16;
void modOneBlock(uint64_t block, Tally& tally) {
  uint32_t from, to, step;
  if (block < 23 * 8) {  // [1, 2^23): 23 binades, each in eight slices
    from = 0x3f800000u + (uint32_t)block * (1u << 20);
    to = from + (1u << 20);
    step = 1;
  } else if (block < 23 * 8 + 128) {  // [0, 1), every 16th
    from = (uint32_t)(block - 23 * 8) * (0x3f800000u / 128);
    to = from + 0x3f800000u / 128;
    step = 16;
  } else {  // 2^23 and up, infinities and NaN included, every 4099th
    from = 0x4b000000u + (uint32_t)(block - 23 * 8 - 128) * (0x35000000u / 16);
    to = from + 0x35000000u / 16;
    step = 4099;
  }
  for (uint32_t u = from; u < to; u += step) {
    const float x = fromBits(u);
    for (int sign = 0; sign < 4; ++sign) {
      const float sx = (sign & 1) ? -x : x;
      const float sy = (sign & 2) ? -1.0f : 1.0f;
      tally.same("fmodOne", sx, sy, PFLibm::fmodOne(sx, sy), ::fmodf(sx, sy));
    }
    // The general paths on the same input now and then: a divisor of one is
    // also just a divisor.
    if ((u & 0x3fu) == 0) mod(x, 1.0f, tally);
  }
}

void routes(const char* title, const uint64_t* count) {
  std::printf("    %-22s returned x %llu, exact at once %llu, stepped down %llu, "
              "stepped up %llu, library %llu\n",
              title, (unsigned long long)count[EARLY], (unsigned long long)count[PLAIN],
              (unsigned long long)count[DOWN], (unsigned long long)count[UP],
              (unsigned long long)count[LIBRARY]);
}

}  // namespace

int main() {
  // Unary: all of them.
  const Tally unary = inParallel(UNARY_BLOCKS, unaryBlock);
  report("floor ceil trunc round", unary);
  std::printf("    every float bit pattern through each; %llu of 4294967296 inputs inline, "
              "the rest (2^23 and up, inf, NaN) the library's\n",
              (unsigned long long)unary.inlined);
  require(unary.checked == 4ull * 4294967296ull, "not every float was run");
  require(unary.inlined == 2ull * 150ull * 8388608ull, "the inline range is not |x| < 2^23");

  Tally minmax = inParallel(1, minMaxEdges);
  minmax.merge(inParallel(MINMAX_RANDOM_BLOCKS, minMaxRandomBlock));
  minmax.merge(inParallel(MINMAX_NEAR_BLOCKS, minMaxNearBlock));
  report("fmin fmax", minmax);
  std::printf("    %llu pairs; %llu settled inline, %llu (a NaN, or +0 against -0) by the library\n",
              (unsigned long long)(minmax.checked / 2), (unsigned long long)minmax.inlined,
              (unsigned long long)(minmax.checked / 2 - minmax.inlined));
  require(minmax.checked / 2 > minmax.inlined, "no pair reached the library");

  Tally fmod = inParallel(1, modEdges);
  fmod.merge(inParallel(MOD_RANDOM_BLOCKS, modRandomBlock));
  fmod.merge(inParallel(MOD_SPREAD_BLOCKS, modSpreadBlock));
  fmod.merge(inParallel(MOD_CONSTANT_BLOCKS, modConstantBlock));
  fmod.merge(inParallel(MOD_MULTIPLE_BLOCKS, modMultipleBlock));
  fmod.merge(inParallel(MOD_SWEEP_BLOCKS, modSweepBlock));
  fmod.merge(inParallel(MOD_EXTREME_BLOCKS, modExtremeBlock));
  report("fmod (both paths)", fmod);
  uint64_t pairs = 0;
  for (int r = 0; r < ROUTES; ++r) pairs += fmod.divided[r];
  std::printf("    %llu pairs, each through the division path and the reciprocal path\n",
              (unsigned long long)pairs);
  routes("division:", fmod.divided);
  routes("reciprocal:", fmod.multiplied);
  for (int r = 0; r < ROUTES; ++r) {
    // A correctly rounded quotient is never under the true one by a whole
    // step, so the division path has no reason to step up; the branch is
    // there for a divider that rounds less well than this machine's.
    if (r != UP) require(fmod.divided[r] > 1000, "a branch of the division path saw under 1000 pairs");
    require(fmod.multiplied[r] > 1000, "a branch of the reciprocal path saw under 1000 pairs");
  }

  const Tally one = inParallel(MOD_ONE_BLOCKS, modOneBlock);
  report("fmod by +-1", one);

  if (failures) {
    std::printf("pf_libm.h does NOT match libm\n");
    return 1;
  }
  std::printf("pf_libm.h exact: %llu comparisons, bit for bit\n",
              (unsigned long long)(unary.checked + minmax.checked + fmod.checked + one.checked));
  return 0;
}
