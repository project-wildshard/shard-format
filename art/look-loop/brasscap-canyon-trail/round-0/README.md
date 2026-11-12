# Brasscap Mesa look loop: Canyon trail, round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (3.5, -6), ground y 0, yaw 0.073, pitch -0.06
  (`../cameras.json`, which says why P sits where it does). 198 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-05-canyon-trail-fp-front.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; every P stands outside the
  bandits' 9 m aware radius. Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | The trail, the tin target and the canyon run to the gate read like the target. No CAMPS / GATE signpost at the left | M: LF2-2 |
| 2 | A pink boulder sits in front of the target post and a second plate is at the left | - |
| 3 | Mesas are stacked boxes, the left wall a near-black face | M, C: stepped faceted mesas with cream caps (LF2-4); L: shadow sides (LF2-3) |
| 4 | The ground is flat with a paler trail | G: path edges, rocks every few metres, tufts (LF2-4) |
| 5 | Pale sky, no haze | C, L: LF2-3 |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
