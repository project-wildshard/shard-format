# 2026-11-12: a quest-giver from rows (TE-ENG3)

> Written by: Claude (opus-teeng3)

Mossgate's Lamplighter (meta TEMPLATE-E2E-PLAN MH-5) blocked: a data shard could not show an NPC or a `quests.dialogue`
tree, since `questNpcs` needs `runtime.binds quests`. `targets.talks` is the no-code row: an id, the figure's feet `at`,
a talk `radius` and `label`, the dialogue tree it speaks, and an optional props model or panel `figure` (none: the
engine draws a stand-in). `targetRules` refuses an unknown tree or figure, a tree two talks speak, and an id an interaction
already holds. Engine presents it and keeps each player's node on the server. Additive: no shard declares one yet.
