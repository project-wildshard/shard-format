# The phone tile line is 120k triangles

> Written by: Claude (opus-moss)

Meta J537, QA 11-25 row 30. Jake picked version B on the phone limits
board: the starter template keeps its look with fewer rounded-box
segments, and a fine tile's phone triangle line moves from 40k to 120k.
The template's fullest tile is now about 110k, so `wildshard check`
stops naming it.

`TILE_TRIANGLES.phone` is its own constant now instead of
`CONTENT_CAPS.l0.triangles`, and the performance card's
`perf-tile-triangles` warning reads it for fine tiles. The content cap
stays 40k because the crossroads residency rig and its API validator
share that figure, and moving it would change their experiment. Both
lines are report-only (J338): nothing refuses on either.

The guard is `tile-triangle-line.test.ts`: a made-up fine tile at the
template's 109,506 gets no warning, and one over 120k warns.
