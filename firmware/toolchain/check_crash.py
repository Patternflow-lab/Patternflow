"""Walk the crash record through the boots it has to tell apart.

python firmware/toolchain/check_crash.py [--sanitize]

src/core_crash.h decides, once per boot, what a reset left behind: a
breadcrumb in RAM that only some resets preserve, and a core dump in flash
that only some resets write. Getting that wrong does not crash anything - it
reports last week's backtrace as today's, or pins a death on a pattern that
was not running - and a panel cannot be made to take every reset on demand.
So the production header is compiled here against a scripted reset reason,
coredump partition and dump parser, and booted through reset x breadcrumb x
dump.
"""
import argparse
from pathlib import Path
import subprocess
import tempfile

from check_module_elf import ROOT, compiler_environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sanitize', action='store_true')
    args = parser.parse_args()
    compiler, env = compiler_environment()
    with tempfile.TemporaryDirectory(prefix='patternflow-crash-') as directory:
        work = Path(directory)
        # core_module_elf.h is the real one: it is where ELF_MAGIC comes from,
        # and it has no device dependencies.
        for name in ('core_crash.h', 'core_module_elf.h'):
            (work / name).write_bytes((ROOT / 'firmware/patternflow/src' / name).read_bytes())
        for name in ('Arduino.h', 'esp_attr.h', 'esp_core_dump.h', 'esp_partition.h',
                     'esp_system.h', 'core_mem.h'):
            (work / name).write_text('// Hardware supplied by crash_test.cpp\n')
        source = ROOT / 'firmware/toolchain/tests/crash_test.cpp'
        exe = work / ('crash_test.exe' if Path(compiler).suffix.lower() == '.exe' else 'crash_test')
        if Path(compiler).stem.lower() == 'cl':
            if args.sanitize:
                raise SystemExit('--sanitize requires GCC or Clang')
            command = [compiler, '/nologo', '/std:c++20', '/EHsc', '/O2', '/W4', '/WX', '/utf-8',
                       f'/I{work}', str(source), f'/Fe:{exe}']
        else:
            command = [compiler, '-std=c++20', '-O2', '-Wall', '-Wextra', '-Werror',
                       f'-I{work}', str(source), '-o', str(exe)]
            if args.sanitize:
                command += ['-fsanitize=address,undefined', '-fno-omit-frame-pointer']
        subprocess.run(command, cwd=work, env=env, check=True)
        subprocess.run([str(exe)], cwd=work, env=env, check=True)


if __name__ == '__main__':
    main()
