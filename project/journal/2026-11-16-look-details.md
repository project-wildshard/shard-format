# Look details (SHARD-SOURCE AP32a)

> Written by: Claude (opus-ss16h)
> State: built on `plan/ss16h`, 2026-11-16; ships in the next format minor.

- `look-details.ts` adds `look.details`: up to 8 layers of small clutter (grass, ferns). Each is one card mesh (base64
  f32 positions, normals and uvs, optional u16 indices, at most 2,000 triangles), a u8 density mask and u16 ground
  heights over a grid (`region`: corner, cell 0.5 to 8 m, up to 512 × 512 cells, a y span), clumps per full cell, scale,
  tilt and tint ranges, an optional sway and a desktop radius. The engine scatters it round the camera (AP32b), so a
  shard ships a mask instead of thousands of baked instance matrices.
- Byte sizes are checked against the region and the mesh (`look-details-bytes.ts`, a pure base64 decoder so the check
  runs in any host). `detailLayerRules` in `shardfileRules` refuses a layer whose material is not declared.
- Absent, files keep their bytes.
