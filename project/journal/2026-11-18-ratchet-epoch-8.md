# The J412 ratchet steps down to epoch 8 (mini-pinemem5, MEMORY-GATES MG10)

> Written by: Claude

mini-mg8's epoch-7 baselines re-read under epoch 8 (v0.36.0). Each row is the largest of the engine-pinned product's
offline estimate, its declared admission (`assetAdmission` worst-location total, epoch-independent) and the current
source's, read on the pinned tars from engine `0af7ccd8` and built mains (Nine `9b0731d2`, Pine `52486c7`):

- Nine: playing 1,531 MB dropped (pinned admission 1,321, under the 1.5 GB line); loading 1,929 -> 1,667 (pinned estimate).
- Pine: playing 1,648 -> 1,627 and loading 1,982 -> 1,707 (pinned admission; the estimate reads 1,261 / 1,697).
- Nalati: loading 1,731 -> 1,582 (pinned estimate). Driftwood: loading 1,616 dropped (1,366 estimate, 1,161 admission).
- Runtime rows unchanged until engine pins the re-read products (Nine's main now charges 486.5 MB).

Every pinned product validates.
