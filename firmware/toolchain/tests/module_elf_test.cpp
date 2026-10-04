// Host regressions for the checks used by core_module_loader.h. License: MIT.
#include "core_module_elf.h"
#include <fstream>
#include <iostream>
#include <iterator>
#include <stdexcept>
#include <string>
#include <vector>

using namespace PFModuleLoader;

static void require(bool ok, const char* what) {
  if (!ok) throw std::runtime_error(what);
}

static void regressions() {
  static_assert(sizeof(Elf32Ehdr) == 52, "ELF header layout");
  static_assert(sizeof(Elf32Shdr) == 40, "ELF section layout");
  static_assert(sizeof(Elf32Sym) == 16, "ELF symbol layout");
  static_assert(sizeof(Elf32Rela) == 12, "ELF relocation layout");
  Elf32Ehdr good{};
  memcpy(good.ident, &ELF_MAGIC, sizeof(ELF_MAGIC));
  good.ident[4] = good.ident[5] = 1;
  good.type = ET_REL;
  good.machine = EM_XTENSA;
  good.shentsize = sizeof(Elf32Shdr);
  good.shnum = 2;
  good.shoff = sizeof(Elf32Ehdr);
  const size_t fileSize = good.shoff + good.shnum * sizeof(Elf32Shdr);
  require(moduleHeaderValid(good, fileSize), "valid header rejected");
  require(!moduleHeaderValid(good, fileSize - 1), "truncated section table accepted");
  require(!moduleHeaderValid(good, sizeof(Elf32Ehdr) - 1), "short header accepted");
  for (int kind = 0; kind < 8; ++kind) {
    Elf32Ehdr bad = good;
    switch (kind) {
      case 0: bad.ident[0] = 0; break;
      case 1: bad.ident[4] = 2; break;  // ELF64
      case 2: bad.ident[5] = 2; break;  // big endian
      case 3: bad.type = 2; break;     // executable, not relocatable
      case 4: bad.machine = 3; break;  // x86
      case 5: bad.shentsize = 1; break;
      case 6: bad.shnum = 0; break;
      case 7: bad.shoff = UINT32_MAX - 3; break;  // used to wrap on ESP32
    }
    require(!moduleHeaderValid(bad, fileSize), "malformed header accepted");
  }

  require(rangeValid(12, 4, 16), "last complete relocation rejected");
  require(!rangeValid(13, 4, 16), "partial relocation accepted");
  require(!rangeValid(UINT32_MAX - 1, 4, 16), "wrapped relocation accepted");
  require(!rangeValid(SIZE_MAX - 1, 4, 16), "host size overflow accepted");
  require(rangeValid(16, 0, 16), "empty range at end rejected");
  require(!rangeValid(17, 0, 16), "range past end accepted");

  size_t rounded = 0;
  require(sectionAllocationSize(1, rounded) && rounded == 4, "short section rounding");
  require(sectionAllocationSize(4, rounded) && rounded == 4, "aligned section rounding");
  require(sectionAllocationSize(UINT32_MAX - 3, rounded) && rounded == UINT32_MAX - 3,
          "largest representable rounded section");
  for (uint32_t tail = 0; tail < 3; ++tail)
    require(!sectionAllocationSize(UINT32_MAX - tail, rounded), "wrapped allocation accepted");

  const char names[] = "\0sinf\0.init_array\0unterminated";
  const size_t tableSize = sizeof(names) - 1;  // terminator exists OUTSIDE the table
  require(tableString(names, tableSize, 0) == names, "empty symbol rejected");
  require(strcmp(tableString(names, tableSize, 1), "sinf") == 0, "symbol lookup");
  require(strcmp(tableString(names, tableSize, 6), ".init_array") == 0, "section lookup");
  require(!tableString(names, tableSize, 18), "unterminated name accepted");
  require(!tableString(names, tableSize, tableSize), "end-of-table name accepted");
  require(!tableString(names, tableSize, SIZE_MAX), "wrapped name accepted");
  require(!tableString(nullptr, 0, 0), "absent table accepted");
  const char utf8[] = "Moir\xc3\xa9";
  require(tableString(utf8, sizeof(utf8), 0) == utf8, "UTF-8 name rejected");
}

template<class T>
static T read(const std::vector<char>& image, size_t offset) {
  require(rangeValid(offset, sizeof(T), image.size()), "fixture record outside file");
  T value;
  memcpy(&value, image.data() + offset, sizeof(T));
  return value;
}

// What a module shipped from this repository may cost in code, as the loader
// prices it (the sum of its executable sections). Two numbers, because since
// 3.10.5 there are two places code can go.
//
// SHIPPED_CODE_CEILING - every module, no exceptions. Code is placed in PSRAM
// (PF_MODULE_CODE_PSRAM_FIRST, src/core_module_memory.h) and charged nothing
// against internal RAM, and the loader keeps megabytes of PSRAM free before a
// load, so whether a module comes on no longer depends on its size. What still
// does is what it costs to run: code in PSRAM is fetched through the 16 KB
// instruction cache (CONFIG_ESP32S3_INSTRUCTION_CACHE_SIZE 0x4000). Measured
// 2026-10-01, A-B-B-A on one boot (core_module_memory.h has the table): nine
// catalogue modules ran within -0.1..+0.8 % of their internal-RAM frame time;
// 10, 23 and 32 KB with every byte executed every frame cost 2.6..5.3 %. The
// ceiling is the cache: a module under it can sit in the cache whole, one over
// it refetches part of itself from PSRAM every frame. Going over is allowed
// and is a decision, not a formality - measure that module's frame time with
// its code placed both ways and say in the commit what it cost.
//
// INTERNAL_PLACEMENT_LINE - where the ceiling used to be, and why it is still
// written down. Code goes to internal RAM wherever PSRAM is not used for it:
// on every firmware before 3.10.5, and on a unit that has demoted itself after
// a failed read-back (codeDemoted). There it is admitted against
// budget() = serviceFree() - PF_MODULE_INTERNAL_RESERVE, and serviceFree() is
// ambient - an HTTP response in flight, an rtpMIDI session and a DHCP renew
// all move it. Set 2026-09-10 from docs/investigations/2026-09-firmware-runtime.md:
//   the module's internal share with none resident measures 7,816 B (section 4.4)
//   boot-to-boot ambient variance is about 700 B (section 4.1)
//   so the worst reasonable budget is about 7,116 B - on the Audio edition, the
//   tightest (41,036 B internal free after smoke, against Default's 73,172 B)
// and 6,144 sits 972 B below that. Section 4.2 is what the absence of this
// number once cost: a firmware that could not load its own pack, 24,576 +
// 5,364 = 29,940 against ~28,320 free, found by hardware bisect.
//
// A module over the line loads wherever code runs from PSRAM. Where it does
// not, it is refused once it is past the budget: about 7.8 KB on an Audio
// build before 3.10.5 (7.1 on a bad boot), some 48 KB on the default one.
// Nothing builds a module smaller for that firmware - it is told to update -
// so this is a real cost, and it is taken by name: a module over the line has
// to be listed in OVER_INTERNAL_LINE to pass, and listing one is the decision
// to give up loading it there, said in the commit.
//
// breakout_arcade was listed 2026-10-04, when modules began to be built at -O2
// with libm inline (build_module.py DEFAULT_OPT, abi/pf_libm.h): 5,564 B the
// old way, 6,568 B at -Os with libm inline, 14,204 B at -O2. The other 32
// modules in the pack are under 4.5 KB.
static constexpr size_t SHIPPED_CODE_CEILING = 16384;
static constexpr size_t INTERNAL_PLACEMENT_LINE = 6144;
static const char* const OVER_INTERNAL_LINE[] = {"breakout_arcade"};

static size_t largestShippedCode = 0;
static const char* largestShippedName = "";
static std::string overInternalLine;

// "dir/26-breakout_arcade.pfm" -> "breakout_arcade": check_module_elf.py names
// each fixture <index>-<name in the pack>.
static std::string slugOf(const char* path) {
  std::string name = path;
  const size_t slash = name.find_last_of("/\\");
  if (slash != std::string::npos) name.erase(0, slash + 1);
  const size_t dash = name.find('-');
  if (dash != std::string::npos && name.find_first_not_of("0123456789") == dash)
    name.erase(0, dash + 1);
  const size_t dot = name.rfind(".pfm");
  if (dot != std::string::npos) name.erase(dot);
  return name;
}

// Exercise the production bounds functions on the modules actually shipped
// in Basics. This checks compatibility of the file checks, not Xtensa execution.
//
// It also PRICES each module exactly as core_module_loader.h does in its pass 1,
// because structure being valid is not the same as the module being loadable, and
// only the second question is the one that stops a pattern appearing on a panel.
static void shippedModule(const char* path) {
  std::ifstream file(path, std::ios::binary);
  require(file.good(), "cannot open fixture");
  std::vector<char> image((std::istreambuf_iterator<char>(file)), {});
  auto header = read<Elf32Ehdr>(image, 0);
  require(moduleHeaderValid(header, image.size()), "shipped module header rejected");
  auto section = [&](size_t index) {
    require(index < header.shnum, "fixture section index");
    return read<Elf32Shdr>(image, header.shoff + index * sizeof(Elf32Shdr));
  };
  size_t codeBytes = 0;
  for (size_t i = 1; i < header.shnum; ++i) {
    auto s = section(i);
    if (s.flags & SHF_ALLOC) {
      size_t rounded;
      require(sectionAllocationSize(s.size, rounded), "shipped section size rejected");
      if (s.type != SHT_NOBITS)
        require(rangeValid(s.offset, s.size, image.size()), "shipped section range rejected");
      // core_module_loader.h pass 1, to the letter: allocatable, non-empty,
      // rounded up to four, executable summed. If that rule ever moves, this
      // has to move with it or the number below stops meaning anything.
      if (s.size != 0 && (s.flags & SHF_EXECINSTR)) codeBytes += rounded;
    }
    if (s.type == SHT_SYMTAB) {
      auto strings = section(s.link);
      require(rangeValid(strings.offset, strings.size, image.size()), "fixture string range");
      for (size_t n = 0; n < s.size / sizeof(Elf32Sym); ++n) {
        auto sym = read<Elf32Sym>(image, s.offset + n * sizeof(Elf32Sym));
        require(tableString(image.data() + strings.offset, strings.size, sym.name),
                "shipped symbol name rejected");
      }
    }
    if (s.type == SHT_RELA) {
      auto target = section(s.info);
      if (!(target.flags & SHF_ALLOC)) continue;
      for (size_t n = 0; n < s.size / sizeof(Elf32Rela); ++n) {
        auto reloc = read<Elf32Rela>(image, s.offset + n * sizeof(Elf32Rela));
        if ((reloc.info & 0xff) == R_XTENSA_32)
          require(rangeValid(reloc.offset, sizeof(uint32_t), target.size),
                  "shipped relocation rejected");
      }
    }
  }
  if (codeBytes > largestShippedCode) {
    largestShippedCode = codeBytes;
    largestShippedName = path;
  }
  if (codeBytes > SHIPPED_CODE_CEILING) {
    std::cerr << path << ": " << codeBytes << " B of executable sections, over the "
              << SHIPPED_CODE_CEILING << " B ceiling for a module shipped from this\n"
              << "repository - more than the instruction cache holds, so part of it "
              << "is fetched from PSRAM again every frame.\n"
              << "Read the ceiling's provenance in this file before raising it.\n";
    throw std::runtime_error("shipped module over the code ceiling");
  }
  if (codeBytes > INTERNAL_PLACEMENT_LINE) {
    const std::string slug = slugOf(path);
    bool listed = false;
    for (const char* name : OVER_INTERNAL_LINE) listed = listed || slug == name;
    if (!listed) {
      std::cerr << path << ": " << codeBytes << " B of executable sections, over the "
                << INTERNAL_PLACEMENT_LINE << " B internal RAM can be counted on to take.\n"
                << "It loads where code runs from PSRAM (3.10.5 and later) and may be "
                << "refused where it does not.\n"
                << "If that is meant, list it in OVER_INTERNAL_LINE and say so in the "
                << "commit; the reasoning is in this file.\n";
      throw std::runtime_error("shipped module over the internal placement line, unlisted");
    }
    if (!overInternalLine.empty()) overInternalLine += ", ";
    overInternalLine += slug + " " + std::to_string(codeBytes) + " B";
  }
}

int main(int argc, char** argv) {
  try {
    regressions();
    for (int i = 1; i < argc; ++i) shippedModule(argv[i]);
    std::cout << "ELF regressions passed; " << argc - 1 << " shipped modules accepted\n";
    if (argc > 1) {
      const char* slash = strrchr(largestShippedName, '/');
      const char* back = strrchr(largestShippedName, '\\');
      if (back > slash) slash = back;
      std::cout << "largest module code: " << largestShippedCode << " B ("
                << (slash ? slash + 1 : largestShippedName)
                << "), ceiling " << SHIPPED_CODE_CEILING
                << " B, headroom " << (SHIPPED_CODE_CEILING - largestShippedCode)
                << " B\n";
      std::cout << "over the " << INTERNAL_PLACEMENT_LINE
                << " B internal placement line, so PSRAM only: "
                << (overInternalLine.empty() ? "none" : overInternalLine) << '\n';
    }
    return 0;
  } catch (const std::exception& error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
