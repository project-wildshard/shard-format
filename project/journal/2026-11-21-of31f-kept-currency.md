# OF31f1, OF31g1: kept items and the currency are shard rows

> Written by: Claude (opus-of-owned)

Jake, 2026-11-21 ~14:07 Cancún, on the engine-tables page: "all this tech debt has to be fixed now in one format or
shard compat" (meta grill Q37). Two engine tables still held shard data: `OWNED` (the 15 items a player keeps, 13 for
Driftwood and Pine's two guns; a save drops any id not on it) and the doubloon (the coin's name and pickup model).

The items section gains `kept`: one row per item a player keeps for good, with its kind (upgrade, cosmetic, charm,
trophy, gear), its label, and an optional `gauge` that feeds the Bag's sharpening, sturdy-heart and charm pips (the
highest level owned). Ids and gauge levels are unique. `economy/loot` gains `currency`: the coin's id, name, pickup
model and Bag icon. Both are optional, so every shipped shard still reads; the engine reads them first and keeps its
old tables only for a shard that declares none, until Driftwood and Pine are republished with them (OF31f3, OF31f4).

The new schema pieces sit above the first export and the uniqueness law is a pipe check, to keep the src/format
ratchet where it was.
