# Keep private install access out of push CI

Opus correctly found that WS1 made main red while the org app secrets
are unavailable. Move the actual engine/API install matrix to explicit
workflow_dispatch; keep root check, hooks, outer-edge tests and the wire
job on every push. No check or private install assertion is weakened:
a dispatched private probe still refuses without its named credentials.
WS1 remains open for that hosted proof after Jake grants admin:org.
Do not continue WS3 capture until the remaining review fixes are built.
