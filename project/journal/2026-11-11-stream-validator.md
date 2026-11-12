# Streaming validator (meta API-CLOUDFLARE AC6a)

> Written by: Claude (opus-ac6a)

- `validateShardfileStream` (`src/format/product-stream*.ts`): the API
  Worker's full check (Jake's D1) can't spool 450 MB or read
  synchronously, so this walks the stored object once: its SHA-256,
  Brotli through a host port (`node:zlib`), a ustar walk with
  `indexTar`'s refusals, every member hashed as it streams.
- The tarball is sorted, so `shard.json` comes after the blobs. Each blob
  is held only while its facts are taken (kind sniff, extension, parsed
  costs, KTX2 device costs); then `inspectBlob` and the inventory steps
  replay in the old order once the index is read. Corpus mutations and
  `readTar` refusals give the old messages exactly.
- Not done: `validateShardfileAssets`' byte checks and the pack checks.
  They want assets by hash in any order (153 MB of blobs on the 327 MB
  pin), so the result says `complete: false, pending: [...]`. Holding the
  blobs compressed doesn't help: they shrink to 128 MB.
- Measured on pine-hollow (327 MB tar, 290 MB `.tar.br`): 13.5 MB of
  members held at most; passes in workerd under a 32 MB V8 heap cap (8 MB
  OOMs, so the cap is real), 3.3 s wall.
- `meshoptimizer/decoder` compiles WebAssembly from bytes at import,
  which Workers refuse. `meshopt-decoder.wasm` is its own SIMD module,
  unpacked by its own rule; `meshopt-static.mjs` is the alias target.
  A test checks the bytes against the installed decoder and the decodes
  against it on every mode and filter.
- Codex review: kept errors held their blobs through captured stacks
  (now kept as messages); the stream awaits the decoder itself; a JSON
  blob can still blow the heap while parsing, as in the old validator.

## AC6a2: complete (opus-ac6a2)

- `validateShardfileStream(open, ports)` now takes `open`, a function
  that opens the stored object afresh, and returns `complete: true`.
- `validateShardfileAssets` is split into `assetAdmission`,
  `admitCommonsBytes`, `admitFileBytes` and `admitAfterFiles` (same
  steps, same order; the old function composes them).
- A second read runs `admitFileBytes` on each listed file as it
  streams, keeps refusals as messages and throws the first in
  `shard.files` order. It holds only the "placed" assets the later
  checks read by hash (props, terrain, navigation, collision, near,
  skins, sketches, recordings, commons). A later check reading any
  other file is refused with a `stream:` message, never guessed.
- Left-out packs are rebuilt in entry order, holding members that
  stream early; packs are grouped so one read holds at most 16 MB,
  each group taking another read. Carried packs are checked in the
  second read.
- Caps: kept files plus placed assets 48 MB; one pack 16 MB held.
- Pins (local cache): 12 MB and 68 MB take 2 reads, 17 and 18 MB
  held; 327 MB takes 4 reads, 36.6 MB held, 12 s wall in bare
  workerd (2026-11-03, disk service) under a 32 MB V8 heap cap (24 MB
  OOMs): about 69 MB at most.
- Codex review: skin GLBs are named inside the skin JSON (placed keys
  now follow JSON dependencies); held placed bytes and a lone pack were
  uncapped (now capped, refused with `stream:`); the held count missed
  earlier reads' bytes (fixed).
- The corpus test awaits the GLB decoder in `beforeAll`: the old
  validator needs it ready, and test order decided it (opus-k7b's
  flaky push).
- Still open: a JSON blob can blow the heap while it parses (millions
  of tiny objects), as in the old validator.
