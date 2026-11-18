# Memory epoch 5: clean EM11 and only the files a phone fetches (mini-em11b, MEMORY-GATES MG6, 2026-11-18)

> Written by: Claude

Epoch 4 (`2026-11-17-memory-epoch-4.md`) fitted the offline estimate to ENGINE-MEMORY EM11 read through Playwright with
the Web Inspector's Network domain on, which keeps every response body in WebKit (60 MB on Template, 168 MB settled and
287 MB at peak on Nine; engine journal `project/journal/2026-11-18-inspector-cost.md`). Engine `c3776b0d` refits EM11
on readings with that domain off. Against the clean bounds, epoch 4 read Pine at 1.39x / 1.46x (playing / loading) and
Sunscar Dunes under its loading bound (1,143 vs 1,170 MB), so the weights are refitted here.

## What changed

1. **Only the files a phone fetches.** mini-pinemem2 (meta `95a75759`) found a phone Low boot of Pine fetches 141 of its
   330 MB and none of its 99.6 MB of mounted images, while epoch 4 counted every tier's files. `phoneInactiveFiles`
   (`phone-files.ts`) runs tier selection's own verdict (`tierLibrarySteps(source, 'phone', ...)`, the selection the
   engine's boot uses) and the terms leave those files out. Callers with the output index pass it
   (`validateShardfileFolder`, `performanceReport`, the golden generator); without one, every file counts as before.
   A runtime home's mounted images are left to its paired reading; a data shard still counts them (Far Reach decodes
   107 MB of them). Pine's content term falls 459 to 321 MB, Driftwood's 284 to 174, Nine's 402 to 376.
2. **Weights refitted** minimax to all 27 pinned products' clean EM11 upper bounds (engine `037d9f15`, 64 cold WebKit
   runs, instrument minimal), then least total overshoot, content held at 0.5 / 0.8 or more:
   engine 696.8 / 982.3 MB, textures 1.461 / 1.786, GL 1.771 / 1.349, geometry 0 / 1.977.
3. `MEMORY_EPOCH` 5. Readings are still taken as in epoch 3, so `OLDEST_CURRENT_EPOCH` stays 3 and no home re-measures.

## Standing

Every zone at or over its EM11 upper bound; max 1.31x (Open Plots' Saltwind, playing; `CEILING` 1.3 to 1.31, because the
light zones fell ~60 MB clean and Dunes, which sets the engine term, did not). Verdicts at 1.0 GB playing and 1.5 GB
loading match EM11's except Pine's loading: Nalati's bound (1,603 MB) is higher than Pine's (1,411) though every Nalati
term is smaller, so no linear model of these terms covers Nalati and lets Pine under. Driftwood, refused in epoch 4,
now passes loading (1,446 MB). Estimate playing / loading, MB, epoch 4 then 5 (EM11 upper):

| Zone | Playing | Loading |
| --- | --- | --- |
| Nine | 1,454 → 1,379 (1,148) | 2,178 → 1,969 (1,969) |
| Pine | 1,547 → 1,426 (1,117) | 2,066 → 1,774 (1,411) |
| Nalati | 1,400 → 1,325 (1,203) | 1,804 → 1,634 (1,603) |
| Driftwood | 1,165 → 1,136 (1,136) | 1,589 → 1,446 (1,404) |
| Template | 777 → 763 (684) | 1,050 → 1,103 (971) |
| Far Reach | 996 → 1,000 (911) | 1,489 → 1,450 (1,153) |

The streamed validator (api-server path, `shardfile-stream-admit.ts`) passes its index too. It still has no mount
bytes in the stream, so it leaves out a data shard's mounted images (Far Reach-only today, as in epoch 3).
