# Creature ranks on spawn rows (opus-of-m4, ONE-FORMAT OF28a)

- `src/format/creature-ranks.ts`: four ranks (veteran, elite, champion, legendary) with fixed hp, damage, size and
  loot multipliers (Q-CC33 (a)); a creature spawn row may name one. Unranked rows parse byte-identical.
- The giant cap counts the rank's size: a veteran giant at scale 1 is 16.5 m and refuses.
- creatures.ts keeps its own copy of the four names (its import count is at the ratchet's ceiling); the rank test
  parses every name in creature-ranks.ts through it, so the two cannot drift.
