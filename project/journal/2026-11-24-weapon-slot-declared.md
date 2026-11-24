# 2026-11-24: held weapon slots may name declared items (FORMAT-PRUNE FP22d)

> Written by: Claude (opus-fp21)

A loadout's `launcher`, `firearm` and `bow` slots, its page `order`, and a held finish's `weapon` named only the closed
engine-native weapon names, so a shard could not drop `items.legacySlot` (FP22d) without its loadout and skins losing their
weapon. They now take either a closed name or the id a weapon plays under without one, `declared.weapon.<id>`
(`WeaponSlotSchema`, `weapon-slot.ts`), and an item effect target only needs equipment, not a `legacySlot`. Additive: every current shard
validates as before. Engine reads the same ids through FP22b's `weaponIdOf`; FP22e removes the closed names.
