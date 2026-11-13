# MoverBox and AnimalDims (SHARD-COMPAT SI3)

- `./movers` exports `MoverBox` (an alias of `MoverData`'s box row) and
  `./creatures` exports `AnimalDims` (the species `dims` row, spelled out
  with field docs), so shards stop naming engine's `physics/mover` and
  `entities/species/registry`. Types only; no schema or output change.
- `row-type-exports.test.ts` compiles a virtual consumer: each type equals
  the row it names both ways, and a box without `rot` or dims without
  `feet` is refused. Engine's `AnimalDims` also has an optional
  `capsuleAxis`; the format row never allowed it, so the format type omits it.
- Ratchet: both files fold the new name into one trailing `export type { }`
  (with `MoverBake` and `PageGroupRows`), and creatures' non-exported
  interfaces sit after its last non-export statement, so `group-exports`
  and `exports-last` don't rise.
