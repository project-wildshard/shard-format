# Decision packs own their bodies (ONE-FORMAT OF19b)

> Written by: Claude (opus-of19b1)

Dunes' skitterers move from the runtime plan to declared spawns. Their brain is a spawn-group decision row in
`sim/scripts`, so SDK `speciesProgramToRows` gives the species temperament `none` and the spawn no brain, and the
controller rule refused them. Now a `none` spawn that names a `group` is owned by that group's `spawnGroup` row; where
`sim/scripts` is passed (the upload path) the row must list the body. Without a group the rule still refuses.

The tests live in `decision-pack-controller.test.ts`: `creature-controller.test.ts` was at the ratchet's line limit.
