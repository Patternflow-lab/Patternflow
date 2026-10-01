// Module allocations may use internal RAM only while preserving service room.
// This governs module-owned allocations, not allocations by Wi-Fi or features.
//
// One internal heap serves both jobs on the S3: EXEC|INTERNAL|32BIT and
// INTERNAL|8BIT name the same D/IRAM, so an executable allocation reduces the
// very number the reserve is measured against. Two rules follow:
//
//   The reserve PLACES data; it never refuses it. Data has PSRAM to fall back
//   on, so a data section that will not fit internally moves - it does not
//   fail a load.
//
//   Code is PRICED, once, for the whole module, from its section headers,
//   before anything is allocated. While internal RAM was the only place code
//   could run, .text was the one part with no second home, so it was the only
//   thing admission could honestly be about - and it had to be charged its own
//   size. It has a second home now (PF_MODULE_CODE_POLICY, below); the pricing
//   is unchanged for whatever still lands internally.
//
// Both rules were broken. The previous policy refused an executable allocation
// whenever total free was under the reserve WITHOUT looking at the requested
// size, and code() had no fallback, so a 2 KB .text was refused exactly as hard
// as a 200 KB one: a module rejected while the RAM it needed sat unused. Each
// data section was also tested independently against one floor, so N sections
// that each "fit" crossed it together, and the outcome depended on the order
// the sections happened to be walked. Finally it allocated first and rolled
// back after - dipping the heap under the reserve, on the network core, to
// discover whether it was allowed to, which is the exact condition the reserve
// exists to prevent.
#pragma once
#include <esp_heap_caps.h>
#include <stdint.h>
#include <stddef.h>

#ifndef PF_MODULE_INTERNAL_RESERVE
#define PF_MODULE_INTERNAL_RESERVE 24576
#endif
#ifndef PF_MODULE_DATA_INTERNAL_MAX
#define PF_MODULE_DATA_INTERNAL_MAX 16384
#endif
#ifndef PF_MODULE_RUNTIME_MAX_BYTES
#define PF_MODULE_RUNTIME_MAX_BYTES (4u * 1024u * 1024u)
#endif

// Where a module's code may live.
//
// "The S3 cannot execute from PSRAM" was the axiom everything above was built
// around, and it is true only of the pointer malloc() hands back. On the S3
// the instruction bus (0x42000000) and the data bus (0x3C000000) index ONE MMU
// table, so a PSRAM page the heap reaches at 0x3Dxxxxxx is also fetchable at
// that address + 0x06000000. The heap does not know: it tags the region as
// data and returns the data-bus address, which faults when jumped to. The
// loader writes and relocates through that pointer and calls through the
// alias (core_module_loader.h, execAddress).
//
//   0  internal executable RAM only - the rule until 2026-10
//   1  internal while the budget allows, PSRAM when it does not
//   2  PSRAM whenever it can take the code, internal only when it cannot
//
// 2 is what ships, and the reason is the services rather than the pattern.
// Measured 2026-10-01 on one board, A-B-B-A on the same boot: nine catalogue
// modules ran within -0.1..+0.8% of their internal frame time; the worst case
// that could be built - 10, 23 and 32 KB of code with every byte executed
// every frame, twice what the 16 KB instruction cache holds - cost 2.6..5.3%
// (0.3..0.6 ms). Against that, on the Audio edition a module with 10 KB of
// code left 21..23 KB of internal heap under rule 0 and rule 1, which is where
// lwIP was once seen to stop sending for good, and 27.5..27.9 KB under rule
// 2, whether the module carried 5 KB of code or 32. Rule 1 changes nothing for
// what already loads, which also means it leaves that where it was, and it
// makes the PSRAM path the one that only ever runs for unusual modules.
// Rule 2 runs it on every load.
#define PF_MODULE_CODE_INTERNAL 0
#define PF_MODULE_CODE_PSRAM_FALLBACK 1
#define PF_MODULE_CODE_PSRAM_FIRST 2
#ifndef PF_MODULE_CODE_POLICY
#if defined(CONFIG_IDF_TARGET_ESP32S3)
#define PF_MODULE_CODE_POLICY PF_MODULE_CODE_PSRAM_FIRST
#else
// The alias is a property of the S3's MMU. Nothing else is assumed to have it.
#define PF_MODULE_CODE_POLICY PF_MODULE_CODE_INTERNAL
#endif
#endif

namespace PFModuleMemory {
constexpr uint32_t internalData = MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT;
constexpr uint32_t internalCode =
    MALLOC_CAP_EXEC | MALLOC_CAP_INTERNAL | MALLOC_CAP_32BIT;
constexpr uint32_t externalData = MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT;

inline uint32_t refusals = 0;

// A variable, not the macro, so the host test can walk every rule and a bench
// build can compare placements on one boot.
inline uint8_t codePolicy = PF_MODULE_CODE_POLICY;
// The verdict admitCode() reached for the module being loaded: all of its
// executable sections go to the same home.
inline bool codeExternal = false;
// Set when code placed in PSRAM once failed to read back through the
// instruction bus. Retrying would only repeat it - the allocator hands back
// the block it was just given - so from then until reboot this unit keeps
// code where it always worked. Published as moduleMemory.codePolicy 0.
inline bool codeDemoted = false;
inline uint8_t codeRule() {
  return codeDemoted ? (uint8_t)PF_MODULE_CODE_INTERNAL : codePolicy;
}

// Code in PSRAM is given whole cache lines, start and length. The bytes are
// written through the data cache and have to be written back to the chip
// before they can be fetched, and the S3's write-back has an erratum: a line
// that someone else touches while it is being written back can come back
// wrong (ESP_ROM_HAS_CACHE_WRITEBACK_BUG; the SDK's patched routine protects
// only the unaligned edges of a range). An ordinary heap block shares its
// first and last line with the allocator's own headers and with whatever
// block sits next to it, which the other core may be splitting or merging at
// that moment. A block that owns its lines has no such neighbour.
constexpr size_t CODE_LINE = 64;   // covers every cache line size the S3 offers
inline size_t codeBlockBytes(size_t bytes) {
  return (bytes + CODE_LINE - 1) & ~(CODE_LINE - 1);
}

// Internal bytes this load may still place in data sections: what the reserve
// leaves after the module's executable image is priced. Zero outside a load,
// so setup()'s api->alloc() and the temporary ELF image stay PSRAM-first.
inline size_t dataBudget = 0;

inline bool fits(size_t bytes, size_t available, size_t reserve = 0) {
  return bytes && reserve <= available && bytes <= available - reserve;
}

inline size_t serviceFree() { return heap_caps_get_free_size(internalData); }

// What a module may take from internal RAM without pushing the services under
// the reserve. Nothing is held; this is the one number every decision inside a
// load is made against, and /api/status publishes it.
inline size_t budget() {
  const size_t free = serviceFree();
  const size_t reserve = (size_t)PF_MODULE_INTERNAL_RESERVE;
  return free > reserve ? free - reserve : 0;
}

// One allocation out of the service pool, charged its own size against live
// free BEFORE it is attempted. Total space and a contiguous block both matter.
inline void* internal(size_t bytes, uint32_t caps, bool zero = false) {
  if (!fits(bytes, serviceFree(), (size_t)PF_MODULE_INTERNAL_RESERVE)) return nullptr;
  if (bytes > heap_caps_get_largest_free_block(caps)) return nullptr;
  return zero ? heap_caps_calloc(1, bytes, caps) : heap_caps_malloc(bytes, caps);
}

// Never let the running total wrap: a data section may reach the internal heap
// through the PSRAM-refused fallback without having been budgeted for.
inline void spend(size_t bytes) {
  dataBudget = bytes >= dataBudget ? 0 : dataBudget - bytes;
}

// Whole-module admission, called once from load() before any section is
// placed. codeBytes is the SUM of the module's executable sections, taken from
// the section headers, so the verdict is a property of the module and not of
// the order its sections happen to be walked in.
//
// With a second home for code the verdict is where, and only fails when there
// is nowhere: code in PSRAM is charged nothing against the internal budget,
// so all of it is left for the module's small data.
inline bool codeFitsExternal(size_t codeBytes) {
  // Each executable section is rounded up to whole lines and aligned to one;
  // eight lines of slack covers that for any module the loader will take.
  return codeBytes && codeBlockBytes(codeBytes) + 8 * CODE_LINE <=
                          heap_caps_get_largest_free_block(externalData);
}
inline bool admitCode(size_t codeBytes) {
  const size_t room = budget();
  const bool fitsInternal = codeBytes <= room;
  const uint8_t rule = codeRule();
  // Under the fallback rule "does not fit" has to mean what code() will find:
  // room in total is not a block of that size, and a module refused for
  // fragmentation is exactly the one the second home is for.
  const bool placeable =
      fitsInternal && codeBytes <= heap_caps_get_largest_free_block(internalCode);
  codeExternal =
      (rule == PF_MODULE_CODE_PSRAM_FIRST && codeFitsExternal(codeBytes)) ||
      (rule == PF_MODULE_CODE_PSRAM_FALLBACK && !placeable &&
       codeFitsExternal(codeBytes));
  if (codeExternal) {
    dataBudget = room;
    return true;
  }
  dataBudget = fitsInternal ? room - codeBytes : 0;
  return fitsInternal;
}
inline void endLoad() { dataBudget = 0; }

inline void* data(size_t bytes, bool zero, bool preferExternal) {
  if (!bytes) return nullptr;
  void* p = nullptr;
  // The budget decides WHERE, never WHETHER. Past it the section goes to
  // PSRAM, and if PSRAM refuses, the reserve-checked internal heap is still
  // tried - so data can lose its placement but can never fail a load alone.
  if (!preferExternal && bytes <= dataBudget) {
    p = internal(bytes, internalData, zero);
    if (p) spend(bytes);
  }
  if (!p) {
    p = zero ? heap_caps_calloc(1, bytes, externalData)
             : heap_caps_malloc(bytes, externalData);
  }
  if (!p) {
    p = internal(bytes, internalData, zero);
    if (p) spend(bytes);
  }
  if (!p) ++refusals;
  return p;
}

// The home admitCode() chose. A PSRAM block is returned at its data-bus
// address; the caller owns the translation to the address it is fetched from.
//
// Returns where the code goes; `*block` is what to free. They differ in PSRAM:
// the allocation carries one line of slack and the code starts at the first
// line boundary inside it, so every line it occupies lies wholly within the
// allocation. Aligned by hand rather than with heap_caps_aligned_alloc()
// because that call was the allocator's aligned path's only user in the
// image, and the path is IRAM: 1.5 KB of the internal RAM this placement
// exists to give back (measured from the linked sections, 2026-10-02).
inline void* code(size_t bytes, void** block) {
  void* p = nullptr;
  if (codeExternal) {
    void* raw = heap_caps_malloc(codeBlockBytes(bytes) + CODE_LINE, externalData);
    *block = raw;
    if (raw) {
      p = reinterpret_cast<void*>(((uintptr_t)raw + CODE_LINE - 1) &
                                  ~(uintptr_t)(CODE_LINE - 1));
    }
  } else {
    p = internal(bytes, internalCode);
    *block = p;
  }
  if (!p) ++refusals;
  return p;
}
} // namespace PFModuleMemory
