# Harvest is declared on species rows

ONE-FORMAT OF31b1 defines one deterministic drop contract for open species
rows and the older species-program producer. An entry names an item, a
positive count, and optionally the variants that receive it. Order is
authored. The whole declaration is capped at 64 item units and 64 rows.

Row admission checks variant references, including spawn-only variants in
the older contract. Full shard admission additionally checks the pack item
catalogue. Existing declarations do not acquire a new default field.

The real row and full-shard tests admit a custom trophy and refuse unknown
items, unknown or repeated selectors, malformed ids, nonpositive or fractional
counts, excessive delivery, and callbacks. Runtime harvesting and copied kit
content remain OF31b2/b3; this schema does not remove the current engine table.

Review found that hull looks and build-only look metadata spread the shared
species schema. They now explicitly omit harvest, in both schemas and public
types. The real hull-book section strips that gameplay field; the strict
build-only metadata parser refuses it. Neither becomes an unchecked third
harvest declaration path.
