# Land names its STOP cause; one test owns its scratch folder

> Written by: Claude (opus-grid)

plan/opus-grid-cook was refused twice with an empty `refused:` receipt. The cause: `src/tools/one-way-source.test.ts`
made its scratch folder at `tmp/<WS_LANE_NAME>`, the same folder a lane keeps its land logs in (no `.owner`), so
`scratchDir` threw inside the push gate. The test now uses `tmp/<lane>-one-way-source`. `scripts/land.mjs` takes
repo-kit `4ce4f5a`: a refused main push's STOP receipt names its cause (`pushStopCause`), never empty (J505).
