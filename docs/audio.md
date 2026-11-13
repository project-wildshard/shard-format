# Audio in a shard: targets and how to hit them

> Written by: Claude

> **State:** living, 2026-11-13 (meta `docs/plans/AUDIO-PLAN.md` row AU8). Numbers are shard-format's `AUDIO_RULES`
> (`src/format/audio-rules.ts`) as of v0.4.5. If this page and that file disagree, the file is right; fix this page.

Read this before you add music or sound effects to a shard source. It says what to ship, why, and which shard-format
check holds you to it. Where no check exists yet, it says so and gives you the command to measure it yourself.

## Why audio has targets

J299 (Jake's decision, 2026-11-12, meta `docs/plans/multi-repo/MULTI-REPO-PLAN.md` section 2): audio is downloaded and
cached at DOWNLOAD, never streamed and never read during LOAD. So every recording your shard plays is in the phone's
first download, and every megabyte of it is boot time on bad LTE. Before J299, prod v0.1.13 Driftwood sat 34 s in LOAD
reading 91 audio files one by one (meta QA-FEEDBACK-2026-11-12 row 36). The targets below keep a shard's audio small
enough to download up front.

## Before you upload

1. Run `wildshard build <folder>` and read its `audio` lines (see "Where the check runs").
2. Measure each new or re-exported file with the three commands below: loudness (`ebur128`), length (`ffprobe`) and, for
   a stereo sound effect, the mono check (`aeval`).
3. Read `src/shards/<folder>/mounts.json` for a file you don't play, a copy of an `sfx/best` sound, or two files of the
   same sound; drop the unused ones and point duplicates at one file.

Done when: build shows no red line; each new music file reads `I:` between −19 and −17 LUFS; each new sound effect reads
`Peak:` at −1 or lower; each music loop runs 30 to 90 s and each one-shot under 3 s; each stereo sound effect's L−R
`max_volume` is above −40 dB (or it is mono). Fix an AMBER bitrate or format line in the same re-export that touches the
file.

## Where the check runs

One check owns the rules, AU5's (row AU5 of meta `docs/plans/AUDIO-PLAN.md`): `audioReport` in
`src/format/audio-rules.ts`, fed by `productRecordings` in `src/format/product-audio.ts` (it measures each recording
from its bytes in `src/format/audio-measure.ts`, no ffmpeg).

- `wildshard build <folder>` (sharddev) prints the report after validation: one `audio green|AMBER` total line, then one
  `AMBER audio <rule>: …` line per finding. Build still writes the shard file.
- `wildshard upload` (sharddev) and the API's admission refuse a **red** finding (`assertAudioAdmission`, code
  `audio-refused`). AMBER never refuses.
- Every finding has a stable code, listed in [VALIDATION-CODES.md](VALIDATION-CODES.md#audio).

The tests that pin each rule are in `src/format/audio-rules.test.ts`.

## The targets

| Rule | Target | AU5 check | Level |
|---|---|---|---|
| Format | AAC-LC in `.m4a`, 48 kHz, mono or stereo | `formatFinding`: `audio-unreadable`, `audio-wav`, `audio-sample-rate`, `audio-strict-index` | unreadable is red; the rest AMBER |
| Bitrate, music | 64 kbps stereo, 48 kbps mono | `bitrateFinding`: `audio-bitrate` (cap plus 10%) | AMBER |
| Bitrate, sound effects | 48 kbps stereo, 40 kbps mono | `bitrateFinding`: `audio-bitrate` (cap plus 10%) | AMBER |
| Length, any file | 180 s at most | `durationFinding`: `audio-duration` | red |
| Budget, the shard's own audio | green to 6 MB, AMBER 6 to 10 MB, red over 10 MB (J303) | `budgetFindings`: `audio-budget-amber`, `audio-budget-red` | AMBER, then red |
| Loudness | music −18 LUFS integrated (−19 to −17); sound effects true peak −1 dBTP or lower | none yet | measure it yourself |
| Loop and one-shot length | music loops 30 to 90 s; one-shots under 3 s | none yet; `audio-duration` stops only past 180 s | measure it yourself |
| Mono unless it pans | sound effects in one channel unless left and right differ | none yet; `audio-bitrate` gives mono a lower cap | measure it yourself |

A recording is music if its path starts `/assets/music/` and a sound effect if it starts `/assets/sfx/` (`recordingRole`
in `audio-measure.ts`). The bitrate cap follows from that path, so keep music under `music/`.

## Loudness

Target: music at **−18 LUFS integrated**, within −19 to −17; sound effects with a true peak of **−1 dBTP or lower**. The
engine sets music and effect gains itself, so a track mastered at −10 LUFS drowns the rest of the game, and a peak near
0 dBTP can clip once AAC decodes it. The engine's piano title (`public/assets/music/piano/title-3d1f713a.m4a`, engine
`8850b104`) measures −18.2 LUFS, peak −1.8 dBTP.

Measure with ffmpeg's `ebur128` filter:

```sh
ffmpeg -hide_banner -nostats -i public/assets/music/<set>/<name>.m4a \
  -filter_complex ebur128=peak=true -f null - 2>&1 | grep -E 'I:|Peak:'
```

`I:` is the integrated loudness in LUFS. `Peak:` is the true peak; ffmpeg prints its unit as `dBFS`, but with
`peak=true` it is dBTP. To fix a file, re-export it from the source at the target; don't stack gain on an already
encoded file.

**AU5 check:** none. Nothing measures loudness at build or upload yet; this rule is yours to measure.

## Length

- **Music loops run 30 to 90 s.** A shorter loop repeats audibly; a longer one costs download for nothing the player
  notices. At 64 kbps stereo, 60 s is about 480 KB.
- **One-shots run under 3 s.** The engine's shared `sfx/best` averages 2.7 s and 25 KB (meta `AUDIO-PLAN.md`, measured
  at engine `ec5ce64e`).
- **Ship each one-shot as its own file, never a bank.** Pine Hollow's
  `public/assets/sfx/pine-hollow/oneshots-362ce515.m4a` (shard-pine-hollow `8b17e93`) is one 160 s mono file of 1.16 MB.
  The engine decodes a whole file to PCM before it plays any part of it: 160 s × 48,000 samples × 4 bytes (float32) is
  about 31 MB of memory, and the whole 1.16 MB downloads, even when one sound plays.

**AU5 check:** `durationFinding` (`audio-duration`) refuses any file over 180 s as red. The 30 to 90 s and 3 s targets
have no check yet. Measure with `ffprobe -v error -show_entries stream=duration,channels -of csv=p=0 <file>`.

## Seamless loops

A music slot loops between `loopStart` and `loopEnd`, in seconds, from its row in the set's `music.json` (as in Coral
Drift's `public/assets/music/coral-drift/music.json`, shard-open-plots `bf47e41`). Put both on bar lines; `bpm` and
`beatsPerBar` sit beside them. The engine keeps only that window (engine `8850b104`
`src/client/engine/audio/loopWindow.ts`, `compactLoopWindow`, plus 128 samples either side), so an intro or outro
outside it costs download but never plays.

AAC starts every file with priming samples, the encoder's warm-up. The engine skips them using the `edts` edit list in
the `.m4a` (shard-format `src/format/aacIndex.ts` reads it as `primingFrames`; engine
`src/client/engine/audio/aacPull.ts` drops them). So:

- export with an edit list (ffmpeg and macOS `afconvert` write one by default);
- don't pad silence at the start to hide priming, and don't trim samples by hand to "fix" a click;
- if a loop clicks, check that the file has `edts`, then move `loopStart` or `loopEnd` to a zero crossing on a bar line.

**AU5 check:** `formatFinding` reports `audio-strict-index` (AMBER) when a file is AAC that the strict playback index
refuses, for example with no `edts` (six of Pine Hollow's beds at shard-pine-hollow `8b17e93`). Treat it as a loop that
may click.

## Cache, never stream (J299)

There is no lazy or streamed audio. Everything your shard names is downloaded at DOWNLOAD and cached on the device
before play starts. So:

- ship a loop, not a long track that would need to stream;
- ship only what you play: an unplayed recording is downloaded anyway. Drop unused takes and styles from the shard
  source and from `src/shards/<folder>/mounts.json`.

**AU5 check:** the budget (`budgetFindings`) and `audio-duration` are the limits; together they bound what DOWNLOAD
carries.

## Mono unless it pans

Ship a sound effect in mono unless its left and right channels really differ, for example a stereo ambience bed or a
sweep. A positional sound is placed by the engine, so a stereo source buys nothing. Mono at 40 kbps is under half the
bytes of a stereo file at about 97 kbps, the rate shards shipped at before AU7's encoder (`audio-rules.ts` header).
Music may stay stereo.

To see whether a stereo file is really mono, measure the difference of its two channels:

```sh
ffmpeg -hide_banner -nostats -i <file> -af "aeval=val(0)-val(1)|val(0)-val(1),volumedetect" -f null - 2>&1 \
  | grep max_volume
```

A `max_volume` below about −40 dB means left and right are the same: export it as mono.

**AU5 check:** none refuses stereo. `bitrateFinding` holds a mono file to the lower cap (40 kbps for sound effects, 48
kbps for music), so a mono export is what gets you under it.

## Share, don't copy

The budget counts each distinct file once, by content hash (`uniqueRows` in `audio-rules.ts`): two paths with the same
bytes cost one download. Use that.

- **Within a shard source, or across the shards of one repo:** point at one file. Saltwind Lighthouse and Sky Harbor
  both mount Coral Drift's ambience, `/assets/sfx/coral-drift/ambience-6243d1442260.m4a` (shard-open-plots `bf47e41`,
  `src/shards/open-plots/mounts.json` and `outputs.json`). The device caches it once under that hashed name.
- **Engine sounds:** the engine's shared set, `/assets/sfx/best/` (153 one-shots and beds at engine `ec5ce64e`), ships
  with the engine. Name a sound from it by its catalogue path; don't copy its bytes into your shard source. A copy you
  mount counts against your budget, because the check counts every own `/assets/music/` and `/assets/sfx/` mount.
- **`audio.recordings` bindings:** a `commons:<sha256>` reference is shared, not yours, so it is not in your budget
  (`productRecordings` skips it). See the `audio.recordings` paragraph in [SHARDFILE.md](SHARDFILE.md).

**AU5 check:** `audioReport` dedupes by hash before it sums the budget, so sharing shows up as fewer bytes in the `audio
…` total line.

## Engine music slots (J304)

Every shard plays one music style, piano (J304, Jake 2026-11-12). A score can play the engine's own piano stems instead
of shipping its own: a slot whose set is `base` (or unset) plays the engine's stem of that name, and `bootSlots:
['title']` plays the engine's title. The engine has exactly these slots: `ENGINE_MUSIC_SLOTS` in
`src/format/engine-music.ts` (`island`, `pine`), plus `title`. Validation refuses any other `base` slot
(`AudioMusicSchema`; tests in `src/format/audio-engine-music.test.ts`).

Engine music the engine ships costs you no budget in AU5's check, since the bytes are the engine's; a stem your shard
source mounts itself does count. Engine music is still in the player's download: the piano title alone is 0.76 MB (meta
`AUDIO-PLAN.md` row AU18, engine `8850b104`).

## The budget (J303)

AU5 counts your shard's **own** recordings: every `/assets/music/` and `/assets/sfx/` mount plus every non-commons
`audio.recordings` blob, each distinct hash once.

| Own audio | Level | What happens |
|---|---|---|
| up to 6 MB | green | nothing |
| over 6 MB, up to 10 MB | AMBER (`audio-budget-amber`) | build prints it; upload and admission pass |
| over 10 MB | red (`audio-budget-red`) | build prints it; upload and admission refuse |

A shard over the red line while its fix is under way can carry a dated waiver in its shard source,
`src/shards/<folder>/audio-waiver.json`:

```json
{ "version": 1, "waivers": [{ "shard": "<slug>", "until": "2026-12-31", "maxBytes": 15000000, "reason": "<why, and the row that closes it>" }] }
```

Build copies the row for your slug into the shard file's `shard.json` as `admission.audioWaiver` (schema:
`AudioWaiverSchema` in `src/format/audio-waiver.ts`). While it holds, red becomes `audio-budget-waived` (AMBER). It
stops holding when the date passes, when it names another shard, or when your audio grows past `maxBytes`: then you get
`audio-waiver-invalid` (AMBER) and the red comes back.

The player's whole audio download is your own audio plus the engine music and `sfx/best` sounds you play. That total is
the engine's to report, not this check's.
