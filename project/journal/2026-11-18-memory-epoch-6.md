# Memory epoch 6: the estimate follows the engine through a sweep and a refit (mini-sweep, MEMORY-GATES MG6, 2026-11-18)

> Written by: Claude

## The question

Does the offline estimate's engine term follow engine improvements, or is it frozen at its fit engine? **Frozen.** The
estimate is `engine + weights x terms` (`bootPhoneBytes`). The terms are the product's alone: file wire and decoded
bytes, texture and geometry GPU bytes, declared sims, and a runtime home's `runtimeCost.json` reading. The engine term
and every weight are what one engine build does with those bytes, fitted to one EM11 sweep (epoch 5: engine
`037d9f15`). An engine cut therefore moved no estimate until someone refit by hand, and the refit had no tool: the
EM11 readings were typed into `memory-calibration.golden-gen.mjs` and the weights solved off-repo.

## The fix

1. `memory-em11.mjs` turns an every-zone sweep (engine `scripts/memory/measure.mjs --runs=1` files, cold native WebKit,
   instrument minimal) into `memory-calibration.em11.json` through the engine's own EM11 chain (`phoneModel.mjs`):
   per zone the median run's central figure and the highest run's upper bound, and the build it was read on.
2. `memory-fit.mjs` fits `PHONE` from that file and the golden's terms: per phase, minimax of estimate / upper bound
   with every estimate at or over its bound, content held at 0.5 / 0.8, EM11's verdict kept at 1.0 GB playing and
   1.5 GB loading unless `--exempt` names a zone; then least total overshoot at that ratio; the engine term is re-derived
   after rounding so no zone drops under its bound. It reproduces epoch 5 from epoch 5's readings (engine
   696.76 / 982.76 MB, textures 1.461 / 1.779, GL 1.771 / 1.345, geometry 0 / 1.980).
3. The golden-gen reads the EM11 file and stamps its build; `memory-calibration.test.ts` holds the golden to that file.
4. Cadence: refit at every engine release, and after a memory cut that should reach the gates.

A runtime home's own reading (`runtimeCost.json`, Simulator, epoch 3) still freezes at the engine it was read on; the
refit's GL weight absorbs part of that, and a home re-measures when its reading goes stale.

## The sweep

Engine main `50092092` (`e0c33f79` Nine far levels after the loader, `03382d5d`, `af4b2851`, `ea42b301`, `08f3d688`)
with all 27 catalogue pins, Mac mini, headless Playwright WebKit as a phone at Low, instrument minimal, model
`c3776b0d`: 99 cold runs, 02:25-02:46 Cancún, zone order flipped each round. Six runs each for Nine, Pine, Nalati and
Driftwood, four for Template, Far Reach, Dunes, Brasscap and both Showcase zones, three per Open Plots plot. More runs
than epoch 5's three widen the upper bounds where JavaScriptCore's collection timing moves the peak: Pine's loading
peaks read 1,378-1,711 MB upper, Driftwood one settled run at 868 MB WebContent against ~730.

## Epoch 6

`PHONE`: engine 739.59 / 958.997 MB, content 0.5 / 0.8, textures 0.6696 / 2.2211, GL 2.2214 / 1.9312, geometry 0 / 0.68.
Ratio playing 1.343 (Pine, Open Plots' Saltwind and Patchwork), loading 1.197; `CEILING` 1.31 to 1.35. Every verdict
matches EM11's with no exemption (epoch 5 refused Pine's loading over EM11's; six runs put Pine over the line on EM11
too). Driftwood's loading estimate is 1,499.999 MB, under the line by the verdict constraint. Estimate MB, epoch 5 to 6
(EM11 upper, epoch 5 to 6):

| Zone | Playing | Loading |
| --- | --- | --- |
| Nine | 1,379 → 1,547 (1,148 → 1,170) | 1,969 → 1,905 (1,969 → 1,905) |
| Pine | 1,426 → 1,612 (1,117 → 1,200) | 1,774 → 1,870 (1,411 → 1,711) |
| Nalati | 1,325 → 1,489 (1,203 → 1,198) | 1,634 → 1,731 (1,603 → 1,658) |
| Driftwood | 1,136 → 1,266 (1,136 → 1,266) | 1,446 → 1,500 (1,404 → 1,442) |
| Template | 763 → 793 (684 → 671) | 1,103 → 1,065 (971 → 1,015) |
| Far Reach | 1,000 → 926 (911 → 925) | 1,450 → 1,448 (1,153 → 1,210) |
| Sunscar Dunes | 826 → 818 (826 → 818) | 1,170 → 1,163 (1,170 → 1,163) |

Nine's loading falls with the engine cut (1,969 → 1,905 MB). The heavy zones' playing estimates rise: Driftwood's
widest settled run sets the GL weight that every runtime home's reading carries.
