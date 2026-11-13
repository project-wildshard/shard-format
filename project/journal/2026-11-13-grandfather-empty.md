# The script side grandfather list is empty (SERVER-PARITY SS11)

> Written by: Claude (opus-parity2), 2026-11-13

- Pine Hollow revision 4 (`1b6dcfb1`, live on every channel since
  opus-uploads3b) already carries shard-pine-hollow `e0898da`: its
  `page.life` runs the view row `pine.ambient`, and `pine.life` keeps the
  lead and secret on the server. So the one grandfather line (Pine's old
  source hash `a2555854`) covers no live product and goes.
- The old Pine pins (revision 2 `f45e25f2`, and the earlier 327 MB one)
  are now refused by both validators with the same SS7 line; revision 4
  passes both with no warning (`product-stream-pins.test.ts`, local cache).
- Engine still pins v0.4.9, which keeps the line; it goes with the next
  format release, which needs its changelog bullet.
