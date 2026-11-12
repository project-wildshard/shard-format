# Brasscap Mesa look loop: Camp 3, round 4

> Written by: Claude (opus-lf26), 2026-11-12 ~05:35 Cancún. **State:** round 4 done (LF2-6, camps, gate, cacti and
> the water tower; meta `docs/plans/TEMPLATE-E2E-PLAN.md`). Same cameras as round 0 (`../cameras.json`).

- **Build:** engine `lf26-preview` worktree (engine main `45d83bf2`) with this repo's corpus at LF2-6 laid over the
  format dependency and installed through `pins.ts install --from-format brasscap-mesa`, on a one-shard catalogue
  (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by
  `scripts/look-loop/views.mjs --save=debug.lookLight=on` (desktop 1400x933, Metal, mock keychain).
- **Target:** `art/targets/brasscap/t2-11-camp-3-fp-cleared.jpg`.
- **Files:** `capture-1-fp-front.jpg` (camera 1), `board.jpg` (capture over target).

## What changed (all zones)

The props are form now, in their own source GLB (`corpus/sources/brasscap-mesa/props.glb`), drawn in the L0 tiles
only; canyon.glb keeps the plain stand-ins for the far mesh and the L1 tiles.

- **Tents:** canvas slopes in three panels with seams and a hem, a door with its flaps tied back, a warm glow inside
  (the `glow` emissive material) and a lantern hung just inside the door. Camp 3's tent turns its door down the slot
  toward the gate.
- **Campfires:** a ring of nine faceted stones, crossed charred logs, glowing embers and an orange flame with yellow
  tongues, each with a `look.light.pools` pool.
- **Crates and barrels:** X-braced crates (a frame and an X on each side), hooped barrels at camps 1 and 3.
- **Camp 3's wagon:** a plank bed on four wheels, a tongue on the ground, a canvas cover on hoops, torn through on one
  side with a flap hanging.
- **The gate:** double plank doors with iron straps and rivets, pull rings and back braces, still the one `gate.door`
  panel that field 101 hides and drops; timber posts, a crossbeam on knee braces carrying the GATE sign and a hanging
  lantern (its pool on the ground), and the right post is the lever post, with the brass bell on a bracket above it.
- **Saguaros:** ribbed eight-rib trunks with domed tops, arms that run out level, bend and rise, each face shaded by
  how it faces the sun; one more beside the gate.
- **The water tower:** legs leaning in on X-braces, a plank deck, a stave tank with three iron hoops, a tin cone roof
  with a finial, a spout and a ladder.

Iterations: (1) everything in; (2) camp 3's tent turned to the gate, the saguaro ribs deepened, the gate's crossbeam
and sign lowered into the frame, the gate cactus moved into it; (3) the bell and lever moved onto the right gate post
(a post of their own stood in camp 3's frame), stronger rib contrast, camp 1's barrels beside the fire; (4) the
tent's front pole and outside lantern removed (they stopped `bm6b-play.mjs` at camp 2), the lantern hung inside.
After Codex's review the lit parts are their own L0-only node (`dress.glow`), so the L1 tiles draw no flame without
its fire; camera 1 is unchanged by that.

## Gap list, camera 1

| # | Gap (form first) | Look |
|---|---|---|
| 1 | The target frames the camp from closer, with the gate behind it; our slot looks from the gate side, so the gate is behind the camera | form |
| 2 | Cacti and the fence the target shows inside the camp are not there (the slot is narrow rock) | M |

The tent faces the camera with its lit door, the fire burns beside it, the wagon's torn cover shows behind.
