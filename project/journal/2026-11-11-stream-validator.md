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
