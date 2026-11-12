# Brasscap Mesa look loop: Camp 3, round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (-4, -40), ground y 0, yaw -0.876, pitch -0.06
  (`../cameras.json`, which says why P sits where it does). 187 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-11-camp-3-fp-cleared.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; every P stands outside the
  bandits' 9 m aware radius. Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | Form: no side canyon; camp 3 is on the trail 12 m before the gate, so the gate and its fence fill the left | Form: LF2-2 |
| 2 | The target shows the camp cleared (bodies, a burning fire, CAMPS CLEARED); round 0 is the uncleared camp. Later rounds shoot it cleared by play | State: LF2-8 |
| 3 | The Dust Wyrm's nameplate draws over a bandit from 50 m away, through the gate (non-look find, engine nameplates) | - |
| 4 | No campfire, crates, barrels or wagon | M: LF2-6 |
| 5 | Pale sky, flat ground, black shadow sides | C, G, L: LF2-3, LF2-4 |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
