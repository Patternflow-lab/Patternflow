# Cleanup baseline

*Step 0 of [rfc-cleanup.md](../rfc-cleanup.md), §2.2. Run on 14 October 2026.*

The cleanup starts from `8226f7ea5da15b0e0e55b15fa9ec7af136eef080` on `dev`,
the commit that added [rfc-cleanup-progress.md](../rfc-cleanup-progress.md).
Project v3.11.0, Audio v0.7.0, Performance v0.4.0. The last commit to touch
`firmware/` or `web/` before it is `caaf2c1`, on 12 October.

The web commands ran in a cloud container on that tree with nothing added:
Node 22.22.0, npm 10.9.4, `npm ci` from `web/package-lock.json`. CI runs Node 20.

## The five commands

| command | result | output |
| --- | --- | --- |
| `firmware/bundles/build.sh all` | pass, on CI | five compositions built and scanned, see below |
| `npm run check:ci` | pass | 25 suites, last line `All module cache checks passed.`, 50 s |
| `npm run check:panels` | pass | 35 test files, 478 tests, 19 s |
| `npm run typecheck` | pass | `tsc --noEmit` prints nothing, 27 s |
| `npm run lint` | pass | 0 errors, 12 warnings, 50 s |

None of the five is red, so there is no fix PR to land before Step 1.

The container cannot build firmware. PlatformIO fetches the espressif32 platform
and the Xtensa toolchain from `api.registry.platformio.org`, and the container's
network policy refuses that host (403 on CONNECT). So `build.sh all` ran the way
CI runs it, `build.sh one <composition>` per job, in `firmware-build.yml`
dispatched on `dev` at this SHA ([run 38560727407](https://github.com/Patternflow-lab/Patternflow/actions/runs/38560727407)).
Each job scans its image for the feature markers:

```
default       1102672 bytes  ok
audio         1208656 bytes  ok
performance   1526624 bytes  ok
clock         1187088 bytes  ok
midi          1163440 bytes  ok
```

`check_footprint.py` says `every edition within tolerance` in all five. The 17
host-side checks in `firmware-checks.yml` and the two in `console-sync.yml` pass.

The lint warnings, for Step 3:

| file | line | rule |
| --- | --- | --- |
| `web/scripts/performance-smoke.ts` | 16 | `@typescript-eslint/no-unused-vars` |
| `web/src/app/build/breadboard/page.tsx` | 394, 435, 476, 514, 556 | `@next/next/no-img-element` |
| `web/src/app/editions/EditionCard.tsx` | 35 | `@typescript-eslint/no-unused-vars` |
| `web/src/app/roadmap/RoadmapMap.tsx` | 272 | `@typescript-eslint/no-unused-vars` |
| `web/src/app/roadmap/RoadmapMap.tsx` | 315 | `react-hooks/exhaustive-deps` |
| `web/src/components/community/PatternCard.tsx` | 8 | `@typescript-eslint/no-unused-vars` |
| `web/src/components/journal/JournalLightbox.tsx` | 86 | `@next/next/no-img-element` |
| `web/src/components/sections/Hero.tsx` | 55 | `@next/next/no-img-element` |

## The doc map

`npm run doc-map` in `web/` ([doc-map.ts](../../web/scripts/doc-map.ts))
wrote [2026-10-doc-map.csv](2026-10-doc-map.csv): 1007 links out of 193
files, 7 of them from this file, `AGENTS.md` and the progress log as Step 0
leaves them. 532 are relative, 329 site, 114 absolute-blob and 32 console.
None is absolute-raw; nothing links through `raw.githubusercontent.com`.

24 of the absolute-blob rows name a release tag, `v1.0.0` to `v3.1.0`, from the
roadmap, the release notes and the hardware READMEs. A shallow clone has no
tags and reports those 24 as `no`, so fetch the tags before running the script.

The map leaves out links that a file move cannot break: a bare `#anchor`
inside one file, the repository's front page, issues, pull requests and
releases. It also leaves out the site's own route links (`href="/guide"` in a
component), the vendored upstream docs under `hub75/`, `webserver/` and
`pubsubclient/`, and the `*_index.h` headers, which are the console pages again.

§2.3 expects the site to link `BUILD_GUIDE_v2.md` at §1, §2, §4, §8 and §10.
At this SHA it links it once, from `BuildPanel.tsx`, with no anchor. The
anchored links go to `BUILD_GUIDE.md`. Moving the v2 guide touches that one
site link, the test beside it, and five Markdown files: `README.md`,
`BUILD_GUIDE.md`, `docs/assembly/README.md`, `hardware/README.md` and
`hardware/case/README.md`.

## Known broken

None. Every row in the map resolves.
