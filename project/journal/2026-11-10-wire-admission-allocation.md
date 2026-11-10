# Bound recording admission temporaries

Exact source 957c1ce has a green local normal push but hosted CI
42802287444 rejects the complete dense graph case at 9.669 seconds.
The 9.5-second guard remains unchanged. No workflow rerun is requested.

Read-only source tracing finds two avoidable admission allocation paths.
Word expansion previously retained a single expanded text plus parsed
copy of the entire 80 MB dense session before frame grammar/replay.
Expand one frame at a time instead, retaining only the final admitted
frames. Every word reference, frame schema, per-handle callback and
frozen byte oracle still runs before the session is returned. Graph
hashes and its two-pass reference/size/key/depth admission are unchanged.

Frozen replay also allocated a new 4 KiB WorldFrame on every actual
rowFrom callback. Its pinned encoder consumes each result synchronously;
reuse one private scratch world, reset all prior offsets and rebuild every
source in order. Do not cache by handle or skip repeated calls. A late
changed source still changes actual bytes and is refused. Frozen codec
source, recorded bytes, due decisions and timing paths are untouched.

Light focused replay/order checks pass. A 500-frame synthetic dense
control reconstructs all 91,000 callbacks: old 564.13 ms, new 539.83 ms;
walking is effectively unchanged (331.63/334.36 ms). These observations
are not two-run qualification or proof of the hosted root. Strict types,
focused lint and generated declarations build locally. Full dense
admission, memory and hosted evidence remain pending; no full gate,
benchmark timing or publication is run in the release priority window.
