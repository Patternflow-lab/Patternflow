// The firmware headers the practice AI answers the Lab's conversion prompt
// with: firmware/patternflow/presets/preset_<slug>.h, copied in verbatim
// (LF line endings). Generated — don't edit by hand. answers.test.ts checks
// each one still equals its file; when a header changes, copy it in again.

/** firmware/patternflow/presets/preset_0710.h */
export const HEADER_0710 = `#pragma once

// ===== Patternflow pattern =====
// Title:   260710
// Author:  Seunghun LEE
// Date:    2026-07-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

#include <Arduino.h>
#include "config.h"
#include "../src/core_display.h"
#include "../src/core_encoders.h"
#include "../src/core_canvas.h"
#include "../src/core_math.h"
#include "../src/core_params.h"

namespace TileWaves {

const char* NAME = "TileWaves";
const char* const KNOB_LABELS[4] = {"Quantize", "Speed", "PhaseShift", "Sharpness"};
constexpr bool ABSOLUTE_READY = true;

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {1,0,8},{3,0,17},{4,0,25},{6,0,34},{7,0,42},{9,0,50},{10,0,59},{11,0,67},
  {13,0,76},{14,0,84},{16,0,93},{17,0,101},{19,0,110},{20,0,118},{21,0,127},{23,0,135},
  {24,0,144},{26,0,152},{27,0,161},{29,0,169},{30,0,178},{31,0,186},{33,0,195},{34,0,203},
  {36,0,211},{37,0,220},{39,0,228},{40,0,237},{41,0,245},{43,0,254},{42,2,255},{42,4,255},
  {41,7,255},{41,9,255},{40,11,255},{39,13,255},{39,16,255},{38,18,255},{37,20,255},{37,22,255},
  {36,25,255},{36,27,255},{35,29,255},{34,32,255},{34,34,255},{33,36,255},{32,38,255},{32,41,255},
  {31,43,255},{31,45,255},{30,48,255},{29,50,255},{29,52,255},{28,54,255},{27,57,255},{27,59,255},
  {26,61,255},{26,64,255},{25,66,255},{24,68,255},{24,70,255},{23,73,255},{22,75,255},{22,77,255},
  {21,80,255},{21,82,255},{20,84,255},{19,86,255},{19,89,255},{18,91,255},{17,93,255},{17,95,255},
  {16,98,255},{16,100,255},{15,102,255},{14,105,255},{14,107,255},{13,109,255},{12,111,255},{12,114,255},
  {11,116,255},{11,118,255},{10,121,255},{9,123,255},{9,125,255},{8,127,255},{7,130,255},{7,132,255},
  {6,134,255},{6,137,255},{5,139,255},{4,141,255},{4,143,255},{3,146,255},{2,148,255},{2,150,255},
  {1,152,255},{1,155,255},{0,157,255},{7,153,248},{14,148,241},{21,144,234},{28,140,227},{35,135,220},
  {42,131,213},{49,127,206},{56,122,199},{63,118,192},{70,114,185},{77,110,178},{84,105,171},{91,101,164},
  {98,97,157},{105,92,150},{112,88,143},{119,84,136},{126,79,129},{133,75,122},{140,71,115},{147,67,108},
  {154,62,101},{161,58,94},{168,54,87},{175,49,80},{182,45,73},{189,41,66},{196,36,59},{203,32,52},
  {210,28,45},{217,23,38},{224,19,31},{231,15,24},{238,11,17},{245,6,10},{252,2,3},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
};

// Knob state initialized to Pattern Lab current values
static float quantizeState = 6.533f;
static float speedState = 7.048f;
static float phaseShiftState = 3.0f;
static float sharpnessState = 1.0f;

// Calibrated steps per detent
static const float TILE_QUANTIZE_STEP = 0.05f;
static const float TILE_SPEED_STEP = 0.1f;
static const float TILE_PHASESHIFT_STEP = 0.05f;
static const float TILE_SHARPNESS_STEP = 0.05f;

// Range limits
static const float TILE_QUANTIZE_MIN = 1.0f;
static const float TILE_QUANTIZE_MAX = 12.0f;
static const float TILE_SPEED_MIN = 0.1f;
static const float TILE_SPEED_MAX = 10.0f;
static const float TILE_PHASESHIFT_MIN = 0.0f;
static const float TILE_PHASESHIFT_MAX = 5.0f;
static const float TILE_SHARPNESS_MIN = 1.0f;
static const float TILE_SHARPNESS_MAX = 10.0f;

static float timeAcc = 0.0f;

// tileSize is fixed at 8; precompute tile centers and distances for all grid cells.
// Grid dimensions: (PANEL_RES_W/8 + 1) x (PANEL_RES_H/8 + 1) — center of panel is (w/2, h/2) in pixel coords.
// We precompute dist for each grid cell once per frame since phaseShift can change,
// but the gridX/gridY → dist mapping is parameter-dependent only via phaseShift multiplier applied later.
// Actually dist itself is parameter-independent (pure geometry), so precompute it in setup.
// gridCols = ceil(PANEL_RES_W / 8.0f), gridRows = ceil(PANEL_RES_H / 8.0f).
// We store dist for each (gridX, gridY) so we don't recalc sqrtf per pixel.

static const int TILE_SIZE = 8;
static int gridCols;
static int gridRows;
static float* gridDist; // size gridCols * gridRows; dist from tile center to panel center

static float cx, cy;

void setup() {
    PFMath::buildSinLUT();

    cx = PANEL_RES_W * 0.5f;
    cy = PANEL_RES_H * 0.5f;
    gridCols = (PANEL_RES_W + TILE_SIZE - 1) / TILE_SIZE;
    gridRows = (PANEL_RES_H + TILE_SIZE - 1) / TILE_SIZE;
    gridDist = new float[gridCols * gridRows];

    float halfTile = TILE_SIZE * 0.5f;
    for (int gy = 0; gy < gridRows; gy++) {
        float ty = gy * TILE_SIZE + halfTile;
        float dy = ty - cy;
        int rowBase = gy * gridCols;
        for (int gx = 0; gx < gridCols; gx++) {
            float tx = gx * TILE_SIZE + halfTile;
            float dx = tx - cx;
            gridDist[rowBase + gx] = sqrtf(dx * dx + dy * dy);
        }
    }
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &quantizeState, TILE_QUANTIZE_MIN, TILE_QUANTIZE_MAX, TILE_QUANTIZE_STEP);

    PFParams::apply(input, 1, &speedState, TILE_SPEED_MIN, TILE_SPEED_MAX, TILE_SPEED_STEP);

    PFParams::apply(input, 2, &phaseShiftState, TILE_PHASESHIFT_MIN, TILE_PHASESHIFT_MAX, TILE_PHASESHIFT_STEP);

    PFParams::apply(input, 3, &sharpnessState, TILE_SHARPNESS_MIN, TILE_SHARPNESS_MAX, TILE_SHARPNESS_STEP);

    timeAcc += dt * speedState;
    // timeAcc feeds fastSin with integer multiplier (3.0) and floorf for quantization.
    // Wrap at TWO_PI for the sin use; the quantization floorf operates on the wrapped value
    // but produces the same floorf(localTime/step) since step is fractional and TWO_PI is the
    // period of the underlying sine. The phase offset (dist * phaseShift * 0.08) drifts but is
    // added before floorf. To keep floorf quantization stable we need to preserve the
    // unbounded drift in the offset, but wrapping timeAcc at 2π is correct because
    // sin(theta - 2π*k) == sin(theta) and floorf((theta - 2π*k)/step) differs from
    // floorf(theta/step) by an integer, which sin eliminates. So wrap is safe.
    if (timeAcc > TWO_PI) {
        timeAcc -= TWO_PI;
    } else if (timeAcc < -TWO_PI) {
        timeAcc += TWO_PI;
    }
}

void draw() {
    float t = timeAcc;
    float quantize = quantizeState;
    float phaseShift = phaseShiftState;
    float sharpness = sharpnessState;

    int tileSize = TILE_SIZE;
    int cols = gridCols;
    int rows = gridRows;

    float quantizeStep = 1.0f;
    float invQuantize = 1.0f;
    if (quantize > 1.0f) {
        quantizeStep = 1.0f / quantize;
        invQuantize = quantize;
    }

    for (int y = 0; y < PANEL_RES_H; y++) {
        int gridY = y / tileSize;
        int rowBase = gridY * cols;

        // tile border check: top edge of tile
        bool borderY = (y % tileSize == 0);

        for (int x = 0; x < PANEL_RES_W; x++) {
            int gridX = x / tileSize;
            float dist = gridDist[rowBase + gridX];

            // Phase-delayed, time-quantized motion
            float localTime = t - dist * phaseShift * 0.08f;
            if (quantize > 1.0f) {
                localTime = floorf(localTime * invQuantize) * quantizeStep;
            }

            // Concentric tile waves
            float wave = PFMath::fastSin(dist * 0.25f - localTime * 3.0f);
            float val = (wave + 1.0f) * 0.5f;

            // Sharpness power scaling
            if (val > 0.0f) {
                val = PFMath::fastPow(val, sharpness);
            }

            // Tile frame borders
            if (borderY || (x % tileSize == 0)) {
                val = 0.0f;
            }

            // Clamp
            if (val < 0.0f) val = 0.0f;
            if (val > 1.0f) val = 1.0f;

            int li = (int)(val * 255.0f + 0.5f);
            PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace TileWaves

// ── Made with Patternflow Pattern Lab · https://patternflow.work/pattern-lab ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
`;

/** firmware/patternflow/presets/preset_0713.h */
export const HEADER_0713 = `#pragma once

// ===== Patternflow pattern =====
// Title:   260713_Firefly
// Author:  Seunghun LEE
// Date:    2026-07-13
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

#include <Arduino.h>
#include "config.h"
#include "../src/core_display.h"
#include "../src/core_encoders.h"
#include "../src/core_canvas.h"
#include "../src/core_math.h"
#include "../src/core_noise.h"
#include "../src/core_params.h"

namespace FireflyHollow {

const char* NAME = "Firefly Hollow";
const char* const KNOB_LABELS[4] = {"Flies", "Speed", "Glow", "Wind"};
constexpr bool ABSOLUTE_READY = true;

// Ramp LUT – DO NOT EDIT (generated from user ramp, 256 entries)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {11,10,10},{26,24,24},{41,36,36},{57,47,47},{72,56,56},{87,64,64},{103,70,70},{118,75,75},
  {133,79,79},{149,81,81},{164,82,82},{179,81,81},{195,79,79},{210,75,75},{225,70,70},{241,64,64},
  {254,58,56},{254,68,47},{254,80,38},{254,94,29},{255,109,20},{255,126,11},{255,144,2},{255,165,38},
  {255,185,87},{255,206,138},{255,227,187},{255,248,238},{255,250,227},{255,243,183},{255,236,140},{255,229,96},
  {255,222,53},{255,215,9},{255,207,0},{255,200,0},{255,193,0},{255,185,0},{255,178,0},{255,171,0},
  {255,163,0},{255,156,0},{255,149,0},{255,141,0},{255,134,0},{255,127,0},{255,119,0},{255,112,0},
  {255,105,0},{255,97,0},{255,90,0},{255,83,0},{255,75,0},{255,68,0},{255,61,0},{255,53,0},
  {255,46,0},{255,39,0},{255,31,0},{255,24,0},{255,17,0},{255,9,0},{255,2,0},{255,48,39},
  {255,109,93},{255,164,147},{255,213,201},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
  {255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},{255,240,235},
};

// Knob state (initial values from Pattern Lab)
static float knobFlies = 34.0f;   // 2..34
static float knobSpeed = 2.275f;  // 0.2..5
static float knobGlow  = 1.32f;   // 0..2
static float knobWind  = 0.409f;  // 0..2

static constexpr int MAX_FLIES = 16;
static int   numFlies = 16;          // active count (capped at 16)

// Firefly motion parameters (constant per firefly, set in setup)
static float fly_s1[MAX_FLIES];
static float fly_s2[MAX_FLIES];
static float fly_hb[MAX_FLIES];

// Phase accumulators (each wraps at TWO_PI)
static float phase_fu[MAX_FLIES];      // main x-osc
static float phase_fv_main[MAX_FLIES]; // main y-osc
static float phase_fv_extra[MAX_FLIES];// secondary y-osc (freq 0.9)
static float phase_b[MAX_FLIES];       // brightness oscillation

// Output buffers used by draw()
static float fu[MAX_FLIES];
static float fv[MAX_FLIES];
static float fb[MAX_FLIES];

// Grass sway phases
static float grass_phase1 = 0.0f;   // freq 1.8
static float grass_phase2 = 0.0f;   // freq 2.6

// Cloud drift accumulator (unwrapped – feeds noise coordinates, not sin)
static float cloudT = 0.0f;

void setup() {
    PFMath::buildSinLUT();  // idempotent

    for (int i = 0; i < MAX_FLIES; ++i) {
        // deterministic per-firefly constants (replace sin‑based hash with cellHash)
        fly_s1[i] = 0.13f + 0.11f * PFNoise::cellHash(i, 0, 7);
        fly_s2[i] = 0.09f + 0.13f * PFNoise::cellHash(i, 0, 8);
        fly_hb[i] = PFNoise::cellHash(i, 0, 9);

        // random initial phases
        phase_fu[i]      = PFNoise::cellHash(i, 0, 10) * TWO_PI;
        phase_fv_main[i] = PFNoise::cellHash(i, 0, 11) * TWO_PI;
        phase_fv_extra[i]= PFNoise::cellHash(i, 0, 12) * TWO_PI;
        phase_b[i]       = PFNoise::cellHash(i, 0, 13) * TWO_PI;

        // initial values so first frame is valid
        fu[i] = 0.5f + 0.44f * PFMath::fastSin(phase_fu[i] + i * 2.39f);
        fv[i] = 0.62f
                + 0.30f * PFMath::fastSin(phase_fv_main[i] + i * 5.17f)
                + 0.05f * PFMath::fastSin(phase_fv_extra[i] + (float)i);
        float p = PFMath::fastSin(phase_b[i] + i * 1.7f);
        float pp = fmaxf(0.0f, p);
        fb[i] = pp * pp * pp;   // x^3
    }

    grass_phase1 = 0.0f;
    grass_phase2 = 0.0f;
    cloudT = 0.0f;
}

void update(float dt, const InputFrame& input) {
    // ----- knobs -----
    PFParams::apply(input, 0, &knobFlies, 2.0f, 34.0f, 0.05f);

    PFParams::apply(input, 1, &knobSpeed, 0.2f, 5.0f, 0.1f);

    PFParams::apply(input, 2, &knobGlow, 0.0f, 2.0f, 0.05f);

    PFParams::apply(input, 3, &knobWind, 0.0f, 2.0f, 0.05f);

    int flies = (int)lroundf(knobFlies);
    if (flies < 2)  flies = 2;
    if (flies > 16) flies = 16;
    numFlies = flies;

    const float speed = knobSpeed;

    // ----- firefly phases & buffers -----
    for (int i = 0; i < MAX_FLIES; ++i) {
        phase_fu[i]       += dt * speed * fly_s1[i] * 2.0f;
        phase_fv_main[i]  += dt * speed * fly_s2[i] * 2.0f;
        phase_fv_extra[i] += dt * speed * 0.9f;
        float freqB = 0.8f + 0.5f * fly_hb[i];
        phase_b[i]        += dt * speed * freqB;

        // wrap each phase at TWO_PI
        while (phase_fu[i]       > TWO_PI) phase_fu[i]       -= TWO_PI;
        while (phase_fv_main[i]  > TWO_PI) phase_fv_main[i]  -= TWO_PI;
        while (phase_fv_extra[i] > TWO_PI) phase_fv_extra[i] -= TWO_PI;
        while (phase_b[i]        > TWO_PI) phase_b[i]        -= TWO_PI;

        fu[i] = 0.5f + 0.44f * PFMath::fastSin(phase_fu[i] + i * 2.39f);
        fv[i] = 0.62f
                + 0.30f * PFMath::fastSin(phase_fv_main[i] + i * 5.17f)
                + 0.05f * PFMath::fastSin(phase_fv_extra[i] + (float)i);
        float p = PFMath::fastSin(phase_b[i] + i * 1.7f);
        float pp = fmaxf(0.0f, p);
        fb[i] = pp * pp * pp;
    }

    // ----- grass phases -----
    grass_phase1 += dt * speed * 1.8f;
    while (grass_phase1 > TWO_PI) grass_phase1 -= TWO_PI;
    grass_phase2 += dt * speed * 2.6f;
    while (grass_phase2 > TWO_PI) grass_phase2 -= TWO_PI;

    // ----- cloud drift (offset only, no sin → precision loss negligible) -----
    cloudT += dt * speed * (0.4f + knobWind * 0.8f);
}

void draw() {
    const int W = PANEL_RES_W;
    const int H = PANEL_RES_H;

    const float vh = (float)W;  // logical vertical extent
    const float vw = (float)H;  // logical horizontal extent
    const float vh_half = vh * 0.5f;

    const float glowSq = knobGlow * knobGlow;
    const float wind   = knobWind;
    const int   n      = numFlies;

    // ----- pre‑compute per‑row data (depends only on u = y) -----
    float hillTop[H];
    float grassGh[H];
    for (int u = 0; u < H; ++u) {
        float hu = (float)u;
        hillTop[u] = vh * 0.58f
                     + PFMath::fastSin(hu * 0.09f + 2.0f) * 5.0f
                     + PFMath::fastSin(hu * 0.023f) * 8.0f;

        int gx = u / 2;
        float hh = PFNoise::cellHash(gx, 0, 91); // 0..1
        grassGh[u] = 10.0f + hh * 16.0f;
    }

    const float cloudDrift = cloudT * (0.4f + wind * 0.8f);

    for (int y = 0; y < H; ++y) {
        const int u = y;                       // logical x in JS
        const float hill = hillTop[u];
        const float gh   = grassGh[u];

        for (int x = 0; x < W; ++x) {
            const int v = W - 1 - x;           // logical y in JS
            const float g = (float)v / vh;     // normalized 0..1

            float val = 0.05f + 0.14f * g;

            // ----- clouds (only upper half of the view) -----
            if ((float)v < vh_half) {
                float cn = PFNoise::valueNoise2D(u * 0.045f + cloudDrift * 0.12f,
                                                  v * 0.09f  + cloudDrift * 0.015f) * 0.65f
                         + PFNoise::valueNoise2D(u * 0.11f  - cloudDrift * 0.07f,
                                                  v * 0.22f  + 40.0f) * 0.35f;
                cn *= 1.0f - (g / 0.5f) * 0.7f;   // g < 0.5 here
                float cd = (cn - 0.38f) / 0.18f;
                if (cd > 0.0f) {
                    float soft = (cd >= 1.0f) ? 1.0f
                                              : cd * cd * (3.0f - 2.0f * cd); // smoothstep
                    val += soft * 0.13f * 1.5f;   // lit = 1.5
                }
            }

            // ----- distant hill silhouette -----
            if (v >= hill) {
                val = 0.07f;
            }

            // ----- foreground grass (swaying) -----
            float sway = PFMath::fastSin(u * 0.3f + grass_phase1) * wind * 4.0f
                       + PFMath::fastSin(u * 0.9f - grass_phase2) * wind * 2.0f;
            float grassTop = vh - gh + sway;
            if (v >= grassTop) {
                val = 0.015f;
                if (v - grassTop < 1.2f) val = 0.11f;  // moonlit tips
            }

            // ----- fireflies (additive glow) -----
            for (int i = 0; i < n; ++i) {
                float du = (float)u - fu[i] * vw;
                float dv = (float)v - fv[i] * vh;
                float dd = du * du + dv * dv;
                if (dd < glowSq * 9.0f) {
                    val += fb[i] * expf(-dd / glowSq);
                }
            }

            // ----- clamp and map through ramp -----
            if (val < 0.0f) val = 0.0f;
            if (val > 1.0f) val = 1.0f;
            int idx = (int)(val * 255.0f + 0.5f);
            if (idx < 0)   idx = 0;
            if (idx > 255) idx = 255;

            PFCanvas::setPixel(x, y,
                               RAMP_LUT[idx][0],
                               RAMP_LUT[idx][1],
                               RAMP_LUT[idx][2]);
        }
    }

    PFCanvas::present();
}

} // namespace FireflyHollow

// ── Made with Patternflow Pattern Lab · https://patternflow.work/pattern-lab ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
`;
