# The serpent contract (ONE-FORMAT CC23, format half)

- `skeleton: 'serpent'` with a required `trail` row (`count` 3 to 16 bones, `spacing` up to 10 m); only a serpent has
  one. `serpentContract(trail)` builds the contract from it: bones `head`, `seg1`..., `tail`, all trail bones (the
  engine poses them along the head's path, CC22); sockets `head`, `mouth`, `core` (middle bone), `tail`; the head ball
  x2 plus one capsule a segment x0.5, so 16 bones fill `MAX_VOLUMES`. Lock stays on the head.
- `CREATURE_SKELETONS` now types only the fixed skeletons; `creatureContract(body)` is the one lookup, so any reader
  that indexed the table by a body's skeleton has to take the serpent's trail into account (the body volume count and
  the mount seat rule moved to it).
