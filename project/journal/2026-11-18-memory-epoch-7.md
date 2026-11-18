# Memory epoch 7: EM11's upper bound is a 90% prediction bound (mini-em11c, MEMORY-GATES MG6, 2026-11-18)

> Written by: Claude

## The question

Six runs per heavy zone widened EM11's upper bounds over epoch 5's three (Pine loading 1,411 -> 1,711 MB), and the
estimate is fitted at or over those bounds. A bound that widens as runs are added punishes measuring more. Epoch 6 read
a zone's upper as the highest run's high: that maximum is a distribution-free prediction bound whose coverage is
N/(N+1), 75% at three runs and 86% at six, so it widens because it asks for more each time.

## The change

Engine `upperOverRuns` (scripts/memory/phoneModel.mjs, EM11c; journal `2026-11-18-em11-upper-bound.md`): the
one-sided 90% prediction bound on one more cold boot's high, mean + t90(N-1) x sd x sqrt(1 + 1/N) over the runs' highs.
Each run's high stays the model's upper end, the two families at the ends the v0.1.36 anchor allows; an engine test
holds that the bound reads the anchor's death window over the line. `memory-em11.mjs` now calls it (and refuses an
engine checkout without it) and stamps `"upper": "p90-prediction"`. `memory-fit.mjs` keeps a kept verdict 50 kB under
its line, so rounding can no longer carry Driftwood's loading estimate over 1.5 GB (it refused by hand otherwise).

## Epoch 7

The same 99 runs (engine `50092092`, mini-sweep) read with the new bound move every upper by under 2%: the widening
was the runs, not the statistic (Pine's loading centrals read 1,231-1,580 MB over six cold boots; three of them would
bound it at 1,738). `PHONE`: engine 730.889 / 968.046 MB, content 0.5 / 0.8, textures 0.8518 / 2.2277, GL 2.1475 /
1.8758, geometry 0 / 0.7399. Ratio playing 1.313 (was 1.343), loading 1.197. Every verdict still matches EM11's.

| Zone | Playing est / upper (epoch 6) | Loading est / upper (epoch 6) |
| --- | --- | --- |
| Nine | 1,518 / 1,175 (1,547 / 1,170) | 1,908 / 1,908 (1,905 / 1,905) |
| Pine | 1,580 / 1,203 (1,612 / 1,200) | 1,864 / 1,723 (1,870 / 1,711) |
| Nalati | 1,461 / 1,207 (1,489 / 1,198) | 1,727 / 1,678 (1,731 / 1,658) |
| Driftwood | 1,243 / 1,243 (1,266 / 1,266) | 1,500 / 1,452 (1,500 / 1,442) |
| Far Reach | 944 / 933 (926 / 925) | 1,460 / 1,220 (1,448 / 1,210) |
| Sunscar Dunes | 821 / 821 (818 / 818) | 1,173 / 1,173 (1,163 / 1,163) |
| Template | 787 / 674 (793 / 671) | 1,075 / 1,027 (1,065 / 1,015) |

## Why the heavy zones' playing estimates stay ~1.3x over

The form cannot do better. Only the four runtime homes carry GL bytes, and Driftwood, the lightest of them (GL 194 MB),
reads the highest playing bound (1,243 MB, from one 868 MB settled run). With the engine term held down by Far Reach and
Dunes under 1.0 GB (about 734 MB), even with no content weight the GL weight must be at least (1,233 - 734) / 194 =
2.6, which puts Pine (GL 316 MB) at 1.55 GB or more against its 1.20 bound: the content floor at 0 moves Pine only 1.31
-> 1.30. Closing it needs a term that tells Driftwood from Pine, or Driftwood's settled outlier gone from its runs.
