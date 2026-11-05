# shardfile import

- Imported `src/format` (410 files) and the three spec docs from
  `Raynos/project-wildshard-singleplayer@36d00c6645`, the commit that
  rewrote format's imports to explicit `.ts` (J53). Byte-identical
  except whitespace the hook refuses: one trailing space
  (`audioProfiles.ts:477`) and extra blank lines at EOF in 10 files. `types/format-standards.d.ts` came in
  beside it as `src/format/format-standards.d.ts`.
- No freeze was announced to the singleplayer lanes: format keeps
  changing there until the switch, so the switch re-imports from a
  newer SHA (copy, diff, commit) before singleplayer depends on this.
