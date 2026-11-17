# Format laws from the engine (SDK-SPLIT SP4)

> Written by: Claude (opus-sdksplit2)

- SP4a: the seeded RNG (`Rng`, `fnv1a32`, state types) moved here as
  `./seededRng`; the engine keeps its named-stream service and page salt.
  `seeded-rng.golden.json` holds the engine's own draws (seven seeds,
  number and string forks, the scrambled mode) as float64 bits, made by
  `src/format/seeded-rng.golden-gen.mjs` against engine `rng.ts`. `ROAD_WIDTH`
  and `ROAD_LENGTH` joined `contentBounds`.
- SP4b: `core/noise` (`./noise`) and `world/terrainField`
  (`./terrainField`) moved byte for byte; only their imports changed.
  `terrain-field.golden.json` samples three fixture specs
  (`terrain-field.golden-specs.ts`, not shipped) that touch every branch
  (graded path and bench, trails, pads, pond, ocean, finish, splat) on
  91 points, from the engine's own functions
  (`terrain-field.golden-gen.mjs`, run with the engine's
  sim-node-loader). New files are kebab-case. The src/format ratchet
  refuses any rise, so the verbatim law ports and the golden oracles
  carry one file-level oxlint-disable naming exactly the rules that
  fire, with the reason; restyling them would risk the bit-exact match.
