"""Prove that the module SDK's inline floorf/fmodf and kin return what libm returns.

python firmware/toolchain/check_libm.py [--sanitize]
No board required. Takes a minute or two: it runs every float there is.

abi/pf_libm.h puts inline FPU code behind floorf, ceilf, truncf, roundf, fminf,
fmaxf and fmodf in every .pfm, so that a pattern nobody edits stops calling into
the firmware's libm per pixel. The header's claim is that each of the seven
returns exactly what libm returns, so this is not a tolerance check like
check_math.py: tests/libm_test.cpp compares bit patterns against this machine's
libm - all 2^32 floats through the one-argument functions, about three billion
comparisons through the others - and one mismatch fails.

Two things it does not do. It cannot compile the part of the header that only a
module build has (the bodies behind the C names, the fmod dispatch): that is
check_module_libm.py, which needs the Xtensa compiler. And it cannot check that
the S3's multiply-subtract is fused: that is tests/modules/_math_probe, on a
board.
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
    headers = ROOT / 'firmware/patternflow/abi'
    source = ROOT / 'firmware/toolchain/tests/libm_test.cpp'
    with tempfile.TemporaryDirectory(prefix='patternflow-libm-') as directory:
        work = Path(directory)
        exe = work / ('libm_test.exe' if Path(compiler).suffix.lower() == '.exe' else 'libm_test')
        if Path(compiler).stem.lower() == 'cl':
            if args.sanitize:
                raise SystemExit('--sanitize requires GCC or Clang')
            command = [compiler, '/nologo', '/std:c++17', '/EHsc', '/O2', '/W4', '/WX', '/utf-8',
                       f'/I{headers}', str(source), f'/Fe:{exe}']
        else:
            # The names under test stay calls into this machine's libm. Left as
            # builtins, GCC answers some of them inline on a PC, and its floor
            # hands a signalling NaN back unquieted where glibc's does not.
            calls = [f'-fno-builtin-{name}' for name in
                     ('floorf', 'ceilf', 'truncf', 'roundf', 'fminf', 'fmaxf', 'fmodf')]
            command = [compiler, '-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror', '-pthread',
                       *calls, f'-I{headers}', str(source), '-o', str(exe)]
            if args.sanitize:
                command += ['-fsanitize=address,undefined', '-fno-omit-frame-pointer']
        subprocess.run(command, cwd=work, env=env, check=True)
        subprocess.run([str(exe)], cwd=work, env=env, check=True)


if __name__ == '__main__':
    main()
