# Script sides (SERVER-PARITY SS7)

> Written by: Claude

Pine's "find the 3 secrets" never completes in a room because `pine.life`, a v1 row declared
`sim`, sets `secret:log` only where the page runs it (`page.life`). v1 could say only `sim`, and
nothing checked where a script is hosted. Now a v1 row says `sim` or `view`, and v1 sides and v2
lanes map onto SS2's side words (`src/format/script-sides.ts`): v1 `sim` is `both`, v2 `sim` is
`server`, `project` is `both`, and `view` is `view`.

Admission refuses a `view` row that emits anything but `timer`, `cue` or `channel`; a `sim` row
that `page.life` runs; a `page.life` copy that differs from its `actors/return-scripts` row (so the
side checked is the admitted one); and a `view` row in `sim/scripts`. Both validators run the
product checks once the sections are read, on named files whose size and hash match the index.

`pine.life` is also run by the server (the quest lead and chapter), so the refusal is about the
`page.life` binding, not the script as a whole: "runs in page-only feature page.life, which no
server host runs". A generic "bound only by view features" rule would have refused Nalati and Nine
Dragon too: their `practice.course` rows are `sim` and run on the page alone (cosmetic), and the
server reads many files by name with no reference in the product. So the page-only hosts are a
named table, starting with `page.life`.

Of the 28 products in engine's `out/`, 27 still validate unchanged; Pine is refused until SS5. The
327 MB pin test now expects that refusal from both validators. Engine's next format bump narrows
`DecisionScript.side` to the `sim` rows it spreads in (a type change only).

- SS7 grandfather (opus-ss7b): the refusal blocked engine's format bump
  (and so SS8) because every validator refused Pine's live product. SS5
  put Pine's secret on the server, so `script-side-grandfather.ts` now
  names that one product (slug, source hash, `pine.life`) and both
  validators admit it with a warning (`warnings` on their result,
  printed by `shardfile validate`). A new Pine upload, or any other
  product, is still refused; SERVER-PARITY SS11 drops the entry.
