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
- SP4c: `parseBakedTerrain` and `bakedSamplers` were already defined
  here (`./bakedTerrainBytes`, `./bakedTerrainSampling`); the engine's
  `world/BakedTerrain.ts` only re-exports them, so nothing moved. The
  sdk's bake points at these subpaths in SP6, and `Heightfield`'s
  install global stays with the builders there. New characterization
  vectors pin them: three fixture grids (WSTR bytes from the SP4b
  fields) sampled through the engine's exports.
- SP4d (opus-sdksplit3): `placeForest`, `placeForestSteps`, `canopyMapOf`,
  `TreeGrid` and `treeGridOf` (`./forestPlacement`) and the `GrassField`
  class (`./grassField`) moved with no three.js, level or installed
  terrain: the caller hands a `ForestPlacementSource` (samplers, seed,
  tree cap, forest spec) or the grass ports. Tints are linear rgb
  triples from `hslToRgb`, three's `Color.setHSL` in the linear working
  space. `forest-placement.golden.json` pins five forests over the SP4b
  terrains (the plain draw, a species mix with every spacing, growth,
  bare pads, a mask, an infill grove, the cap, treeless and forestless),
  canopy maps, trunk queries, seven HSL triples and four meadows on 91
  points, all from the engine's own code; bit-exact on the first run.
  The engine's undergrowth pass (`placeUndergrowth`, `DecisionLog`) and
  `decodeTreeRecords` have no callers, so they stay for SP5 to drop.
