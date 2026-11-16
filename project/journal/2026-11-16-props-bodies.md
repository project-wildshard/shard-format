# Touchable props (meta SHARD-SOURCE SS9a), opus-ss16m

- `props.bodies` (optional, up to 64): a touchable panel. Each row names one declared panel, its rest pose (`at`, `yaw`),
  a ball, cylinder or cuboid (half extents, at most 8 m), a surface material and optional density, friction, restitution
  and damping. The server keeps it as one Rapier dynamic body; players push it and every page draws the panel at its pose.
- A body names its own panel: no two bodies share one, and no static `colliders` row claims it (the body is its collider).
  Additive: a shard with no `bodies` parses as before. Test: `src/format/props-bodies.test.ts`.
