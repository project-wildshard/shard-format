# HS6b: a `server/plan` section

> Written by: Claude (opus-compat-w6), 2026-11-23

The server reads feature rows from the page's `client/plan` (11 engine files,
behind one seam since HS6a). `server/plan` is the server's own section: the
same rows and schema, written beside `client/plan` by the SDK (HS6d) and read
by the engine's seam (HS6c). No chain step writes it: a repair step at the
current format would make a migrated copy of every live shard and drop each
one's receipt, so old files keep the seam's `client/plan` fallback until the
roll re-uploads them.
