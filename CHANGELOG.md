# shard-format changelog

Every release has a section here before it is tagged: one to five bullets in plain language, for shard authors and
Jake, never commit subjects. Add the next version's section at the top, commit and push it, then release as
docs/dev.md says.

## v0.5.5 (2026-11-14)

- A look can paint its own sky: `look.sky` is an unlit material graph (written in TSL) that the engine draws on its
  sky dome in place of the two-colour gradient, so bands, a sun glow, clouds and stars are the shard's own.
- The look's environment is filtered from that same sky, so ponds and shiny surfaces reflect the painted sky. Leave
  `look.sky` out and the dome draws as before.

## v0.5.4 (2026-11-14)

- A PBR surface can be see-through (`blend: 'alpha'`, `opacity`), sit just off a wall as a decal (`depthOffset`), sway in
  the wind (`sway`, its reach per vertex in a `_SWAY` channel) or scroll its map (`uvScroll`).
- An unlit surface can be blended over what is behind it (`blend: 'alpha'`) and drawn as camera-facing cards
  (`card: true`, corners in a `_CORNER` channel): flames, glows, fireflies and sparks.
- A card can move on its own with no shard code: `motion` pulses it (a flame), drifts it round its seat (fireflies) or
  lifts and fades it (sparks). Leave these keys out and everything draws as before.

## v0.5.3 (2026-11-13)

- A PBR surface can glow on its own: `emissive` (a colour) and `emissiveIntensity` light lamp glass, candles or coins
  while the sun and lamps still light them. Leave them out and the surface draws as before.

## v0.5.2 (2026-11-13)

- A PBR surface can carry a procedural `detail` layer: world-space mottling, fine grain, bumps and moss on its tops,
  drawn in the shader. It gives stone, slab, wood and moss their texture with no image files and no UVs. Leave it out
  and the surface draws as before.

## v0.5.1 (2026-11-13)

- A pond can now reflect: a pool's `surface` asks for a planar mirror of the scene (desktop) or a sky-only reflection,
  with its own deep tint, Fresnel and ripples. Leave it out and the pool draws as before.
- A look can soften its sun shadows (`look.light.shadow`: strength, blur radius, normal bias) and fill the air with
  fireflies, sparks or dust (`look.light.motes`).
- Lamps can glow and flicker: each lamp may add a halo, a flicker and its own light falloff (`decay`).
- `look.grade` gains `tone: 'aces'` (the filmic curve the cleanrooms use), an optional `vignette` and a bloom
  `radius`.

## v0.5.0 (2026-11-13)

- The word *product* is gone from the package: every import path and name that said it now says shard file. A tool
  that imported `@wildshard/shard-format/product` imports `/shardfileAssets`; `/productValidation` is
  `/shardfileValidation` (`validateShardfileFolder`), `/productStream` is `/shardfileStream`, `/productAudio` is
  `/shardfileAudio`, `/product-reads` is `/shardfile-reads` and `/directorProduct` is `/directorDocument`.
- Shard files do not change: a shard file that passed v0.4.10 passes v0.5.0 unless its headless assembly keys an
  `@wildshard/` module under `modules` (none does today), and the director schema id inside them keeps its old spelling.
- A headless assembly names engine functions by host, not by module path: `{"$ref": ["host", "proveTerrainEntries"]}`
  replaces `["@wildshard/engine/game/plugin/mover", "proveTerrainEntries"]`. `assemblyRefIssues` from
  `/assemblyHosts` lists every module path or unknown host left in one (a check for authors and tools; validation does
  not run it yet), and the schema no longer takes an engine module as a `modules` key.
- The prepare refusal now says `wildshard prepare <folder>`, as the CLI does.
- A habitat's canopy (`sim/population-metadata.json` `trees` and `tops`) may hold any number of trees up to 4,096,
  one top per tree, not exactly 155: Nalati's page now plants 146, and its server habitat can follow.

## v0.4.10 (2026-11-13)

- A look can now light its props for real: `look.light.lamps` places up to 16 point lights (lanterns, tent lamps,
  campfires), `look.light.bounce` adds a warm fill from the ground opposite the sun, and `look.light.environment` lights
  every surface from the look's own sky over a ground colour. Each is off when you leave it out.
- `look.grade.tone` picks the display curve: `neutral` keeps saturated colours saturated, `agx` (or leaving it out) is
  the engine's curve as before.
- Brasscap Mesa uses all four, ported from its cleanroom: warmer, deeper, with lit lanterns and fires.

## v0.4.9 (2026-11-13)

- A shard's named place sets (`world.sets` and `world.bind-sets`) now count as view-only: they list placed models for
  the sets explorer and need nothing from the server. A place's gameplay, like respawn and discovery, still comes from
  `quest.world` and `quest.reference`, so Nine Dragon, whose places use named sets alone, no longer asks the server
  for a places installer it never needed.

## v0.4.8 (2026-11-13)

- Every audio file under `/assets/music` or `/assets/sfx` now counts toward the shard's audio budget, not only `.m4a`
  and `.wav`: a `.flac`, `.aiff` or `.mp3` counts, in any letter case, and so does any file whose bytes are audio,
  whatever its name. A file that isn't audio, like `music.json`, still doesn't.
- Those newly counted files can push a shard past the budget lines: AMBER over 6 MB, red over 10 MB.
- A new red code, `audio-container`, names audio the format check can't read: FLAC, AIFF, Ogg, MP3, WebM, CAF or bytes
  in no known container. Upload refuses a shard with one, so a stray `.flac` or `.mp3` that uploaded on v0.4.7 is
  refused now. Ship AAC-LC in `.m4a`, as docs/audio.md says.

## v0.4.7 (2026-11-13)

- The shard grid is now 7×7 (49 cells), up from 5×5: the 25 placed shards keep their cells in the middle and the new
  outer ring starts empty, ready for new shards to be placed into.
- A grid may now leave cells empty; it no longer has to fill every cell. A cell beyond the 7×7 is still refused.
- `GRID_CELL_COUNT` (49) is now the most cells a grid holds, not the exact count, and `GRID_RADIUS` is 3: tools that
  sized a 5×5 from them see the bigger grid when they update.

## v0.4.6 (2026-11-13)

- Every validation refusal now carries a short, stable code (like `audio-sample-rate`) beside its message, so tools can
  match the code instead of the wording; the repo's docs/VALIDATION-CODES.md lists them all.
- A new page in the repo, docs/RUNTIME-CONTRACT.md, lists everything a shard may declare, which engine part runs it and what
  validation refuses, so you can author a shard without an engine checkout.
- A new audio guide in docs/audio.md says what audio to ship: format, bitrate, length, loudness, loops and the budget.
- Tools can import the list of engine music slots a score may play (`ENGINE_MUSIC_SLOTS` from
  `@wildshard/shard-format/engineMusic`) instead of copying it.
