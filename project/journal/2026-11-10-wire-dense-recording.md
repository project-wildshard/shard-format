# Dense room recording without sampling

The final WS3 capture uses 32 real native clients and 60 moving native
creatures in an explicit synthetic patrol arena. Three seconds preserve
all 2,912 frame encodes and 8,768 packets, including missing-ACK recovery.
The old word dictionary still expands to 80.16 MB of repeated JSON.

A typed, browser-compatible structural dictionary stores the exact tree
in 1.49 MB across 14 explicit deflate-JSON envelopes, each under the unchanged 1 MiB hook.
It has separate explicit stored/decompressed/expanded/node/depth bounds, ordered hash
checks and mandatory frozen byte replay. No file limit is raised and no
sample is dropped. The other three recordings keep their original form.

The generic decoder rejects forward/cyclic references, repeated object
keys and exponential/deep expansion before serialization. Real stream
corruption with recomputed storage hashes still fails the frozen codec.
The complete dense CI case passes in 3.99 seconds; five hostile-reader
cases are milliseconds. All remain outside hooks with 9.5-second caps.

Remove duplicate internal frame preparation, not an oracle: stored and
expanded session entry points now share one validated decode result.
Every frame and packet still passes the same mandatory frozen replay.
No benchmark timing, v1 gate, live network or renderer pass is claimed.

A second independent native capture reproduces all fifteen committed
data files literally byte for byte. All sixteen explicit recording and
graph proofs pass together in 5.78 seconds; dense case 5.36 seconds.
These readings are test duration, not the codec performance benchmark.

Rechecking the WS3 table also found its stricter 5 MB whole-recording
requirement. The initial 13.30 MB uncompressed graph did not meet it and
was never committed. Standard browser deflate, explicitly named in each
JSON envelope, keeps all data at 1,491,667 bytes including the manifest.
No limit is raised. The reader stream-bounds decompression before graph
parse, then verifies exact source bytes and the unchanged frozen oracle.
A real compressed expansion bomb refuses before allocating its result.

J206 one-shot review WS3-dense-ride-20261110T035648Z-57256 found one
MUST: validate the whole graph before any output construction. A separate
measurement pass now verifies all refs, keys and expansion bounds first.
The actual native-object mutant constructs one sentinel before a later
invalid reference; the fixed core constructs zero. The CI regression
keeps that barrier. No second review round or relaxed limit is used.

Compressed parts also declare exact decompressed lengths in the manifest,
bounded to 20 MB in total before concurrent reads and 1 MB per streamed
part. Hash-valid decompression bombs refuse before graph parsing. Eight
graph cases pass, dense body 7.21 seconds under the original 9.5-second
cap. These are proof durations, not codec benchmark numbers.

The final compressed format also repeats byte for byte in a second
independent native capture: all fifteen data files equal. Existing wire
suite 117/117 passes in 2.73 seconds; strict type/lint/format green.
