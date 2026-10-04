"""The module ABI does not move silently.

    python firmware/toolchain/check_abi_freeze.py            # verify
    python firmware/toolchain/check_abi_freeze.py --update   # re-pin, deliberately

firmware/patternflow/abi/ is the one contract in this repository that is
consumed WITHOUT recompiling: every installed .pfm module on every panel was
compiled against some version of these structs and reads their exact byte
layout at run time. The compiler cannot defend that boundary - it never sees
the modules - and neither can a code review that does not know the rule. A
reordered field, a widened type, an insertion anywhere but the tail: each one
compiles clean, links clean, and silently misreads on hardware.

The versioning discipline already exists (PF_ABI_VERSION is frozen at 1,
modules stamp PF_ABI_MODULE_VERSION, the loader accepts the range, new fields
append at the tail so older readers see a prefix they understand). What was
missing is enforcement that a change HAPPENED ON PURPOSE. This pins a sha256
of every abi header; CI fails on any drift.

To change the ABI legitimately:
  1. append at the tail - never insert, reorder, retype or remove;
  2. bump PF_ABI_MODULE_VERSION and teach the loader the new range;
  3. run this with --update in the same commit, and say in the commit message
     what was appended and why the layout is still a prefix of itself.

A comment-only edit trips this too. That is intended: refreshing the sums is
the two-second acknowledgement that you know which directory you are in.

One header here lays out nothing: pf_libm.h is inline code every module compiles
into itself, behind floorf, fmodf and five more, and it is pinned because an
edit to it changes what every module built afterwards computes. What an edit
there owes is not a version bump but check_libm.py (and check_module_libm.py,
where there is an xtensa toolchain) passing first.

--update rewrites the hashes and nothing else: the comment lines in abi.sums
are notes people wrote about what the file does and does not cover, and they
are kept as they stand.

License: MIT
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ABI = ROOT / "patternflow" / "abi"
SUMS = ABI / "abi.sums"

# Written only when abi.sums has no comment of its own to keep.
DEFAULT_HEADER = [
    "# sha256 of each LF-normalized header in abi/. Verified in CI by",
    "# check_abi_freeze.py; regenerate with --update ONLY alongside a",
    "# deliberate, append-only ABI change. The file exists so no change",
    "# to the one contract installed modules read can be an accident.",
]

# Headers that compute rather than lay out, and what a change to one owes.
# Anything not named here gets the layout rule, which is the strict one.
COMPUTES = {
    "pf_libm.h": (
        "pf_libm.h lays out nothing, but every module built after an edit to it\n"
        "computes with the edited code. Run\n"
        "  python firmware/toolchain/check_libm.py\n"
        "  python firmware/toolchain/check_module_libm.py   (needs an xtensa toolchain)\n"
        "and only when they pass:\n"
        "  python firmware/toolchain/check_abi_freeze.py --update"),
}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(errors="replace")


def digest(path: Path) -> str:
    # LF-normalized so a checkout's line-ending policy cannot fake a change.
    data = path.read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def current() -> dict[str, str]:
    return {p.name: digest(p) for p in sorted(ABI.glob("*.h"))}


def main() -> int:
    now = current()

    if "--update" in sys.argv[1:]:
        # Every comment line already in the file is kept, in order. They are
        # hand-written - what the hashes do not cover, what pf_libm.h is doing
        # here - and this command used to replace them with four lines of its
        # own, which is how a note gets lost by the person following it.
        kept = []
        if SUMS.exists():
            kept = [line.rstrip() for line in SUMS.read_text(encoding="utf-8").splitlines()
                    if line.lstrip().startswith("#")]
        lines = list(kept or DEFAULT_HEADER)
        lines += [f"{h}  {n}" for n, h in now.items()]
        SUMS.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"pinned {len(now)} abi header(s), {len(kept)} comment line(s) kept")
        return 0

    if not SUMS.exists():
        print("abi/abi.sums is missing - run with --update to pin the current ABI")
        return 1

    pinned: dict[str, str] = {}
    for line in SUMS.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        h, _, n = line.partition("  ")
        pinned[n] = h

    problems = []
    moved = []
    for name, h in now.items():
        if name not in pinned:
            problems.append(f"  {name}: new abi header, not pinned")
            moved.append(name)
        elif pinned[name] != h:
            problems.append(f"  {name}: content changed")
            moved.append(name)
    for name in pinned:
        if name not in now:
            problems.append(f"  {name}: pinned but gone")
            moved.append(name)

    if problems:
        print("the module ABI moved:\n")
        print("\n".join(problems))
        for name in moved:
            if name in COMPUTES:
                print("\n" + COMPUTES[name])
        if any(name not in COMPUTES for name in moved):
            print(
                "\nEvery installed .pfm on every panel reads this layout without\n"
                "recompiling. If this change is deliberate: append-only, bump\n"
                "PF_ABI_MODULE_VERSION, teach the loader the new range, then\n"
                "  python firmware/toolchain/check_abi_freeze.py --update\n"
                "in the same commit. If it is not deliberate, revert it.")
        return 1

    print(f"abi frozen: {len(now)} header(s) match abi.sums")
    return 0


if __name__ == "__main__":
    sys.exit(main())
