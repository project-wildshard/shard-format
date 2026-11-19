# Wire 1.3.0: a creature's road place (opus-mp5)

- MMO-PLAN MP5.2b: under zone entry (J352) the road shows each seat its home cell's creatures near the home edge. The road's
  frame 0 is the world's, past `animal.x`/`z`'s ±260 m, so `animal` gains `roadX` (30) and `roadZ` (31), sent to all as the
  row's other fields are, over ±2,048 m in 16 bits, `since: 3`; player 58/59's twins (wire 1.2.0). The lock diff is the two
  fields plus `wireMinor` 3, `rowFields` and `v0SchemaHash`; the cross test's old client skips them both ways.
- `wire-v1.3.0` publishes it; engine's pin is MP5.2b.
