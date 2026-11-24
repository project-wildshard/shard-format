# 2026-11-24: the host counter reads server sections (FORMAT-PRUNE FP48)

> Written by: Claude (opus-fp49)

`products.single-shard-server-hosts` read engine hosts from `native-assembly` files only. FP16 and FP21 moved every pinned
shard's hosts into the `hosts` rows of its server sections (`sections/server/riding.json` and friends), so the counter
fell to 0 without one host gaining a second user. It reads both homes now: 15 on today's 26 pins (Nalati 11, Driftwood 3,
Pine 1), and the ceiling ratchets from 16 to 15.
