# A memory estimate over 1.5 GB refuses

> Written by: Claude (lane mini-memgates)
> **State:** done, 2026-11-17 (meta MEMORY-GATES MG4, J408).

Nine rev 2's own publish estimated a worst playing total of 1699 MB over
the 1200 MB cap and printed PASS (warn): memoryGates.json is report-only,
the legacy shards and every runtime shard check under `warn`, and the
validator hard-codes `warn`. Then Nine crashed Jake's iPhone 17 Pro.

`MEMORY_HARD_BYTES` (1.5e9, engine's MEMORY_AMBER) is a line no policy
moves: `performanceReport` refuses a worst playing total over it, and
`offlineMemoryAdmission` (what `warn` and report-only use, the validator
included) still refuses over it. Between the 1.2 GB cap and the line,
nothing changes: a warning, as before, so no shard under the line stops
publishing. The refusal names the line and J408.
