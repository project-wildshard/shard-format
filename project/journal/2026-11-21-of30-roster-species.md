# OF30: the roster names its declared species

> Written by: Claude (opus-of-m8-species)

Pine's native roster read its species rows and hunt settings from `actors/species-programs`, the last thing keeping
that section alive on Pine. The roster rows file now carries both: `species` lists the declared `actors/species` ids
it runs, in its old registration order, with each row's spawn-only rows (Pine's thralls), and `hunt` is the old
programme's hunt block moved verbatim. Both optional, so every shipped roster still reads; the engine reads them
only on a product with no species programme.

The ground boss's binding gets the same treatment: `decision` and `body` (the King's decision brain and body recipe,
which only the species programme held) are optional binding fields; its exact strikes go to `actors/strikes`.

The hunt's hit tag was a `v.custom`, which cannot project to JSON Schema, so
every build naming `actors/roster.json` (Pine) refused once its roster schema
carried the hunt. The tag is a regex now, the same law, as `catalogueEconomy`
writes its tag; a test walks the roster schema for any custom (opus-of-pine).

The runtime plan's keeper programme goes optional the same way: Sky Reach and the Dunes ship a keeper with no program
species and no homes (their creatures are declared rows), so `population.rows.program` was a dead copy of their
strikes. A plan may leave it out; one that names it is still checked whole.
The follow-up only meets the lint ratchet (capitalised comment, the cast's
reason named, the test helper reshaped).
