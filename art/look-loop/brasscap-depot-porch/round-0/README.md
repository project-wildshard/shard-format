# Brasscap Mesa look loop: Depot porch, round 0

> Written by: Claude (opus-lf21), 2026-11-12 ~00:50 Cancún. **State:** round 0 done (camera 1 beside its target,
> no fixes). LF2-1 in meta `docs/plans/TEMPLATE-E2E-PLAN.md`; later rounds re-shoot `../cameras.json` exactly.

- **Build:** engine `32c301ca` preview (build `32c301ca-mwd43kjc`, worktree `lf21-preview`) with shardfile `f32eae4`'s `corpus/brasscap-mesa/` installed through `pins.ts install --from-format brasscap-mesa` over the format package, on a catalogue that lists Brasscap (`WILDSHARD_CATALOGUE`); served by `scripts/serve-build.sh`, shot headless by `scripts/look-loop/views.mjs` (desktop 1400x933, Metal, mock keychain).
- **Camera 1:** P (-1.6, 2.6), ground y 0, yaw 0, pitch -0.06
  (`../cameras.json`, which says why P sits where it does). 204 draw calls in the frame.
- **Target:** `art/targets/brasscap/t2-01-depot-porch-fp-front.jpg`.
- **Freeze:** `look.json` pins `dayOverride` 0.4, so the sun is fixed with no time setting; weather clear through the
  save's Debug settings; the Dust Wyrm has no brain and its 14 m arena never starts; every P stands outside the
  bandits' 9 m aware radius. Clouds: there are none in engine yet (LF2-3).
- **Files:** `capture-1-fp-front.jpg` (the capture), `board.jpg` (the capture over the target).

## Gap list, camera 1 (form first)

| # | Form and subject | Look |
|---|---|---|
| 1 | The porch, the rack and the trail to the far gate are in frame and centred, like the target. The porch roof's underside is a near-black void over the top third (TOP-10 #3) | L: no warm bounce under the roof; the targets' roof has lit planks and rafters (LF2-5, LF2-3) |
| 2 | The depot wall is a flat maroon slab with a blank cream window. No tin roof, BRASSCAP sign, wall lantern, bell or bench | M: LF2-5. L: the window is flat cream, not lantern-lit (LF2-5, LF2-3) |
| 3 | Down the canyon: the gate, tents, target plates and cacti read, but small and with no water tower in view (it stands to the right of this yaw) | C: a pale beige-grey sky against the target's turquoise top and salmon clouds (LF2-3) |
| 4 | The cactus at the right is a dark green bar | T: faceted olive saguaro with a lit side (LF2-6) |
| 5 | The porch floor and ground are one flat tone | G: warm sand with patches, rocks and tufts (LF2-4) |

Not look items: the HUD pills (ammo, hotbar, coins) and the held rifle and gloved hand come with BM-3 and BM-6; the
minimap's green blob against the targets' slate is engine's.
