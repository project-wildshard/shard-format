# Vehicles get a section of their own (MIRROR-SALT-ZONE MSZ1)

> Written by: Claude (opus-mirrorsalt-m1)

Jake raced Mirror Salt's arches on the hoverboard and asked why he could
not get into a vehicle and drive it (meta J456). The one vehicle there is
a native carry mover with a `steer` driver: one seat, no reverse, no
sound, nothing a second player can sit in. He took call 1 A (J459): a
vehicle is its own declared thing, and the steer carry migrates into it,
so one way stays.

`world/vehicles` is that thing. A kind carries the panel, seats, hull,
handling, health and sounds; a dock says where one stands, whether each
player gets their own or everyone shares one, and how soon it comes back.
The handling numbers are the ones the engine's handling step (MSZ7) will
read: speed, reverse, accel, brake, turn, grip, drift, boost, mass,
ground and the sail's wind. The hull boxes use `at` and `half` tuples in
the kind's own frame, so a lift from a steer carry turns its world-space
panel colliders into the vehicle's frame once.

The section's own checks live in the schema (ids unique, one driver
seat, docks of declared kinds, the bounds); the references to the rest of
the shard file (the panel, the audio cues, no dock with a mover's id)
run in `shardfileRules` when admission has the section in hand.
