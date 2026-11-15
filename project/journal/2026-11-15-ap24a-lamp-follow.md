# AP24a: lamps that follow an actor (opus-ss16c)

- `look.light.lamps[].follow { actor, bone? }` (SHARD-SOURCE AP24a): a lamp rides a creature or boss by its spawn id,
  optionally one of its bones; its `at` is the offset there. Additive (an older engine's strict parse refuses it, so a
  shard using it names the engine that draws it, AP24b). The emitter half of AP24 is the emissive card's follow, for AP24c.
- Push ratchet: the follow schema's nested calls hoisted to named pieces, both files oxfmt'd.
- AP28 (same release, v0.5.9): `lamps` cap 16 to 256; `LOOK_LIGHT_LIT_MAX` (16) exported for the engine's nearest-16 pick.
