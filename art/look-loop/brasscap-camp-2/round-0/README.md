# Brasscap Mesa look loop: Camp 2 (below the ledge), round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (6.4, -25.4), ground y 0, yaw -0.425, pitch -0.06
  (`../cameras.json`, which says why P sits where it does). 187 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-08-camp-2-fp-ledge.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; every P stands outside the
  bandits' 9 m aware radius. Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | Form: there is no 6 m ledge, ladder or barricade. Camp 2 sits on the canyon floor, so this is dome A's view of a flat camp, not the target's look up at a ledge | Form: LF2-2 (TOP-10 #1) |
| 2 | The tent, flag and bandits read, small. Fences and the rail line cross the foreground | M: LF2-6 |
| 3 | A dark green cactus bar at the left | T: LF2-6 |
| 4 | Mesas are stacked boxes with near-black shadow sides | M, C: LF2-4; L: LF2-3 |
| 5 | Pale sky | C: LF2-3 |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
