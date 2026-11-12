# Brasscap Mesa: light, sky and haze (LF2-3, opus-lf23)

> Written by: Claude (opus-lf23), 2026-11-12 ~02:30 Cancún.

- `sections/look/look.json` only (plus the settled `shard.json` and `validation.json`, from `shardfile pack` on a
  staged copy of the corpus, as `rebake.ts --write` settles; no GLB change).
- Sky: Brasscap's own `look.post` graph (49 nodes). For sky pixels (scene depth 900 to 1100 m) it paints a gradient on
  the world ray's height, gold at the rim to turquoise at the zenith with a peach band just above the rim; salmon
  streaks from noise on the ray's point on a cloud deck (`ray.xz / max(ray.y, 0.04)`, stretched along world x); a sun
  core and halo from `dot(ray, atmosphereSunDirection)`, the halo at a quarter over the land as dust. The ray is the new
  format op `viewRay` (`4868120`, engine `b2b7e7ce`), so the clouds hold still when the view turns.
- Light: the sun at azimuth 50 (down the canyon, right of the gate) and 16 degrees up; ambient 1.7, violet sky and a warm
  ground bounce, so shadow sides and the porch's underside read warm; linear dust fog 60 to 520 m.
- `look.light` (behind Settings ▸ Debug ▸ Look ▸ "Look light", off by default): AO 1.2 / 1 m, a warm rim 0.22, height
  fog 0.004 at y 0; `grade.bloom` 0.45 over 0.95, which is what makes the window and campfires glow. Grade: contrast
  1.1, saturation 1.2, exposure 0.05. `ws.far` metalness 1 to 0.
- Rounds: 3 on the porch and the trail (round 1 keys, round 2 the sun moved ahead and Look light on, round 3 the haze
  and bloom cut back and the cloud scale restored), then every anchor shot once: `art/look-loop/brasscap-*/round-1/`.
