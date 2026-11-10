# Full Sunscar walking recording

Captured from exact engine cfd668102efcb7c10a6fb57d3021c1f3d23c37a5,
with only the source tee in scripts/wire/install-capture-tee.mjs. The real
NetRoom/SimNetWorld, native physics and admitted Sunscar product run
1,800 command ticks. The runner and docs/dev.md give the repeat command.

The session preserves 901 byte-identical frames, 14,122 actual per-handle
rowFrom calls, 16,498 due results and 2,706 real transport packets.
Eighty upstream command bundles are deliberately lost; ten later full
frames prove recovery from missing ACKs. Actual displacement is
206.03405780008669 metres; decoder drops and live sockets are zero.

The canonical source is 4,474,982 bytes, SHA-256
892662a38ce40cb58deb7a3077233fe7f902744b08d545c094386c191a19350c.
Lossless word IDs retain every f32/f64 bit, including owner/ride words,
and all per-handle baselines. Six ordered JSON parts plus manifest are
4,475,972 bytes. Largest part is 999,298 bytes. No file exceeds the real
1 MB hook cap; the complete recording stays below 5 MB. Provenance prose
is separate from the manifest-addressed data and its timing input.

The actual codec first verifies every captured output during capture;
the reader again requires frozen-v0 byte-identical replay after full
hash-checked reload. This is historical v0, before socket voice prefix 8.
It is no claim about a mounted, fight or dense-room recording, or about
Node/4x Chromium benchmark timing.

The actual admitted product inputs at capture have these SHA-256 values:

- shard.json: c22b789e082a1ce85bc428ce485b8865af73c837c2bd8c04525780c907081eaf
- cook.json: e9475be46da6cf99b88e8b49dd40c264ef7eee2c0382a5b44b3f554d4d19e304
- validation.json: bed394eea86fd3b59b8f3176c85c9497bff60e9b3073fd32275cfb1276acac17

The portable runner was repeated after packaging; every one of the seven
manifest/part files was literally byte-identical. That is capture
repeatability, not the still-open two-run timing-stability measurement.
