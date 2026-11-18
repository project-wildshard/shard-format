# Placement pages admitted from their text (mini-ninemem3, MEMORY-GATES MG10, ENGINE-MEMORY EM17)

- Nine's boot allocated ~110 MB of main-thread garbage parsing ~6 MB of scene placement pages: `placementPageData`'s
  descriptor walk (a property descriptor per key, entry and item copies), valibot's rebuilt output, and the matrix branch
  of the pose union failing (issue objects) for every yxz pose. Allocation sampling, engine `10616505`, Low phone boot.
- `parseWorldScenePlacementPageText` (`placement-page-text.ts`, walk in `parsed-json.ts`): a `JSON.parse` value is plain
  by construction, so the guard is just nodes, depth and canonical numbers; an exact page is used as it stands. Anything
  else, including shapes valibot would accept but rebuild (`cull: []`, a 4-item colour, a `__proto__` params key),
  goes to `parseWorldScenePlacementPage`. Safety is the differential fuzz: 4 seeds x 100k mutated pages by hand, none
  admitted that the schema refuses. 21 real pinned pages (Nine, Sky Reach, Pine, Nalati, Driftwood, Dunes) all take the
  plain path with output equal to the schema's, 3x faster.
- Engine is held on format 0.21.0 (MG8), so engine carries the same code until its pin reaches a release with this.
