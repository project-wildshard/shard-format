# Keep complete frame recordings within their declared JSON cap

The first original-v0 Sunscar capture retains 901 actual frames and 2706
packets across 1800 walking ticks, including lost ACKs and full recovery.
Its raw JSON is 7856996 bytes, above the five-MB recording ceiling.

Dictionary only exact base64 row, owner and ride bit strings. Every
baseline, per-handle source, due result, class, byte string and packet
stays present. Both pack and persisted unpack validate frozen frame
replay before returning data to a timing run. The full private capture
reloads exactly, revalidates all packets, and measures4474982bytes.
The full artifact and capture runner are still private; this commit
ships its typed reader and three actual source-frame samples only.

The one-shot review found no MUST-FIX. Both SHOULD fixes are included:
corruption requires the byte-difference error, packing corrupt source
bytes must refuse, and owner as well as ride preserves signed zero.
Five focused cases plus actual root Oxlint, build and strict types pass.
Review: ~/.cache/wildshard/session-keep/reviews/
shardfile-WS3-frame-dictionary-20261110T012053Z-3280.md.

The remaining scenarios, committed capture runner, Node/4x Chromium
benchmark and repeatability are open. WS3 is not done. No frozen codec,
policy, size limit, asset or engine source changes.
