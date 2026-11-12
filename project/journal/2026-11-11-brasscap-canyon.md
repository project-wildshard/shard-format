# Brasscap Mesa: the canyon blockout (BM-1)

> Written by: Claude (opus-brasscap, finished by opus-brasscap2)

Jake picked Brasscap Mesa as Template 2 (2026-11-11 ~18:45 Cancún,
board v3 idea 1): a low-poly sunset canyon shooter with a lever-action,
raw assets only, sharing nothing with Template 1. The build rows are
BM-1 to BM-8 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`.

This is BM-1's asset half. Blender isn't scriptable on this machine,
so `src/tools/brasscap/canyon.ts` stands in for the Blender export. It
writes `corpus/sources/brasscap-mesa/canyon.glb` (944 KB, 11k
triangles, no dependencies): flat-shaded, vertex-coloured banded mesas,
the red depot with its porch and rifle rack, three camps with flags,
the plank gate, a water tower, a rail line and fence, two tin target
plates, cacti and boulders, inside an unlit sunset dome (gold horizon
to turquoise zenith, pink clouds). Named empties mark spawn, the rack,
the targets, the camps, the gate and the Wyrm's pit for the rows that
come next. Run it with `node src/tools/brasscap/canyon.ts`.

`corpus/sources/` is author source, not a product: the package ships
only `corpus/handwritten/**`, and nothing imports the tool. It carries
a file-head lint disable because a level blockout is all coordinates
and colours.

A Codex review of the first cut found three winding bugs, fixed
before the commit: prism top caps faced down (mesa tops, box tops and
the porch deck were culled from above, so the floor showed through the
porch), boulder fans faced inward, and the sky dome's pole row made
degenerate triangles with zero normals. The pole row is now a fan, and
the tents got their back wall. A second Codex review caught three
more: the porch roof had no underside (it vanished looking up from
spawn), the target bullseyes lay flat like plates, and the rail
sleepers ran along the track. The roof has an underside, the targets
are upright discs facing the depot, and the sleepers cross the rails. `canyon.test.ts` holds the output to
the committed bytes (a fixed-seed generator, so it is deterministic),
under 1 MiB, unit normals only, the named empties, and box faces
outward. Rerun the tool whenever the source changes, or the test fails.
The corrected three.js shot is `progress/t2-01-fixed.jpg`.

Not done yet: the GLB is not in engine. A corpus product is cooked
output (tiles, collision, edge, far mesh), so BM-2 bakes it once into
`corpus/brasscap-mesa/`. The lever-action is BM-3: engine's declared
kit has only melee families, so the per-round lever law needs a
lever-only subset of Pine's native assembly in rows.

## BM-2: Brasscap as a product (opus-bm2)

- `corpus/brasscap-mesa/` is the canyon as a product, beside Template
  1's `corpus/handwritten/` and sharing no blob with it. Baked once in
  a sharddev checkout (`wildshard build <project> <out> --product-only`)
  over the GLB: 80 render tiles, 64 collision tiles, one far mesh, the
  four edge profiles. Packs are left out, as in Template 1 (C0).
- Three changes to the GLB for the bake, all author-side: the sky dome
  is dropped (the sunset is now `look` keys: a 9-degree sun from the
  west, violet ambient for long violet shadows), a flat sand skirt runs
  from the 216 m rim to the 250 m edge (the edge sampler needs ground
  there), and a welded copy of the canyon is the far stand-in, since a
  flat-shaded mesh never simplifies (10,459 far triangles > 8,000).
- Its discovery row is hidden, order 9, like Template 1's. It ships in
  `files`, so engine's `pins.ts install --from-format brasscap-mesa`
  reads it. `src/ci/brasscap-mesa.test.ts` holds the shape.

## BM-3: the lever-action, asset half (opus-bm3)

- `src/tools/brasscap/rifle.ts` writes
  `corpus/sources/brasscap-mesa/rifle.glb` (28 KB, 312 triangles),
  BM-1's way: flat-shaded vertex colours, walnut stock and fore-end,
  a brass receiver and lever loop, a blued octagonal barrel over the
  magazine tube. It lies along -Z, the origin at the receiver, with
  empties `muzzle` (the barrel's tip), `grip` and `fore`. Two
  primitives: matte, and brass (metallic 0.25). `rifle.test.ts`
  holds it to the committed bytes, the budget, the muzzle at the
  front, and unit normals that agree with each triangle's winding.
  Three.js shot: `progress/t2-04-rifle-model.jpg`.
- Not in the product yet, and BM-3 is blocked on engine. The plan's
  "reachable from data" finding holds only on the server. On the
  client, `held.ranged-page` (engine
  `src/client/game/loadout/rangedPage.ts`) is Pine's whole page: it
  needs a forest page, a bow, a crossbow launcher, elites, roaming
  combat and the trophy compendium, so no lever-only subset exists.
  And the native `cycle` item hits only native population bodies
  (`bodyAlong`), not a declared shard's actors. The declared kit
  (`SERVER_KIT_FAMILIES`: `kit.melee`, `kit.lantern`) has no ranged
  family. Meta TEMPLATE-E2E-PLAN row TE-ENG2 specs the engine change:
  a `kit.lever` family on the declared path.
- The rack: BM-1's canyon already bakes a static rifle on the rack
  at the `rack` empty. A pickup needs that rifle hidden once taken, so
  BM-3 will move it out of the baked tiles into a target panel.

## BM-3: the lever-action in the product (opus-bm3b)

- Rows only, on engine `c098cc0c`'s `kit.lever` (TE-ENG2) and format
  `e51eec6`. `combat/items`: a `brasscap.lever` context and the
  `weapon.brasscap-lever` row (6 rounds, a tube of 5 plus the chamber,
  12 in reserve, per-round reload, a round does 10), primary in the
  loadout, which a locked family does not unlock. `sim/hooks`: the
  rack's take (102/3) and reload (102/4) scenes. `ui/ui`: the
  `brasscap.rack.use` prompt on the canyon's `rack` empty and the two
  `itemActions`.
- `rifle.glb` is a blob now, in `admission.library` with its
  `parseGlbData` costs (decoded 27996, gpu 26208, 4 draws), so the
  held model is BM-3's GLB, not the `kit.rifle` stand-in.
- Target posts: two `brasscap.target` bodies (10 hp, a red
  `engine.sphere` look) in front of the baked posts, on a still
  `pursue` brain, since a spawn with no brain needs an encounter to
  own it. `greyBlob` is the kind because the client registers only
  that, boar and bear for a data shard.
- Not done, an engine follow-up: the rack keeps its baked rifle and
  its prompt after the take. A target panel follows a state field and
  needs a script binding, and `kit.lever`'s `taken` is an owned line,
  not a field, so no row can hide it.
- Proof: engine preview with this corpus over the format dependency
  and `pins.ts install --from-format brasscap-mesa`, headless Chromium:
  locked at spawn, E at the rack takes it (6 / 6 + 12), shot 1 and
  shot 2 down the two targets, six shots empty the tube, R feeds
  0 to 5 one round at a time and a second R gives 6. No console
  error, nothing off the machine. Shot `progress/t2-05-rifle-play.jpg`.
  `src/ci/brasscap-mesa.test.ts` holds the rows to the GLBs' empties.

## BM-4: the tin bandits (opus-bm4)

- `src/tools/brasscap/bandit.ts` writes `corpus/sources/brasscap-mesa/
  bandit.glb` (61 KB, 277 triangles, 2 draws) and its skin file
  `bandit.skin.json`: a tin can body with brass rims, a stovepipe hat,
  a red bandana and one yellow eye, skinned to `body` and `head`, with
  `idle`, `walk`, `attack`, `hit` and `die` clips. `die` is the fall:
  the format names clips `idle|walk|run|attack|hit|die`, and engine
  plays `die` when a body dies. It draws through a `platform.skin`
  look; both blobs are in the render library.
- Nine `brasscap.bandit` bodies (10 hp, one round each) stand three to
  a camp on a `pursue` brain (kind `bear`, apart from the posts'
  `greyBlob`).
- Quest `brasscap.bandits`: one step per camp, done when that camp's
  own three bodies are down. Engine raises `dead:<spawn id>` on the
  host's flags at every death, so each step names its bodies
  (`dead:bandit.camp-1.1` and so on, declared in `flags`). A first cut
  counted `creature.<kind>` death triggers in a chain; Codex's review
  caught that killing camp 3 first then cleared camp 1. The quest's
  completion flag is `brasscap.gate.open`, and its scene of the same
  name queues event 301. Per-player books in a room (BM-7) get no
  `dead:` flags of their own yet; the lead's do.
- `corpus/sources/brasscap-mesa/gate.as` (Template 1's door.as shape)
  sets shared field 101 on event 301, and a target panel on that field
  hides the gate door and drops its collider. Compiled once by
  sharddev's pinned AssemblyScript; the 716-byte Wasm ships raw.
- The camps are data now (`CAMPS` in canyon.ts: tents and empties),
  and camp 3 moved to (8, -50), 12 m before the gate: behind it, it
  could never be cleared to open it. LF2-2 moves camps 2 and 3 again.
- **The re-bake.** The gate door is its own node, `gate.door`, so the
  bake makes it a panel with its own collider. `canyon.ts --bake`
  writes BM-2's bake input from source: no sky dome or unlit extension,
  a flat sand skirt from the 216 m rim to the 250 m edge at y = 0 (the
  entryways must meet y = 0), and a welded far stand-in `far.canyon`.
  In a sharddev checkout, a project whose `shard.config.ts` spreads
  `emptyShardfile(identity)` with this corpus's `look`, the gate's
  `state`, `sim` and `hooks`, `behaviour: [{ id: 'gate', source:
  'gate.as' }]` and `world: { glb, materials: { Mesa: 'mesa', Glow:
  'glow' }, colliders: 'mesh', far: 'far.', farMode: 'replace',
  interactive: [{ node: 'gate.door', id: 'brasscap.gate', colliderId:
  'brasscap.gate' }] }`, then `wildshard build <project> <out>
  --product-only`. Take its `world/tiles`, `world/collision`,
  `world/props` and `sim/sim` sections, their blobs, its blob packs and
  its sim budget into `corpus/brasscap-mesa/`, then `shardfile pack`
  settles the measured fields. The edge profiles came out identical to
  BM-2's; the far mesh is 6,550 triangles (BM-2's 4,814).
- Proof: an engine preview over this corpus (`pins.ts install
  --from-format brasscap-mesa`, a one-shard catalogue), headless
  Chromium with `--use-mock-keychain --password-store=basic`. A walk
  into the shut gate stops at z = -61.2. With the rifle from the rack,
  each bandit falls to one round (a miss steps round the cover; twelve
  rounds for nine), each camp's step completes in turn, the quest completes, the
  gate's row reads 1, its collider is no longer solid, and the walk
  goes through to z = -67.3. No console error, nothing off the machine.
  Shot `progress/t2-06-bandits.jpg`.
- Not done: the bandits close in but never hurt, since the spawns have
  no strike row (Codex SHOULD; a strike is BM-4's follow-up or LF2-8's).
  The bandits are lockable, and the lock-on holds the view on a fallen
  bandit.

## BM-5: the Dust Wyrm (opus-bm5)

- `src/tools/brasscap/wyrm.ts` writes `corpus/sources/brasscap-mesa/
  wyrm.glb` (74.5 KB, 292 triangles, 2 draws) and `wyrm.skin.json`: a
  sand mound, plated terracotta and cream segments with cream back
  spines, an armoured head, and a jaw plate over a yellow gullet. Four
  joints (`body`, `neck`, `head`, `jaw`). Clips `attack.rise`,
  `attack.burst` and `attack.open`, and `attack`, rise then burst
  (1.5 s, the look's `attackSpan`): engine plays `attack` across a
  strike's windup only and cancels it as the strike lands
  (`StrikeRunner`), so the slam meets the end of the 1.2 s windup.
  `attack.open` (the jaw down) ships but no engine path plays a clip
  from a field yet, so the window shows as gullet particles. Also
  `idle`, `hit` and `die` (it sinks back under the sand).
- Rows (TE-ENG1): spawn `dust-wyrm` (species `brasscap.wyrm`, kind
  `bear`, 80 hp, scale 2, no brain) on the canyon's `wyrm` empty,
  strike `brasscap.wyrm.burst` (a 1.6 point, 3.2 m at scale 2, 20
  damage), boss encounter `brasscap.wyrm` (arena 14 m, phase two at
  0.5) with a `wyrm-panel` boss bar, public shared fields 110
  `brasscap.wyrm-tell` and 111 `brasscap.wyrm-gullet`.
- The decision, `behaviour/wyrm.as`, is the Warden's shape: each beat
  the tell rises, the guard goes to 1 and the burst starts; at the
  windup's end the tell drops, the gullet opens and the guard goes to
  3 (rounds only) for 3 s, then back to 1. Fight entry opens the guard
  after `onStart`, so `onStart` shuts it and an `arm` timer shuts it
  again a tick later (0.02 s); `onStop` leaves it shut, since a phase
  change stops and restarts the decision (Codex MUST: the Warden's 0.1 s
  arm and `onStop` reset left gaps where a round could land). The tell and gullet are
  particles, not panels (a panel needs a re-bake and adds draws to the
  tile; the Warden hit the 8-draw cap): twelve `sand-ring.N` anchors
  3.4 m round the mound read 110, a `gullet` anchor at the maw reads
  111, through `sand.as`, a 731-byte ABI v0 client script.
- The lever's reserve goes from 12 to 30: nine bandits take nine to
  twelve rounds, and 18 in all left too few for an 80 hp Wyrm.
- **The one-time bake.** Both Wasm modules ship raw: the decision
  (`blobs/wasm/1d6ace79…`, critical) and `sand.as`
  (`24a4d4c1…`, in the render library). To re-bake after editing either
  source, in a sharddev checkout (`ab8231b` here), write this as
  `tmp/<lane>/bake.ts`, bundle it with
  `node_modules/.bin/esbuild tmp/<lane>/bake.ts --bundle --platform=node
  --format=esm --outfile=tmp/<lane>/bake.mjs --external:assemblyscript
  --external:binaryen` and run `node tmp/<lane>/bake.mjs <shardfile>
  <out>`:

  ```ts
  import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
  import { join } from 'node:path'
  import { createHash } from 'node:crypto'
  import { emptyShardfile } from '../../src/sharddev/author.ts'
  import { compileDeclaredDecisionScripts } from '../../src/sharddev/buildDecisionScripts.ts'
  import { compileScript } from '../../src/sharddev/bake/compileScript.ts'
  const [shardfile, out] = process.argv.slice(2)
  const S = join(shardfile, 'corpus/brasscap-mesa/sections'), src = join(shardfile, 'corpus/sources/brasscap-mesa')
  const sec = p => JSON.parse(readFileSync(join(S, p), 'utf8'))
  const base = emptyShardfile({ slug: 'brasscap-mesa', name: 'Brasscap Mesa', author: 'Wildshard', revision: 1, seed: 1 })
  const source = { ...base, creatures: sec('actors/creatures.json').creatures, state: sec('state/state.json').state,
    rows: { ...base.rows, species: sec('actors/species.json').rows.species, strikes: sec('combat/strikes.json').rows.strikes } }
  const { sourceHash, ...row } = sec('sim/scripts.json')[0]   // the shipped row is the input; module is rewritten
  const authored = new Map([[row.source, readFileSync(join(src, row.source), 'utf8')]])
  const built = await compileDeclaredDecisionScripts([row], source, [], authored, { asLineCeiling: 256 })
  const sha = b => createHash('sha256').update(b).digest('hex'); mkdirSync(out, { recursive: true })
  for (const b of built.blobs) writeFileSync(join(out, `${sha(b.bytes)}.wasm`), b.bytes)
  writeFileSync(join(out, 'scripts.json'), JSON.stringify(built.rows))
  const sand = await compileScript(readFileSync(join(src, 'sand.as'), 'utf8'), { abi: 0, maximumPages: 1 })
  writeFileSync(join(out, `${sha(sand)}.wasm`), sand)
  ```

  Then put the Wasm in `blobs/wasm/`, the row in `sections/sim/
  scripts.json`, the new hashes in `shard.json`'s `files` (the decision
  `critical`, named `behaviour/wyrm.wasm`) and admission lists and in
  the client bindings' `module`, and `shardfile pack` the folder; copy
  the tarball's settled `shard.json`, `validation.json` and sections
  back.
- Proof: an engine preview (`d1d73749`, this corpus over the format
  dependency, `pins.ts install --from-format brasscap-mesa`, built with
  a `WILDSHARD_CATALOGUE` that lists Brasscap: without it the page
  stalls at "Reading build files", BM-4's corpus too), headless
  Chromium with `--use-mock-keychain --password-store=basic`. E takes
  the rack's rifle; 10 m from the mound the fight starts; four rounds
  with the gullet shut fire and land 0, each showing MISS: one in the
  fight's first frame, one while the ring rises, one just after phase
  two begins; eight rounds in the windows land 10 each, and the Wyrm
  falls in the third window, 16 s in. No console error, nothing off
  the machine. Shot `progress/t2-07-wyrm.jpg`.
- Seen, not done (LF2-8 or engine): the Wyrm reads dark against the
  low sun, the dead body ragdolls over and draws white, and the burst
  never reaches a player who stays out of the ring, so the Wyrm does no
  harm to a rifle at range.

## LF2-1: the one-command re-bake (opus-lf21)

- `node src/tools/brasscap/rebake.ts` is the whole author re-bake.
  It runs `canyon.ts --bake`, writes a throwaway project into the
  sibling sharddev checkout's `tmp/brasscap-rebake/` (BM-4's
  declaration: `emptyShardfile` with this corpus's identity, `look`,
  `state`, `sim` and `hooks`, the gate's `gate.as` as `script:gate`,
  the GLB's `world` row), cooks it with `wildshard build <project>
  <out> --product-only`, and compares the cooked `world/tiles`,
  `world/collision`, `world/props` and `sim/sim` sections and every
  blob they name with `corpus/brasscap-mesa/`. A difference exits 1.
- `--write` copies the differing sections and blobs in, then prints
  what it does not do (Codex review, MUST): settle `shard.json` (the
  changed hashes in `files` and the admission lists, stale blobs
  dropped, the sim budget), `node src/cli/bin.mjs pack
  corpus/brasscap-mesa`, and copy the tarball's settled `shard.json`,
  `validation.json` and sections back, as BM-4 did. The first real
  re-bake (LF2-2) owns automating that. `--sharddev <path>` picks the
  checkout (default `../sharddev`); `--keep` keeps the work folder.
  Nothing tracked in sharddev is written.
- Check on the unchanged GLB: 234 of 234 files byte-equal (4
  sections, 230 blobs), about 5 s, on sharddev `f1852d6` with
  opus-fmtpin's format `f32eae4` installed, and again on sharddev
  `21b915e` (that pin, committed). The sharddev checkout's format
  version is part of the bake: re-run the check after a pin bump.

## LF2-2: the layout, form first (opus-lf22)

- `canyon.ts` lays the level out to the targets, on its own generator
  (`lcg(2202)`), so BM-1's mesas, cacti and boulders stay where they
  were. All of it is data next to `CAMPS`:
  - **Camp 2's ledge** (`LEDGE`): a two-tier stepped mesa east of the
    trail, x 5 to 18.5, z -27 to -41, flat on top at 6 m (the tier
    band at 3.2 m, the west face set back 0.8 m). A plank barricade
    runs along its west lip, a ladder leans on its west face (dressing,
    not climbable), and a stair of 24 rock steps (0.25 m rise, under
    the player's 0.3 m autostep; 0.55 m run) climbs its south flank to
    the top. Camp 2 stands on it at (13.5, 6, -34), bandits at y 6.
  - **Camp 3's side canyon** (`SIDE`): a slot whose axis runs from the
    gate along (0.8, 0.6), rock walls 6.2 m either side of it from 9.5
    to 25 m out, closed by three rocks at the far end. Camp 3 stands
    deep in it at (18.4, 0, -50.5), its bandits between the mouth and
    the tent, so the camp looks straight back down the slot at the
    gate; still 11.5 m before the gate. A first cut put the camp 16 m
    out: its tent filled the slot and a bandit behind it could not be
    shot from the mouth.
  - **The sand pit** (`PIT`): a pale sand floor 10.5 m round the `wyrm`
    empty with two darker rings, ringed by twelve two-tier rocks
    (16 to 22 m tall) 14.5 m out, open 14 degrees either side of the
    gate. BM-5's spawn, 14 m arena, respawn and sand-ring anchors are
    unchanged.
  - **The signpost** (`SIGNPOST`, empty `signpost`) at (0.8, -20.5):
    two arrow boards, GATE down the canyon and CAMPS toward the ledge,
    and a paler branch from it to the stair's foot. New empty `ledge`
    at the stair's top.
- To stay under the 1 MiB hook (the GLB is 1,007,060 bytes, 11,944
  triangles), the rail line now ends in the gate's right butte (it ran
  on to z -136 behind the pit) and the fence stops before the ledge.
- Rows moved with the camps: camp 2 and 3's bandit spawns and their
  quest markers. The look-loop anchors for camp 2 (below the ledge, 10
  m from its face) and camp 3 (the slot's mouth) moved; the ledge dome
  is `art/look-loop/brasscap-camp-2-ledge/`.
- `canyon.test.ts` adds the layout checks, on the world mesh with a
  front-face ray cast: camp 2's empty is on the 6 m top, the stair
  never steps more than 0.3 m and ends level with the top, camp 3 is
  before the gate with a clear sightline to it and a wall on each
  side, and the pit is rock all round at 2 m and 12 m but its mouth.
- **The re-bake settles itself.** `rebake.ts --write` now works on a
  staged copy of the corpus: the cooked files in, the changed blobs'
  `files` rows and critical entries, their pack members (gone ones
  out, new ones into the pack sharing most members with the cooked
  pack that holds them, offsets and sizes recomputed), the sim budget
  and server memory moved by the critical blobs' change, then
  `shardfile pack` and its settled `shard.json`, `validation.json` and
  sections; only then is the stage copied over the corpus and stale
  blobs dropped. A failure leaves the corpus untouched (Codex MUST).
  A changed render-library blob still stops it: settle that by hand.
  Ran three times in this lane; each left `rebake.ts` (check) at 234
  of 234 byte-equal and `shardfile validate` ok.
- Caps after the re-bake: L0 tiles at most 3,210 triangles and 4
  draws (caps 40,000 and 8), L1 at most 4,340 and 2 (10,000 and 2),
  far 7,478 triangles in 898,428 bytes (8,000 and 1 MB), sim budget
  340,674 compressed. The far stand-in is now near its cap: LF2-4's
  mesa work has little far room.
- **Proof** in a local engine preview (engine `3be630ff` worktree, this
  corpus over the format dependency, `pins.ts install --from-format
  brasscap-mesa`, a one-shard catalogue listing Brasscap), headless
  Chromium with `--use-mock-keychain --password-store=basic`. One
  scripted run (`~/.cache/wildshard/plan-artifacts/template-e2e-v3/
  lf22-play.mjs`, walks through `walkLeg` with an `inside` box so no
  step is a teleport): E takes the rack's rifle; walks reach camp 1,
  the ledge top by the stair (y 6.02) and camp 2, back down, and into
  camp 3 through the slot's mouth; the nine bandits fall to 22 rounds
  (BM-4's run took 12: the ledge's tent and camp 3's slot make the
  script walk round to a clear line); each step completes, the gate
  panel goes hidden and not solid, and the walk goes through the gate
  into the pit. The Dust Wyrm's fight starts at the mouth; 16 rounds,
  8 landing in the gullet windows and 8 missing outside them, beat it
  (BM-5's shape). No console error. TOP views before and after:
  `progress/t2-08-layout-{before,after}.jpg`.
- Two harness traps for the next lane: `probe.pose` and a `walkLeg`
  without `inside` stand the player on the heightfield, which has no
  ledge, so on the ledge they drop it into the rock; aim by setting
  `player.yaw` and `pitch` instead. The ledge dome's FP cameras have
  the same problem through views.mjs.

## LF2-5: the depot, porch and rack (opus-lf25, 2026-11-12 ~03:40 Cancún)

- **The depot ships in two source GLBs.** `canyon.glb` keeps the
  depot's shell (footing, walls, gable roof, deck, posts, the porch's
  shed roof, header and fascia); the detail goes in
  `corpus/sources/brasscap-mesa/depot.glb` (`depotDetail` in
  `canyon.ts`; `node src/tools/brasscap/canyon.ts` writes both).
  With the detail in it, `canyon.glb` would have passed the repo's
  1 MiB file limit; split, it is 996,304 bytes and `depot.glb`
  246,588. The bake input (`--bake`) folds the detail into its canyon
  and glow meshes after welding the far stand-in, so the far mesh
  holds only the shell: 7,448 triangles (was 7,478).
- **Detail:** corrugated tin ribs on both roofs, a plank ceiling on
  rafters, knee braces, plank seams and corner boards, four-pane
  windows with sills, a door, a bench, four hooped barrels, a wall
  lantern whose glass is `glow` (with a `look.light.pools` pool at its
  foot), the brass bell on an iron bracket, the rack as a two-plank
  board on pegs with the lever-action, an X-braced ammo crate, the
  handcar on the siding, and BRASSCAP in raised low-poly letters on the
  porch roof's south edge. Low-poly letters cost no draw (same
  `mesa` material); a KTX2 decal would have added a material, so one
  draw in each tile it touched. No detail draws on `rand`, so BM-1's
  mesas stay put.
- **Caps:** L0 at most 3,534 triangles and 4 draws (was 3,210 and 4),
  L1 4,548 and 2, far 7,448 of 8,000. The bake's warning ("far
  resident target 1,788,560 > 1,600,000") is on the far mesh, which
  this row only shrank, so it predates LF2-5.
- **The re-bake leaves `look.post` out** of its throwaway project: the
  sibling sharddev's format predates LF2-3's `viewRay` op and refused
  the look, and the cooked world and sim sections never read the post
  graph. `rebake.ts --write` settled the new blobs and `look.json`'s
  pool; `--check` then reads 234 of 234 files byte-equal.

## LF2-4: mesas and ground (opus-lf24, 2026-11-12 ~03:40 Cancún)

- **Three new source GLBs.** The near mesas (both walls, the two
  buttes by the gate) and LF2-2's crags are faceted cliffs in
  `cliffs-west.glb` (608,752 bytes) and `cliffs-east.glb` (771,464),
  split at x 0 so each stays under the 1 MiB limit; the ground's
  dressing is `ground.glb` (352,704). `canyon.glb` keeps BM-1's plain
  mesas (992,272). `node src/tools/brasscap/canyon.ts` writes all five.
- **The bake splits by tile level.** `--bake` writes the cliffs and
  the dressing as one `dress` node and the plain mesas as
  `coarse.mesas`; `rebake.ts` declares `detail: 'dress'` and
  `coarse: 'coarse.'`. So the L0 tiles draw the cliffs and dressing
  (and they collide), the L1 tiles and their near view draw the plain
  mesas (never colliding), and the far stand-in is welded from the
  plain shell as before: 7,448 triangles, unchanged. Folding the
  cliffs into `canyon` instead pushed the near view to 1,071,468
  bytes, past the pack's 1 MiB entry, and the settle failed.
- **Fixed seeds.** The cliffs and dressing draw on `lcg(2404)` and
  `lcg(2405)`; `mesa` and `crag` still draw `rand` and `lcg(2202)`
  exactly as before, so nothing BM-1 or LF2-2 placed moves. The
  boulders by the trail and the target posts are left out (they still
  draw `rand`), and the boulder colour is warmer.
- **Walkable.** `ROUTES` lists the ways a player walks (to camp 1,
  the stair branch, to camp 3, through the gate). Scree and set-back
  rocks keep 1.4 m plus their radius off them and 7 m off each camp;
  the rocks along the trail are under 0.25 m; a test holds anything
  taller than 0.25 m off every route.
- **Caps:** L0 at most 9,212 triangles and 4 draws (was 3,534), L1
  4,636 and 2, far 7,448 of 8,000 in 894,828 bytes, near view 781 KB.
  The bake's one warning (far resident 1,788,560 > 1,600,000) is
  unchanged.
- **Codex review (one `codex exec` on `08b68bb`): no MUST.** Its
  SHOULD is taken: the route test now checks every L0 detail face
  (cliffs, scree and dressing, corners and centres from a step up to
  head height), not only the dressing's vertices. Its NIT too: the
  `--bake` log counts the detail triangles.
- **Play proof.** opus-lf22's script got two harness fixes in
  `template-e2e-v3/lf22-play.mjs`: each standoff starts from the next
  side, so camp 2's last bandit, idling behind the flag pole at
  x 15.3, is not shot through the pole every time; and the walk into
  camp 2 goes round the tent's north-east corner first.

## LF2-7: the metal material and the palette (opus-lf27, 2026-11-12)

- **One `metal` material** (`Metal` in the GLBs, `look.materials.metal`:
  pbr, vertex-coloured, metalness 0.5, roughness 0.45, faceted). It
  draws the roofs' tin, the rails, the gate's iron straps, rivets and
  pull rings, both bells with their brackets, and the water tower's
  hoops, cone roof and finial. Brass and tin differ only in vertex
  colour. `metal(() => ...)` in `canyon.ts` flags the triangles drawn
  inside it; a flagged mesh writes a second primitive.
- **L0 only.** The engine's L1 tiles take 2 draws and already use
  them, so in the bake the canyon node's metal (the roofs, the rails,
  the depot's bell) moves into `dress` (L0 detail) and is drawn in
  `mesa` in `coarse.mesas` (L1). The far stand-in ignores the flags.
- **Caps:** metal is in 5 L0 tiles, (3,3), (3,4), (4,2), (4,3) and
  (4,4): L0 at most 6 draws (was 4) and 14,321 triangles (unchanged),
  L1 2 draws (unchanged), far 7,498 of 8,000 (the palette moved the
  weld). No tile keeps its metal in `mesa` for want of draws.
- **Palette:** the sand and the mesa bands moved half the measured
  step toward the targets' means (sand linear red x1.25, blue x0.8;
  bands red x1.2, green and blue x0.95); the LUT fits on top.
- **`rebake.ts`:** a changed blob that shares no member with any pack
  (the far mesh, after a palette change) now refills the pack its old
  blob left empty; `shardfile pack` refused an empty pack.
