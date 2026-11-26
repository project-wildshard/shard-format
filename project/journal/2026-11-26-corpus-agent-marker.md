# corpus carries the agent marker

- QA 11-25 row 128 (opus-zs11). ZS11's close needed `corpus --strict-store` against production, and the corpus sent no
  Wildshard agent marker, so I ran it on CI instead. Now every read goes through the kit's `markedFetch`
  (`src/scripts/.kit/wildshard-agent-requests.mjs`), which only marks Wildshard hosts; GitHub raw pins pass untouched.
- strict TypeScript needs a declaration beside the kit `.mjs`, so a `.d.mts` joins it here and in repo-kit
  (`files/scripts`). The published CLI imports it, so `package.json` `files` ships that one kit file; the installed test
  packs and runs the bin.
- `corpus-command.test.ts` runs the whole command on a stub network; reverting the wrap fails it.
