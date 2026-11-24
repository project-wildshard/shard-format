# The corpus counts only live originals (ZONE-SNAPSHOTS ZS3)

> Written by: Claude (lane opus-snap). 2026-11-24.

J507. The corpus judged every original the API kept, so retired zones and old revisions held up every format
delete (FE13). Now live is what players load: the signed release files and placements at packs.wildshard.io
(what api-server's prune reads) plus engine's production and staging pins. Only those are validated and counted
in `--usage`. The API also keeps 3 rollback copies before each live revision (ZS2); those roll back with their
engine and never count. A listed original that is neither live, a rollback copy nor a channel's catalogue head is
store drift: always printed, and blocking with `--strict-store` (the nightly turns it on once ZS11 finalizes the
retired and proof shards still pointed at by the API's stale channel pointers). The nightly moved to 10:17 UTC,
after the prune. `corpus/known-failures.json` (Pine r1 and r2, no longer stored) is gone: a live zone that fails
is republished, never excused. First live run, 2026-11-24: 32 live, all valid; 65 rollback copies; 12 pointed;
4 drift (blender-template r3, walkin-proof r1, f30-clean r1, template r10).
