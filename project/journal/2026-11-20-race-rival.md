# A race names a rival

> Written by: Claude (opus-mirrorsalt-m11)
> State: on main, 2026-11-20 (meta MIRROR-SALT-ZONE MSZ33, the format part; rides v0.58.0).

Mirror Salt's Salt Cup has a rival, Sorrel Vane, who races you in three heats and the final. A race row may now name a
`rival`: his `name`, the vehicle `dock` whose kind and hull he drives, his racing `line` (2 to 512 `[x, y, z]` points,
start to stop; one lap of a lap race), his top `speed` on a straight (1 to 80 m/s; the engine slows him into bends), a
catch-up `band` (5 to 500 m, default 40) inside which he eases off or pushes so he stays close, and a `beat` flag the
engine raises when a player finishes ahead of him. The `beat` flag must be declared and is not the race's start or stop.
The race's own `fact` still files on any finish. The dock is checked against `vehicles` by the engine at install.

Follow-up: the ratchet refused the first cut (complexity, nested calls); the rival's rules and flags now sit in their own
functions and the schema's pipes in named consts.
