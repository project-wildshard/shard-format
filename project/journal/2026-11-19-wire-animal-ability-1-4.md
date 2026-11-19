# Wire 1.4.0: a creature's running ability (opus-of-m23)

- ONE-FORMAT CC11a2c: a page picks a creature's attack clip from the declared ability it is running (its clip map's
  `abilities` entry, or the ability's own `clip`). The server knew it; a page only had the attack scalar. `animal` gains
  `ability` (32, U8: the 1-based place in its species' `abilities` list, 0 for none) and `abilityT` (33, 0..1: how far
  through it is), `since: 4`, so a late-joining page and a continuing one pick the same clip until the strike ends.
- An index, not the strike id: a delta row stays one byte, and every page already holds the species rows.
- A room older than 1.4 sends neither, and a newer page reads 0: no running ability, so it keeps the attack fallback.
- The lock diff is the two fields plus `wireMinor` 4, `rowFields` and `v0SchemaHash`; `wire-v1.4.0` publishes it.
