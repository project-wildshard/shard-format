# Brasscap Mesa look loop: Canyon trail, round 3

> Written by: Claude (opus-lf24), 2026-11-12 ~03:35 Cancún. **State:** round 3 done (LF2-4, mesas and ground; meta
> `docs/plans/TEMPLATE-E2E-PLAN.md`). Same cameras as round 0 (`../cameras.json`).

- **Build:** engine `lf24-preview` worktree (engine main `ed411d6b`) with this repo's corpus at LF2-4 laid over the
  format dependency and installed through `pins.ts install --from-format brasscap-mesa`, on a one-shard catalogue
  (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by
  `scripts/look-loop/views.mjs --save=debug.lookLight=on` (desktop 1400x933, Metal, mock keychain).
- **Target:** `art/targets/brasscap/t2-05-canyon-trail-fp-front.jpg`.
- **Files:** `capture-1-fp-front.jpg` (camera 1), `board.jpg` (capture over target).

## What changed

The canyon's near mesas (both walls and the two buttes by the gate) and LF2-2's crags (the side canyon and the pit's
ring) are now faceted cliffs. Each tier's wall has two rows of facets, and long faces are split into columns. Each
tier has a chamfered lip, some have a cornice, and each has a lit cap (cream on the top tier). Every face is its band
colour jittered on a fixed seed. The upper row of each tier takes a neighbouring band, so the walls read as strata.
Scree boulders lie at the foot.

The ground has:

- colour patches;
- a darker edge each side of the trail;
- wheel ruts from the fork to the gate;
- a low faceted rock every 2 to 4 m along the trail, with bigger rocks set back;
- dry-grass tufts.

Nothing taller than a step stands on a route a player walks. The cliffs and the dressing draw in the L0 tiles only;
the L1 tiles and the far stand-in keep BM-1's plain mesas.

Three iterations:

1. Everything in.
2. Long faces split into columns, stronger face jitter, and darker patches (the pale ones read as raised slabs).
3. Each tier's upper row takes a neighbouring band, for strata.

## Gap list, camera 1

| # | Gap (form first) | Look |
|---|---|---|
| 1 | The trail itself is still the pale flat strip from canyon.glb: its edges and ruts are in, its tone is not | G, C |
| 2 | The pink ball in front of the post is the target body (LF2-8); the saguaros are still green bars (LF2-6) | M, T |
| 3 | The sand is a shade paler and less orange than the target's (a colour item for LF2-7's grade) | C |

No mesa or ground form item is left in this frame.
