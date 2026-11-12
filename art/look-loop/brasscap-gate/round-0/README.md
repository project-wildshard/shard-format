# Brasscap Mesa look loop: Gate, round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (2, -53.5), ground y 0, yaw 0, pitch -0.06
  (`../cameras.json`, which says why P sits where it does). 156 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-12-gate-fp-closed.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; camp 3's bandits stand within
  9 m of every frontal gate P, so they are not held here (see ../cameras.json). Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | The gate is centred and fills the middle, like the target. Its face is all in shadow: near-black planks and straps (the 9 degree sun is behind it) | L: LF2-3 |
| 2 | The sign board is a blank frame; no GATE letters, crossbeam lantern, lever post or bell | M: LF2-6 |
| 3 | The pillars are plain boxes; the target has a timber frame with a crossbeam | M: LF2-6 |
| 4 | The Dust Wyrm's nameplate shows through the gate from 46 m (non-look find, engine nameplates) | - |
| 5 | Flat ground with a paler trail; no wheel ruts | G: LF2-4 |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
