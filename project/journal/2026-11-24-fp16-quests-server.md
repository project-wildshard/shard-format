# FP16: quests/server, the quest family

> Written by: Claude (lane opus-native)

The four quest hosts were the one native-assembly gap no primitive family covered (ONE-FORMAT OF17b3, moved to
FORMAT-PRUNE FP16/FP21). They now have a home: an optional `quests/server` section holding the native plan's own quest
rows, and a `quest` family it switches on. Default taken (J505, reversible): re-home the rows as they are; porting
Driftwood and Pine onto declared quest rows (`quests/host`) stays later work. No uniqueness `check` in the schema, so it
projects to JSON Schema (FP9); the engine refuses a repeated host.

Ratchet fix: the section owns its four rows in `quest-server.ts`; `nativeAssembly.ts` keeps its own copy un-exported
(exports-last, isolated declarations), and the section test holds both admitting the same rows until FP21.

FP16d: `quests/server` renamed `server/quest` (unreleased, so no file carries the old name) to sit with `server/riding`,
`server/boss` and `server/patrol`, each a family's host rows (projectable `{ host }` rows; the engine admits them with the
plan's row schemas, as HS6b's `server/plan`). A native plan may now name no host.

FP21: `server/world` holds the native world's non-host settings (level, terrain, navigation, bake, collision, entries,
boot, field); with the family sections it replaces the plan file. Server-class files stay server class (coordinator default).
