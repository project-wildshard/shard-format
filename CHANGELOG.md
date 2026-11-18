# shard-format changelog

Every release has a section here before it is tagged: one to five bullets in plain language, for shard authors and
Jake, never commit subjects. Add the next version's section at the top, commit and push it, then release as
docs/dev.md says.

## v0.33.0 (2026-11-18)

- The memory estimate is refitted to the current engine (memory epoch 6), so engine memory cuts now count at upload and in check.

## v0.32.0 (2026-11-18)

- The phone memory estimate now counts only the files a phone downloads, so heavy zones read closer to what a phone holds.
- The estimate is refitted to cleaner Mac memory readings (memory epoch 5); Driftwood now passes the 1.5 GB loading line.

## v0.31.0 (2026-11-18)

- The memory estimate now follows the engine's measured phone model, so checks and uploads stop refusing zones a phone runs.
- Pine Hollow's loading estimate falls from 2.27 to 2.07 GB and Nalati's from 2.26 to 1.80 GB.
- Runtime readings taken under memory epoch 3 stay current: no runtime home needs to re-measure.

## v0.29.0 (2026-11-17)

- Sections switch primitives on: `derivePrimitives` lists the primitives a built shard's sections turn on (weather and sky today).
- A section at an unknown version, such as `wildshard:world/weather@2`, now refuses by name.
- Any creature can be ridden: a species `mount` row names its seat, its gaits from walk to gallop, and whether it flies.

## v0.28.0 (2026-11-17)

- Give creature abilities a knockback distance or a ring or lane warning.
- Describe a creature projectile with launch speed, gravity and collision radius.

## v0.27.0 (2026-11-17)

- Name creature skin clips freely and map look states or abilities to those clips.
- Author a named origin socket and clip on a creature ability.
- Use the unified shard terminology throughout the format.

## v0.26.0 (2026-11-17)

- Memory checks now use the phone-calibrated model; v0.25.0 was cut just before it landed.

## v0.25.0 (2026-11-17)

- Memory checks now match what a phone really uses at boot, so worlds too big for a phone are refused before upload.

## v0.24.0 (2026-11-17)

- Clipless creature skins now admit without adding a placeholder animation.

## v0.23.0 (2026-11-17)

- Refuse shard builds and uploads whose estimated playing or loading memory exceeds the 1.5 GB phone budget.
- Let runtime shards record their memory model version so gates can refuse stale measurements when the model changes.

## v0.22.0 (2026-11-17)

- Creature authors now have one size policy for geometry, stride, awareness and cell weight.
- Giant declarations above 15 metres are refused, including oversized variants and individual spawns.

## v0.21.0 (2026-11-17)

- A steer vehicle can take a wind push: its sail goes faster downwind and slower upwind.

## v0.20.0 (2026-11-17)

- A steer vehicle can take a wind push: its sail goes faster downwind and slower upwind.

## v0.19.0 (2026-11-17)

- A race can name `resets`: flags its finish and a lapse lower, so a second run counts its middle gates again.
- A carry mover can take a `steer` driver: its rider's stick and boost move it instead of a fixed path.
- A creature can declare its own hit volumes and lock sockets; creatures without them keep their bytes.

## v0.18.0 (2026-11-17)

- Declare a timed run in quests: `races` names a start and a stop flag, the fact the finish files, and a cap in seconds.
- Existing shard files are unchanged: the list is optional.

## v0.17.0 (2026-11-17)

- Declare perch creatures, their homes and shared projectile pools in the shard format.
- Catch missing perch strikes and excessive script memory before loading a shard.

## v0.16.0 (2026-11-17)

- Shard tools can place forests, grow grass, place colliders and read item catalogues by the game's own rules, without the engine.
- New shared parts: terrain field, seeded random numbers, noise, interactables, quest tables, headless sections, road light, mover poses.
- Each new rule ships with golden test vectors from the engine, so tools and game stay in step bit for bit.
- Nothing changes for existing shard files: these are additions only.

## v0.15.0 (2026-11-17)

- Give creatures social pack membership while each keeps its own brain.
- Preserve existing shard files when social membership is omitted.

## v0.14.0 (2026-11-16)

- Conditional incoming-damage exemptions preserve attack, state and effect tags when older creature policies are converted.
- Contradictory legacy and exact cap policies are refused before a shard starts.

## v0.13.0 (2026-11-16)

- Explicit weapon contact effects can name creatures declared in the shard’s species program.

## v0.12.0 (2026-11-16)

- A shard can make up to 64 of its panels touchable with `props.bodies`: a crate or barrel players push.
- Each body has a rest pose, a ball, cylinder or box shape, a surface and optional weight, grip, bounce and damping.
- Shards using these fields need an engine that implements them; older engines may refuse them.

## v0.11.0 (2026-11-16)

- Custom creatures can use their declared temperament when built.
- Weapon contact effects retain strict validation without blocking native documents.

## v0.10.0 (2026-11-16)

- A look can hang lanterns, signs and banners that swing: `look.light.swings` holds up to 32 of them.
- Each swing has a pivot, a rate, a lean in the wind and a reach at which a passing body bumps it.
- A lamp can name its swing so its light moves with the lantern; surfaces and glow cards use the `_SWING` channel.
- Shards using these fields need an engine that implements them; older engines may refuse them.

## v0.9.0 (2026-11-16)

- Shards from the preceding additive format remain readable without rebuilding their signed files.

## v0.8.0 (2026-11-16)

- Creatures can declare variant-selected harvest drops and an explicit exemption from the incoming damage cap.
- Strike and melee rows can describe bounded contact debris with overrides for target species.
- Journals can use admitted images; alpha tint keeps a sticker's inherited color.
- An accepted item-scene use can raise a declared quest flag for its player.
- Shards using these fields need an engine that implements them; older engines may refuse them.

## v0.7.0 (2026-11-16)

- A look can grow grass, ferns and small clutter round the player: `look.details` holds up to 8 layers.
- Each layer is a small card mesh, a density mask and ground heights over a grid, all three as binary files.
- The engine scatters the cards near the camera, so a meadow ships as a mask, not thousands of copies. Leave it out and nothing changes.

## v0.6.0 (2026-11-16)

- Creature authors can declare body, temperament, senses, ordered abilities
  and presentation separately, using shared quadruped and biped contracts.
- One creature look can name a complete variant skin table. Admission checks
  every skin and refuses missing variants, dependencies or incompatible rigs.
- A pinned inventory now prevents growth in the remaining format migration work.
- A fine tile now has a triangle budget for each tier: `TILE_TRIANGLES` is 40,000 on a phone (as before) and 400,000 on
  a desktop, where Mossgate's fullest tile holds 60 fps. `wildshard check` reports both; neither refuses a shard.

## v0.5.10 (2026-11-15)

- A map POI can stay out of respawning: `manifest.pois[].respawn: false` means a fallen player never comes back there
  (a boss pit), while every other POI still is a place to come back to. Leave it out and nothing changes.

## v0.5.9 (2026-11-15)

- A lamp can follow a creature: `look.light.lamps[].follow` names an actor by its spawn id (and optionally one of its
  bones), and the lamp's `at` becomes its offset there, so a boss's eyes and core light the ground as it moves. Engines
  that predate it refuse a shard that uses it.
- A look may hold up to 256 lamps (it was 16). An engine lights the nearest 16 each frame (4 on a phone), so a long
  street of lanterns lights as you walk it.

## v0.5.8 (2026-11-15)

- A rack can hand over a melee weapon: an item scene's take (`targets.itemActions`, action 3) may name a `kit.melee`
  weapon, so a sword waits on its rack until the player takes it. Any other action on a melee weapon is still refused.
- A creature spawn can come back: `creatures.spawns[].respawn` is the seconds (1 to 3600) after its death that its
  body returns at its `at`. Leave it out and the body stays dead, as before.

## v0.5.7 (2026-11-14)

- A tile's draws no longer have their own 8-draw cap: engines now draw each material once across nearby tiles, so the
  report checks a whole view instead, every fine tile near it against `VIEW_DRAWS` (150 on a phone, 400 on a desktop).
- The Brasscap Mesa example shard is now a real build of a pinned `shard-brasscap` commit
  (`corpus/exports/brasscap-mesa/`), not a hand-written source here, and the package ships that folder in its place.
- `node src/tools/brasscap-export.ts` rebuilds it from a pinned commit (`--check` compares), and shard-format still
  has no three.js dependency. (0.5.6 was never published; its notes ride here.)

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
