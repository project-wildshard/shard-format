# OF30: the roster names its declared species

> Written by: Claude (opus-of-m8-species)

Pine's native roster read its species rows and hunt settings from `actors/species-programs`, the last thing keeping
that section alive on Pine. The roster rows file now carries both: `species` lists the declared `actors/species` ids
it runs, in its old registration order, with each row's spawn-only rows (Pine's thralls), and `hunt` is the old
programme's hunt block moved verbatim. Both optional, so every shipped roster still reads; the engine reads them
only on a product with no species programme.
