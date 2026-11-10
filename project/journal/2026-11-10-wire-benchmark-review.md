# Resolve the three pre-timing review findings

J206 original NO-GO fca0d4d, three MUST and two SHOULD:
`~/.cache/wildshard/session-keep/reviews/ws3-recordings-shardfile-20261110-WS3-two-run-benchmark-20261110T101912Z-48658.md`.

Take p95's ending clock before constructing its reporting key. The
actual old order passes the four statistics-only checks and fails the
new deterministic timestamp-boundary proof. Restore every source byte.
Move common codec selection into each timed sender/receiver call:
retain typed prepared values, switch to actual frozen encoders inside
encodePacketInput, and dispatch the actual receiver prefix inside
decodePacketValue. Frame/packet selection is timed too. No frozen codec
is edited; original text/BOM restoration and every byte oracle remain.
Expose the actual sink on the browser API and consume it outside clocks;
Node consumes it too. Allocation and decoded objects stay observable.

Close both SHOULD notes with a real-codec forwarding harness: original
order, lost-send encoding, delivered-only decode, sender-kind/receiver-
prefix dispatch and exact timestamp/reporting boundaries all assert.
Five cheap deterministic cases pass in 113 ms. Preserve every raw p95
sample in owned local JSON alongside a hashed compact summary. Retain
paired-clock resolution, zero counts and distinct timing bins without
subtracting or smoothing anything. Fixed work counts are unchanged;
1,024 diagnostic clock pairs are outside measured work. No timing run
or qualification is claimed here, and no second review is launched.
