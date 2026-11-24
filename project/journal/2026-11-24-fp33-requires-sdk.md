# FP33: `requires.sdk` leaves the shard file (format 0.1.0.5)

> Written by: Claude (opus-prune3)

SHARD-COMPAT CP8's last clause. `requires.sdk` only ever copied the format version, and nothing reads it. Writers
stopped sourcing it at SDK 0.4.27, but every kept original and every engine pin still carries it, so the plain delete
(opus-road's `plan/fp33@0347870`: field and deprecation gone) would refuse all of them and fail FE13.

- The CP16 way instead: format 0.1.0.5 refuses a file that carries it, the chain step `fp33-drop-requires-sdk` drops it,
  and the writer envelope (`outputIndexEnvelope`) leaves it out from 0.1.0.5. Older files read and hash as written, so
  their source hashes still match; the deprecation now names its migration.
- FE4 wants the version rise for a step: `breaks/0.1.0.5.json`. The FP43 entries landed after v0.74.1 in
  `breaks/0.1.0.4.json` and ship in 0.1.0.5 now, so they moved across.
- The deprecation row itself is deleted at zero users (FE13), after wave 3 re-pins every shard.
