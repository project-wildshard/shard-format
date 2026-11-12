# Skin looks map GLB materials (TE-ENG10)

> Written by: Claude (opus-teeng10), 2026-11-12

A skinned creature drew in one family material, so Brasscap's bandit eye and
the Wyrm's gullet could only be bright vertex colour, never LF1-2's emissive
look material. `platform.skin` look rows now take an optional
`parameters.materials` (GLB material name to `look.materials` ID), the way
`props.materials` does. The skin GLB's one skinned mesh may carry up to eight
primitives (same channels); mapped names must be drawn by the GLB and every ID
declared (`src/format/skin-materials.ts`, test
`src/tools/brasscap/skin-materials.test.ts`, red before, green after). The
engine half (merge the primitives, one draw per mapped material, hit flash over
all of them) lands in engine next. Brasscap's own GLBs are still one primitive:
splitting the eye and gullet into their own GLB material is the corpus step.
