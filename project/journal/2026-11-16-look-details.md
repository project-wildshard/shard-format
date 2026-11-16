# Look details (SHARD-SOURCE AP32a)

> Written by: Claude (opus-ss16h)
> State: built on `plan/ss16h`, 2026-11-16; ships in the next format minor.

- `look-details.ts` adds `look.details`: up to 8 layers of small clutter (grass, ferns). Each names three binary files by
  hash: a card mesh (no header: f32 positions, normals and uvs, then u16 indices; at most 2,000 triangles and 6,000
  vertices, counts in the row), a u8 density mask and u16 ground heights over a grid (`region`: corner, cell 0.5 to 8 m,
  up to 512 × 512 cells, a y span). The row holds clumps per full cell, scale, tilt and tint ranges, an optional sway and
  a desktop radius. The engine scatters it round the camera (AP32b), so a shard ships a mask instead of thousands of
  baked instance matrices.
- The files stay binary: the first cut put them inline as base64, but the engine refuses base64 (G649), so they became
  file references. `detailFileFaults` checks a layer's bytes against its counts and grid wherever the bytes are at hand
  (`check`, the cook, the engine); `detailLayerRules` in `shardfileRules` wants declared materials and plain binary
  files.
- Absent, files keep their bytes.
