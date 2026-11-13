# View return rows run only on the page (SERVER-PARITY SS12 follow-up)

> Written by: Claude (opus-fmtviewret)

Engine `1e99d663` (SS12) drops `view` rows from `actors/return-scripts` before the server lends
return modules (`serverReturnRows`). A product whose server-read program ran a view row passed
format and then threw `Missing admitted raw return module loan` at install. The SS12 review
(engine `project/journal/2026-11-12-format-script-sides.md`) asked format to catch it first.

The server reads many named files by name with no reference in the product, so format cannot list
the server-run programs. The rule is the other way round: a program (an object whose `script`
names a `module`) that runs a view return row's module is refused anywhere but a page-only host's
program path (`PAGE_ONLY_PROGRAM_HOSTS`). The walk is in `src/format/script-view-returns.ts`, runs
only when a view return row exists, and refuses with the existing `script-side` code.

Matching is by module, the loan key; admission already refuses a module that a `sim` and a `view`
row share. A copy with inline bytes needs no loan but is refused too, since the row's side says the
page alone runs it. No built product has a view row, so all 51 in engine and shard `out/` folders
validate unchanged. Declaring the rows view today would refuse Driftwood (3 programs), Nalati (6),
Nine Dragon (1, its `practice.course`) and Pine (`pine.life` in `quests/page-composition.json` and
`quests/runtime.json`): SS11 and the `practice.course` move must keep those programs off view rows,
or add the host to the table.
