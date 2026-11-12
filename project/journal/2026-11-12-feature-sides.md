# Feature sides (SERVER-PARITY SS2)

> Written by: Claude

The rope bridge fell through because the page built gameplay from `client/plan` and nothing said
the server needed a half. Now every `client/plan` feature kind and all 18 `world.assembly` stage
kinds carry a side in `src/format/feature-sides.ts`: `view` (draws only), `both` (the server owns
the gameplay half) or `server`. A `both` entry names the installer key engine will register in SS3
(`rope-deck` and `rope-chain` to `ropeDecks`, `stealth.entry` to `stealth`, and so on).

The tables are typed as total records over the schema's kind unions, so a new kind without a side
fails typecheck. Admission checks it too: both validators (`validateShardfileProduct` and the
stream) run `assertSectionSides` on the raw `client/plan` before its schema, so a made-up kind is
refused by name, and both give the same refusal.

Sides follow meta's `server-parity/HOSTS.md` "Should" column, with two calls: `page.life` is
`view` (Part 1: SS7 refuses a `sim` script bound only by it), and the kinds engine's server reads
straight from `client/plan` today (`combat.targets`, `elite.construct`, `elite.entry`,
`timed.encounters`, `view.program`) are `both`, since that is true until HS6 moves those reads.
`view.program` came from the review: slots and open-arena bosses run its pose views on the server.

The file is kebab-case, not `featureSides.ts` as the plan wrote, because the src/format ratchet
refuses a new camelCase file; the package export is `./featureSides`. The test sits in
`src/format/` where format's vitest runs, not `test/`. Every product in engine's `out/` (28) and
the shard repos' `out/` still validates. No format revision bump: no admitted product changes.
