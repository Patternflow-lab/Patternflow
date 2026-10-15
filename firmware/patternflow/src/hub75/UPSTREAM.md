# Upstream

This folder is [ESP32-HUB75-MatrixPanel-DMA](https://github.com/mrcodetastic/ESP32-HUB75-MatrixPanel-DMA)
at tag `3.0.13`, commit `a6221865c71fd5aeba885c31b81fe41bd36c5705` (25 October
2025). It was copied in on 31 July 2026, in `42bfc10`. Upstream's `master` was
already past the tag that day, but the copy is the tag: every upstream file here
that [patternflow.patch](patternflow.patch) does not name is byte for byte the
one at `a622186`.

The patch is every change since. It is `diff -ruN` of upstream's `src/` against
this folder, over the files both carry, and [VENDORED.md](VENDORED.md) says why
each change is there.

## What was not copied

Only upstream's `src/` is here, and without its three images:

- `platforms/esp32/RGB_HUB75_PINS.png`
- `platforms/esp32s3/ESP32-S3-DevKitC-1-pin-layout.png`
- `platforms/esp32s3/ReservedPinsForPSRAM.PNG`

Everything at upstream's root stayed behind: `examples/`, `doc/`, `testing/`,
`LICENSE.txt` and the build manifests. One manifest came along under another
name. `library.properties` is `UPSTREAM_library.properties` here, kept for its
version line.

## Upstream's TODO

`setupDMA()` in `ESP32-HUB75-MatrixPanel-I2S-DMA.cpp` has
`// TODO: should we release all previous rowBitStructs here???`. It is
upstream's, and it stays as it is. Editing it would add a hunk to the patch.

## Rebuilding the patch

From the repository root, with GNU diff:

```sh
U=$(mktemp -d)
git clone -q https://github.com/mrcodetastic/ESP32-HUB75-MatrixPanel-DMA "$U/upstream"
git -C "$U/upstream" checkout -q a6221865c71fd5aeba885c31b81fe41bd36c5705
ln -s "$U/upstream/src" "$U/a"
ln -s "$PWD/firmware/patternflow/src/hub75" "$U/b"
(cd "$U" && diff -ruN -x VENDORED.md -x UPSTREAM.md -x UPSTREAM_library.properties \
    -x patternflow.patch -x '*.png' -x '*.PNG' a b) |
  sed -E -e '/^diff /d' -e 's/^(---|\+\+\+) ([ab]\/[^[:space:]]+).*/\1 \2/' \
  > firmware/patternflow/src/hub75/patternflow.patch
```

The `sed` drops the timestamps and the command lines diff prints, so the same
tree always gives the same file. Rebuild the patch instead of editing it.
Upstream ends some lines in spaces, the patch carries them as context, and an
editor that trims trailing whitespace (`.editorconfig` asks for that) breaks
those hunks.

To check it, apply it to a clean copy of the tag. The last `diff -r` prints
nothing:

```sh
cp -R "$U/upstream/src" "$U/check"
patch -p1 --fuzz=0 -d "$U/check" < firmware/patternflow/src/hub75/patternflow.patch
diff -r -x VENDORED.md -x UPSTREAM.md -x UPSTREAM_library.properties \
    -x patternflow.patch -x '*.png' -x '*.PNG' "$U/check" firmware/patternflow/src/hub75
```

## Taken from upstream since

None yet. A commit taken from upstream gets a line here, oldest first, with its
hash and title. The rebuild above then picks it after the checkout
(`git -C "$U/upstream" cherry-pick -n <hash>`), so the patch stays Patternflow's
changes and nothing upstream wrote.
