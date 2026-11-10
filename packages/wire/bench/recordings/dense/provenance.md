# Synthetic dense room recording

Exact engine cfd668102efcb7c10a6fb57d3021c1f3d23c37a5, real native physics,
SimHost, SimNetWorld, NetRoom and 32 actual NetClients. The authored
benchmark level uses a real ground-creature recipe from the admitted
Sunscar resident's public continuation adapter. It is a synthetic flat
arena, not a Nalati herd or live server capacity claim.

32 players and 60 creatures begin on an interleaved three-metre grid.
An explicit synthetic patrol policy sets each creature's desired native
motor yaw and speed. After 60 warmup ticks, commands steer all 32 players
for 180 captured ticks (three simulated seconds). Actual motor movement
exceeds 0.1 m for every player and creature. No pose, frame row, state or
packet is manufactured after initial placement. No live sockets open.
All clients report zero decoder drops; finally disposes all clients,
room and native world, including failed assertions and file writes.

The complete stream has 2,912 frames (91 per client) and 8,768 packets,
including 32 hellos, 32 welcomes and 5,760 command packets. Every client
sees the other 31 players and all 60 creatures; its own handle stays out
of its visible rows. Command loss at 20 <= capture tick < 100 discards
2,560 packets, exactly 32 per tick. 320 full recovery frames retain the
missing-ACK path. Wire ticks are 60..240 because warmup precedes capture;
transport ticks are 0..179. No sample or callback is discarded.

Expanded canonical source is 80,160,770 bytes, SHA-256
5124dbef574237cf721fbd2a5472b6315a8005bca189888e1d63b9c402c3b6e0.
Lossless structural sharing retains that exact JSON tree in 14 ordinary
deflate-JSON part envelopes plus manifest, total 1,491,667 bytes. Every file
is at most 170,188 bytes, beneath the existing 1 MiB hook cap and the
plan's 5 MB per-file ceiling. No hook or storage policy is raised.

All four complete recordings remain below 5 MB stored in total per
scenario. Dense uses wire-capture-graph/1: lossless structural sharing
followed by standard browser deflate in explicit JSON envelopes. Limits
are 5 MB stored, 1 MB decompressed per part, 100 MB expanded canonical
JSON, 500,000 nodes and depth 64 maximum. Its
reader checks ordered complete parts, each hash and the canonical hash,
bounds streamed decompression and expansion before serialization, refuses forward/cyclic refs and
duplicate object keys, then requires every frozen frame and non-frame
packet to replay byte-identically. This includes per-handle rowFrom
sources and due decisions. Correctly resealed corrupt bytes still fail.

Run scripts/wire/capture-dense.mjs with the documented BASE/NEW_OUTPUT
arguments and exact-tee preflight. The independent CI graph proof is
outside hooks and retains 9.5-second timeout/elapsed bounds per case.
This is capture integrity, not Node/4x Chromium timing or a v1 gate pass.
