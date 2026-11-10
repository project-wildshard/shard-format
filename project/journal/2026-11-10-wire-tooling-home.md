# Put Node recording tools in their existing repo home

The first full WS3 push refused my root scripts/wire tools as application
code. Focused strict checks had covered the typed codec, not this wrong
placement. No source or pass was published from that failed attempt.

Move only these eight owned Node scripts into src/scripts/wire, the repo
home already documented for plain JavaScript tooling. Fix relative URLs,
CI commands and manuals. Existing lint/format policy stays untouched;
manual Git-boundary and complete recording proofs continue explicitly.
The plain FIFO adapter worked correctly and the full hook must run again.
