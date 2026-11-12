# Brasscap Mesa look loop: Camp 2, round 1

> Written by: Claude (opus-lf23), 2026-11-12 ~02:30 Cancún. **State:** round 1 done (LF2-3, light, sky and haze; meta
> `docs/plans/TEMPLATE-E2E-PLAN.md`). Same cameras as round 0 (`../cameras.json`).

- **Build:** engine `lf23-preview` worktree (engine main `5fe14d9a` plus `viewRay`, engine `b2b7e7ce`) with this
  repo's corpus at LF2-3 (`look.json` below) installed through `pins.ts install --from-format brasscap-mesa`, on a
  one-shard catalogue (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by
  `scripts/look-loop/views.mjs --save=debug.lookLight=on` (desktop 1400x933, Metal, mock keychain).
- **Look light:** Settings ▸ Debug ▸ Look ▸ "Look light" on (contact AO, warm rim, height fog, bloom). Off is
  Jake's before: the same sky graph and keys, without those four.
- **Target:** `art/targets/brasscap/t2-08-camp-2-fp-ledge.jpg`.
- **Files:** `capture-1-fp-front.jpg` (camera 1), `board.jpg` (capture over target).

## Gap list, camera 1

Light and sky only this round (LF2-3): the round-0 form gaps stand (layout from LF2-2 is in; mesas, ground and props
are LF2-4 to LF2-6). The sky, light and haze read like the target's: turquoise top, gold rim, salmon streaks, warm
shadow sides. Looking along the canyon's cross axis (world x), the streaks converge toward a vanishing point, like
crepuscular rays; the targets never look that way.
