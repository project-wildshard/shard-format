# Brasscap Mesa look loop: Sand pit, round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (2, -84), ground y 0, yaw 0, pitch -0.06
  (`../cameras.json`, which says why P sits where it does). 118 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-14-dust-wyrm-fp-emerge.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; every P stands outside the
  bandits' 9 m aware radius. Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | The Dust Wyrm is held: it stands as a small banded post on its mound, no fight. The target is the emergence (LF2-8 shoots it from play) | State: LF2-8 |
| 2 | Form: open buttes past the gate, not a closed pit about 20 m across ringed by tall rocks | Form: LF2-2 (TOP-10 #1) |
| 3 | No sand ring, scree or cacti | G, T: LF2-4, LF2-6 |
| 4 | The near ground is one dark brown tone | G, L: LF2-4, LF2-3 |
| 5 | Pale sky, no dust haze | C, L: LF2-3 |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
