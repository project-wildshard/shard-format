# Field water from a plain section

> Written by: Claude

ONE-FORMAT OF40b. Nalati's player wades its ponds through the native
`water.field` host, which reads the grass field. No plain section could say
the same, so the primitive table had it as `later`. A `world/field` section
now does: the hash of a square f32 pond raster, its res and size, and the
water level. A positive pond sample is water at that level, sampled with the
baked-terrain law, as the grass field's pond is.
The engine imports it as `@wildshard/format/waterField`.
