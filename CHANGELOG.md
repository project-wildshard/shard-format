# shard-format changelog

Every release has a section here before it is tagged: one to five bullets in plain language, for shard authors and
Jake, never commit subjects. Add the next version's section at the top, commit and push it, then release as
docs/dev.md says.

## v0.82.1 (2026-11-26)

- Read the engine's current uploadNumber pins in the stored corpus check.
- Release the standalone shardfile art guard and slug-scoped mounts, including a shard's own discovery and hero URLs.
- Refuse carried GPU textures on new uploads and admit slug-scoped audio.
- Recognize ground folders and sky stems when the shard carries the files they name.

## v0.82.0 (2026-11-26)

- Require art named by a standalone shardfile to be carried by that shardfile or supplied by the engine.
- Keep zone mounts under their shard slug, including the zone program and its own discovery and hero URLs.
- Refuse carried GPU textures for new uploads and admit the zone audio names.

## v0.81.0 (2026-11-26)

- Shardfiles and cook metadata can declare the author's shard version separately from the format version.

## v0.80.0 (2026-11-25)

- Format 0.1 and 0.1.0.0 shardfiles are no longer read; the floor is 0.1.0.1, and the N-1 test is gone.
- Species programs are deleted: shardfiles declare species, and the actors/species-programs section is gone.
- The items.legacySlot field is deleted; weapons and loadouts use declared item ids.
- Closed weapon-name breaks are named in the format's break record.

## v0.79.3 (2026-11-25)

- Installs on Node 26 as well as Node 24 (engines.node >=24.18.0 <27), so engine and SDK tooling on Node 26 can take this format.

## v0.79.2 (2026-11-25)

- Uploads from @wildshard/upload 0.4.22 and 0.4.25 pass again: 0.79.1 refused their requires.sdk.
- An upload's deleted fields are mended before the strict check; its hashes are checked as sent.
- A wrong source or preparation hash is still refused.
- A test runs those clients' files through both checks on main and every release branch.

## v0.79.1 (2026-11-25)

- The format release no longer waits on unrelated store uploads.
- Grass card clumps are optional: a shard may ship all of them or none.
- Texture cost counts KTX2 files at their real size.
- Old unused file fields are gone (format prune); files at an older version are mended on load.

## v0.79.0 (2026-11-25)

- Grass card clumps are optional: a shard may ship all of them or none.
- Texture cost counts KTX2 files at their real size.
- Old unused file fields are gone (format prune); files at an older version are mended on load.

## v0.78.0 (2026-11-24)

- A light emitter may follow a scene field, so a quest can wake a light step by step instead of only switching it.

## v0.77.0 (2026-11-24)

- A far view carries its own look (shading, haze, grade and mood band), so engine reads it from the shard.
- A held weapon's finish, loadout and boss rows may name the shard's own declared items as weapon slots.

## v0.76.0 (2026-11-24)

- The level's look (sky, atmosphere, grade, horizon) lives only in the look section; older files migrate it there.
- The discovery document no longer carries a copy of the look or the start words.
- Start words the level manifest repeated (spawn, loadout, audio, weapon, creatures) move to their own sections.
- Which zones are armed for memory checks comes from the API catalogue, not a list in the format.
- The map image leaves the level manifest; the map lives in look/map.

## v0.75.0 (2026-11-24)

- New shard files no longer need a required SDK version in their manifest.
- Older shard files migrate population homes to the current member lists.
- Headless tools can read a shard's server plan directly.
- The validator no longer accepts cook data version 2. Current cooked exports already use the supported version.

## v0.74.1 (2026-11-23)

- Quests get their own server section (quests/server), so a shard can declare its quest family without the client reading it.
- Server-only host sections (server/world and the server/* family) carry native world settings the page never reads.

## v0.74.0 (2026-11-23)

- A shard file no longer has a separate species-programs section: each creature's behaviour is written with the creature itself.
- The old point-of-interest place types are gone from the format; quests name the places they use directly.
- A shard file no longer has to list the capabilities it requires; older files that list them still load.
- Older shard revisions that name a retired creature feature still validate, so no kept shard is dropped.

## v0.73.0 (2026-11-23)

- The 450 MB shardfile upload cap is now one shared number, so the API and the cook can never disagree about how big a shard may be.

## v0.72.0 (2026-11-23)

- Shards with declared creature skins fit the upload validator’s streaming memory limit.
- Shard files can report a newer preparation version before the reader tries to open it.

## v0.71.0 (2026-11-23)

- A shard can declare which save revision it reads without changing the original upload.
- Tools can use one JSON Schema for the shard format.
- Authors can declare barter currency for their shard.

## v0.70.0 (2026-11-22)

- Format 0.1.0.3: a prepared file records its preparation spec, not the old sdk marker; old files migrate on upload.
- Preparation spec 4 names no engine, so an engine update no longer makes a prepared shard file stale.
- New preparationSpec subpath: preparationSpecOf reads the spec back from any shard.json.

## v0.69.2 (2026-11-21)

- Driftwood, Nalati, Nine Dragon and Pine are armed again: a new upload past the loading ceiling is refused.

## v0.69.1 (2026-11-21)

- Format 0.1.0.2 keeps requires.capabilities: dropping it broke the build source hash of every existing shard file.
- requires.sdk and requires.capabilities are now deprecated: validate warns on them until writers stop writing them.
- 0.69.0 is superseded; pin 0.69.1.

## v0.69.0 (2026-11-21)

- Format 0.1.0.2: shard.json names its format in formatVersion (like "0.1.0.2"); the separate version field is gone.
- New files drop the always-empty schemas, runtime.files, runtime.lines and runtime.trust fields.
- Older files still load: the migration chain rewrites them to 0.1.0.2.
- Writers pass their old shard.json rows through outputIndexEnvelope (./version) to get their version's shape.

## v0.68.1 (2026-11-21)

- Saved games load again on the newest engine: the save-state migrations are back where the engine reads them.

## v0.68.0 (2026-11-21)

- Older shard files are migrated, not refused: `@wildshard/shard-format/migrate` rewrites a file to the current format.
- Pine Hollow revisions 1 to 6 load again: their retired journal icons become the images the game drew.
- `shard-format validate` warns when a shard uses a deprecated field and names what to write instead.
- Write `shardfile`, not `gridShardfile`, and drop `runtime.trust`; older files are mended automatically.

## v0.67.0 (2026-11-21)

- Items can list `kept` rows: what a player keeps for good in your shard, each with a kind, a label and an optional Bag gauge.
- `economy/loot` can name its `currency`: the coin's name, pickup model and Bag icon.
- A runtime plan's keeper may skip its species programme when every creature is a declared row.

## v0.66.1 (2026-11-21)

- A roster's hunt tags now project to JSON Schema, so a shard that declares its roster's hunt builds with the SDK.
- A keeper may name no species programme: its plan stands without one.

## v0.66.0 (2026-11-21)

- A shard's spawn, loadout and audio live in their own sections now; an older level manifest is lifted at the door.
- The level manifest's weapon and map image are optional: nothing reads them any more.
- A native population roster names the declared species it runs and carries its own hunt settings.
- A native boss binding can carry its own decision programme and body; headless vehicle docks are carried.

## v0.65.0 (2026-11-21)

- A plain upload can declare field water: a `world/field` section with a pond raster and a water level.

## v0.64.0 (2026-11-21)

- A creature's body can put its pivot at ground level (`bodyY: 0`), as a flying rig's often does.
- A creature's body can name its capsule axis (`capsuleAxis: 'y'` for an upright body, `'z'` for a lying one).

## v0.63.0 (2026-11-20)

- A weather row can name its weather program, so a shard whose weather is a program turns weather on with a row.

## v0.62.0 (2026-11-20)

- A weather row can name its weather program, so a shard whose weather is a program turns weather on with a row.

## v0.61.0 (2026-11-20)

- A creature look with variants can now give phones their own lighter skins: name `phone` and a `phoneVariants` table beside `variants`.
- Phones no longer download a creature's desktop skins and maps when its look has a phone skin.

## v0.60.0 (2026-11-20)

- Declare different vehicle grip on roads, dry ground and flooded patches.

## v0.59.0 (2026-11-20)

- A race can name a rival (`rival`): an AI driver in a dock's vehicle who races each run along a racing line.
- The rival eases off or pushes within a catch-up `band`, and a player who finishes ahead of him raises its `beat` flag.

## v0.57.0 (2026-11-20)

- A race can run laps (`laps`, 1 to 20) over ordered `checkpoints` a lap must cross before its line counts it.
- A race can say how it is run (`ride`: `vehicle`, `foot` or `any`), and a run begun the wrong way is refused.

## v0.56.0 (2026-11-19)

- A quest step can land where it was done: a flare, light over the ground, a reward pop and a sound (`feedback`).
- A finished quest can pay off: a bigger landing, the score's reward take and the next goal (`onComplete.payoff`).
- Journal selectors name an image, never a glyph.

## v0.55.2 (2026-11-19)

- Asset admission also lets a boss fight on a declared creature keep its decision fields.

## v0.55.1 (2026-11-19)

- A boss fight on a declared creature keeps its decision row's public fields, as a runtime boss did.

## v0.55.0 (2026-11-19)

- A shard's swept sword kit can be a `held/melee` section (the same rows a native `item.swept` host read from a server file).

## v0.54.0 (2026-11-19)

- A creature's timed return can wait like an island's: a random extra delay, no player nearby, night only, and a fade first.

## v0.53.0 (2026-11-19)

- Shards can declare vehicles: kinds with seats, a hull and handling, and docks where they stand (`world/vehicles`).
- A land-sail built as a steer carry lifts into a vehicle kind and a shared dock, and lowers back for engines without the vehicle runtime.

## v0.52.0 (2026-11-19)

- Prop colliders can be capsules, so a palm trunk or a post stands as one solid.
- Every prop collider shape can name a contact material (now also planks, ground, flesh and shell), its own friction and its collision groups.
- A convex hull may hold up to 256 points, and a props section up to 16,384 collider units, enough for a whole baked island.

## v0.51.0 (2026-11-19)

- A shard's sky, fog, colour grade and horizon can now live in its look section (look.level).
- An older shard keeps them in its level manifest and looks exactly the same.
- A lamp can follow a panel (the lamp panel binding).

## v0.50.0 (2026-11-19)

- A creature look can draw its body from a scene library's rig: recipe `platform.rig`, naming the library and optionally the body.
- A data page whose declared creatures all have looks, and whose keeper stands no body, no longer needs a `species.program` feature.

## v0.49.1 (2026-11-19)

- A boss moved off a runtime plan's keeper to a declared encounter keeps the plan's owner row without a page boss feature.

## v0.49.0 (2026-11-19)

- A creature ability can throw the player it hits: `effect: 'impulse'`, `strength` in m/s and `lift` up.
- An ability can aim above the target's feet with `aimHeight`, so a diving strike aims at the chest.

## v0.48.1 (2026-11-19)

- Shard authors can use convex prop colliders with a declared pose and surface.

## v0.48.0 (2026-11-19)

- The hand-written Template 2 (corpus/handwritten) is gone; read Brasscap Mesa's export in corpus/exports instead.

## v0.47.2 (2026-11-19)

- A runtime plan page can stand declared creatures and bosses beside its own keeper.

## v0.47.1 (2026-11-19)

- A runtime plan may keep no owner row, so a shard can move its boss to a declared encounter and keep its quest page.

## v0.47.0 (2026-11-19)

- A creature spawn can wait: `hold: { field, until }` keeps a memory field at 1 until a quest flag is set.

## v0.46.2 (2026-11-19)

- A pack driven by one decision script loads: a `none` temperament plus a spawn `group` its script owns.

## v0.46.1 (2026-11-18)

- The horizontal T-Rex stance listed under 0.46.0 ships here: 0.46.0 was cut without it.

## v0.46.0 (2026-11-18)

- A two-legged creature can stand horizontal like a T-Rex, its tail trailing behind.
- A horizontal creature's tail can be hit along its length, and a sweep can start from its tip.

## v0.45.0 (2026-11-18)

- Several small creatures can share one GLB: each skin names its creature, and only that mesh, bones and clips are read.

## v0.44.0 (2026-11-18)

- A strike row can say whether its reach is in metres or grows with the creature's size, so a converted creature hits exactly as before.

## v0.43.2 (2026-11-18)

- A plain shard's grapple mode with its own profile and hooks needs no quest page or runtime: the game runs it from the row.
- A grapple profile's looks must be declared in look.materials, so a missing one is caught at check, not in play.

## v0.43.1 (2026-11-18)

- A plain shard's grapple mode with its own profile and hooks needs no quest page or runtime: the game runs it from the row.
- A grapple profile's looks must be declared in look.materials, so a missing one is caught at check, not in play.

## v0.43.0 (2026-11-18)

- A grapple mode can carry its own profile, hook list, guard and rise, so a plain shard declares a grapple without extra files.
- A strike row can overshoot its target, so a charge carries on past where the player stood.
- Fur materials can grow strands on both the toon and PBR looks.

## v0.42.0 (2026-11-18)

- A grapple mode can carry its own profile, hook list, guard and rise, so a plain shard declares a grapple without extra files.
- A strike row can overshoot its target, so a charge carries on past where the player stood.
- Fur materials can grow strands on both the toon and PBR looks.

## v0.41.1 (2026-11-18)

- Driftwood, Nalati, Nine and Pine are held off the armed list until the engine pins their new builds: their gates report (J424).

## v0.41.0 (2026-11-18)

- A creature skin can now wear its own texture maps and a coat per variant, so a deer or wolf can carry a painted hide instead of flat colour.
- Skins can set a soft sheen and a rim light, for fur that catches the light at its edges.
- A painterly variant wears its own map, so the stylised look keeps its painted detail.

## v0.40.0 (2026-11-18)

- Creatures can carry socket attachments on their body, and actors can declare channels with their own looks.
- Creatures can give a body part its own hit points on a volume, and serpents have their own body contract.
- Scripts can lock, heal, pull and root, add brain hooks and hit tags, and pick abilities.
- Encounters can bring in adds when a fight changes phase.

## v0.39.0 (2026-11-18)

- Use the shard's named budget tier to cap authored material graphs and post passes. Explicit graph budgets can narrow the cap.

## v0.38.1 (2026-11-18)

- Pine, Nine and every light zone are armed (J426): each memory check now refuses them back over their line.

## v0.38.0 (2026-11-18)

- Memory gates refuse only armed zones (J426): Driftwood and Nalati are armed, and every check refuses them back over the line.
- Every other zone's memory gates report and never refuse (J424).

## v0.37.1 (2026-11-18)

- Nine's and Pine's memory ratchet rows match the engine's full check of their pinned products, so engine can pin this format.

## v0.37.0 (2026-11-18)

- The memory ratchet steps down to epoch 8: Nine, Pine and Nalati must stay at or under their new, lower readings.
- Driftwood and Nine's playing reading now pass the 1.5 GB line, so that line refuses them again.

## v0.36.0 (2026-11-18)

- The memory estimate is refitted to the current engine (memory epoch 8): Nine reads 1.45 GB loading, Pine 1.30 GB.
- Every zone's estimate falls except Far Reach's playing, which stays under 1.0 GB.

## v0.35.0 (2026-11-18)

- Memory gates are ratchets: Nine, Pine, Nalati and Driftwood build while no worse than their current reading.
- Those four zones report the 1.5 GB phone line and the runtime tier instead of refusing.
- Every other zone still refuses over the 1.5 GB line and its runtime tier.

## v0.34.0 (2026-11-18)

- The memory estimate pairs to a steadier phone bound (memory epoch 7), so measuring a zone more no longer raises it.

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
