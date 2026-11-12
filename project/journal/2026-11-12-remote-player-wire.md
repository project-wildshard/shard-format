# What another page needs to animate a player (REMOTE-PLAYERS RP6)

> Written by: Claude

A remote page drew other players from position, facing, board, swim, hp and held item only: a swing, its
weight and a jump reached just the player who made them. The `player` row for others now carries
`swing` (id 55, u8, a count that moves on each swing or shot and wraps), `heavy` (56, whether that swing
was the heavy) and `air` (57, off the ground and not swimming). Additive under WIRE-STABILITY 5.5: each
side reads rows by the sender's table, so an older page skips them and a newer page reads 0 and false
from an older server. `maxHp` stays owner-only: no row draws a bar over another player yet, and a
released id keeps its `send`, so it would take a new field.

The capture bridge (`bench/capture/v1-frames.ts`) now compiles each recorded class with only the row
fields its sender carried, as a v1 receiver would from that sender's table. The lock, the v0 hash pin
(now 2038956392) and the baseline counts move with it. `inSourceRepo` no longer throws for a copy
installed inside another git repo (WR6's carried item), with a nested-copy test.
