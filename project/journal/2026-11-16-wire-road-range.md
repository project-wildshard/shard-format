# Wire 0.1.1: the road's range (opus-mmo1)

- MMO-PLAN MP1.5. The MMO server has its road (engine GC15 `roadRoom.ts`), whose frame 0 is the world's: about ±1,390 m across the
  5 by 5 grid. `player` x/y/z are `METRES`, ±260 m, so every seat on a road more than 260 m from (0, 0) reached other pages pinned at
  the clamp. Changing their node is a major; instead `player` gains `roadX` (58) and `roadZ` (59), `send: 'others'`, over ±2,048 m
  in 16 bits (6.25 cm). Additive under WIRE-STABILITY 5.5: an older peer skips them; a newer one reads zero from an older server.
- The lock, the v0 hash pin (408870210) and the baseline's added list move; the package goes to 0.1.1 (`wire-v0.1.1` publishes it).
