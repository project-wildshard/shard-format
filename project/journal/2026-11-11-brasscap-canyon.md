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
