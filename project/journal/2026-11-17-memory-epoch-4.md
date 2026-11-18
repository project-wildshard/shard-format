# Memory epoch 4: the estimate on EM11's phone chain

> Written by: Claude (lane mini-estcal2)
> **State:** 2026-11-17, MEMORY-GATES MG6 (J408, J410). Model in `src/format/boot-memory-cost.ts`; the paired table is
> `src/format/memory-calibration.golden.json`, held by `memory-calibration.test.ts`.

Epoch 3 charged a boot at max(Chromium renderer x2.0, 2.5 x a runtime home's Simulator reading). By the time the
engine's own meter landed (ENGINE-MEMORY EM11, `phone-model.json`, refit at 2048 MiB in engine `72e30a23`), that put
Pine at 2,276 MB while EM11 read it at 1.5-1.7 GB loading and 1.1-1.2 GB playing, so the gates refused zones the phone
runs and no Pine cut could reach MG9's close.

**The pairs.** Engine main `6b432a2a` with all 27 catalogue pins, `scripts/memory/measure.mjs` on the Mac mini, headless
Playwright WebKit as a phone at Low, cold: 3 runs per zone, 2 per Open Plots plot (64 runs, 23:15-23:55 Cancún). Each run
goes through EM11's chain; the estimate is held to the highest run's upper bound, settled (playing) and peak (loading).

**The model.** Per phase, phone bytes = engine + weights x the product's terms:

| Term | What it reads | Playing | Loading |
| --- | --- | --- | --- |
| engine | constant | 710 MB | 910 MB |
| content | every file's wire + CPU-decoded bytes (audio aside), commons, decoded mounted images | 0.5 | 0.8 |
| textures | image + KTX2 GPU bytes, commons GPU, mounted images (data shards only) | 1.3 | 2.4 |
| gl | a runtime home's paired GL reading | 1.5 | 1.4 |
| geometry | GLB + binary GPU bytes | 0.2 | 2.6 |
| sims | declared `max(budgets.sim.resident, serverBudget.memory)` | 1 | 1 |

A runtime home is also held at or over its own Simulator reading settled, and 1.26 x it loading (EM11's lowest peak
over settled); no pinned home binds there. A runtime home's textures are its GL reading because its files carry every
tier's variants: Pine ships 704 MB of texture bytes and holds 65 MB of textures on a phone at Low.

The fit is minimax over the 27 pairs, then least total overshoot, with two verdict constraints: a product EM11 puts
under the 1.0 GB playing envelope or under the 1.5 GB line stays under it here. The content weight is held at 0.5 and
0.8 or more so bytes a boot downloads always count. The runtime reading's own weight fitted to zero: content, GL and
geometry carry the homes.

**Result.** Every zone is at or over its EM11 upper bound. Estimate over that bound has a median of 1.19 and a maximum of
1.29 (Saltwind Lighthouse, playing). Sunscar Dunes sets the engine term: it holds ~40 MB of decoded bitmaps and reads
~180 MB over Template at loading on the same terms, so the light zones carry ~20% over. In MB, playing / loading against
EM11's bound:

| Zone | Estimate | EM11 upper bound | Epoch 3 loading |
| --- | --- | --- | --- |
| Nine Dragon | 1,454 / 2,178 | 1,367 / 2,178 | 2,017 |
| Pine Hollow | 1,547 / 2,066 | 1,240 / 1,738 | 2,266 |
| Nalati | 1,400 / 1,804 | 1,281 / 1,683 | 2,260 |
| Driftwood | 1,165 / 1,589 | 1,165 / 1,434 | 1,894 |
| Far Reach | 996 / 1,489 | 953 / 1,305 | 1,185 |
| Sunscar Dunes | 831 / 1,143 | 830 / 1,140 | 972 |
| Template | 777 / 1,050 | 700 / 958 | 948 |

One verdict differs: Driftwood's loading estimate is over 1.5 GB though EM11's bound (1,434 MB) is under it. No linear
model of these terms covers Sunscar Dunes, Nalati and Nine and lets Driftwood under; the test names it.

**Epochs.** `MEMORY_EPOCH` is 4. Epoch 4 changes how a reading is converted, not how it is taken, so readings from epoch
3 on stay current (`OLDEST_CURRENT_EPOCH`): the four homes' epoch-3 readings need no re-measure. With those mains'
readings (smaller GL than the pinned products' epoch-1 readings) the homes estimate 1,089-1,363 MB playing and 1,518-2,093
MB loading.

The epoch-2 grid terms stay for runtime admission, which passes no boot. Offline gates now read EM11's phase figures
only, so a shard's declared library caps no longer raise its offline estimate; its declared sims still do.
