# Render-match hosts (TEMPLATES-CLEANROOM M4, opus-mossrender)

- Jake asked for shard source alone to reproduce the Mossgate and Brasscap cleanroom looks. The audit
  (meta TEMPLATES-CLEANROOM M4) found the format could not say: a reflecting pool, the sun's shadow strength,
  lamp halos, decay and flicker, motes (fireflies), ACES, a vignette, a bloom radius.
- New modules `look-render.ts` (shadow, motes, lamp extras, vignette) and `pool-surface.ts` (a pool's `surface`),
  so `look-light.ts` and `water.ts` stay under the lint caps. All keys are exactOptional: no default is filled,
  older shard files parse to the same bytes.
- 0.5.2: a PBR surface's procedural detail layer (world-space mottling, grain, bumps, moss on tops), J338's procedural route to the cleanroom's canvas textures: no bytes, no UVs.
- 0.5.3 (opus-mossrender2): a PBR surface's own glow, `emissive` + `emissiveIntensity` (three's MeshStandardMaterial emissive), for the cleanroom's lit lamp glass that stays lit by the sun; exactOptional, absent keys keep the bytes.
