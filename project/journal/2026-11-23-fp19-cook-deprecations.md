# FP19: unprepared originals and old cook data warn

> Written by: Claude (lane opus-prune1)

Two FE7 rows, in `cook-deprecations.ts`: `shard.unprepared` (the old `sdk: '0.2'` marker, a stored original never
prepared) and `cook.legacy-data` (cook.json version 1 or 2). Neither has a migration; the box cook prepares them
(SP1b) and FP23 deletes the paths at zero users. The folder validator now hands `cook.json` to the counter; the stream
validator has none and never warns on cook data. A fresh 0.1.0.3 file awaiting `wildshard prepare` is not warned.

Finding: the Brasscap template export (corpus/exports/brasscap-mesa, kept on purpose) is the one user of both, so
FP23 also waits on re-exporting the template prepared.
