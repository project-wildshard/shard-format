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

The src/format ratchet refused the first cut (exports, magic numbers, a
four-parameter helper), so the line and its words live in memory-line.ts
with one export group, and the playing refusal is its own branch.

MG5: `runtimeCost` readings name the memory epoch they were taken
against (`epoch`, optional; absent is epoch 1). `MEMORY_EPOCH` is 1 today,
so nothing is refused yet: MG6 raises it when the model starts counting
shader compile, load transients, far slabs and paint arrays, and from then
an older reading refuses whatever the policy until the home re-measures.
Refusing every first-party home now would stop Driftwood and Nalati,
which are under the line.

Codex relay, MG4 and MG5. Loading-only estimates over 1.5 GB now refuse
under both report policies and in offline admission. Folder and stream
validation also count measured runtime residency in the offline verdict
and check its epoch. The loading-only cases failed before the fix.
