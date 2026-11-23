# PR6f1: edges may carry observations (opus-compat-w9)

- `world/edge` takes an optional `edgeObservations` field: per side, `geometry` (`ground` or `void`) and `waterSurface`
  (open water's height at the edge, within 250 m). Engine's road strips read these today from its own registry
  (`manifest.ground.structures`, `minimap.openWater`); PR6f2 has the SDK write them and engine read them from the file.
- Its own file, `src/format/edge-observations.ts`, so `edgeProfiles.ts` keeps its ratchet counts. Declared as
  `noFileChange` in breaks 0.1.0.4: every admitted file still admits.
