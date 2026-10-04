// ═══ PINNED WITH THE ABI ═══ Not a layout - but every .pfm built after an
// edit here computes with the edited code, so it changes the way the contract
// does: on purpose, with firmware/toolchain/check_libm.py and
// check_module_libm.py passing, and with abi.sums refreshed in the same commit
// (check_abi_freeze.py --update; it keeps the notes in that file).
// Patternflow module SDK — floorf, ceilf, truncf, roundf, fminf, fmaxf and
// fmodf as inline FPU code that returns what the C library returns, bit for bit.
//
// Why. A module links no libm: those names are imports the loader resolves
// against the firmware's copy, so each use is a windowed call into a generic C
// routine. Per call through a module, measured on a board 2026-10-04: floorf
// 251 ns, ceilf 273, roundf 185, fminf and fmaxf 611 for the pair, fmodf
// 700-840 (truncf was not timed) - and a frame is 8,192 pixels. Four presets
// as they stood before they were rewritten around PFMath (floorf and fmodf per
// pixel, the way most community headers are written), same board, -O2, with a
// first version of this file: 0510 13.3 -> 10.3 ms a frame, 0515-4 23.7 ->
// 17.5, 0520 23.1 -> 20.3, 0601 24.5 -> 20.2. With this file as it stands,
// the 33 Basics modules against their August builds, same board: every one
// faster, 1.11x to 2.36x the frames, 1.52x at the median (that is this file,
// -O2 and a month of preset edits together; the split is in
// toolchain/build_module.py). PFMath::ifloor, floorF, fract and clamp
// (src/core_math.h) are still the least code where a pattern is written with
// them; this is for the .h files nobody is going to edit.
//
// What is exact. These seven functions: for every input each returns the bits
// the library function returns. Nothing here is an approximation. Each handles
// inline only the inputs for which IEEE 754 leaves exactly one answer and the
// code below provably reaches it, and hands every other input - a NaN, an
// infinity, a magnitude past the proved range, a tie whose winner is the
// library's own choice - to the real function. The reasoning is beside each
// function. firmware/toolchain/check_libm.py runs it: all 2^32 float bit
// patterns through the four one-argument functions and about three billion
// comparisons through the others, as bits, against the libm of whatever
// machine runs the check. check_module_libm.py then reads a module the real
// compiler built, to see that this code is what a pattern's calls became.
//
// What a PC cannot check is the panel's own arithmetic: that MSUB.S is fused
// (one rounding - fmod's remainder depends on it) and that its conversions
// and compares do what IEEE says. toolchain/tests/modules/_math_probe is a
// module that checks those on a board, against the firmware's own libm
// (2026-10-04, one board: "math ok 9/9", 1.17 million comparisons).
//
// What is not exact: the pattern's own arithmetic, which this file changes
// without touching. Modules are compiled with GCC's default
// -ffp-contract=fast: a*b+c becomes one fused instruction - one rounding where
// there were two - when the compiler sees the multiply and the add in one
// basic block. The code here has branches, so a product computed before one of
// these calls and added after it no longer shares a block with its add; and
// -O2, the build default that arrived with this file, inlines helpers -Os left
// alone, which fuses products that were not fused before. Either way a value
// in the pattern can come out different in its last bit. Two cases, both
// worked through on the two compilers:
//
//   sinf(floorf(x) * 12.9898f + floorf(y) * 78.233f) * 43758.5453f
//       The shader cell hash written as one expression. The first product
//       used to be the fused one; now the second is. On a 16x8 grid of cells
//       the sum differs for 20 of 128, and the hash turns each of those into
//       an unrelated value. (The same hash behind a helper, hash(floorf(x),
//       floorf(y)), is unchanged; PFNoise::cellHash is integer and cannot be.)
//
//   1.0f - smooth(...)   where smooth() ends in a multiply
//       At -Os the helper stays a function: mul.s, return, sub.s. At -O2 it
//       is inlined and the two become one msub.s.
//
// A last bit shows only where a pattern amplifies it: a float hash like the
// one above, state carried from one frame to the next, and - rarely - a value
// sitting on the edge of a floorf band. Everywhere else it is lost in the
// rounding to eight bits.
//
// Layout. PFLibm:: holds the algorithms as ordinary functions any C++17
// compiler builds - that is what the host test runs, under GCC and MSVC. The
// second half exists only when a module is being built for the panel: it puts
// those functions behind the C names, so `floorf(x)` in an unedited pattern is
// the inline code. A firmware image never includes this file.
//
// Include it BEFORE <math.h> (pf_module.h does): the redirection of
// libstdc++'s float overloads happens while that header is read.
// License: MIT
#pragma once

#include <stdint.h>

// ── What the algorithms are written in ──────────────────────────────
// `real::` is the C library's own function - the answer outside what is
// proved below.
//
// On the panel's compiler these are GCC's builtins, for two reasons. A call to
// __builtin_floorf is the call an unedited `floorf(x)` always was - the same
// import, and folded by the compiler in exactly the cases it folded before -
// and it still means that after the C name has been given a body further
// down. And builtins can sit in a constexpr function, which these have to be:
// libstdc++'s std::floor(float) is constexpr and is about to be routed here.
//
// Anywhere else (the host test: GCC, Clang, MSVC) they are the C names from
// <math.h>, and check_libm.py turns the compiler's builtin handling of those
// names off, so that the reference really is that machine's libm and not the
// compiler's inline idea of it.
#if defined(__XTENSA__) && defined(__GNUC__) && !defined(__clang__)
#define PF_LIBM_FN constexpr inline __attribute__((always_inline))
namespace PFLibm {
namespace real {
PF_LIBM_FN float floor(float x) { return __builtin_floorf(x); }
PF_LIBM_FN float ceil(float x) { return __builtin_ceilf(x); }
PF_LIBM_FN float trunc(float x) { return __builtin_truncf(x); }
PF_LIBM_FN float round(float x) { return __builtin_roundf(x); }
PF_LIBM_FN float fmin(float x, float y) { return __builtin_fminf(x, y); }
PF_LIBM_FN float fmax(float x, float y) { return __builtin_fmaxf(x, y); }
PF_LIBM_FN float fmod(float x, float y) { return __builtin_fmodf(x, y); }
}  // namespace real
PF_LIBM_FN float magnitude(float x) { return __builtin_fabsf(x); }
// The sign BIT: true for -0.0f, which `x < 0` is not.
PF_LIBM_FN bool negative(float x) { return __builtin_signbit(x) != 0; }
// x - q*y with ONE rounding. On the S3 this is MSUB.S; no call.
PF_LIBM_FN float fnma(float q, float y, float x) { return __builtin_fmaf(-q, y, x); }
}  // namespace PFLibm
#else
#include <cmath>
#define PF_LIBM_FN inline
namespace PFLibm {
namespace real {
inline float floor(float x) { return ::floorf(x); }
inline float ceil(float x) { return ::ceilf(x); }
inline float trunc(float x) { return ::truncf(x); }
inline float round(float x) { return ::roundf(x); }
inline float fmin(float x, float y) { return ::fminf(x, y); }
inline float fmax(float x, float y) { return ::fmaxf(x, y); }
inline float fmod(float x, float y) { return ::fmodf(x, y); }
}  // namespace real
inline float magnitude(float x) { return std::fabs(x); }
inline bool negative(float x) { return std::signbit(x); }
inline float fnma(float q, float y, float x) { return std::fma(-q, y, x); }
}  // namespace PFLibm
#endif

namespace PFLibm {

// 2^23. Below it a float converts to int and back without loss; from it up
// every float is already a whole number, so there is nothing to round - and
// that side, with the infinities and NaN (which fail the `<` too), is left to
// the library.
constexpr float WHOLE_FROM = 8388608.0f;

// ── floor, ceil, trunc, round ───────────────────────────────────────
// For |x| < 2^23 only. (int)x truncates toward zero and is exact, as is the
// conversion back; a negative x with a fraction lands one above its floor, and
// the subtraction is between whole numbers under 2^23, so exact too. That is
// floor(x) as a value. As bits it can be wrong in one case, x = -0.0f, where
// truncation gives +0.0f: a whole x is its own floor, so it is returned
// itself.
PF_LIBM_FN float floorSmall(float x) {
  const float t = (float)(int)x;
  const float f = t > x ? t - 1.0f : t;
  return f == x ? x : f;
}

PF_LIBM_FN float floor(float x) {
  return magnitude(x) < WHOLE_FROM ? floorSmall(x) : real::floor(x);
}

// ceil(x) = -floor(-x), signs of zero included: ceil of -0.3f is -0.0f, and
// floorSmall(0.3f) is +0.0f. Negation is exact.
PF_LIBM_FN float ceil(float x) {
  return magnitude(x) < WHOLE_FROM ? -floorSmall(-x) : real::ceil(x);
}

// A zero result carries x's sign - trunc and round of -0.3f are -0.0f - and
// the conversion from int only ever makes +0.0f. x * 0.0f is that zero: the
// product of a finite x and zero is exact and takes the sign of x. (A
// multiplication rather than a look at the sign bit, because reading a
// float's bits makes GCC 8.4 keep the value in memory for its whole life.)
PF_LIBM_FN float signedZero(float x) {
  return x * 0.0f;
}

PF_LIBM_FN float trunc(float x) {
  if (!(magnitude(x) < WHOLE_FROM)) return real::trunc(x);
  const float t = (float)(int)x;
  return t == 0.0f ? signedZero(x) : t;
}

// Half away from zero. x - t is the fraction of x, exact because both are
// multiples of x's last bit and the difference is under 1; the comparison
// with 0.5 is then of the true fraction, not of a sum that has already
// rounded (floor(x + 0.5f) gets 0.49999997f wrong, and every odd number from
// 2^23 up, where x + 0.5f is a tie that rounds to even). t +- 1 is between
// whole numbers no larger than 2^23.
PF_LIBM_FN float round(float x) {
  if (!(magnitude(x) < WHOLE_FROM)) return real::round(x);
  const float t = (float)(int)x;
  const float d = x - t;
  const float r = d >= 0.5f ? t + 1.0f : (d <= -0.5f ? t - 1.0f : t);
  return r == 0.0f ? signedZero(x) : r;
}

// ── fmin, fmax ──────────────────────────────────────────────────────
// When one argument is strictly less, the answer is that argument's bits. When
// they compare equal they are the same bits unless they are zeros of opposite
// sign - and which zero comes back from fmin(+0, -0) is the library's choice
// (newlib returns its second argument, other libraries the negative one), as
// is everything about a NaN. Those two cases go to the call the pattern always
// made, and get what it always got from this compiler - which is not always
// newlib's answer for the arguments in the order they were written: GCC
// answers the call itself when both arguments are constants, and from GCC 12
// it may hand the library the two operands the other way round.
PF_LIBM_FN float fmin(float x, float y) {
  if (x < y) return x;
  if (y < x) return y;
  if (x == y && negative(x) == negative(y)) return x;
  return real::fmin(x, y);
}

PF_LIBM_FN float fmax(float x, float y) {
  if (x > y) return x;
  if (y > x) return y;
  if (x == y && negative(x) == negative(y)) return x;
  return real::fmax(x, y);
}

// ── fmod ────────────────────────────────────────────────────────────
// fmod(x, y) is x - n*y for the whole number n = trunc(x / y) of the TRUE
// quotient, carries x's sign, and is always exactly representable. Write
// ax = |x|, ay = |y|, and R = ax - n*ay, 0 <= R < ay, for the answer's
// magnitude.
//
// |x| < |y| returns x itself (n = 0; this is also x = +-0 and y = +-inf).
// Otherwise the quotient is estimated - `p`, from a division or from a
// multiplication by 1/ay - and only its whole part q is kept. The remainder
// is then taken with the fused multiply-subtract, which rounds the exact
// ax - q*ay once:
//
//   q = n      the exact value is R, representable, so r = R.
//   q = n + 1  the exact value is R - ay, in [-ay, 0): a multiple of ay's last
//              bit no larger than ay, so representable, so r is negative.
//   q = n - 1  the exact value is R + ay, in [ay, 2*ay). It may round, but
//              rounding is monotonic and ay is a float, so r >= ay.
//
// So a single look at r says which way q is off, and after stepping q by one
// the remainder is computed AGAIN from ax - never by adding or subtracting ay
// from r, which in the third case has already lost its low bit.
//
// What that needs is |p - ax/ay| < 1, so that q is within one of n. p is a
// rounded division (relative error 2^-24 when it is correctly rounded, which
// _math_probe checks of the panel's; twice that would do), or ax times 1/ay
// (2^-24 for each of the two roundings - and where 1/ay is subnormal, an
// absolute 2^-150 instead, which ax < 2^128 turns into at most 2^-22). Either
// way |p - ax/ay| is under 2^-23 * (ax/ay) + 2^-21, which for a quotient below
// 2^22 + 1 is under 0.51. p < 2^22 is therefore the fast path's whole
// condition: it puts the true quotient below 2^22 + 1; it fails for a NaN
// anywhere, for x = +-inf, for y = 0 (p is inf or NaN) and when 1/ay
// overflowed; and everything it fails for goes to the library. q is at most
// 2^22, so the conversions are exact and so is q +- 1.
//
// The sign: here ax >= ay > 0, so x is not a zero and `x < 0` is its sign
// bit; an exact multiple leaves r = +0.0f, which negation turns into the
// -0.0f fmod returns for a negative x.
constexpr float FMOD_QUOTIENT_BELOW = 4194304.0f;  // 2^22

PF_LIBM_FN float fmodFrom(float x, float y, float ax, float ay, float p) {
  if (!(p < FMOD_QUOTIENT_BELOW)) return real::fmod(x, y);
  float q = (float)(int)p;
  float r = fnma(q, ay, ax);
  if (r < 0.0f) {
    q -= 1.0f;
    r = fnma(q, ay, ax);
  } else if (r >= ay) {
    q += 1.0f;
    r = fnma(q, ay, ax);
  }
  return x < 0.0f ? -r : r;
}

// Any divisor: the quotient costs a division (__divsf3, 327 ns on the S3).
PF_LIBM_FN float fmod(float x, float y) {
  const float ax = magnitude(x);
  const float ay = magnitude(y);
  if (ax < ay) return x;
  return fmodFrom(x, y, ax, ay, ax / ay);
}

// A divisor known when the pattern is compiled: `reciprocal` is 1.0f / |y|
// rounded to nearest, which the compiler folds, and the division is gone.
PF_LIBM_FN float fmodRecip(float x, float y, float reciprocal) {
  const float ax = magnitude(x);
  const float ay = magnitude(y);
  if (ax < ay) return x;
  return fmodFrom(x, y, ax, ay, ax * reciprocal);
}

// y is 1.0f or -1.0f - the hue wrap. The remainder is the fraction of |x|,
// exact as in round() above, with nothing to correct; |x| >= 1 here, so
// `x < 0` is again the sign.
PF_LIBM_FN float fmodOne(float x, float y) {
  const float ax = magnitude(x);
  if (ax < 1.0f) return x;
  if (!(ax < WHOLE_FROM)) return real::fmod(x, y);
  const float r = ax - (float)(int)ax;
  return x < 0.0f ? -r : r;
}

}  // namespace PFLibm

// ═════════════════════════════════════════════════════════════════════
// Module builds only: the C names become the functions above.
// ═════════════════════════════════════════════════════════════════════
// __XTENSA__ as well as PF_MODULE_BUILD: a host test defines the latter to get
// at the shared headers, and on a PC these names belong to its own libc.
#if defined(PF_MODULE_BUILD) && defined(__XTENSA__) && defined(__GNUC__) && !defined(__clang__)

namespace PFLibm {
// The divisor is a constant far more often than not (`fmodf(h, 1.0f)`,
// `fmodf(a, TWO_PI)`), and after inlining the compiler knows which calls
// those are.
PF_LIBM_FN float fmodAny(float x, float y) {
  if (__builtin_constant_p(y)) {
    if (y == 1.0f || y == -1.0f) return fmodOne(x, y);
    return fmodRecip(x, y, 1.0f / magnitude(y));
  }
  return fmod(x, y);
}
}  // namespace PFLibm

// 1. The spellings that go through libstdc++. In C++, `floor(x)`,
//    `std::floor(x)`, `fmod(a, b)` and the rest on float arguments are
//    <cmath>'s float overloads, each one line: `return __builtin_floorf(x);`.
//    A builtin cannot be given a body, so for the length of that header the
//    builtin's name is a macro for the function above. PFLibm's own `real::`
//    fallbacks were defined before this point and still mean the builtin.
//    Checked with libstdc++ 8.4 and 14.2 - the versions between are let in on
//    the strength of those two - and check_module_libm.py reads the result out
//    of a built module. Outside that range the redirection is off, and those
//    spellings simply stay calls.
#if __GNUC__ >= 8 && __GNUC__ <= 14
#define __builtin_floorf(x) PFLibm::floor(x)
#define __builtin_ceilf(x) PFLibm::ceil(x)
#define __builtin_truncf(x) PFLibm::trunc(x)
#define __builtin_roundf(x) PFLibm::round(x)
#define __builtin_fminf(x, y) PFLibm::fmin(x, y)
#define __builtin_fmaxf(x, y) PFLibm::fmax(x, y)
#define __builtin_fmodf(x, y) PFLibm::fmodAny(x, y)
#include <math.h>
#undef __builtin_floorf
#undef __builtin_ceilf
#undef __builtin_truncf
#undef __builtin_roundf
#undef __builtin_fminf
#undef __builtin_fmaxf
#undef __builtin_fmodf
#else
#include <math.h>
#endif

// 2. The C names themselves. `extern inline` with gnu_inline is a definition
//    used for inlining and for nothing else: no copy of it is emitted, and
//    anything that is not a call - `float (*f)(float) = floorf;` - still
//    refers to the firmware's symbol. always_inline makes every call the
//    inline one at any optimisation level (and is what makes GCC use this
//    body in place of its own idea of the builtin).
//
//    The imports stay within what every loader resolves: each fallback is
//    the symbol the call would have imported anyway, and fmodf with a divisor
//    that is not a constant adds __divsf3. All eight have been in the host
//    symbol table (src/core_module_loader.h) since the first loader, v3.2.0.
extern "C" {
extern inline __attribute__((gnu_inline, always_inline)) float floorf(float x) {
  return PFLibm::floor(x);
}
extern inline __attribute__((gnu_inline, always_inline)) float ceilf(float x) {
  return PFLibm::ceil(x);
}
extern inline __attribute__((gnu_inline, always_inline)) float truncf(float x) {
  return PFLibm::trunc(x);
}
extern inline __attribute__((gnu_inline, always_inline)) float roundf(float x) {
  return PFLibm::round(x);
}
extern inline __attribute__((gnu_inline, always_inline)) float fminf(float x, float y) {
  return PFLibm::fmin(x, y);
}
extern inline __attribute__((gnu_inline, always_inline)) float fmaxf(float x, float y) {
  return PFLibm::fmax(x, y);
}
extern inline __attribute__((gnu_inline, always_inline)) float fmodf(float x, float y) {
  return PFLibm::fmodAny(x, y);
}
}  // extern "C"

#endif  // module build
