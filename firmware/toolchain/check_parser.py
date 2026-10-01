"""Replay truncated, stalled and trickled HTTP requests through the vendored
request parser, and fail on a wait that does not sleep or does not end.

python firmware/toolchain/check_parser.py [--sanitize]

The real src/webserver/Parsing.cpp and WebServer.cpp are compiled against a
scripted socket and a fake clock (tests/parser_test.cpp says what the two
properties are and why they are the ones that reboot a board). No board, no
PlatformIO.
"""
import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile

from check_module_elf import ROOT, compiler_environment

VENDORED = ROOT / 'firmware/patternflow/src/webserver'
# Everything the server includes that is not in its own directory. The test
# supplies what they declare; these only have to exist.
SUPPLIED = ('Arduino.h', 'esp32-hal-log.h', 'WiFi.h', 'WiFiServer.h', 'WiFiClient.h', 'WString.h',
            'pgmspace.h', 'FS.h', 'MD5Builder.h', 'esp_random.h', 'http_parser.h', 'libb64/cencode.h',
            'core_net_maintenance.h')
# MSVC has no variable-length arrays, and _parseForm declares one (stock). For
# cl alone that one declaration becomes _alloca in the temporary copy. GCC and
# Clang - which is what CI runs - compile the file byte for byte.
VLA = 'char fastBoundary[ fastBoundaryLen ];'
NO_VLA = 'char* fastBoundary = static_cast<char*>(_alloca(fastBoundaryLen));'
# The subject of this test is code that does not return. A replay that neither
# looks at the socket nor sleeps is outside what the fakes can throw out of,
# and must not become a CI job that runs until the runner kills it.
RUN_SECONDS = 120


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sanitize', action='store_true')
    args = parser.parse_args()
    compiler, env = compiler_environment()
    msvc = Path(compiler).stem.lower() == 'cl'
    with tempfile.TemporaryDirectory(prefix='patternflow-parser-') as directory:
        work = Path(directory)
        # Laid out like the sketch, so Parsing.cpp's "../core_net_maintenance.h" resolves.
        src = work / 'src'
        shutil.copytree(VENDORED, src / 'webserver')
        for name in SUPPLIED:
            (src / name).parent.mkdir(parents=True, exist_ok=True)
            (src / name).write_text('// Supplied by parser_test.cpp\n')
        if msvc:
            parsing = src / 'webserver/Parsing.cpp'
            text = parsing.read_bytes().decode('utf-8')
            if text.count(VLA) != 1:
                raise SystemExit(f'Parsing.cpp no longer declares "{VLA}" exactly once; '
                                 'update the MSVC stand-in in check_parser.py.')
            parsing.write_bytes(text.replace(VLA, NO_VLA).encode('utf-8'))
        source = ROOT / 'firmware/toolchain/tests/parser_test.cpp'
        exe = work / ('parser_test.exe' if Path(compiler).suffix.lower() == '.exe' else 'parser_test')
        # C++17, not the C++20 the other checks use: the server is C++11 code
        # and C++20's reversed comparison candidates make its String == String
        # expressions ambiguous. Plain char is unsigned, as it is on Xtensa.
        # The vendored directory goes on the system include path (the test
        # turns warnings off around it for MSVC): it is not ours to make
        # -Wextra clean, and the test itself still is.
        if msvc:
            if args.sanitize:
                raise SystemExit('--sanitize requires GCC or Clang')
            command = [compiler, '/nologo', '/std:c++17', '/EHsc', '/O2', '/W4', '/WX', '/utf-8', '/J',
                       f'/I{src}', str(source), f'/Fe:{exe}']
        else:
            command = [compiler, '-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror', '-funsigned-char',
                       '-isystem', str(src), str(source), '-o', str(exe)]
            if args.sanitize:
                command += ['-fsanitize=address,undefined', '-fno-omit-frame-pointer']
        subprocess.run(command, cwd=work, env=env, check=True)
        try:
            subprocess.run([str(exe)], cwd=work, env=env, check=True, timeout=RUN_SECONDS)
        except subprocess.TimeoutExpired:
            raise SystemExit(f'parser_test did not finish in {RUN_SECONDS} s: a loop in the parser neither '
                             'looks at the socket nor sleeps, so nothing could stop it.')


if __name__ == '__main__':
    main()
