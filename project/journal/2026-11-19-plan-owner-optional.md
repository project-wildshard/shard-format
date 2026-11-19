# A runtime plan may keep no owner row

> Written by: Claude (opus-of19b2, ONE-FORMAT OF19c0b)

Dunes and Sky Reach keep their runtime plan for the quest page and the
held melee (J367 (7)) while their bosses move to declared `boss`
encounters (OF19c1, OF20c). Engine `OF19c0` runs those encounters beside
the plan and lets the plan's keeper stand no boss, but the
`sim/runtime-plan` schema still demanded `population.owner`, so a built
product could not drop it.

`owner` is now optional. A plan without one has no owner inputs (the
transform gives `[]`, and listing any refuses), a keeper `boss` row
without one refuses, and a client page with no owner may carry no
`boss.held` / `boss.spawned` feature (its boss is declared). A plan
with an owner parses exactly as before.
