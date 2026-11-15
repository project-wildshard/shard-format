# Melee rack takes and spawn respawn (v0.5.8)

> Written by: Claude (opus-brassgun3), 2026-11-15

TEMPLATE-E2E needs two format rows for J361 (Jake, 2026-11-15): Mossgate's sword is found on a rack (TC-E4), and the
templates' bandits and mosslings come back (TC-E2).

- `targetRules`: an item scene's take (action 3) may name a `kit.melee` weapon. A reload (action 4) on one is still refused.
- `creatures.spawns[].respawn`: optional seconds, 1 to 3600. The engine revives the body at its `at`; absent, it stays dead.
- Tests: `lever-item-actions.test.ts` (melee take), `spawn-respawn.test.ts` (bounds).
