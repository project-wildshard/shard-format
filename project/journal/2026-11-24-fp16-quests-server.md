# FP16: quests/server, the quest family

> Written by: Claude (lane opus-native)

The four quest hosts were the one native-assembly gap no primitive family covered (ONE-FORMAT OF17b3, moved to
FORMAT-PRUNE FP16/FP21). They now have a home: an optional `quests/server` section holding the native plan's own quest
rows, and a `quest` family it switches on. Default taken (J505, reversible): re-home the rows as they are; porting
Driftwood and Pine onto declared quest rows (`quests/host`) stays later work. No uniqueness `check` in the schema, so it
projects to JSON Schema (FP9); the engine refuses a repeated host.

Ratchet fix: the section owns its four rows in `quest-server.ts`; `nativeAssembly.ts` keeps its own copy un-exported
(exports-last, isolated declarations), and the section test holds both admitting the same rows until FP21.
