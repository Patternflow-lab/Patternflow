// ═══════════════════════════════════════════════════════════
// PatternFlow - what a board that died leaves behind
//
// A crash used to leave one word. resetReason said "panic" or "task_wdt", and
// nothing said where, or in which of forty installed patterns. Two records
// answer that, and they are kept apart here because they do not live equally
// long and do not always describe the same death.
//
// THE CORE DUMP. The SDK is built with CONFIG_ESP_COREDUMP_ENABLE_TO_FLASH and
// the partition table has always carried a 64 KB `coredump` partition - the
// table was copied to stay identical to the Arduino package and the line came
// along unexamined - so every panic (an exception, an abort(), a task or
// interrupt watchdog) was already set up to end with the SDK writing an ELF
// image of every task's stack there. It survives a power cycle and a reflash
// (the flasher writes nothing at 0xFF0000), and nothing ever read it. begin()
// reads its summary once per boot: the task, the exception, the PC, up to
// sixteen return addresses, and the hash of the image that crashed - the same
// hash /api/status publishes as `build`, so a report names the ELF that
// decodes it.
//
// THE BREADCRUMB. A backtrace says where the CPU was. It does not say which
// pattern was on the panel, and for a module it cannot be decoded at all: a
// .pfm is loaded wherever the heap had room, so its code sits at an address no
// firmware.elf has heard of. So the pattern's slug, which of its entry points
// was executing and where its code was loaded are kept in RTC memory, which a
// panic or a watchdog reset does not clear. With those an address inside the
// module becomes an offset into the .pfm, and the .pfm's own symbol table
// resolves that.
//
// The dump outlives the breadcrumb: flash keeps it until the next panic
// overwrites it or somebody clears it, while RTC memory is gone with the
// power. And a death does not always write a dump - a reset by the RTC
// watchdog never reaches the panic handler, and a dump too large for the
// partition is refused before the old one is erased, so the old one stays. A
// breadcrumb from today next to a backtrace from last week would be a
// confident lie, so the record says whether the two belong together
// (dumpFromThisReset), and only then are module addresses turned into offsets.
//
// What this file does not do is act on any of it. No pattern is forgotten, no
// reboot is forced, the boot latch in the sketch is untouched: this is the
// half that reports. It costs two word stores per call into a pattern, 64
// bytes of RTC memory and 232 bytes of internal RAM (heap start moved from
// 0x3fcaab78 to 0x3fcaac60 on the default build). Eight of those are this
// file's two pointers. The other 224 are four error strings that come with
// esp_core_dump_get_summary(): the SDK's core dump code keeps its log text in
// DRAM so it can print with the flash cache off, and that holds for the one
// function in it that only ever runs at boot. Reading the dump without the
// SDK's parser would get them back, at the price of a parser. The record
// itself is allocated in PSRAM, and only on a board that has something to
// report.
//
// License: MIT
// ═══════════════════════════════════════════════════════════
#pragma once

#include <Arduino.h>
#include <string.h>
#include <esp_attr.h>
#include <esp_core_dump.h>
#include <esp_partition.h>
#include <esp_system.h>

#include "core_mem.h"
#include "core_module_elf.h"   // ELF_MAGIC

namespace PFCrash {

// What the device was doing. IDLE is everything that is not pattern code -
// the blit, the features, the network - so "idle" beside a slug reads "that
// pattern was resident, and this was not inside it".
enum Phase : uint32_t {
  IDLE = 0,
  LOADING,        // reading and relocating a .pfm, up to and including its entry point
  CONSTRUCTORS,   // the module's .init_array
  SETUP,
  UPDATE,
  DRAW,
  // Not a pattern's phase: begin() itself, inside the SDK's dump parser. See
  // begin() for why reading a record of a crash is a thing to leave a trail
  // around.
  READING_DUMP,
  PHASE_COUNT
};

inline const char* phaseName(uint32_t phase) {
  switch (phase) {
    case LOADING:      return "loading";
    case CONSTRUCTORS: return "constructors";
    case SETUP:        return "setup";
    case UPDATE:       return "update";
    case DRAW:         return "draw";
    case READING_DUMP: return "dump-read";
    default:           return "idle";
  }
}

constexpr size_t SLUG_BYTES = 40;       // MODULE_NAME_BYTES; a longer slug is cut
constexpr uint32_t TRAIL_MAGIC = 0x50464331;   // "PFC1": bump when the layout changes

// The breadcrumb. Plain data with no initialisers on purpose: a constructor
// would run at every boot and wipe the one thing this exists to carry across.
struct Trail {
  uint32_t magic;
  // Over everything below `phase`. RTC memory is noise after a power-on and
  // intact after a panic, and the only way to tell is to check.
  uint32_t check;
  // Outside the checksum because it is written twice per call into a pattern,
  // and the budget for that is one store each way. It needs no seal of its
  // own: a block whose magic and checksum hold was written by this firmware,
  // and then so was this word.
  uint32_t phase;
  // Where the module's code is EXECUTED, and how much of it there is: the
  // range a crash PC inside the module falls in. Zero for a preset, whose
  // code is in firmware.elf like everything else.
  uint32_t codeBase;
  uint32_t codeSize;
  // The checksum word of the core dump that was in flash when this boot
  // looked; 0 for none. The next boot compares, and a dump that is not this
  // one was written by the reset in between.
  uint32_t dumpSeen;
  char slug[SLUG_BYTES];
};

// .rtc_noinit is a NOLOAD region of RTC slow memory (0x50000000) that the
// startup code neither copies nor zeroes, which is the whole point.
//
// It is shared, and that has a price to know about. The SDK keeps its RTC
// clock bookkeeping in the same region (s_rtc_last_ticks, s_esp_rtc_time_us)
// and initialises it only on a power-on; the sketch's object links ahead of
// the SDK's, so this struct sits first and those two words sit after it. An
// image that changes this struct's size moves them, and the first boot into
// it after a warm reset - an update over the air - reads them from memory
// nothing wrote: the wall clock is wrong on that one boot until SNTP sets it.
// That is from the SDK's code (esp_rtc_get_time_us zeroes them only while the
// slow-clock calibration register reads 0), not from a panel. Do not grow
// this struct casually.
inline RTC_NOINIT_ATTR Trail trail;

// Who the breadcrumb currently names, as a pointer nobody dereferences: a
// preset's name literal, a module's path. Ordinary RAM, because it only has
// to answer "is this still the pattern I named" within one boot.
inline const void* owner = nullptr;

inline uint32_t seal() {
  // FNV-1a over the fields that change when the pattern does.
  const uint8_t* p = reinterpret_cast<const uint8_t*>(&trail.codeBase);
  const uint8_t* end = reinterpret_cast<const uint8_t*>(&trail) + sizeof(trail);
  uint32_t h = 2166136261u;
  for (; p < end; ++p) {
    h ^= *p;
    h *= 16777619u;
  }
  return h;
}

// The store around a call into pattern code. Nothing else belongs in here.
inline void enter(Phase phase) { trail.phase = phase; }

inline bool isRunning(const void* who) { return owner == who; }

// Name the pattern. Takes a module's path or a preset's slug and keeps the
// leaf without its extension, which for "/patterns/cell_ripple.pfm" is the
// slug and for a slug is itself.
inline void running(const void* who, const char* pathOrSlug) {
  const char* leaf = pathOrSlug ? strrchr(pathOrSlug, '/') : nullptr;
  leaf = leaf ? leaf + 1 : (pathOrSlug ? pathOrSlug : "");
  memset(trail.slug, 0, sizeof(trail.slug));
  snprintf(trail.slug, sizeof(trail.slug), "%s", leaf);
  char* extension = strrchr(trail.slug, '.');
  if (extension) memset(extension, 0, sizeof(trail.slug) - (size_t)(extension - trail.slug));
  trail.codeBase = 0;
  trail.codeSize = 0;
  trail.check = seal();
  owner = who;
}

// Where the named module's code runs from. Must be the address the CPU
// fetches it at - the one a crash PC will carry - not merely the address it
// was written through.
inline void code(uintptr_t base, uint32_t bytes) {
  trail.codeBase = (uint32_t)base;
  trail.codeSize = bytes;
  trail.check = seal();
}

// Nothing is resident: a module left, or a load failed. Without this the
// breadcrumb keeps naming the last pattern through a PATTERN FAILED screen
// and a crash there is pinned on something that was not running.
inline void forget() {
  memset(trail.slug, 0, sizeof(trail.slug));
  trail.codeBase = 0;
  trail.codeSize = 0;
  trail.phase = IDLE;
  trail.check = seal();
  owner = nullptr;
}

// What begin() found, for /api/status. Two halves, each with its own flag.
struct Record {
  // The breadcrumb, when this boot followed a panic or a watchdog and RTC
  // memory still held it. The reset it belongs to is this boot's resetReason.
  bool trailed;
  uint8_t phase;
  char slug[SLUG_BYTES];
  uint32_t codeBase;
  uint32_t codeSize;

  // The core dump, when the partition holds a valid one.
  bool dumped;
  // The dump was written by the reset this boot followed, so the breadcrumb
  // above describes the same death. False for a dump left by an earlier one.
  bool dumpFromThisReset;
  bool corrupted;          // the SDK's verdict on the backtrace it walked
  uint8_t depth;
  char task[16];
  uint32_t cause;          // Xtensa EXCCAUSE as the SDK recorded it
  uint32_t vaddr;
  uint32_t pc;
  uint32_t frames[16];
  char build[APP_ELF_SHA256_SZ];
  uint32_t bytes;
};

inline Record* record = nullptr;

// An address from the dump that lies inside the code the breadcrumb named,
// as an offset into it. Only meaningful when both halves are one death.
inline bool inModule(const Record& r, uint32_t address, uint32_t& offset) {
  if (!r.trailed || !r.dumpFromThisReset || r.codeSize == 0) return false;
  offset = address - r.codeBase;
  return offset < r.codeSize;
}

inline const esp_partition_t* dumpPartition() {
  return esp_partition_find_first(ESP_PARTITION_TYPE_DATA,
                                  ESP_PARTITION_SUBTYPE_DATA_COREDUMP, nullptr);
}

// Whether the partition holds something the SDK's summary parser can safely
// be handed, and that image's size and checksum word.
//
// esp_core_dump_get_summary() maps as many bytes as the first word says and
// reads an ELF header twenty bytes in, checking neither (IDF 4.4.7,
// disassembled: no bounds test before esp_partition_mmap, `addi a5, a6, 20`).
// The partition is not this firmware's alone - a board that ran a build on
// another SDK generation keeps that build's dump, and a later generation's
// header is a word longer - so the size is bounded and the ELF magic is
// looked for where THIS parser will look, before anything is parsed.
inline bool dumpPresent(const esp_partition_t* part, uint32_t& bytes, uint32_t& checkWord) {
  uint32_t head[6];
  if (!part || esp_partition_read(part, 0, head, sizeof(head)) != ESP_OK) return false;
  bytes = head[0];
  if (bytes == 0xFFFFFFFFu) return false;   // erased: never panicked, or cleared
  if (bytes < sizeof(head) + sizeof(uint32_t) || bytes > part->size) return false;
  if (head[5] != PFModuleLoader::ELF_MAGIC) return false;
  // CONFIG_ESP_COREDUMP_CHECKSUM_CRC32: the image ends in its own CRC.
  return esp_partition_read(part, bytes - sizeof(uint32_t), &checkWord,
                            sizeof(checkWord)) == ESP_OK;
}

// Once, first thing in setup(): before any pattern is loaded, because the
// first one overwrites the breadcrumb this reads.
inline void begin() {
  const esp_reset_reason_t why = esp_reset_reason();
  const bool died = why == ESP_RST_PANIC || why == ESP_RST_INT_WDT ||
                    why == ESP_RST_TASK_WDT || why == ESP_RST_WDT;
  const bool kept = trail.magic == TRAIL_MAGIC && trail.check == seal() &&
                    trail.phase < PHASE_COUNT;
  const Trail last = trail;

  // This boot's own trail starts here, valid from the first line that could
  // crash - which is the dump parser, a few lines down.
  if (!kept) memset(&trail, 0, sizeof(trail));
  trail.magic = TRAIL_MAGIC;
  forget();

  const bool trailed = kept && died;
  // The last boot died in the parser below. Reading a crash record at boot is
  // the one place this file could turn a board that crashed once into a board
  // that cannot start, and setup() runs on the task no watchdog covers. So
  // the parse leaves a trail like a pattern does, and a boot that finds it
  // does not try again. (The panic it took will normally have replaced the
  // dump that caused it, so the boot after this one reads a good one.)
  const bool choked = trailed && last.phase == READING_DUMP;

  const uint32_t startedMs = millis();
  const esp_partition_t* part = dumpPartition();
  uint32_t bytes = 0, checkWord = 0;
  const bool present = dumpPresent(part, bytes, checkWord);
  bool dumped = false;
  // Zeroed, because the parser returns ESP_OK without having filled the task
  // name or the backtrace when it does not find the crashed task's stack.
  esp_core_dump_summary_t summary = {};
  if (present && !choked) {
    enter(READING_DUMP);
    // The whole image against its CRC first: a dump cut short by a power loss
    // has a believable first word and anything at all after it.
    dumped = esp_core_dump_image_check() == ESP_OK &&
             esp_core_dump_get_summary(&summary) == ESP_OK;
    enter(IDLE);
  }
  const uint32_t readMs = millis() - startedMs;

  // A dump this boot has not seen before, after a reset that writes one. Only
  // a kept trail can say what "before" was; after a power-on the dump is
  // simply an old one.
  const bool fresh = dumped && trailed && checkWord != last.dumpSeen;
  trail.dumpSeen = present ? checkWord : 0;
  trail.check = seal();

  if (choked) {
    Serial.println("[CRASH] the last boot died reading the core dump - not reading it again this boot");
  }
  if (!trailed && !dumped) return;

  record = static_cast<Record*>(PFMem::alloc(sizeof(Record)));
  if (!record) return;
  if (trailed) {
    record->trailed = true;
    record->phase = (uint8_t)last.phase;
    memcpy(record->slug, last.slug, sizeof(record->slug));
    record->slug[sizeof(record->slug) - 1] = '\0';
    record->codeBase = last.codeBase;
    record->codeSize = last.codeSize;
    Serial.printf("[CRASH] the reset came during %s", phaseName(last.phase));
    if (record->slug[0]) Serial.printf(" of \"%s\"", record->slug);
    else Serial.print(", no pattern resident");
    if (last.codeSize) {
      Serial.printf(", module code at 0x%08x (%u B)", (unsigned)last.codeBase,
                    (unsigned)last.codeSize);
    }
    Serial.println();
  }
  if (dumped) {
    record->dumped = true;
    record->dumpFromThisReset = fresh;
    record->corrupted = summary.exc_bt_info.corrupted;
    record->cause = summary.ex_info.exc_cause;
    record->vaddr = summary.ex_info.exc_vaddr;
    record->pc = summary.exc_pc;
    record->bytes = bytes;
    snprintf(record->task, sizeof(record->task), "%.15s", summary.exc_task);
    snprintf(record->build, sizeof(record->build), "%.*s", (int)sizeof(record->build) - 1,
             reinterpret_cast<const char*>(summary.app_elf_sha256));
    const uint32_t depth = summary.exc_bt_info.depth;
    record->depth = (uint8_t)(depth < 16 ? depth : 16);
    for (uint8_t i = 0; i < record->depth; ++i) record->frames[i] = summary.exc_bt_info.bt[i];

    Serial.printf("[CRASH] core dump%s: task %s, cause %u at 0x%08x, build %s, %u B, read in %u ms\n",
                  fresh ? "" : " (from an earlier reset)", record->task,
                  (unsigned)record->cause, (unsigned)record->vaddr, record->build,
                  (unsigned)bytes, (unsigned)readMs);
    // The same shape as the SDK's own "Backtrace:" line, so the tools people
    // already paste that into take this one too. A frame inside the module is
    // written as an offset, which no firmware.elf could have decoded anyway.
    Serial.print("[CRASH] backtrace:");
    for (uint8_t i = 0; i < record->depth; ++i) {
      uint32_t offset;
      if (inModule(*record, record->frames[i], offset)) {
        Serial.printf(" %s+0x%x", record->slug, (unsigned)offset);
      } else {
        Serial.printf(" 0x%08x", (unsigned)record->frames[i]);
      }
    }
    Serial.println(record->corrupted ? " |<-CORRUPTED" : "");
  }
}

// Erase the dump and drop the record. True when there was anything to clear.
//
// The SDK erases the whole 64 KB rather than the first sector, which is the
// right amount - a dump is every task's stack, and "cleared" should mean gone
// - and costs a flash erase with both cores' caches off: the panel holds its
// last frame for a moment. Called from an HTTP handler, on the task that
// also reads `record`.
inline bool clear() {
  uint32_t first = 0xFFFFFFFFu;
  const esp_partition_t* part = dumpPartition();
  const bool stored = part &&
      esp_partition_read(part, 0, &first, sizeof(first)) == ESP_OK &&
      first != 0xFFFFFFFFu;
  if (!stored && !record) return false;
  if (stored) esp_core_dump_image_erase();
  free(record);
  record = nullptr;
  return true;
}

}  // namespace PFCrash
