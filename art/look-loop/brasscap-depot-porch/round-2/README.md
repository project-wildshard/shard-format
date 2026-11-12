# Brasscap Mesa look loop: Depot porch, round 2

> Written by: Claude (opus-lf25), 2026-11-12 ~03:40 Cancún. **State:** round 2 done (LF2-5, the depot, porch and rack;
> meta `docs/plans/TEMPLATE-E2E-PLAN.md`). Same cameras as round 0 (`../cameras.json`).

- **Build:** engine `lf25-preview` worktree (engine main `b2b7e7ce`) with this repo's corpus at LF2-5 installed through
  `pins.ts install --from-format brasscap-mesa`, on a one-shard catalogue (`WILDSHARD_CATALOGUE`); served by
  `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs --save=debug.lookLight=on` (desktop
  1400x933, Metal, mock keychain).
- **Target:** `art/targets/brasscap/t2-01-depot-porch-fp-front.jpg`.
- **Files:** `capture-1-fp-front.jpg` (camera 1), `board.jpg` (capture over target), `sheet.jpg` (all 9 cameras).

## What changed

The depot is a shell in `canyon.glb` (walls, gable roof, deck, posts, the porch's shed roof) and its detail in its own
source GLB, `corpus/sources/brasscap-mesa/depot.glb` (`canyon.ts` writes both; the bake folds the detail in after the
far stand-in is welded). The porch ceiling is lit planks on rafters with knee braces and a header, not a void. Both
roofs are corrugated tin (raised ribs, a few rusty). The walls carry plank seams and corner boards; the windows have
four panes and sills; there is a plank door, a bench, four hooped barrels, a wall lantern with a lit glass (the `glow`
material, plus a `look.light.pools` pool at its foot), the brass bell on an iron bracket, the rack (below), an
X-braced ammo crate with cartridge boxes, the handcar on the rail's siding, and the BRASSCAP sign as raised low-poly
letters (no new material, so no extra draw) standing on the porch roof's south edge, facing down the canyon.

Three iterations: (1) everything in, the rack board 1.4 m tall, walling off the porch view; (2) the rack cut to a
two-plank board on pegs and the bell made smaller; (3) the sign moved from the south wall to the porch roof's edge.

## Gap list, camera 1

| # | Gap (form first) | Look |
|---|---|---|
| 1 | Past the porch: the cacti are bars, the water tower a can, the camps flat (LF2-6) | M, T |
| 2 | The ground and deck are one warm tone, no rocks, tufts or path edge (LF2-4) | G |
| 3 | The target's porch ceiling is darker and frames the canyon; ours is lit and lighter, so the frame reads less | L |

Caps: L0 max 3,534 triangles and 4 draws (was 3,210 and 4), far 7,448 of 8,000 triangles; `canyon.glb` 996,304 bytes,
`depot.glb` 246,588 bytes, both under the 1 MiB file limit.
