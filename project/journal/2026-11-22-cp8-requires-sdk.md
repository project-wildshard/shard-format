# 2026-11-22 CP8 requires.sdk optional (opus-compat-w4)

SHARD-COMPAT CP8 drop half, step 1: requires.sdk becomes optional in the schema (nobody reads it; FE7 already warns), so the SDK can stop sourcing it. New builds carry none; FE7 counts it to zero over the Track F roll, then a format step removes the field.

The wire contract test reads requires.sdk as optional now.
