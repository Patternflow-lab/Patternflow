// Build-time fixture for firmware/toolchain/check_module_libm.py, not a
// showable pattern. check_libm.py proves abi/pf_libm.h's algorithms on a PC,
// but the half of that header a module actually uses - the bodies behind the C
// names, the redirection of libstdc++'s float overloads, the choice between
// the three fmod paths - exists only under PF_MODULE_BUILD on the Xtensa
// compiler, and no PC test compiles it. This file is that half, one spelling a
// function, so the check can read each one out of the built .pfm:
//
//   pf_shape_<spelling>   what a pattern writes; must be inline code with the
//                         library call left only as the fallback
//   pf_control_<what>     what must STILL be a plain call - there so the check
//                         is known to tell the two apart
//
// The static_asserts are evaluated by the compiler THROUGH the module-only
// wiring (std::floor on a float is PFLibm::floor once pf_module.h has been
// read, std::fmod is fmodAny and whichever path it picks), so a wrapper bound
// to the wrong function, or a wrong test in the fmod dispatch, does not build.
#include "pf_module.h"

#define SHAPE extern "C" __attribute__((noinline))

// ── values, through the wiring ──────────────────────────────────────
static_assert(std::floor(2.5f) == 2.0f && std::floor(-2.5f) == -3.0f, "floor");
static_assert(std::ceil(2.5f) == 3.0f && std::ceil(-2.5f) == -2.0f, "ceil");
static_assert(std::trunc(2.7f) == 2.0f && std::trunc(-2.7f) == -2.0f, "trunc");
static_assert(std::round(2.5f) == 3.0f && std::round(-2.5f) == -3.0f, "round");
static_assert(std::round(0.49999997f) == 0.0f && std::round(2.4999998f) == 2.0f, "round below a half");
static_assert(std::fmin(1.0f, 2.0f) == 1.0f && std::fmin(2.0f, 1.0f) == 1.0f, "fmin");
static_assert(std::fmax(1.0f, 2.0f) == 2.0f && std::fmax(2.0f, 1.0f) == 2.0f, "fmax");
static_assert(std::fmod(7.5f, 2.0f) == 1.5f && std::fmod(-7.5f, 2.0f) == -1.5f, "fmod, reciprocal path");
static_assert(std::fmod(7.5f, -2.0f) == 1.5f && std::fmod(10.0f, 3.0f) == 1.0f, "fmod, reciprocal path");
static_assert(std::fmod(7.25f, 1.0f) == 0.25f && std::fmod(-7.25f, -1.0f) == -0.25f, "fmod by one");
static_assert(std::fmod(0.25f, 2.0f) == 0.25f && std::fmod(-0.25f, 2.0f) == -0.25f, "fmod under the divisor");
// (Nothing here goes past the inline range: there the answer is the builtin's,
// and GCC 8.4 does not fold a constant fmodf at all.)
// signs of zero: the cases the inline code has to get right by hand
static_assert(__builtin_signbit(std::floor(-0.0f)) && !__builtin_signbit(std::floor(0.3f)), "floor zero");
static_assert(__builtin_signbit(std::ceil(-0.3f)) && !__builtin_signbit(std::ceil(0.0f)), "ceil zero");
static_assert(__builtin_signbit(std::trunc(-0.3f)) && !__builtin_signbit(std::trunc(0.3f)), "trunc zero");
static_assert(__builtin_signbit(std::round(-0.3f)) && !__builtin_signbit(std::round(0.3f)), "round zero");
static_assert(__builtin_signbit(std::fmod(-6.0f, 3.0f)) && !__builtin_signbit(std::fmod(6.0f, 3.0f)), "fmod zero");
static_assert(__builtin_signbit(std::fmod(-2.0f, 1.0f)) && __builtin_signbit(std::fmod(-0.0f, 1.0f)), "fmod-by-one zero");

// ── the C names ─────────────────────────────────────────────────────
SHAPE float pf_shape_floorf(float x) { return floorf(x); }
SHAPE float pf_shape_ceilf(float x) { return ceilf(x); }
SHAPE float pf_shape_truncf(float x) { return truncf(x); }
SHAPE float pf_shape_roundf(float x) { return roundf(x); }
SHAPE float pf_shape_fminf(float x, float y) { return fminf(x, y); }
SHAPE float pf_shape_fmaxf(float x, float y) { return fmaxf(x, y); }
SHAPE float pf_shape_fmodf(float x, float y) { return fmodf(x, y); }
SHAPE float pf_shape_fmodf_one(float x) { return fmodf(x, 1.0f); }
SHAPE float pf_shape_fmodf_const(float x) { return fmodf(x, 6.2831853f); }
SHAPE float pf_shape_fmodf_negconst(float x) { return fmodf(x, -360.0f); }

// ── the spellings that go through libstdc++'s float overloads ────────
SHAPE float pf_shape_floor(float x) { return floor(x); }
SHAPE float pf_shape_std_floor(float x) { return std::floor(x); }
SHAPE float pf_shape_ceil(float x) { return ceil(x); }
SHAPE float pf_shape_trunc(float x) { return trunc(x); }
SHAPE float pf_shape_round(float x) { return round(x); }
SHAPE float pf_shape_fmin(float x, float y) { return fmin(x, y); }
SHAPE float pf_shape_fmax(float x, float y) { return fmax(x, y); }
SHAPE float pf_shape_fmod(float x, float y) { return fmod(x, y); }
SHAPE float pf_shape_std_fmod(float x, float y) { return std::fmod(x, y); }
SHAPE float pf_shape_std_fmod_const(float x) { return std::fmod(x, 6.2831853f); }

// ── what stays a call ───────────────────────────────────────────────
SHAPE float pf_control_builtin(float x) { return __builtin_floorf(x); }
SHAPE float pf_control_pointer(float x) {
  float (*volatile through)(float) = floorf;  // not a call to floorf: the firmware's symbol
  return through(x);
}
SHAPE long pf_control_lroundf(float x) { return lroundf(x); }

namespace LibmShapes {

const char* NAME = "Libm Shapes";
const char* const KNOB_LABELS[4] = {"-", "-", "-", "-"};

volatile float in = 1.25f;
float out;

void setup() {}

void update(float dt, const InputFrame& input) {
  (void)dt;
  (void)input;
}

void draw() {
  const float a = in, b = in;
  out = pf_shape_floorf(a) + pf_shape_ceilf(a) + pf_shape_truncf(a) + pf_shape_roundf(a) +
        pf_shape_fminf(a, b) + pf_shape_fmaxf(a, b) + pf_shape_fmodf(a, b) +
        pf_shape_fmodf_one(a) + pf_shape_fmodf_const(a) + pf_shape_fmodf_negconst(a) +
        pf_shape_floor(a) + pf_shape_std_floor(a) + pf_shape_ceil(a) + pf_shape_trunc(a) +
        pf_shape_round(a) + pf_shape_fmin(a, b) + pf_shape_fmax(a, b) + pf_shape_fmod(a, b) +
        pf_shape_std_fmod(a, b) + pf_shape_std_fmod_const(a) + pf_control_builtin(a) +
        pf_control_pointer(a) + (float)pf_control_lroundf(a);
  PFCanvas::clear();
  PFCanvas::present();
}

}  // namespace LibmShapes

PF_REGISTER_PATTERN(LibmShapes)
