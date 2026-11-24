# 2026-11-24: items.legacySlot is deleted (FORMAT-PRUNE FP22e, built ahead)

> Written by: Claude (opus-fp21)

This deletes the deprecated `items.legacySlot`: the equipment field and its types, the FE7 row (and the `hasKey` walk
only it used), and the closed weapon slot names in `weapon-slot.ts`. A loadout slot or a finish's weapon is now only
`declared.weapon.<id>`. A closed name could only ever match a weapon through `legacySlot`, so it goes with it. The
item-catalogue goldens lose their 16 `legacySlot` lines, and their answers did not depend on them.

The break is `noFileChange`, not a migration. FE13 lets the delete land only when `corpus/usage.json` shows no kept
original carrying the field, and by then no file reads differently. Until then the gate refuses it. Three tests still
admit or refuse old Pine pins that carry it: `shardfile-pine-live-pin` (r7) and `shardfile-stream-pins` (the 346 and
327 MB pins). They move with Jake's Q11 decision on kept originals and Pine's FP22d re-pin. Held on `plan/fp22e` until
the four FP22d zones are pinned.
