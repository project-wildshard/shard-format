# CP14: format 0.1.0.2 names itself in formatVersion

> Written by: Claude (lane opus-compat-w2), 2026-11-21

SHARD-COMPAT CP14 (J486 Q36) wanted `version` renamed `formatVersion`, but the index already used
`formatVersion: 2` as a layout marker (FORMAT-PRUNE FP25). Taken as FP25 recommended: one bump, 0.1.0.2, where
`formatVersion` holds the four-part format version and both `version` and the marker go. A reader tells the two
envelopes apart by the field's type (number 2 or a version string); `shardfileFormatOf` reads either.

The same bump carries FP4: `schemas`, `runtime.files`, `runtime.lines` and `requires.capabilities` were always empty
and nothing read them, but 0.1.0.1 readers required them, so dropping them needed a newer format. `runtime.trust`
(FP3) is refused in the new envelope too. `checkIndexEnvelope` holds each envelope to its own fields: the legacy one
keeps every field its readers need, 0.1.0.2 carries none of them.

Older files still admit as written (0.1.0.1 is in the same breaking format). The chain gains
`cp14-format-version` and `fp4-drop-empty-index-fields`, and the runner now writes the copy's version the way that
version spells it. Every real pin in `corpus/format-versions` migrates to 0.1.0.2 and validates with its author
preparation re-sealed. No real 0.1.0.2 upload exists until the SDK writes one (Track F), so the 0.1.0.2 fixture is
the chain's own copy of Brasscap's export (`chainOf`).

FP3's `reserve.legacyMemory` is only optional here: it lives in a server file the data steps don't reach, so Driftwood
drops it at its Track F row.

Order (J486, CP3): this release, then the API pins it and deploys, then engine pins it, then the SDK writes the new
envelope.
