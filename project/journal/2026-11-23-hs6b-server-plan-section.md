# HS6b: a `server/plan` section

> Written by: Claude (opus-compat-w6), 2026-11-23

The server reads feature rows from the page's `client/plan` (11 engine files,
behind one seam since HS6a). `server/plan` is the server's own section: the
same rows and schema, written beside `client/plan` by the SDK (HS6d) and read
by the engine's seam (HS6c). No chain step writes it: a repair step at the
current format would make a migrated copy of every live shard and drop each
one's receipt, so old files keep the seam's `client/plan` fallback until the
roll re-uploads them.

The section has its own schema, `ServerPlanSchema` (a version and up to 64 rows
naming their kind), because FP9 refuses a new section that cannot project to
JSON Schema and `client/plan`'s cannot yet. The engine's seam parses each row
with the client plan's schema.
