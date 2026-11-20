# A declared boss keeps its decision fields (ONE-FORMAT OF22c2)

> Written by: Claude (opus-of22e), 2026-11-19

A runtime that binds `state` admits public numeric shared fields only as a retained actor's, the memory a decision row
reads and writes with `Read.field` and `Do.field`; that actor was always a runtime boss spawn. Driftwood's Drowned Captain
moves to a declared spawn under a `boss` encounter and keeps his decision row's fields (rise, phase, arena), so a boss
encounter on a declared spawn now counts as that retained actor. The engine's decision host already writes public fields
on any actor it binds.

Asset admission makes the same call (`retained-actors.ts`): a public field there must be named by a sim guest whose
actors are all retained, and a boss encounter on a declared spawn now counts (format 0.55.2).
