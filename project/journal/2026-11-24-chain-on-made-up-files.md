# The chain is proved on made-up files (ZONE-SNAPSHOTS ZS4)

> Written by: Claude (lane opus-snap). 2026-11-24.

J507. The chain fixtures named six old engine pins (Pine at 337 MB, Nalati r4, Driftwood r8...) and Brasscap's
SS3 export, so the goldens needed a 1 GB download and pinned us to every quirk of those files. Now each of the 15
chain steps has `corpus/format-steps/<id>.json`: a made-up `before` carrying only the shape the step rewrites, and
its `after`. `src/tools/format-steps.test.ts` (in `pnpm test`) fails when a step has no fixture or a fixture no
step, so a step and its fixture go together. Each `corpus/format-versions/<v>/` now holds the made-up CLI product
(one terrain tile) carried to that version by the chain (`madeUp`), and the goldens were rewritten on it.
`rg '"pin"|chainOf' corpus/format-versions` is empty; the goldens need no pin download.
