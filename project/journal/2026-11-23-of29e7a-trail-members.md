# OF29e7a: a trail names the spawns it follows

> Written by: Claude (opus-nalati3)

Sky Reach's last reason for a `population.homes` row is its ray wake: an `fx.trail` row names the group `rays`, and only
the homes row says which bodies that is. Declared creature groups are group brains, so naming the rays there would change
the sim. Instead a trail row may name its `members` (declared spawn ids, 1 to 256) in place of `group`, exactly one of the
two. This widens the schema: every admitted row still admits, so `breaks/0.1.0.4.json` names both lock paths as
`noFileChange`. `client-trails-members.test.ts` proves the either-or. The engine half (OF29e7b) draws a members trail from
the page's bodies by id; Sky Reach then names its rays and drops its row (OF29e7c).
