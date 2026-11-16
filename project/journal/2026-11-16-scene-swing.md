# Scene swing (meta SHARD-SOURCE SS8b), opus-ss16l

- `look.light.swings` (new `look-swing.ts`, at most 32): hanging bodies with a
  pivot, body length, rate, gust lean and bump reach. A lamp's `swing` names
  one, so its light turns with the lantern; a pbr or emissive entry's
  `swing: true` reads the per-vertex `_SWING` channel (row number + 1, 0
  still). Additive: absent keys stay absent, older files keep their bytes.
- look-light.ts sits at the 300-line cap, so the swing rows live in their own
  module and file of tests.
