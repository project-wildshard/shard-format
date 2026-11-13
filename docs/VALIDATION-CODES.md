# Validation codes

> Written by: Claude

> **State:** generated from `src/format/issue-codes.ts` (SHARD-AUTHORING SA41). Do not edit by hand: run
> `node src/tools/validation-codes.ts write`.

Every issue shard-format reports carries a stable `code`: a validator refusal, a performance report issue and an audio
finding. Match the code, never the message: messages may be reworded, codes are renamed only with a release note.

- A validator tags a refusal by the check that refused; a code set nearer the throw wins. Both validators give the same
  code for the same refusal.
- A code that is not in these tables (Node's `ENOENT` from a file port, `ERR_ENCODING_INVALID_ENCODED_DATA` from
  bad UTF-8) is replaced by the check's code; such codes differ by host. The message keeps its words.
- `issueCodeOf(error)` (`@wildshard/shard-format/issue-codes`) returns a refusal's code, or `undefined`.

## validate

`validateShardfileProduct`, `validateShardfileStream` and `readTar`: `error.code` on the thrown Error.

| Code | Meaning |
|---|---|
| `archive-invalid` | The tarball is not strict ustar (a bad header, path, padding or end, a truncated entry, too many entries), or the stored object does not decode. |
| `index-invalid` | `shard.json` is missing, too large, not canonical JSON, or fails the index schema. |
| `file-mismatch` | A listed file is missing, unreadable (a symlink, not a regular file), larger than declared, or its hash or size differs. |
| `section-invalid` | A section is not canonical JSON, fails its section schema, or is a `client/plan` kind with no declared side. |
| `script-side` | A script runs on a side its declaration does not allow (SERVER-PARITY SS7). |
| `script-admission` | The script admission rows the sections declare are invalid. |
| `blob-invalid` | A blob's bytes contradict its listing: kind or extension, registered named JSON and its schema, or costs understated. |
| `server-file-invalid` | A server file (J91) is unregistered named JSON or its bytes differ from its declared kind. |
| `ktx2-costs` | The declared KTX2 device costs differ from the verified bytes. |
| `pack-invalid` | A pack is missing a member, or a member or the pack's hash differs. |
| `cook-invalid` | The cook file, its preparation, or a mount (path or bytes) is invalid (C0, J137). |
| `runtime-files` | Copied runtime files are present without a runtime import checker, or fail it. |
| `unlisted-file` | A file in the product is not listed in `shard.json`. |
| `shard-schema` | The shardfile assembled from the sections fails the shardfile schema. |
| `declared-costs` | The declared costs fail preflight: a budget or memory admission over its limit. |
| `performance-targets` | A declared performance target over its limit refuses (the `REFUSAL:` lines). |
| `asset-admission` | An asset's bytes fail admission: parse, hash or wire size, costs, bounds or script contract. |
| `world-targets` | `world/targets` names an item or quest the shardfile does not declare. |
| `source-hash` | The sections differ from the declared `build.sourceHash`. |
## stream

`validateShardfileStream` alone: `error.code` on the thrown Error.

| Code | Meaning |
|---|---|
| `stream-cap` | A member, pack or the placed assets are over the streaming cap. |
| `stream-miss` | A check asked for bytes the stream did not hold (AC6a2). |
| `stream-changed` | The stored object changed between its reads. |
## performance

`performanceReport` and `performanceTargetIssues`: `PerformanceIssue.code`.

| Code | Meaning |
|---|---|
| `perf-memory-target` | A resident memory target (tradeable) is over; always a warning. |
| `perf-library-download-budget` | The declared library download budget is over the allowance. |
| `perf-critical-download-budget` | The declared critical (sim) download budget is over its limit. |
| `perf-library-download` | The library closure's download bytes are over the allowance. |
| `perf-critical-download` | The critical closure's download bytes are over the limit. |
| `perf-tile-download` | A tile's download bytes are over its LOD cap (provisional: a warning). |
| `perf-tile-draws` | A tile's draws are over its LOD cap (provisional: a warning). |
| `perf-tile-triangles` | A tile's triangles are over its LOD cap (provisional: a warning). |
| `perf-far-download` | The far view's download bytes are over the limit. |
| `perf-far-draws` | The far view's draws are over the limit. |
| `perf-far-triangles` | The far view's triangles are over the limit. |
| `perf-native-view-unmeasured` | Native view and download measurement is required and missing. |
| `perf-native-resident-unmeasured` | The native runtime declares no measured resident cost. |
| `perf-playing-memory` | The worst playing total bytes are over the limit (report-only under G433: a warning). |
| `perf-loading-memory` | The worst loading total bytes are over the limit (report-only under G433: a warning). |
| `perf-script-sample-invalid` | A measured script or fuel figure is not a finite, non-negative number. |
| `perf-script-cpu` | Script CPU p95 per tick is over the limit. |
| `perf-script-fuel` | Script fuel per tick is over the limit. |
| `perf-script-samples-missing` | Fewer than 60 measured script or fuel ticks. |
## audio

`audioReport`: `AudioFinding.code`; `assertAudioAdmission`: `error.code` on the thrown Error.

| Code | Meaning |
|---|---|
| `audio-unreadable` | A recording is not readable as AAC-LC 48 kHz mono or stereo (red). |
| `audio-strict-index` | A recording is AAC outside the strict playback index (amber). |
| `audio-wav` | A recording is PCM WAV; ship AAC-LC 48 kHz (amber). |
| `audio-sample-rate` | A recording is AAC at a sample rate other than 48 kHz (amber). |
| `audio-duration` | A recording runs over the maximum seconds (red). |
| `audio-bitrate` | A recording's bitrate is over its role and channel cap plus slack (amber). |
| `audio-budget-amber` | The shard's own audio bytes are over the amber line (amber). |
| `audio-budget-red` | The shard's own audio bytes are over the red line, with no waiver that holds (red). |
| `audio-budget-waived` | Over the red line, but a dated waiver holds (amber). |
| `audio-waiver-invalid` | The waiver names another shard, has expired, or covers fewer bytes (amber; the red budget finding follows). |
| `audio-refused` | `assertAudioAdmission` refuses a report with a red finding. |
