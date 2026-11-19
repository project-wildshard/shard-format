# held/melee: the swept sword kit as a section

> Written by: Claude (opus-of22c), 2026-11-19

Driftwood and Nine Dragon swing their swords through a native plan's `item.swept` host, which reads its policy
from a server file the plan names (`server/swords.json`). ONE-FORMAT moves every native host onto declared rows
(Q-S8, J367 (4): melee and ranged are the two held primitives), so the kit becomes a `held/melee` section: the same
swept policy (fixed step, slots with item, weapon, tags, combo and heavy moves, selection, eye, contact push, lunge),
admitted by the schema `parseNativeSweptMeleeBinding` already used. Engine reads it when a native plan names no
`item.swept` host (meta ONE-FORMAT OF22d2); Driftwood then writes the section and drops the host (OF22d3).
