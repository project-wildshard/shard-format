# FP20: the species-program family leaves the format

- opus-prune2: the three retired sections (the programme stub, the hull look book and the rigged-hull book), the three
  page feature kinds and their FE7 rows go, with the hull look book's schemas and the rigged-hull book's schema and
  parser. A data page now must draw its creatures from their declared looks (its keeper stands no body).
- Kept on purpose: `SpeciesProgramsSchema` (the engine's population shape and its tests), the keeper programme in the
  runtime plan (no pin uses it, but the engine still reads it), and the `RiggedHullBook` type (Nalati's generator data).
- `legacyKinds` cannot be deleted yet: Pine r18 writes `legacyKinds: []` in `actors/roster.json`, a named file no chain
  step reaches. It is optional now; Pine's generator drops it and the delete follows once no pin or kept file has it.
- The gate refuses only on `feature.species.program` (Nalati r8, production) and FP22e's legacySlot, so this lands with
  FP22e's release after production leaves Nalati r8, Driftwood r12 and Pine r16.
