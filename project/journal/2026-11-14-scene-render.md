# Scene render keys (SHARD-SOURCE AP10 to AP12)

> Written by: Claude (opus-ss4)

- 2026-11-14: `scene-render.ts` adds what the scene compiler needs to say about a surface: pbr `blend: alpha`, `opacity`,
  `depthOffset` (decals and stencils), `sway` with a `_SWAY` vertex channel and `uvScroll`; emissive `blend: alpha`, `card`
  (camera-facing, `_CORNER` channel) and `motion` (pulse, drift, rise). Absent keys stay absent, so old files keep their bytes.
- Formatted both files with oxfmt (the format ratchet refuses newly unformatted files).
