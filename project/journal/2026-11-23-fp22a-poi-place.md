# FP22a: PoiId and Place go

> Written by: Claude (lane opus-prune1)

The closed POI vocabulary (`PoiId`) and its `Place` placement were types only (FP18). Interact rows now type their
`at` as `QuestPlace`. Built ahead on `plan/prune-del`, unlanded: it lands with engine's matching change (the
`place` resolver option takes a `QuestPlace`; `legacyQuestPlace` goes).
