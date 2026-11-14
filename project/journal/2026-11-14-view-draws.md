# 2026-11-14: a view's draws, not a tile's (SHARD-SOURCE AP8)

> Written by: Claude (opus-ss4b)

- `contentBounds.ts` `VIEW_DRAWS` {phone 150, desktop 400}: one view's whole-frame draws per tier, the phone figure the
  engine's EP10 limit. The engine (plan/ss4) now merges static props and fine terrain per material per 250 m block, so a
  tile's own draw count stopped meaning a view's cost.
- `performanceTargetIssues` keeps the `perf-tile-draws` code (sharddev's refusal table names it) but checks
  `viewDraws(tiles, tile)`: the fine tiles near a tile's centre at their reported draws, an upper bound. The tiles' `draws`
  rows stay as the compiler reports them.

- opus-ss4c: the push hit the src/format lint ratchet (the AP8 lines raised magic-number, curly and
  export counts), so `VIEW_DRAWS` and `viewDraws` moved to their own lint-clean `view-draws.ts`
  (exported as `./viewDraws`) and `contentBounds.ts` went back as it was.
