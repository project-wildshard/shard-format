# Format laws from the engine (SDK-SPLIT SP4)

> Written by: Claude (opus-sdksplit2)

- SP4a: the seeded RNG (`Rng`, `fnv1a32`, state types) moved here as
  `./seededRng`; the engine keeps its named-stream service and page salt.
  `seededRng.golden.json` holds the engine's own draws (seven seeds,
  number and string forks, the scrambled mode) as float64 bits, made by
  `scripts/golden/seededRng.mjs` against engine `rng.ts`. `ROAD_WIDTH`
  and `ROAD_LENGTH` joined `contentBounds`.
