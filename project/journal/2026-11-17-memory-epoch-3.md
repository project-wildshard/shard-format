# Memory epoch 3: calibrate the estimate on the phone-tier probe

> Written by: Claude (lane mini-estcal)
> **State:** 2026-11-17, MEMORY-GATES MG6 (J408, J410). Model source on this commit; the paired table is
> `src/format/memory-calibration.golden.json`, held by `memory-calibration.test.ts`.

The epoch-2 estimate let Nalati (1,412 MB) and Driftwood (1,484 MB) under the 1.5 GB line while the probe predicted
2,239 and 1,604 MB on the phone (loading renderer x2.0, engine `3cd2dd87`, MG11). Re-probing the pinned products on
the mini (v0.1.36 preparation client, Low, phone tier) with the renderer's allocator dumps and page counters:

| Zone | Renderer peak MB | ArrayBuffers | Decoded audio | Bitmaps | Worker V8 | Main V8 |
| --- | --- | --- | --- | --- | --- | --- |
| Nalati | 1,159 | 531 | 142 | 19 | 501 | 165 |
| Pine Hollow | 1,053 | 442 | 55 | 4 | 564 | 191 |
| Nine Dragon | 831 | 246 | 0 | 12 | 383 | 202 |
| Driftwood | 718 | 276 | 32 | 9 | 169 | 157 |
| Far Reach | 578 | 127 | 0 | 107 | 304 | 126 |
| Sunscar Dunes | 596 | 129 | 0 | 43 | 573 | 105 |
| Brasscap | 360 | 100 | 0 | 0 | 111 | 91 |
| Template | 435 | 64 | 0 | 4 | 464 | 74 |
| Ink Cel | 364 | 37 | 0 | 4 | 388 | 69 |

V8 columns are committed heap, not footprint. What the model missed:

- **Runtime homes lost their pre-entry set.** `runtimeAccountedBytes` subtracts `residentBaseMB` (Nalati 685, Pine
  671 MB) instead of the 299 MB engine, but the renderer's ArrayBuffers stay at their peak after ready, so that set is
  live at the boot peak. The offline gates now charge from the engine base (`runtimeOfflineBytes`).
- **The CPU side scales the phone twice.** The phone line is the renderer x2.0, and the renderer holds each file's
  download and its decoded copy (not its GPU upload). Nalati also downloads its binaries twice (52 MB served for 28 MB
  of `binary` files: two readers) and decodes 142 MB of sample PCM. The boot floor is now 2.0 x (420 MB empty-product
  renderer + every client file's wire + its CPU-decoded bytes, audio aside + the decoded engine images the cook mounts).
- **Mounted engine images were never charged.** Far Reach decodes 107 MB of bitmaps at boot; 81 MB are its mounted
  sky and terrain images. The folder validator now sums them (`mountedImageBytes`); the streamed validator does not
  read mount bytes yet, so the API path lacks this term.
- **A runtime home's own reading** bounds it too: the probe's phone over the paired Simulator WebContent + GL reading
  is 2.48 (Nalati) and 2.44 (Pine), so the floor takes 2.5 x that reading.

Loading = max(epoch-2 terms with the engine-base runtime charge, the boot floor). Against MG11's table every zone is at
or over its measured peak: Nine +1%, Nalati +1%, Dunes +1%, Brasscap +4%, Far Reach +5%, Pine +9%, Pastel +10%,
Template +12%, Driftwood +18%, Ink Cel +20%, Open Plots up to +26.5% over the range's top (796 MB). Brasscap (925 MB)
and Open Plots plots with the same terms bound any conservative model to at least +16%, and one-run noise is large
(Brasscap's renderer read 462 MB in MG11 and 360 MB here). The test holds every zone at or over its peak and under
1.3x. The Simulator disagrees with the probe on Nalati (1.06 GB WebContent + GPU, below Nine's 1.35): the probe's
x2.0 is a floor from one Nine crash, not a fit, so re-calibrate when a phone reads Nalati.

Epoch 3 stales every runtime reading taken before it (MG5): Nine, Pine, Nalati and Driftwood re-measure.
