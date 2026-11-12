# Brasscap Mesa look loop: Depot porch, round 1

> Written by: Claude (opus-lf23), 2026-11-12 ~02:30 Cancún. **State:** round 1 done (LF2-3, light, sky and haze; meta
> `docs/plans/TEMPLATE-E2E-PLAN.md`). Same cameras as round 0 (`../cameras.json`).

- **Build:** engine `lf23-preview` worktree (engine main `5fe14d9a` plus `viewRay`, engine `b2b7e7ce`) with this
  repo's corpus at LF2-3 (`look.json` below) installed through `pins.ts install --from-format brasscap-mesa`, on a
  one-shard catalogue (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by
  `scripts/look-loop/views.mjs --save=debug.lookLight=on` (desktop 1400x933, Metal, mock keychain).
- **Look light:** Settings ▸ Debug ▸ Look ▸ "Look light" on (contact AO, warm rim, height fog, bloom). Off is
  Jake's before: the same sky graph and keys, without those four.
- **Target:** `art/targets/brasscap/t2-01-depot-porch-fp-front.jpg`.
- **Files:** `capture-1-fp-front.jpg` (camera 1), `board.jpg` (capture over target).

## Gap list, camera 1

| # | Gap (form first) | Look |
|---|---|---|
| 1 | The porch roof is a plain slab, no planks or rafters; the depot has no tin roof, BRASSCAP sign, lantern, bell or bench (LF2-5) | M |
| 2 | The ground and porch floor are one tone, no rocks, tufts or path edge (LF2-4) | G |
| 3 | The cactus is a green bar, no faceted saguaro (LF2-6) | T |

Light and sky, closed this round: the sky runs turquoise at the top to gold at the rim, salmon streaks and the sun's glow
sit down the canyon, right of the gate, as in the target; shadow sides and the porch's underside are warm and readable
(no near-black); warm dust haze softens the far canyon. Left on the light side, not in the TOP-3: the window is a flat
lit pane with a bloom halo, not a lantern-lit room (LF2-5's lantern).

## The orbit

`orbit-strip.jpg`: 12 first-person frames from P, 30 degrees apart (yaw 0 = down the canyon, 90 = left), pitched up
0.15 to hold the sky. The sun glow sits right of the gate in frames 0 and 330 and nowhere else; the streaks seen in
frames 240 and 270 move with the mesas between them. The clouds are keyed to the world ray (`viewRay`), not the
screen.
