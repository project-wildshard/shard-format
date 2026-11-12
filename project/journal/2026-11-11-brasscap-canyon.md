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
