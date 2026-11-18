# Memory gates are ratchets (J411, J412)

Lane mini-mg8, MEMORY-GATES MG8. Jake, 2026-11-18: "With these new gates we should
definitely be landing improvements even if they don't meet the new high standards."

`src/format/memory-ratchet.ts` holds one baseline per zone that is still over a line:
Nine, Pine, Nalati and Driftwood. A baseline is the zone's epoch-7 estimate, the largest
of the engine-pinned product (admission and performance report) and the current source.
The J408 1.5 GB line, the OF10c1a runtime tier and the MG5 stale-reading check now refuse
such a zone only above its baseline plus 0.5%; at or under it they report. A zone with no
row keeps every refusing gate. The stale check admits only the pinned product's identity
revision. A cut ratchets a row down, and a zone that passes a line loses that field.

`MemoryAdmission` takes a per-owner line, so the declared and actual envelope checks
read the same table.
