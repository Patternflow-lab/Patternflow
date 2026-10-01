// The crash record's boot logic (src/core_crash.h) with the chip replaced at
// its boundary: a reset reason, a coredump partition and the SDK's dump parser
// that the test scripts. Memory that survives a reset is the test not touching
// PFCrash::trail between two boots; a power-on is the test filling it with
// noise.
#include <algorithm>
#include <cassert>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

// ── The SDK, as far as core_crash.h reaches into it ─────────────────────────
#define __NOINIT_ATTR
using esp_err_t = int;
constexpr esp_err_t ESP_OK = 0, ESP_FAIL = -1;
enum esp_reset_reason_t {
  ESP_RST_UNKNOWN, ESP_RST_POWERON, ESP_RST_EXT, ESP_RST_SW, ESP_RST_PANIC,
  ESP_RST_INT_WDT, ESP_RST_TASK_WDT, ESP_RST_WDT, ESP_RST_DEEPSLEEP,
  ESP_RST_BROWNOUT, ESP_RST_SDIO,
};
static esp_reset_reason_t resetReason = ESP_RST_POWERON;
static esp_reset_reason_t esp_reset_reason() { return resetReason; }

// The coredump partition: 64 KB in partitions/app3M_fat9M_16MB.csv.
constexpr uint32_t PARTITION_BYTES = 0x10000;
constexpr int ESP_PARTITION_TYPE_DATA = 1, ESP_PARTITION_SUBTYPE_DATA_COREDUMP = 3;
struct esp_partition_t { uint32_t size; };
static const esp_partition_t partition{PARTITION_BYTES};
static std::vector<uint8_t> flash(PARTITION_BYTES, 0xFF);
static bool partitionMissing = false, readFails = false;
static const esp_partition_t* esp_partition_find_first(int type, int subtype, const char* label) {
  assert(type == ESP_PARTITION_TYPE_DATA && subtype == ESP_PARTITION_SUBTYPE_DATA_COREDUMP && !label);
  return partitionMissing ? nullptr : &partition;
}
static esp_err_t esp_partition_read(const esp_partition_t* part, size_t offset, void* out, size_t bytes) {
  assert(part == &partition);
  // The size word of a dump is whatever flash holds. Nothing in core_crash.h
  // may turn it into a read past the partition, whatever it says.
  assert(offset <= PARTITION_BYTES && bytes <= PARTITION_BYTES - offset);
  if (readFails) return ESP_FAIL;
  memcpy(out, flash.data() + offset, bytes);
  return ESP_OK;
}

// esp_core_dump.h, IDF 4.4.7, Xtensa.
constexpr int APP_ELF_SHA256_SZ = 17;
struct esp_core_dump_bt_info_t { uint32_t bt[16]; uint32_t depth; bool corrupted; };
struct esp_core_dump_summary_extra_info_t {
  uint32_t exc_cause, exc_vaddr, exc_a[16], epcx[6], epcx_reg_bits;
};
struct esp_core_dump_summary_t {
  uint32_t exc_tcb;
  char exc_task[16];
  uint32_t exc_pc;
  esp_core_dump_bt_info_t exc_bt_info;
  uint32_t core_dump_version;
  uint8_t app_elf_sha256[APP_ELF_SHA256_SZ];
  esp_core_dump_summary_extra_info_t ex_info;
};
static esp_err_t esp_core_dump_image_check();
static esp_err_t esp_core_dump_get_summary(esp_core_dump_summary_t* summary);
static esp_err_t esp_core_dump_image_erase();

static uint32_t clockMs = 0;
static uint32_t millis() { return clockMs += 7; }

struct Logger {
  std::string text;
  void print(const char* s) { text += s; }
  void println(const char* s = "") { text += s; text += '\n'; }
#if defined(__GNUC__)
  __attribute__((format(printf, 2, 3)))   // the production format strings, checked here too
#endif
  void printf(const char* format, ...) {
    char line[512];
    va_list args;
    va_start(args, format);
    vsnprintf(line, sizeof(line), format, args);
    va_end(args);
    text += line;
  }
  bool said(const char* s) const { return text.find(s) != std::string::npos; }
} Serial;

static bool allocFails = false;
namespace PFMem {
inline void* alloc(size_t bytes) { return allocFails ? nullptr : calloc(1, bytes); }
}

#include "core_crash.h"

// ── The dump parser, scripted ───────────────────────────────────────────────
static unsigned imageChecks = 0, parses = 0, erases = 0;
static bool crcHolds = true, parserFails = false;
static esp_core_dump_summary_t inFlash;    // what the dump says, when it parses
static PFCrash::Trail duringParse;         // the breadcrumb as a panic in the parser would leave it

static esp_err_t esp_core_dump_image_check() {
  ++imageChecks;
  duringParse = PFCrash::trail;
  return crcHolds ? ESP_OK : ESP_FAIL;
}
static esp_err_t esp_core_dump_get_summary(esp_core_dump_summary_t* summary) {
  ++parses;
  duringParse = PFCrash::trail;
  if (parserFails) return ESP_FAIL;
  *summary = inFlash;
  return ESP_OK;
}
static esp_err_t esp_core_dump_image_erase() {
  ++erases;
  std::fill(flash.begin(), flash.end(), uint8_t{0xFF});
  return ESP_OK;
}

// What the SDK leaves in the partition: its header with the image's total
// size in the first word, the ELF 20 bytes in, and a CRC in the last word.
// `checkWord` stands for the CRC - the one word two different dumps do not
// share.
static void writeDumpRaw(uint32_t bytes, uint32_t elfMagic, uint32_t checkWord) {
  std::fill(flash.begin(), flash.end(), uint8_t{0xFF});
  const uint32_t head[6] = {bytes, 0x0102, 3, 164, 0, elfMagic};
  memcpy(flash.data(), head, sizeof(head));
  if (bytes >= 4 && bytes <= PARTITION_BYTES) memcpy(flash.data() + bytes - 4, &checkWord, 4);
}
static void writeDump(uint32_t checkWord) {
  writeDumpRaw(23108, PFModuleLoader::ELF_MAGIC, checkWord);
}
static void eraseFlash() { std::fill(flash.begin(), flash.end(), uint8_t{0xFF}); }

static unsigned boots = 0;

// A reset: everything in ordinary RAM is lost, PFCrash::trail is whatever the
// test left in it.
static void boot(esp_reset_reason_t why) {
  free(PFCrash::record);
  PFCrash::record = nullptr;
  PFCrash::owner = nullptr;
  Serial.text.clear();
  imageChecks = parses = 0;
  resetReason = why;
  ++boots;
  PFCrash::begin();
}

// The plug: .noinit comes up as whatever the RAM settled to.
static void powerOn() {
  memset(&PFCrash::trail, 0xA5, sizeof(PFCrash::trail));
  boot(ESP_RST_POWERON);
}

constexpr const char* PROBE = "/patterns/_crash_probe.pfm";
// Internal executable RAM, and PSRAM as the CPU fetches from it: the heap's
// 0x3dc81000 plus the 0x06000000 between the data bus and the instruction bus
// (core_module_loader.h, execAddress).
constexpr uint32_t INTERNAL_CODE = 0x40381c40;
constexpr uint32_t PSRAM_DATA = 0x3dc81000;
constexpr uint32_t PSRAM_CODE = 0x43c81000;
constexpr uint32_t CODE_BYTES = 0x124;

// The calls the loader makes for a module that loads and then runs, in its
// order, stopping inside draw().
static void liveIntoDraw(uint32_t codeBase) {
  PFCrash::running(PROBE, PROBE);
  PFCrash::enter(PFCrash::LOADING);
  PFCrash::code(codeBase, CODE_BYTES);
  PFCrash::enter(PFCrash::CONSTRUCTORS);
  PFCrash::enter(PFCrash::LOADING);
  PFCrash::enter(PFCrash::SETUP);
  PFCrash::enter(PFCrash::IDLE);
  PFCrash::enter(PFCrash::UPDATE);
  PFCrash::enter(PFCrash::IDLE);
  PFCrash::enter(PFCrash::DRAW);
}

// A store through null from fall(), called from draw(), in a module at
// `codeBase`: two frames inside the module, the rest in the firmware.
static void dumpOfProbe(uint32_t codeBase) {
  inFlash = {};
  snprintf(inFlash.exc_task, sizeof(inFlash.exc_task), "loopTask");
  inFlash.exc_pc = codeBase + 0x4e;
  inFlash.exc_bt_info.bt[0] = codeBase + 0x4e;
  inFlash.exc_bt_info.bt[1] = codeBase + 0x9c;
  inFlash.exc_bt_info.bt[2] = 0x4200f1a3;
  inFlash.exc_bt_info.bt[3] = 0x42010b52;
  inFlash.exc_bt_info.depth = 4;
  inFlash.ex_info.exc_cause = 29;
  inFlash.ex_info.exc_vaddr = 0;
  memcpy(inFlash.app_elf_sha256, "3f9a0c1e5d7b2a40", 17);
}

// ── A power-on, with and without something in flash ─────────────────────────
static void testPowerOn() {
  eraseFlash();
  powerOn();
  assert(!PFCrash::record && parses == 0 && imageChecks == 0);
  assert(PFCrash::trail.magic == PFCrash::TRAIL_MAGIC);
  assert(PFCrash::trail.check == PFCrash::seal());
  assert(PFCrash::trail.phase == PFCrash::IDLE && PFCrash::trail.dumpSeen == 0);
  assert(PFCrash::trail.slug[0] == '\0' && PFCrash::trail.codeSize == 0);
  assert(Serial.text.empty());   // a healthy boot prints nothing

  // A dump from some earlier life - this firmware's, or any image before it:
  // the SDK has written them all along. It is reported, as what it is, on
  // every boot until somebody clears it.
  for (int again = 0; again < 2; ++again) {
    writeDump(0xAAAA0001);
    dumpOfProbe(PSRAM_CODE);
    powerOn();
    const PFCrash::Record* r = PFCrash::record;
    assert(r && !r->trailed && r->dumped && !r->dumpFromThisReset);
    assert(r->cause == 29 && r->vaddr == 0 && r->pc == PSRAM_CODE + 0x4e);
    assert(r->depth == 4 && r->bytes == 23108 && !r->corrupted);
    assert(strcmp(r->task, "loopTask") == 0 && strcmp(r->build, "3f9a0c1e5d7b2a40") == 0);
    assert(PFCrash::trail.dumpSeen == 0xAAAA0001);
    assert(Serial.said("core dump (from an earlier reset): task loopTask, cause 29"));
    // Nothing recorded where that module had been, so its frames stay raw.
    assert(Serial.said("backtrace: 0x43c8104e 0x43c8109c 0x4200f1a3 0x42010b52\n"));
    uint32_t offset;
    assert(!PFCrash::inModule(*r, PSRAM_CODE + 0x4e, offset));
  }
}

// ── The case the record exists for ──────────────────────────────────────────
static void testPanicInModule(uint32_t codeBase, const char* rawFrames) {
  writeDump(0xAAAA0001);
  powerOn();                      // this boot saw the old dump ...
  liveIntoDraw(codeBase);
  assert(PFCrash::isRunning(PROBE));
  writeDump(0xBBBB0002);          // ... and the panic replaced it
  dumpOfProbe(codeBase);
  boot(ESP_RST_PANIC);

  const PFCrash::Record* r = PFCrash::record;
  assert(r && r->trailed && r->dumped && r->dumpFromThisReset);
  assert(r->phase == PFCrash::DRAW && strcmp(r->slug, "_crash_probe") == 0);
  assert(r->codeBase == codeBase && r->codeSize == CODE_BYTES);
  assert(Serial.said("the reset came during draw of \"_crash_probe\", module code at 0x"));
  assert(Serial.said("[CRASH] core dump: task loopTask"));
  assert(Serial.said("backtrace: _crash_probe+0x4e _crash_probe+0x9c 0x4200f1a3 0x42010b52\n"));
  uint32_t offset = 0;
  assert(PFCrash::inModule(*r, r->pc, offset) && offset == 0x4e);
  assert(!PFCrash::inModule(*r, 0x4200f1a3, offset));
  // This boot's own breadcrumb names nothing until a pattern is loaded, and
  // remembers the dump it has now seen.
  assert(PFCrash::trail.slug[0] == '\0' && PFCrash::trail.phase == PFCrash::IDLE);
  assert(PFCrash::trail.codeSize == 0 && PFCrash::trail.dumpSeen == 0xBBBB0002);
  assert(!PFCrash::isRunning(PROBE));

  // The same death when the SDK could not write its dump (too large for the
  // partition: refused before the old one is erased). The breadcrumb is
  // today's and the backtrace is not, and an old address that happens to fall
  // in today's range must not be dressed up as an offset.
  liveIntoDraw(codeBase);
  boot(ESP_RST_PANIC);
  r = PFCrash::record;
  assert(r && r->trailed && r->dumped && !r->dumpFromThisReset);
  assert(r->codeBase == codeBase && !PFCrash::inModule(*r, r->pc, offset));
  assert(Serial.said("core dump (from an earlier reset)"));
  assert(Serial.said(rawFrames));
}

// ── Reset reason x breadcrumb x dump ────────────────────────────────────────
enum TrailState { INTACT, NOISE, BROKEN_SEAL, BAD_MAGIC, BAD_PHASE, TRAIL_STATES };
enum DumpState {
  NO_DUMP,      // none before, none after
  OLD_DUMP,     // the one the last boot saw, untouched
  NEW_DUMP,     // the reset replaced the one the last boot saw
  FIRST_DUMP,   // the reset wrote one where there was none
  TORN_DUMP,    // a new one whose CRC does not hold: power lost mid-write
  DUMP_STATES
};

static void testMatrix() {
  const esp_reset_reason_t reasons[] = {
    ESP_RST_UNKNOWN, ESP_RST_POWERON, ESP_RST_EXT, ESP_RST_SW, ESP_RST_PANIC,
    ESP_RST_INT_WDT, ESP_RST_TASK_WDT, ESP_RST_WDT, ESP_RST_DEEPSLEEP,
    ESP_RST_BROWNOUT, ESP_RST_SDIO,
  };
  for (esp_reset_reason_t why : reasons) {
    const bool died = why == ESP_RST_PANIC || why == ESP_RST_INT_WDT ||
                      why == ESP_RST_TASK_WDT || why == ESP_RST_WDT;
    for (int trailState = 0; trailState < TRAIL_STATES; ++trailState) {
      for (int dumpState = 0; dumpState < DUMP_STATES; ++dumpState) {
        // The life before the reset.
        crcHolds = true;
        if (dumpState == NO_DUMP || dumpState == FIRST_DUMP) eraseFlash();
        else writeDump(0xAAAA0001);
        dumpOfProbe(PSRAM_CODE);
        powerOn();
        liveIntoDraw(PSRAM_CODE);

        // What the reset left in flash ...
        if (dumpState == NEW_DUMP || dumpState == FIRST_DUMP || dumpState == TORN_DUMP) {
          writeDump(0xBBBB0002);
        }
        crcHolds = dumpState != TORN_DUMP;
        // ... and in RAM.
        switch (trailState) {
          case NOISE: memset(&PFCrash::trail, 0x5A, sizeof(PFCrash::trail)); break;
          case BROKEN_SEAL: PFCrash::trail.slug[3] ^= 0x20; break;
          case BAD_MAGIC: PFCrash::trail.magic ^= 1; break;
          case BAD_PHASE: PFCrash::trail.phase = PFCrash::PHASE_COUNT; break;
          default: break;
        }
        boot(why);

        const bool trailed = died && trailState == INTACT;
        const bool dumped = dumpState == OLD_DUMP || dumpState == NEW_DUMP ||
                            dumpState == FIRST_DUMP;
        const bool fresh = trailed && (dumpState == NEW_DUMP || dumpState == FIRST_DUMP);
        const PFCrash::Record* r = PFCrash::record;
        assert((r != nullptr) == (trailed || dumped));
        if (r) {
          assert(r->trailed == trailed && r->dumped == dumped);
          assert(r->dumpFromThisReset == fresh);
          if (trailed) {
            assert(r->phase == PFCrash::DRAW && strcmp(r->slug, "_crash_probe") == 0);
            assert(r->codeBase == PSRAM_CODE && r->codeSize == CODE_BYTES);
          } else {
            assert(r->slug[0] == '\0' && r->codeSize == 0);
          }
          uint32_t offset;
          assert(PFCrash::inModule(*r, PSRAM_CODE + 0x4e, offset) == fresh);
        }
        // Whatever it found, this boot's breadcrumb is one the next boot will
        // accept, and it knows which dump is in flash now.
        assert(PFCrash::trail.magic == PFCrash::TRAIL_MAGIC);
        assert(PFCrash::trail.check == PFCrash::seal());
        assert(PFCrash::trail.phase == PFCrash::IDLE);
        const uint32_t inFlashNow = dumpState == NO_DUMP ? 0u
                                  : dumpState == OLD_DUMP ? 0xAAAA0001u : 0xBBBB0002u;
        assert(PFCrash::trail.dumpSeen == inFlashNow);
      }
    }
  }
  crcHolds = true;
}

// ── A dump that kills the parser must not keep the board from starting ──────
static void testParserChoke() {
  writeDump(0xAAAA0001);
  dumpOfProbe(PSRAM_CODE);
  powerOn();
  assert(parses == 1 && imageChecks == 1);
  // The parser ran between two marks, on a breadcrumb that was already
  // sealed: had it panicked there, this is what the next boot would find.
  assert(duringParse.phase == PFCrash::READING_DUMP);
  assert(duringParse.magic == PFCrash::TRAIL_MAGIC);
  PFCrash::trail = duringParse;
  boot(ESP_RST_PANIC);
  assert(parses == 0 && imageChecks == 0);
  assert(Serial.said("died reading the core dump"));
  const PFCrash::Record* r = PFCrash::record;
  assert(r && r->trailed && r->phase == PFCrash::READING_DUMP && !r->dumped);
  assert(strcmp(PFCrash::phaseName(r->phase), "dump-read") == 0);
  // It still noted which dump is there, so a later one is told apart from it.
  assert(PFCrash::trail.dumpSeen == 0xAAAA0001);

  // Only a death skips the parse. A reboot from the same mark for any other
  // reason is not evidence against the dump.
  PFCrash::trail = duringParse;
  boot(ESP_RST_SW);
  assert(parses == 1 && PFCrash::record && PFCrash::record->dumped);

  // The parser refusing a dump is an answer, not a death.
  parserFails = true;
  powerOn();
  assert(parses == 1 && !PFCrash::record);
  parserFails = false;
}

// ── What is in flash is not trusted to be a dump this parser can read ───────
static void testDumpGuards() {
  dumpOfProbe(PSRAM_CODE);
  struct Case { uint32_t bytes; uint32_t magic; };
  const Case refused[] = {
    {0xFFFFFFFFu, 0xFFFFFFFFu},                         // erased
    {PARTITION_BYTES + 4, PFModuleLoader::ELF_MAGIC},   // a size the partition cannot hold
    {0x7FFFFFFFu, PFModuleLoader::ELF_MAGIC},
    {24, PFModuleLoader::ELF_MAGIC},                    // no room for the header and a CRC
    {0, PFModuleLoader::ELF_MAGIC},
    {23108, 0x0102},                                    // another SDK generation's header: no ELF 20 bytes in
  };
  for (const Case& c : refused) {
    writeDumpRaw(c.bytes, c.magic, 0xCCCC0003);
    powerOn();
    assert(parses == 0 && imageChecks == 0 && !PFCrash::record);
    assert(PFCrash::trail.dumpSeen == 0);
  }
  // The largest size that is still inside the partition is read to its end
  // and no further (esp_partition_read above asserts the bound).
  writeDumpRaw(PARTITION_BYTES, PFModuleLoader::ELF_MAGIC, 0xCCCC0003);
  powerOn();
  assert(parses == 1 && PFCrash::record && PFCrash::record->bytes == PARTITION_BYTES);
  assert(PFCrash::trail.dumpSeen == 0xCCCC0003);

  writeDump(0xAAAA0001);
  readFails = true;
  powerOn();
  assert(parses == 0 && !PFCrash::record);
  assert(!PFCrash::clear());      // unreadable flash is not "something to clear"
  readFails = false;

  partitionMissing = true;        // a partition table without the line
  powerOn();
  assert(parses == 0 && !PFCrash::record && !PFCrash::clear());
  partitionMissing = false;

  // A parse that fills in less than it promises: no terminator on the task
  // name or the hash, more frames than the array holds.
  writeDump(0xAAAA0001);
  memset(inFlash.exc_task, 'T', sizeof(inFlash.exc_task));
  memset(inFlash.app_elf_sha256, 'h', sizeof(inFlash.app_elf_sha256));
  inFlash.exc_bt_info.depth = 40;
  inFlash.exc_bt_info.corrupted = true;
  powerOn();
  const PFCrash::Record* r = PFCrash::record;
  assert(r && strlen(r->task) == 15 && strlen(r->build) == 16 && r->depth == 16);
  assert(r->corrupted && Serial.said(" |<-CORRUPTED\n"));

  // No memory for the record: nothing reported, nothing dereferenced.
  allocFails = true;
  powerOn();
  assert(!PFCrash::record);
  allocFails = false;
}

// ── Naming ──────────────────────────────────────────────────────────────────
static void slugIs(const char* pathOrSlug, const char* expected) {
  static const int who = 0;
  PFCrash::running(&who, pathOrSlug);
  assert(strcmp(PFCrash::trail.slug, expected) == 0);
  // Everything after the slug is zero: the seal is over the whole field, and
  // the next boot copies all of it.
  for (size_t i = strlen(expected); i < PFCrash::SLUG_BYTES; ++i) assert(PFCrash::trail.slug[i] == '\0');
  assert(PFCrash::trail.check == PFCrash::seal());
  assert(PFCrash::isRunning(&who));
}

static void testNaming() {
  eraseFlash();
  powerOn();
  slugIs("/patterns/cell_ripple.pfm", "cell_ripple");
  slugIs("cell_ripple.pfm", "cell_ripple");
  slugIs("origin", "origin");                       // a preset's slug is itself
  slugIs("/patterns/v1.2_rings.pfm", "v1.2_rings"); // only the last dot is the extension
  slugIs("/patterns/", "");
  slugIs("", "");
  slugIs(nullptr, "");
  // Longer than the field: cut, terminated, and never a bare ".p" at the end.
  slugIs("/patterns/a_name_that_is_longer_than_the_breadcrumb_has_room_for.pfm",
         "a_name_that_is_longer_than_the_breadcru");
  slugIs("/patterns/abcdefghijklmnopqrstuvwxyz_0123456789.pfm",
         "abcdefghijklmnopqrstuvwxyz_0123456789");

  // Naming a pattern drops the last one's code range; a new range reseals.
  PFCrash::running(PROBE, PROBE);
  PFCrash::code(PSRAM_CODE, CODE_BYTES);
  assert(PFCrash::trail.check == PFCrash::seal());
  static const char preset[] = "Origin";
  PFCrash::running(preset, "origin");
  assert(PFCrash::trail.codeBase == 0 && PFCrash::trail.codeSize == 0);
  assert(PFCrash::isRunning(preset) && !PFCrash::isRunning(PROBE));

  // A preset that dies in setup() at boot: named, and no code range, because
  // its addresses are the firmware's own.
  PFCrash::enter(PFCrash::SETUP);
  eraseFlash();
  boot(ESP_RST_TASK_WDT);
  const PFCrash::Record* r = PFCrash::record;
  assert(r && r->trailed && !r->dumped && r->phase == PFCrash::SETUP);
  assert(strcmp(r->slug, "origin") == 0 && r->codeSize == 0);
  assert(Serial.said("the reset came during setup of \"origin\"\n"));

  // A load that failed, or a module that left: nothing is resident, and a
  // death afterwards is not pinned on it.
  liveIntoDraw(PSRAM_CODE);
  PFCrash::forget();
  assert(!PFCrash::isRunning(PROBE));
  boot(ESP_RST_INT_WDT);
  r = PFCrash::record;
  assert(r && r->trailed && r->slug[0] == '\0' && r->phase == PFCrash::IDLE && r->codeSize == 0);
  assert(Serial.said("the reset came during idle, no pattern resident\n"));

  // A death before any pattern was named at all.
  boot(ESP_RST_PANIC);
  r = PFCrash::record;
  assert(r && r->trailed && r->slug[0] == '\0' && r->phase == PFCrash::IDLE);

  const char* names[] = {"idle", "loading", "constructors", "setup", "update", "draw", "dump-read"};
  for (uint32_t phase = 0; phase < PFCrash::PHASE_COUNT; ++phase) {
    assert(strcmp(PFCrash::phaseName(phase), names[phase]) == 0);
  }
  assert(strcmp(PFCrash::phaseName(PFCrash::PHASE_COUNT), "idle") == 0);
}

// ── An address inside the module, or not ────────────────────────────────────
static void testInModule() {
  PFCrash::Record r = {};
  r.trailed = r.dumpFromThisReset = true;
  r.codeSize = CODE_BYTES;
  uint32_t offset = 0xdead;
  for (uint32_t base : {INTERNAL_CODE, PSRAM_CODE}) {
    r.codeBase = base;
    assert(PFCrash::inModule(r, base, offset) && offset == 0);
    assert(PFCrash::inModule(r, base + CODE_BYTES - 1, offset) && offset == CODE_BYTES - 1);
    assert(!PFCrash::inModule(r, base + CODE_BYTES, offset));
    assert(!PFCrash::inModule(r, base - 1, offset));
    assert(!PFCrash::inModule(r, 0, offset));
    assert(!PFCrash::inModule(r, 0x4200f1a3, offset));   // firmware code in flash
  }
  // Code in PSRAM is one set of bytes at two addresses, and a PC only ever
  // carries the instruction-bus one. A breadcrumb that recorded the address
  // the loader WROTE the code through matches no frame of any crash - which
  // is what this record did before it was put on a panel.
  r.codeBase = PSRAM_CODE;
  assert(PFCrash::inModule(r, PSRAM_CODE + 0x4e, offset) && offset == 0x4e);
  assert(!PFCrash::inModule(r, PSRAM_DATA + 0x4e, offset));
  r.codeBase = PSRAM_DATA;
  assert(!PFCrash::inModule(r, PSRAM_CODE + 0x4e, offset));

  // A range that ends at the top of the address space does not wrap round to
  // claim address zero.
  r.codeBase = 0xFFFFF000u;
  r.codeSize = 0x1000;
  assert(PFCrash::inModule(r, 0xFFFFFFFFu, offset) && offset == 0xFFF);
  assert(!PFCrash::inModule(r, 0, offset));

  // Each of the three conditions is necessary.
  r.codeBase = PSRAM_CODE;
  r.codeSize = CODE_BYTES;
  r.trailed = false;
  assert(!PFCrash::inModule(r, PSRAM_CODE, offset));
  r.trailed = true;
  r.dumpFromThisReset = false;
  assert(!PFCrash::inModule(r, PSRAM_CODE, offset));
  r.dumpFromThisReset = true;
  r.codeSize = 0;                 // a preset
  assert(!PFCrash::inModule(r, PSRAM_CODE, offset));
}

// ── DELETE /api/crash ───────────────────────────────────────────────────────
static void testClear() {
  eraseFlash();
  powerOn();
  erases = 0;
  assert(!PFCrash::clear() && erases == 0);     // nothing recorded: the 404

  writeDump(0xAAAA0001);
  dumpOfProbe(PSRAM_CODE);
  powerOn();
  assert(PFCrash::record);
  assert(PFCrash::clear() && erases == 1 && !PFCrash::record);
  assert(!PFCrash::clear() && erases == 1);     // and it is gone
  powerOn();
  assert(!PFCrash::record);                     // from flash too

  // A breadcrumb with no dump (a watchdog that wrote none) is a record to
  // drop and not a partition to erase.
  liveIntoDraw(PSRAM_CODE);
  boot(ESP_RST_WDT);
  assert(PFCrash::record && PFCrash::record->trailed && !PFCrash::record->dumped);
  assert(PFCrash::clear() && erases == 1 && !PFCrash::record);

  // A dump the parser would not read still occupies the partition, and
  // clearing is how it leaves.
  writeDump(0xAAAA0001);
  crcHolds = false;
  powerOn();
  assert(!PFCrash::record);
  assert(PFCrash::clear() && erases == 2);
  crcHolds = true;
}

int main() {
  testPowerOn();
  testPanicInModule(PSRAM_CODE, "backtrace: 0x43c8104e 0x43c8109c 0x4200f1a3 0x42010b52\n");
  testPanicInModule(INTERNAL_CODE, "backtrace: 0x40381c8e 0x40381cdc 0x4200f1a3 0x42010b52\n");
  testMatrix();
  testParserChoke();
  testDumpGuards();
  testNaming();
  testInModule();
  testClear();
  free(PFCrash::record);
  PFCrash::record = nullptr;
  printf("PASS crash: %u boots walked\n", boots);
  return 0;
}
