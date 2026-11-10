# Keep every captured v0 stream byte exact

WS3 already tees actual frame inputs, per-handle rowFrom baselines and
due calls. The other five transport streams now capture their real bytes
and must replay through frozen codecs before reaching the sink or timing.
Synthetic command identities preserve arbitrary real 16-bit handles;
spawn widths come from the frozen class tables. Frozen source is unchanged.

Preparation decodes once outside encode timing. Encode allocates a fresh
writer and retains copying, references and allocation costs. Decode is
measured separately. Original text is inspected only in preparation;
ordinary records then use the unmodified BitWriter.

The one-shot review found a valid encoder-produced BOM name whose frozen
decoder strips the BOM. Prepared text values now preserve those original
bytes without changing the frozen codec or weakening the byte oracle.
A BOM record includes its prepared text adapter in measured encode cost.
Regressions cover BOM hello, chat and event text, JSON reload, arbitrary
rich-command handles and ownership of input/output/decoded values.
Noncanonical board padding specifically refuses at capture and persisted
read. Removing only the byte-equality guard gives 50 passes and one
expected oracle failure; the restored code passes all 51.

All 51 packet cases pass in 77 ms; build and strict types pass. Review:
~/.cache/wildshard/session-keep/reviews/
shardfile-WS3-packet-capture-20261110T010846Z-53319.md.

A separate isolated original-cfd Sunscar run captures 1800 actual walking
ticks: 901 identical frame replays, 14122 rowFrom calls, 16498 due calls,
2706 actual transport packets, 80 deliberately lost upstream bundles and
10 full frames after the missing ACKs. Actual displacement is 206.034 m;
zero client decoder drops or live sockets. Admitted run takes 2.41 s.
Raw JSON is 7856996 bytes. Word-dictionary compaction measures 4474956
bytes, but its persisted reader and proof are not built in this commit.
Full recordings and Node/Chromium benchmark timings remain open.
