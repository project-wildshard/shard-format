# Spawn rows scale with players and wait for conditions (opus-of-m4, ONE-FORMAT OF28b, OF28c)

- `count: { per, max }` (Q-CC35 (b)): one row grows by one creature per `per` players in the cell, up to `max`.
  A row's ceiling times its size class's cell weight may not pass 16 (16 medium, 4 large, one giant), and the
  entity capacity check counts every row at its ceiling.
- `when: { quest, time, wave }`: from a quest stage on, only by day or night, or as wave `index` of a `set`.
  Unknown keys refuse as `unknown spawn condition`, unknown times as `unknown spawn time`. Respawn timers and group
  mix were already `respawn` and `group`. The engine honours none of this until OF29; rows without them parse
  byte-identical.
