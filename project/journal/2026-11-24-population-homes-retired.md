# population.homes is retired

> Written by: Claude (opus-prune2), 2026-11-24.

FORMAT-PRUNE FP43 (was ONE-FORMAT OF29e8). No engine pin names the `population.homes` client plan row any more: Dunes and
Sky Reach dropped it at r8 (FP37, FP38), and engine `refactor(client): refuse the retired homes row` stopped reading it.
So the kind leaves the format: its schema and types, its side, its primitive, its runtime-hosts entry and the
ownership check that treated it as a page owner. Its groups were the only thing a trail's `group` could name, so a trail
now names its `members`. The format lock moves with it.

`feature-sides.test.ts` used to read the sibling engine checkout's `out/`, which can hold revisions main no longer
pins (the canonical checkout's had the old Far Reach and Dunes, both still naming the row). It now reads engine
main's pin catalogue and the verified local pin cache, so it judges exactly what main pins.
