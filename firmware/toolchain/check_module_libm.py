"""Read the module SDK's inline libm out of a module the real toolchain built.

    python firmware/toolchain/check_module_libm.py

check_libm.py proves abi/pf_libm.h's algorithms on a PC: twenty billion
comparisons against libm. What it cannot do is compile the half of that header
a module actually uses - the bodies behind floorf, ceilf, truncf, roundf, fminf,
fmaxf and fmodf, the redirection of libstdc++'s float overloads, and the choice
between fmod's three paths - because that half exists only under
PF_MODULE_BUILD on the Xtensa compiler. Swap two wrappers there, or break one
of the __builtin_ macros, and check_libm.py still says twenty billion matches.

So this builds tests/modules/_libm_shapes with build_module.py - the same
flags, linker script and import check a pattern gets - and reads the result
(the code out of the object file, where the assembler's own record of what is
an instruction and what is padding is still attached; the imports out of the
linked .pfm):

  - the fixture's static_asserts are evaluated through the module-only wiring,
    so a wrapper bound to the wrong function does not compile;
  - for every spelling the header claims, the function is disassembled and
    walked: there has to be a way from its entry to its return that makes no
    call (one call, to __divsf3, for fmodf by a divisor that is not a
    constant), it has to contain the FPU instructions the inline code is made
    of, and the only library function it may call at all is the one it stands
    in for - the fallback;
  - the three controls (`__builtin_floorf(x)`, a call through a pointer to
    floorf, lroundf) have to be plain calls still, which is what shows the
    walk can tell a call from inline code;
  - the module imports the seven names and __divsf3 and does not import fmaf:
    the fused multiply-subtract is an instruction (MSUB.S) or it is a symbol
    no firmware exports.

It says nothing about the values the inline code computes on a panel - that is
tests/modules/_math_probe, on a board.

Needs the xtensa-esp32s3 toolchain, found the way build_module.py finds it
(PF_XTENSA_BIN, an Arduino core, PlatformIO). CI runs it in the firmware build
job, which has PlatformIO's.
"""

from __future__ import annotations

import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import build_module

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "tests" / "modules" / "_libm_shapes"

RETURNS = {"retw", "retw.n", "ret", "ret.n"}
CALLS = {"call0", "call4", "call8", "call12", "callx0", "callx4", "callx8", "callx12"}
LOOPS = {"loop", "loopnez", "loopgtz"}

SECTION = re.compile(r"^Disassembly of section (\S+):")
FUNCTION = re.compile(r"^([0-9a-f]+) <([^>]+)>:\s*$")
INSTRUCTION = re.compile(r"^\s*([0-9a-f]+):\t[0-9a-f ]+\t([a-z_.0-9]+)(?:\t(.*?))?\s*$")
RELOCATION = re.compile(r"^\s+([0-9a-f]+): (R_XTENSA_\w+)\s+(\S+)")
ADDRESS = re.compile(r"\b([0-9a-f]+) <([^>+-]+)")


@dataclass
class Instruction:
    address: int
    mnemonic: str
    operands: str
    following: int = -1  # the next instruction's address


@dataclass
class Function:
    name: str
    start: int
    section: str
    code: dict[int, Instruction] = field(default_factory=dict)
    # call instruction address -> what it calls ("?" when it cannot be named)
    calls: dict[int, str] = field(default_factory=dict)

    def mnemonics(self) -> set[str]:
        return {i.mnemonic for i in self.code.values()}

    def targets(self) -> set[str]:
        return set(self.calls.values())


def disassemble(obj: Path, objdump: Path) -> dict[str, Function]:
    text = subprocess.run([str(objdump), "-dr", str(obj)], capture_output=True,
                          text=True, errors="replace", check=True).stdout
    functions: dict[str, Function] = {}
    # Keyed by section as well as address: an object has several code sections
    # (libstdc++'s out-of-line overloads get one each), all starting at zero.
    literal: dict[tuple[str, int], str] = {}    # where a literal is -> the symbol stored there
    expanded: dict[tuple[str, int], str] = {}   # where an l32r is -> the symbol it is about to call
    section = ""
    current: Function | None = None
    previous: Instruction | None = None
    for line in text.splitlines():
        match = SECTION.match(line)
        if match:
            section = match.group(1)
            current = previous = None
            continue
        match = FUNCTION.match(line)
        if match:
            current = Function(match.group(2), int(match.group(1), 16), section)
            functions[current.name] = current
            previous = None
            continue
        match = RELOCATION.match(line)
        if match:
            address, kind, symbol = int(match.group(1), 16), match.group(2), match.group(3)
            if kind == "R_XTENSA_32":
                literal[(section, address)] = symbol
            elif kind == "R_XTENSA_ASM_EXPAND":
                expanded[(section, address)] = symbol
            continue
        match = INSTRUCTION.match(line)
        if match and current is not None:
            instruction = Instruction(int(match.group(1), 16), match.group(2), match.group(3) or "")
            current.code[instruction.address] = instruction
            if previous is not None:
                previous.following = instruction.address
            previous = instruction

    # Name every call. With -mlongcalls a call to another section is
    # `l32r aN, <literal>` ... `callx8 aN`; a call inside the module may have
    # been relaxed to a direct `call8 <function>`.
    for function in functions.values():
        loaded: dict[str, str] = {}
        for address in sorted(function.code):
            instruction = function.code[address]
            if instruction.mnemonic == "l32r":
                register = instruction.operands.split(",")[0].strip()
                target = ADDRESS.search(instruction.operands)
                symbol = expanded.get((function.section, address))
                if symbol is None and target:
                    symbol = literal.get((function.section, int(target.group(1), 16)))
                if symbol is None:
                    loaded.pop(register, None)
                else:
                    loaded[register] = symbol
            elif instruction.mnemonic in CALLS:
                if instruction.mnemonic.startswith("callx"):
                    function.calls[address] = loaded.get(instruction.operands.strip(), "?")
                else:
                    target = ADDRESS.search(instruction.operands)
                    function.calls[address] = target.group(2) if target else "?"
    return functions


def reaches_return(function: Function, allowed: set[str]) -> bool:
    """Is there a way from entry to return that calls nothing outside `allowed`?"""
    seen: set[int] = set()
    pending = [function.start]
    while pending:
        address = pending.pop()
        if address in seen or address not in function.code:
            continue
        seen.add(address)
        instruction = function.code[address]
        mnemonic = instruction.mnemonic
        if mnemonic in RETURNS:
            return True
        if mnemonic in CALLS:
            if function.calls.get(address, "?") in allowed:
                pending.append(instruction.following)
            continue
        if mnemonic == "jx":
            continue  # an indirect jump: not followed
        target = ADDRESS.search(instruction.operands)
        if mnemonic == "j":
            if target:
                pending.append(int(target.group(1), 16))
            continue
        if (mnemonic.startswith("b") and mnemonic != "break") or mnemonic in LOOPS:
            if target:
                pending.append(int(target.group(1), 16))
        pending.append(instruction.following)
    return False


@dataclass
class Shape:
    symbol: str
    written: str
    fallback: set[str]                               # every library call it may contain
    needs: set[str]                                  # instructions the inline code is made of
    fast: set[str] = field(default_factory=set)      # calls allowed on the way through
    never: set[str] = field(default_factory=set)     # instructions or calls that mean a wrong path
    libstdcxx: bool = False                          # reached through <cmath>'s float overloads


CONVERT = {"trunc.s", "float.s"}
SHAPES = [
    Shape("pf_shape_floorf", "floorf(x)", {"floorf"}, CONVERT),
    Shape("pf_shape_ceilf", "ceilf(x)", {"ceilf"}, CONVERT),
    Shape("pf_shape_truncf", "truncf(x)", {"truncf"}, CONVERT),
    Shape("pf_shape_roundf", "roundf(x)", {"roundf"}, CONVERT),
    Shape("pf_shape_fminf", "fminf(x, y)", {"fminf"}, {"olt.s"}),
    Shape("pf_shape_fmaxf", "fmaxf(x, y)", {"fmaxf"}, {"olt.s"}),
    Shape("pf_shape_fmodf", "fmodf(x, y)", {"fmodf", "__divsf3"}, CONVERT | {"msub.s"},
          fast={"__divsf3"}),
    Shape("pf_shape_fmodf_one", "fmodf(x, 1.0f)", {"fmodf"}, CONVERT,
          never={"msub.s", "mul.s", "__divsf3"}),
    Shape("pf_shape_fmodf_const", "fmodf(x, 6.2831853f)", {"fmodf"}, CONVERT | {"msub.s", "mul.s"},
          never={"__divsf3"}),
    Shape("pf_shape_fmodf_negconst", "fmodf(x, -360.0f)", {"fmodf"}, CONVERT | {"msub.s", "mul.s"},
          never={"__divsf3"}),
    Shape("pf_shape_floor", "floor(x)", {"floorf"}, CONVERT, libstdcxx=True),
    Shape("pf_shape_std_floor", "std::floor(x)", {"floorf"}, CONVERT, libstdcxx=True),
    Shape("pf_shape_ceil", "ceil(x)", {"ceilf"}, CONVERT, libstdcxx=True),
    Shape("pf_shape_trunc", "trunc(x)", {"truncf"}, CONVERT, libstdcxx=True),
    Shape("pf_shape_round", "round(x)", {"roundf"}, CONVERT, libstdcxx=True),
    Shape("pf_shape_fmin", "fmin(x, y)", {"fminf"}, {"olt.s"}, libstdcxx=True),
    Shape("pf_shape_fmax", "fmax(x, y)", {"fmaxf"}, {"olt.s"}, libstdcxx=True),
    Shape("pf_shape_fmod", "fmod(x, y)", {"fmodf", "__divsf3"}, CONVERT | {"msub.s"},
          fast={"__divsf3"}, libstdcxx=True),
    Shape("pf_shape_std_fmod", "std::fmod(x, y)", {"fmodf", "__divsf3"}, CONVERT | {"msub.s"},
          fast={"__divsf3"}, libstdcxx=True),
    Shape("pf_shape_std_fmod_const", "std::fmod(x, 6.2831853f)", {"fmodf"},
          CONVERT | {"msub.s", "mul.s"}, never={"__divsf3"}, libstdcxx=True),
]

# symbol -> (what was written, what it has to call; None for a call that
# cannot be named from the object)
CONTROLS = {
    "pf_control_builtin": ("__builtin_floorf(x)", "floorf"),
    "pf_control_pointer": ("a call through a pointer to floorf", None),
    "pf_control_lroundf": ("lroundf(x)", "lroundf"),
}

IMPORTED = {"floorf", "ceilf", "truncf", "roundf", "fminf", "fmaxf", "fmodf", "__divsf3"}


def build(opt: str, gxx: Path, work: Path) -> tuple[Path, Path]:
    """The fixture as a linked module and as the object it was linked from."""
    broken = (f"_libm_shapes does not build at -O{opt}: the module half of abi/pf_libm.h "
              "is broken, or one of the fixture's static_asserts no longer holds")
    # The whole pipeline, as a pattern gets it: this is what proves it links
    # and imports nothing the loader lacks.
    out = work / f"O{opt}"
    command = [sys.executable, str(HERE / "build_module.py"), "--opt", opt, "--out", str(out),
               str(FIXTURE)]
    result = subprocess.run(command, capture_output=True, text=True, errors="replace")
    if result.returncode != 0:
        print(result.stdout + result.stderr)
        raise SystemExit(broken)
    # And the same compile again, kept as an object. The linked module has
    # lost the assembler's map of instructions and padding, and a disassembler
    # reading it falls out of step after the first literal pool.
    objects = work / f"O{opt}-obj"
    _, ok, log = build_module.build_one(FIXTURE, gxx, True, build_module.ABI, objects, out, opt)
    if not ok:
        print(log)
        raise SystemExit(broken)
    return out / "_libm_shapes.pfm", objects / FIXTURE.name / "pattern.o"


def check(opt: str, redirected: bool, gxx: Path, tools: dict[str, Path], work: Path) -> list[str]:
    """Every problem found in the fixture built at -O<opt>."""
    pfm, obj = build(opt, gxx, work)
    functions = disassemble(obj, tools["objdump"])
    problems: list[str] = []

    for shape in SHAPES:
        if shape.libstdcxx and not redirected:
            continue
        function = functions.get(shape.symbol)
        if function is None:
            problems.append(f"-O{opt} {shape.written}: {shape.symbol} is not in the module")
            continue
        found: list[str] = []
        if not reaches_return(function, shape.fast):
            found.append("every way through it makes a library call - it is not inline")
        missing = shape.needs - function.mnemonics()
        if missing:
            found.append("no " + ", ".join(sorted(missing)) + " in it")
        stray = function.targets() - shape.fallback
        if stray:
            found.append("calls " + ", ".join(sorted(stray)) + ", which is not its fallback")
        wrong = shape.never & (function.mnemonics() | function.targets())
        if wrong:
            found.append("has " + ", ".join(sorted(wrong)) + " - the wrong fmod path")
        if found:
            problems.append(f"-O{opt} {shape.written}: " + "; ".join(found))
        else:
            through = f", through {'/'.join(sorted(shape.fast))} only" if shape.fast else ""
            print(f"  ok  -O{opt}  {shape.written:<26} inline{through}; fallback "
                  f"{'/'.join(sorted(function.targets() - shape.fast)) or '-'}")

    for symbol, (written, target) in CONTROLS.items():
        function = functions.get(symbol)
        if function is None:
            problems.append(f"-O{opt} control {written}: {symbol} is not in the module")
        elif (reaches_return(function, set()) or not function.calls
              or (target is not None and target not in function.targets())
              or "trunc.s" in function.mnemonics()):
            problems.append(f"-O{opt} control {written}: expected a plain call and found "
                            "something else - the walk cannot be trusted")
        else:
            print(f"  ok  -O{opt}  {written:<34} still a call")

    listed = subprocess.run([str(tools["nm"]), "-u", str(pfm)], capture_output=True, text=True,
                            check=True).stdout
    imports = {line.split()[-1] for line in listed.splitlines() if line.strip()}
    if "fmaf" in imports:
        problems.append(f"-O{opt}: the module imports fmaf - the multiply-subtract is a call, "
                        "and no firmware exports that name")
    if not IMPORTED <= imports:
        problems.append(f"-O{opt}: expected imports missing: {', '.join(sorted(IMPORTED - imports))}")
    unknown = imports - build_module.host_symbol_table()
    if unknown:
        problems.append(f"-O{opt}: imports no loader resolves: {', '.join(sorted(unknown))}")
    print(f"      -O{opt}  imports: {' '.join(sorted(imports))}")
    return problems


def main() -> int:
    gxx = build_module.find_tool("g++")
    tools = {"objdump": build_module.find_tool("objdump"), "nm": build_module.find_tool("nm")}
    version = subprocess.run([str(gxx), "-dumpversion"], capture_output=True, text=True,
                             check=True).stdout.strip()
    major = int(version.split(".")[0])
    # The same range abi/pf_libm.h redirects libstdc++'s overloads for.
    redirected = 8 <= major <= 14
    print(f"xtensa g++ {version}" + ("" if redirected else
          " - outside 8..14, so floor()/std::floor() and kin are expected to stay calls"))

    problems: list[str] = []
    with tempfile.TemporaryDirectory(prefix="patternflow-module-libm-") as directory:
        work = Path(directory)
        # The default level, every spelling. Then -Os, where the C names still
        # have to be inline (always_inline) but GCC is free to keep libstdc++'s
        # overloads as functions of the module's own.
        problems += check(build_module.DEFAULT_OPT, redirected, gxx, tools, work)
        problems += check("s", False, gxx, tools, work)

    if problems:
        print("\nthe module half of abi/pf_libm.h is not what it claims:")
        for problem in problems:
            print("  " + problem)
        return 1
    print("module libm inline: every claimed spelling, library kept as the fallback only")
    return 0


if __name__ == "__main__":
    sys.exit(main())
