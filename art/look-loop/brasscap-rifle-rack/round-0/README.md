# Brasscap Mesa look loop: Rifle rack, round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (-2.2, 0.28), ground y 0, yaw 0, pitch -0.35
  (`../cameras.json`, which says why P sits where it does). 203 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-02-rifle-rack-fp-close.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; every P stands outside the
  bandits' 9 m aware radius. Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | Form differs: today's rack is a free-standing A-frame at the porch front, seen against the canyon. The target is a board on the depot wall with pegs, a wall lantern, the bell on a bracket and an ammo crate | M: LF2-5 |
| 2 | The rifle reads as a black bar with a brass box; the target's has a walnut stock, a brass receiver and a lever loop | M: BM-3's rack rifle, finished in LF2-8 |
| 3 | The prompt reads "E TAKE THE LEVER-ACTION", as the target's "[E] TAKE" does | - |
| 4 | The rack and the porch posts sit in near-black maroon shadow | L: shadow sides warm violet and readable (LF2-3) |
| 5 | A cream window slab fills the top left | L: unlit glass (LF2-5) |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
