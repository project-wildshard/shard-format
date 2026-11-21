# OF30: a species row may carry its projection

> Written by: Claude (opus-nalati2)

Nalati's night riders are a timed encounter whose guest view programme (the balbal's actor projection) lives only in the
species programme's look book (`actors/sheep.json`). The declared species row now takes an optional `projection`
(`ActorProjectionV2Schema`), so the engine can prefer the declared row and fall back to the look book until Nalati's
revision carries it. No row has one today; rows without it parse byte for byte as before.

The first cut imported the schema straight into `rows.ts` and rose the lint ratchet; `creature-layers.ts` lends it
instead, and the test is oxfmt-formatted.
