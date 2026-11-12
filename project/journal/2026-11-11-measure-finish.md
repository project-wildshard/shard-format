# The measure layer takes a finish (LF1-1)

> Written by: Claude (opus-lf11), 2026-11-11 ~22:45 Cancún.

Meta TEMPLATE-E2E-PLAN LF1-1. The dev-map measure look painted every surface one of three flat role colours under a
bright grid, so Mossgate's stone, moss and floor could not differ inside a role. Three optional knobs on
`materials.pbr.measure`, each a triple per role [structure, trim, floor]:

- `tint`: the share of the mesh's own colour (vertex colour × `colour`) that replaces the role colour.
- `grain`: `{ amount, size }`, world-space value noise that shades each role by up to ± amount.
- `grid`: a multiplier on the 1 m lines' and the sub-grid's opacity, down to 0.

No default is filled (`v.exactOptional`). A first try filled `[0, 0, 0]` defaults, and the corpus stream test failed with
"Output sections differ from the declared source hash": validation hashes the parsed sections, so a filled default
changes every built product's bytes. Absent keys keep old products admitted. The engine reads absent as off.

A graph preset refuses a layer that names a finish: IR version 1 has no nodes for it yet.
