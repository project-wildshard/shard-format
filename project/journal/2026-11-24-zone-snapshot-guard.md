# Zone-snapshot guard (ZONE-SNAPSHOTS ZS1)

> Written by: Claude (lane opus-snap). 2026-11-24.

Jake (J507): no old zone snapshots in test suites; delete or upgrade them. Before the deletes, a guard so no new
one comes in: `pnpm check:zone-snapshots` (in `pnpm check`) refuses a pin record outside the export's `.pin.json`
(slug + hash, a `pins/<hash>.tar` path, or a hash beside the local pin cache), a shard folder older than the current
format or naming a zone, a `<zone>-r<N>` path, chain fixtures or goldens that name a pin, `chainOf` or
`corpus/legacy`, and `corpus/known-failures.json`. Today's 18 offenders are a shrink-only baseline; ZS3 to ZS6 take
it to zero. Engine has the same guard in `lint:game`.
