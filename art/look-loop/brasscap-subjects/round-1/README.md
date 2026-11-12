# Brasscap Mesa look loop: the subjects, round 1

> Written by: Claude (opus-lf28), 2026-11-12 ~04:45 Cancún. **State:** round 1 done, three iterations (LF2-8, meta
> `docs/plans/TEMPLATE-E2E-PLAN.md`); to Jake with the open items below.

- **Build:** engine main `72da5c78` in an `lf28-preview` worktree, this repo's corpus over the format dependency
  (`pins.ts install --from-format brasscap-mesa`) on a one-shard catalogue (`WILDSHARD_CATALOGUE`, the grid's other
  cells as roads), served by `scripts/serve-build.sh`; desktop 1400x933, headless Chromium (Metal, mock keychain).
- **Shots:** a scripted run (rack take, then camp 1 from its anchor, then the sand pit), each frame at the fight's
  moment: the held rifle on the porch (`t2-03`), the camp 1 bandits closing (`t2-07`, `t2-10`), the Wyrm's tell and
  open window (`t2-14`, `t2-15`), the beaten Wyrm (`t2-16`).
- **Files:** `board.jpg` (target, before, after per subject), `iteration-0-before.jpg` to `iteration-3.jpg` (the
  contact sheet each iteration), `capture-*.jpg` (iteration 3's frames).

## Iterations

1. The Wyrm rebuilt as an arch of plated segments rising from its mound and bending over toward the player, its round
   maw (cream rim, eight teeth, a dark throat narrowing to the yellow gullet) facing them; lighter terracotta, so it
   reads warm with the low sun behind it. The bandit's eye in a dark socket, standing proud; the right arm raised with a
   revolver. Gloved hands and tan sleeves on the held lever-action.
2. From the front the arch read as a straight column: the body now sweeps across as it rises (base off to one side,
   maw centred). Wider body and maw. The held rifle moved up and out (`view.position` 0.19, -0.22, -0.56) so the right
   hand shows.
3. Cream bands striped the body like a barber's pole: the plate rims are now a lighter terracotta (cream stays on the
   spines, teeth and rim). Gloves a cooler, lighter leather than the walnut, with a knuckle bar.

## Left after three iterations

- **The beaten Wyrm draws white (engine, TE-ENG9).** Its material's emissive stays at the hit flash's full white
  (`ffffff` at 0.9, `FLASH_I`) after the kill; it also lands upside down. Not a GLB or texture fault: the same white
  shows on every hit of the fight (`capture-wyrm-open.jpg`).
- **No part of a skinned subject can glow (engine, TE-ENG10).** A skin look draws its whole mesh with one family
  material, so the bandit's eye and the Wyrm's gullet are bright vertex colour, not LF1-2's emissive.
- `attack.open` is in the GLB and never plays (BM-5's note): the open window is still the gold particles.
- The bandits read boxy beside `t2-07`'s rounder tin robots; the gloves are small in frame at this hold.
