# The armed-zone list (mini-pinemem5, J424 / J426)

> Written by: Claude

J424 made every memory gate report-only; J426 (Jake, ~12:55 Cancún: "get the shard passing the memory gate and then to
LOCK THE GATE IN. And make it fail hard / mandatory") arms a zone's gates once it is under the J410 lines.
`src/format/memory-armed.json` is the one list (shipped in the package; engine's ledger, footprint and boot guards read
the same file). The J412 ratchet functions are the one choke point every memory gate already went through, so they now
ask the list: an armed zone refuses over the line, whatever the policy or memoryGates.json's report-only switch; any
other zone reports, J412 baseline or not.

- Offline estimate (check, validate, cook, upload): an armed zone answers to the J410 lines, 1.0 GB playing and 1.5 GB
  loading; others report over J408's 1.5 GB.
- Declared worst-location total (performance report, admission): an armed zone refuses over J408's 1.5 GB. Not the
  J410 1.0 GB: Driftwood's declared playing ruler reads 1,070 MB while its calibrated estimate reads 821.
- Runtime tier and stale runtime reading: refuse an armed zone only.

Driftwood arms first, at its epoch-8 estimate of `e736730`: 820.9 / 1,157.5 MB (codex-nalati's locked pairs read
990.5 / 1,344.7 MB on the EM11 upper). `memory-armed.test.ts` shows an over-the-line Driftwood refusing and Nine reporting.
