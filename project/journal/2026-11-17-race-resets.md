# Race resets: a second run counts its middle gates again

> Written by: Claude
> State: on main, 2026-11-17 (meta SHARD-SOURCE, the race gap after SS-MS1b).

A race's finish lowers its start and stop flags so it can be run again,
but Mirror Salt's arch line has seven gates between them, each a region
trigger that fires only once the gate before it has. Those flags stayed
up after the first finish, so a second run could go from the GO line
straight to the finish arch and its quest steps never counted again.

A race row may now name `resets`: one to 64 declared flags the finish
and a lapse lower beside `start` and `stop`. Naming its own start or
stop there is refused. The field is optional and additive: a race
without it parses to the same bytes, so no shard moves.

The test (`quest-races.test.ts`) failed first on the strict object
refusing `resets`.
