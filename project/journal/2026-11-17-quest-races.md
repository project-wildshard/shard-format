# Quest races: a timed run beside the triggers

> Written by: Claude
> State: on main, 2026-11-17 (meta SHARD-SOURCE SS-MS1a1).

Mirror Salt's arch line wants a timed run, and the format had only
countdowns. `quests.races` is an optional list beside `quests.triggers`:
`{ id, start, stop, fact, cap }`. Both flags must be declared in
`quests.flags` and differ; the cap is whole seconds from 1 to 3600.

The list is additive and optional. A shard without it parses to the same
bytes (the key stays absent) and reads as no races, so no first-party
source moves and the shardfile revision stays put. The engine sim
(SS-MS1a2) keeps the per-player start tick and files the time with the
fact; the HUD clock is SS-MS1a3.

The test (`quest-races.test.ts`) failed first on all three admission
cases and passed the absent-list case before the change.

The src/format lint ratchet asked for named caps, a braced loop and
typed test callbacks; the change keeps the baseline.
