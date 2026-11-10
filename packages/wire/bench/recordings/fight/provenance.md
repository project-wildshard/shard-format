# Two-client Driftwood fight recording

Exact engine cfd668102efcb7c10a6fb57d3021c1f3d23c37a5, actual admitted
Driftwood product, native physics, SimNetWorld, NetRoom and two NetClients.
Run src/scripts/wire/capture-fight.mjs with the same BASE/NEW_OUTPUT arguments
and exact-tee preflight as capture-walking.mjs (docs/dev.md).

The benchmark fixture starts both physical players next to an actual
living crab, matching the net-link-play combat setup. This is an initial
arena placement, not a spawn-to-fight journey claim. The creature retains
its real AI. Thereafter only real command packets steer, aim and attack;
no health, flag, hit or outcome is supplied. Its 70 HP falls to zero.

Over 300 ticks (5 simulated seconds), 302 frames and 928 complete packets
preserve two hellos, two welcomes, 600 command packets, four chat acts
and eighteen event packets. Decoding the actual bytes finds twelve hit,
two died, eight chat and two reward notifications across both clients.
They are replicated notifications, not counts of distinct server hits.
Each client's decoder drops zero frames. No live socket is opened.

The 180 <= tick < 260 interval intentionally drops 160 upstream command
packets in total. Twenty later full frames prove missing-ACK recovery.
Every actual rowFrom source, due decision, owner/ride bit and packet
remains and must replay frozen-v0 byte-identically before storage/timing.

Canonical source: 3,363,856 bytes, SHA-256
0eb9ad661cabfbbce08da88e3a6183736ba8ba7b613a6a60b29183be0e897035.
Five JSON parts plus manifest: 3,364,687 bytes, largest part 998,544 bytes.
All original file/session caps stay. This is capture evidence only;
mounted/dense recordings and the Node/4x timing benchmark remain open.
