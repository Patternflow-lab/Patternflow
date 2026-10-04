# -*- coding: utf-8 -*-
"""Assemble console/audio-in.html, the panel's /audio-in page, from its sources.

    python firmware/toolchain/console_pages.py build          # the build: this page, then every header
    python firmware/toolchain/console_pages.py check          # everything in sync, this page included

    python firmware/toolchain/build_audio_in_page.py          # only assemble this page
    python firmware/toolchain/build_audio_in_page.py --check  # CI: page == sources, and inside its budget
    --sketch DIR    work on another copy of firmware/patternflow (as console_pages.py)

/audio-in is the one console page that is not written as a page. Its editor is
the browser extension's mapping editor, copied, never re-extracted, so the two
cannot drift apart; what is the panel's own sits beside the other console
sources. This script holds none of their text:

    tools/patternflow-audio-extension/
      editor.html    the markup: what is between its two EDITOR BODY comment lines
                     is taken (the editor itself; the extension's own source bar
                     is above them and stays behind), and the <script src> tags
                     say which scripts, in which order
      editor.css     the editor's styles, down to its EXTENSION ONLY line
      editor.js      the editor; it reaches its host only through window.PFAdapter
      (any other script editor.html loads is taken the same way)
    firmware/patternflow/console/     (underscore: sources, not pages)
      _audio_in_bar.html     the panel's frame around the editor: the page
                             heading and the Sources list, a line that says
                             <!-- EDITOR --> where the editor's body goes, and
                             what closes the page after it
      _audio_in.css          the panel's styles, after the editor's
      _audio_in_adapter.js   window.PFAdapter over fetch('/api/audio-in'): taken where
                             editor.html loads editor-adapter.js, its twin for
                             the extension

Edit those, run `console_pages.py build`. Never edit console/audio-in.html or
features/audio_in/audio_in_index.h: both are generated, and CI fails on a page
that is not what its sources assemble to.

ASSEMBLING IS ALL IT DOES, except for one thing: what the sources say to the
person reading them does not travel. From every source it drops

    whole-line // comments (JS), /* */ comments (CSS), <!-- --> comments (HTML),
    leading and trailing whitespace, and blank lines.

That is a quarter of the page on the wire, on a link measured at 2-5 KB/s, and
it lets the sources stay as commented as they need to be. It is done line by
line, with no JavaScript tokenizer, so it is only safe while a line break in
the source is never inside a token. Rather than trust that, the build FAILS on
the constructs that would break it: a JS line with an odd number of backticks
(a template literal left open across lines), a JS or CSS line ending in a
backslash, a CSS comment opened inside a quoted string, and <pre>/<textarea>/
<script>/<style> in the markup. A comment after code on the same line is left
alone: telling `// note` from the // in 'http://x' is what would need the
tokenizer. Line numbers in the browser's console are therefore the generated
page's, not the source's.

The stylesheets lose a little more, because there it can be said without a
tokenizer what is safe: the white space around { } ; and , and after a colon,
the semicolon that ends a block, and the line break after { ; , or before
{ }, so the page carries one rule to a line however the source lays them
out. A line holding a quote, a backslash or url( is left exactly as written.
Write the sheets to be read; none of that travels.

A script or stylesheet the extension shares with the panel may have a tail the
panel has no use for. A comment that says only EXTENSION ONLY (a rule drawn
around the words is fine) ends what is taken from it: a // line in a script,
a /* */ comment in the stylesheet.

THE BUDGET. `--check` also fails when the page, stamped and gzipped as the panel
sends it, is over BUDGET bytes: see the comment there. The line every build
and check prints also says how many send windows the page takes and how full
the last one is (WINDOW, below): on the mock's slow link one more window is
one more round trip, so a page a few bytes into a window is worth trimming.

Other tools import this: assemble(sketch) returns the page, sources(sketch) the
files it is made from, check(sketch) what is wrong. A bad source raises
BuildError (a ValueError), which is what console_pages.stamp raises too.

License: MIT
"""
from __future__ import annotations

import argparse
import gzip
import io
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
EXT = ROOT / 'tools' / 'patternflow-audio-extension'
SKETCH = ROOT / 'firmware' / 'patternflow'

PAGE = 'audio-in'
EDITOR_HTML, EDITOR_CSS, EDITOR_JS = 'editor.html', 'editor.css', 'editor.js'
EXT_ADAPTER = 'editor-adapter.js'  # the extension's PFAdapter; the panel's goes in its place
BAR_FILE, CSS_FILE, ADAPTER_FILE = '_audio_in_bar.html', '_audio_in.css', '_audio_in_adapter.js'
# The line a shared script is taken down to: a comment that says only this
# (a rule drawn around the words is fine; a sentence that mentions them is not).
EXTENSION_ONLY = re.compile(r'//\W*EXTENSION ONLY\W*')
EXTENSION_ONLY_CSS = re.compile(r'/\*\W*EXTENSION ONLY\W*\*/')
# editor.html: the editor itself is what is between these two lines. Above them
# is the extension's own source bar, which the panel replaces with its frame.
BODY_BLOCK = re.compile(r'<!--\s*EDITOR BODY\s*-->(.*)<!--\s*/EDITOR BODY\s*-->', re.S)
# _audio_in_bar.html: the line where the editor's body goes.
BODY_SLOT = re.compile(r'<!--\s*EDITOR\s*-->')

# Bytes of the page as the panel sends it: stamped by console_pages.py (the
# chrome's ?h= and the fallback PF), gzip -9. This is the heaviest page the
# console has, and on the panel's own hotspot (2-5 KB/s measured) a kilobyte is
# 0.2 to 0.5 s before anything paints - so, like check_footprint.py's PINS, it
# is pinned, and growing it is a decision somebody makes rather than something
# that happens. It was 19,920 before the page stopped shipping its sources'
# comments and about 15,300 right after. To raise it, change the number and say
# in the commit what the bytes bought. (zlib builds differ by tens of bytes for
# the same input; a page that close to the line is over it.)
BUDGET = 17500

# The panel's TCP send buffer (lwIP TCP_SND_BUF; console_serve.py's TCP_WINDOW
# is the same number, and its --slow link is where this was measured). A reply
# leaves one of these at a time and the next waits for the last to be
# acknowledged, so a page one byte into another window costs a whole round
# trip more: 0.4 s there, for the document and for everything behind it. The
# budget is the line the build holds; a multiple of this is the line worth
# getting under inside it, and weight() says how full the page's last window
# is: a few dozen bytes in it are a round trip that taking them out gives back.
# This is the mock's model of the link, counted on the body alone. On a panel
# the reply's headers go into the first window too, and lwIP may start with
# less than a full buffer; where the steps fall there has not been measured.
WINDOW = 5760

# The one comment that does travel: whoever opens the generated page is told
# not to edit it. Short, because the panel serves it too.
GENERATED = '<!-- GENERATED by build_audio_in_page.py: edit its sources -->'


class BuildError(ValueError):
    """A source this page cannot be assembled from; the message says which."""


# ── the sources ────────────────────────────────────────────────────────────

def console_dir(sketch=None) -> Path:
    return Path(sketch or SKETCH) / 'console'


def out_path(sketch=None) -> Path:
    return console_dir(sketch) / (PAGE + '.html')


def shown(path) -> str:
    try:
        return Path(path).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def text_of(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')  # universal newlines: LF from here on
    except OSError as e:
        raise BuildError('%s: %s' % (shown(path), e.strerror or e))


SCRIPT_TAG = re.compile(r'<script src="([^"]+)"></script>')


def script_files(editor_html: str, sketch=None) -> list:
    """(name, path) of each script the page carries: the ones editor.html
    loads, in its order, with the extension's adapter swapped for the panel's."""
    names = SCRIPT_TAG.findall(editor_html)
    if len(names) != editor_html.lower().count('<script'):
        raise BuildError(EDITOR_HTML + ': every script must be a plain '
                         '<script src="file.js"></script>; one here is not')
    for need in (EXT_ADAPTER, EDITOR_JS):
        if names.count(need) != 1:
            raise BuildError('%s: must load %s exactly once' % (EDITOR_HTML, need))
    return [(ADAPTER_FILE, console_dir(sketch) / ADAPTER_FILE) if name == EXT_ADAPTER
            else (name, EXT / name) for name in names]


def sources(sketch=None) -> list:
    """The files the page is assembled from. A preview server watches these
    to know the page changed; it never raises, so that it can."""
    console = console_dir(sketch)
    try:
        scripts = [path for _, path in script_files(text_of(EXT / EDITOR_HTML), sketch)]
    except BuildError:
        scripts = [console / ADAPTER_FILE, EXT / EDITOR_JS]
    return [EXT / EDITOR_HTML, EXT / EDITOR_CSS, console / BAR_FILE, console / CSS_FILE] + scripts


# ── what does not travel ───────────────────────────────────────────────────
# Each takes a source's text and the name to blame, and returns it lean. See
# the docstring for why these are line rules and what they refuse.

def lean_lines(lines) -> str:
    return '\n'.join(s for s in (line.strip() for line in lines) if s)


def lean_js(text: str, name: str) -> str:
    out = []
    for n, line in enumerate(text.split('\n'), 1):
        s = line.strip()
        if EXTENSION_ONLY.fullmatch(s):
            break
        if s.startswith('//') and '*/' in s:
            raise BuildError(
                '%s:%d: a // line holding */. If it closes a block comment, dropping '
                'the line would leave that comment open; reword it.' % (name, n))
        if not s or s.startswith('//'):
            continue
        if s.count('`') % 2:
            raise BuildError(
                '%s:%d: an odd number of backticks. A template literal that runs past '
                'the end of its line would have its inside stripped; keep each on one '
                'line (or build the string with +).' % (name, n))
        if s.endswith('\\'):
            raise BuildError(
                '%s:%d: the line ends in a backslash. A string continued onto the next '
                'line would lose that line\'s indentation; join it with + instead.' % (name, n))
        out.append(s)
    text = '\n'.join(out)
    if '</script' in text.lower():
        raise BuildError('%s: "</script" would end the page\'s <script> early' % name)
    return text


# A CSS line that is left as written: it holds a string, an escape or a url(),
# and telling the inside of one from the sheet's own punctuation is what would
# need a tokenizer.
CSS_AS_WRITTEN = re.compile(r'''["'\\]|url\(''', re.I)


def lean_css(text: str, name: str) -> str:
    text = EXTENSION_ONLY_CSS.split(text, 1)[0]
    out, at = [], 0
    while True:
        a = text.find('/*', at)
        if a < 0:
            out.append(text[at:])
            break
        out.append(text[at:a])
        before = ''.join(out).rsplit('\n', 1)[-1]  # this line, earlier comments already gone
        if before.count('"') % 2 or before.count("'") % 2:
            raise BuildError(
                '%s:%d: /* inside a quoted string; this build would cut it out as a comment'
                % (name, text.count('\n', 0, a) + 1))
        b = text.find('*/', a + 2)
        if b < 0:
            raise BuildError('%s:%d: a /* comment that never closes'
                             % (name, text.count('\n', 0, a) + 1))
        # A comment separates tokens (`a/**/b` is not `ab`), and it keeps its
        # line breaks so that a line number below is still the source's.
        out.append(' ' + '\n' * text.count('\n', a, b))
        at = b + 2

    # White space the sheet does not need. Inside a line: around { } ; and ,
    # and after a colon (never before one: `a :hover` is not `a:hover`), and
    # the semicolon that ends a block. Between lines: a break goes where it
    # follows { ; , or comes before { }, which leaves one rule to a line, as
    # the console's pages are written. Such a break is always between tokens
    # (a string cannot be open at the end of a line, and the one way to make
    # it so is refused), and every other break stays: `.a` over `.b {` is
    # still two selectors.
    text, written = '', False  # written: the line just added was left as written
    for n, line in enumerate(''.join(out).split('\n'), 1):
        s = line.strip()
        if not s:
            continue
        if s.endswith('\\'):
            raise BuildError(
                '%s:%d: the line ends in a backslash. A string continued onto the next '
                'line would be joined to it wrongly; keep it on one line.' % (name, n))
        as_written = bool(CSS_AS_WRITTEN.search(s))
        if not as_written:
            s = re.sub(r'\s*([{};,])\s*', r'\1', s)
            s = re.sub(r':\s+', ':', s).replace(';}', '}')
        if text and (text[-1] in '{;,' or s[0] in '{}'):
            if text[-1] == ';' and s[0] == '}' and not written:
                text = text[:-1]
            text += s
        else:
            text += ('\n' if text else '') + s
        written = as_written
    if '</style' in text.lower():
        raise BuildError('%s: "</style" would end the page\'s <style> early' % name)
    return text


def lean_html(text: str, name: str) -> str:
    for tag in ('pre', 'textarea', 'script', 'style'):
        if re.search(r'<%s\b' % tag, text, re.I):
            raise BuildError(
                '%s: <%s> in the markup. This build strips indentation and comments '
                'line by line, which is not safe inside one.' % (name, tag))
    text = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    if '<!--' in text:
        raise BuildError('%s: a <!-- comment that never closes' % name)
    return lean_lines(text.split('\n'))


# ── the page ───────────────────────────────────────────────────────────────

def assemble(sketch=None) -> str:
    """The page, LF line endings, exactly as console/audio-in.html holds it.
    Raises BuildError when a source is missing or cannot be stripped safely."""
    console = console_dir(sketch)
    editor_html = text_of(EXT / EDITOR_HTML)

    # The editor's body, inside the panel's frame. The extension's source bar
    # (its <header>) is outside the block and does not come along.
    block = BODY_BLOCK.search(editor_html)
    if not block:
        raise BuildError(EDITOR_HTML + ': the editor\'s body must sit between a '
                         '<!-- EDITOR BODY --> line and a <!-- /EDITOR BODY --> line')
    frame = BODY_SLOT.split(text_of(console / BAR_FILE))
    if len(frame) != 2:
        raise BuildError(BAR_FILE + ': needs exactly one <!-- EDITOR --> line, where the '
                         'editor\'s body goes')
    body = '\n'.join(part for part in (
        lean_html(frame[0], BAR_FILE),
        lean_html(block.group(1), EDITOR_HTML),
        lean_html(frame[1], BAR_FILE)) if part)

    css = '\n'.join((lean_css(text_of(EXT / EDITOR_CSS), EDITOR_CSS),
                     lean_css(text_of(console / CSS_FILE), CSS_FILE)))

    # One <script> per file, as editor.html has them: they are separate
    # programs ('use strict' is editor.js's own), sharing only the globals.
    scripts = []
    for name, path in script_files(editor_html, sketch):
        scripts += ['<script>', lean_js(text_of(path), name), '</script>']

    return '\n'.join([
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<script src="/pf-console.js"></script>',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>Patternflow - Audio</title>',
        GENERATED,
        '<style>', css, '</style>',
        '</head>',
        '<body>',
        body,
    ] + scripts + [
        '</body>',
        '</html>',
        '',
    ])


def stamped_gzip(page: str, sketch=None) -> int:
    """Bytes of `page` as the panel sends it: console_pages.py's own stamp and
    its own gzip, so this cannot measure something other than what ships."""
    if str(HERE) not in sys.path:
        sys.path.insert(0, str(HERE))
    import console_pages as cp

    sk = Path(sketch or SKETCH)
    name, rel, delim = cp.CHROME
    try:
        _, chrome, _ = cp.split(cp.read(str(sk / rel)), name, delim)
        shim = cp.load_shim(str(sk / 'console' / cp.SHIM_FILE))
        stamped = cp.stamp(page, cp.crc_of(chrome), shim, PAGE)
    except (OSError, ValueError) as e:
        raise BuildError(str(e))
    return len(gzip.compress(cp.payload(stamped), compresslevel=9, mtime=0))


def weight(page: str, sketch=None):
    """(gzip bytes as the panel sends it, one line saying so against the budget
    and against the send windows it takes)."""
    gz = stamped_gzip(page, sketch)
    windows = -(-gz // WINDOW)
    last = gz - (windows - 1) * WINDOW
    return gz, ('%d bytes, %d gzip -9 as the panel sends it (budget %d, %s; '
                '%d send windows of %d: %d in the last, %d left in it)' % (
                    len(page.encode('utf-8')), gz, BUDGET,
                    '%d spare' % (BUDGET - gz) if gz <= BUDGET else '%d OVER' % (gz - BUDGET),
                    windows, WINDOW, last, WINDOW - last))


def on_disk(sketch=None):
    """The page as written, LF, or None when there is none."""
    out = out_path(sketch)
    return out.read_text(encoding='utf-8') if out.exists() else None


def write(sketch=None):
    """Assemble and write the page. Returns (page, changed). Line endings stay
    the file's own (a Windows checkout is CRLF, as every file around it), and a
    page that already says this is not rewritten, so a build with nothing to
    do touches nothing."""
    page = assemble(sketch)
    out = out_path(sketch)
    if on_disk(sketch) == page:
        return page, False
    nl = '\r\n' if out.exists() and b'\r\n' in out.read_bytes() else '\n'
    with io.open(out, 'w', encoding='utf-8', newline='') as f:
        f.write(page.replace('\n', nl))
    return page, True


def check(sketch=None) -> list:
    """What is wrong, as lines to print; [] when the page on disk is what the
    sources assemble to and is inside its budget."""
    try:
        page = assemble(sketch)
        gz, _ = weight(page, sketch)
    except BuildError as e:
        return ['console/%s.html cannot be assembled: %s' % (PAGE, e)]
    problems = []
    if on_disk(sketch) != page:
        problems.append(
            'console/%s.html is not what its sources assemble to (one of them was '
            'edited, or the page was edited by hand).\n'
            '  run: python firmware/toolchain/console_pages.py build' % PAGE)
    if gz > BUDGET:
        problems.append(
            'console/%s.html is %d bytes gzip -9 as the panel sends it: %d over its '
            'budget of %d.\n'
            '  On the panel\'s own hotspot every kilobyte is 0.2 to 0.5 s before anything '
            'paints.\n'
            '  Take the bytes back out, or raise BUDGET in '
            'firmware/toolchain/build_audio_in_page.py and say in the commit what they bought.'
            % (PAGE, gz, gz - BUDGET, BUDGET))
    return problems


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        description='Assemble console/audio-in.html from its sources. '
                    'The usual way in is console_pages.py build.')
    ap.add_argument('--check', action='store_true',
                    help='write nothing: fail if the page on disk is not what the sources '
                         'assemble to, or is over its size budget')
    ap.add_argument('--sketch', metavar='DIR',
                    help='another copy of firmware/patternflow to read console/_audio_in* '
                         'from and write the page into')
    args = ap.parse_args(argv)
    # Sources are UTF-8 and so are their names in a report; a cp949 console
    # must not turn one into a traceback.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, 'reconfigure'):
            stream.reconfigure(errors='replace')

    if args.check:
        problems = check(args.sketch)
        for problem in problems:
            print(problem, file=sys.stderr)
        if problems:
            return 1
        print('console/%s.html is what its sources assemble to: %s'
              % (PAGE, weight(assemble(args.sketch), args.sketch)[1]))
        return 0

    try:
        page, changed = write(args.sketch)
        gz, line = weight(page, args.sketch)
    except BuildError as e:
        print('build_audio_in_page: %s' % e, file=sys.stderr)
        return 1
    print('%s %s: %s' % ('wrote' if changed else 'unchanged', shown(out_path(args.sketch)), line))
    if gz > BUDGET:
        print('  over its size budget: --check (and CI) fails until it is not', file=sys.stderr)
    if changed:
        print('the header still has to be baked: python firmware/toolchain/console_pages.py build '
              '(which also does this step)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
