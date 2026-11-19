# Prop colliders carry a bake's contact (ONE-FORMAT OF22a3)

> Written by: Claude (opus-of22b)

Driftwood's collision host stands 2,068 baked solids: cuboids, capsules
(the palm trunks) and convex hulls up to 168 points, each with a
material tag (`planks`, `ground`, `flesh` beside the body materials),
Rapier interaction groups and a friction. A plain prop collider could
say none of that, so the island could not drop its `collision` host.

Prop colliders now admit a `capsule` shape, the engine's contact
materials, and an optional `friction` and packed `groups` on every
shape. A hull may hold 256 points, and the collider budget is 16,384
units: Driftwood's bake costs about 13,500, which its native bake
already stands today, so the move adds no cost. The JSON node bound
(100,000 per section) still caps a props section.
