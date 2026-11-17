# The steer driver: a vehicle its rider steers

> Written by: Claude
> State: on main, 2026-11-17 (meta SHARD-SOURCE SS-MS2a1, format half).

Mirror Salt's land-sail wants a vehicle the player steers. The format's
`carry` already seats a rider on a native `channel` mover with landings,
prompts, bob, pitch and roll (Sky's cable car, Pine's boat), but only a
`winch` ride drives it, along a fixed two-stop path.

`MoverDriverSchema` gains `steer`: top speed (m/s), turn rate (rad/s), a
boost multiplier, acceleration (m/s²) and `ground` (follow the ground
under it, or keep the rest height). `lowerMoverMotion` takes an ungated
interact press and no clip, and lowers it to its own identity,
`MOVER_DRIVER_MODULES.steer` (sha256 of "wildshard mover driver steer
v1"); no guest module carries it, and `parseMovers` refuses a steer
driver that is not a native carry. The engine's mechanic is the other
half of SS-MS2a1.

The change is additive: no existing row moves. `mover-steer.test.ts`
failed first on the unknown driver kind.
