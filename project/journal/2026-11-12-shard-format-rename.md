# shardfile becomes shard-format (meta J308)

> Written by: Claude

Jake, 2026-11-12 ~22:10 Cancún: "Shard format, yep, approved... You
rename the GitHub repo, you rename all the code inside that repository,
you rename the package, you rename all the strings... bump a new patch
version. It's not a breaking change, just a name change."

The repo is now `project-wildshard/shard-format` and the package
`@wildshard/shard-format`. The thing an author uploads is still a shard
file, so the format's own words stay: `ShardfileSchema`, `/shardfiles/`
URLs, `shard.json`, file extensions and `docs/SHARDFILE.md`.

Two things keep the old name on purpose:

- The CLI installs as `shard-format` and still as `shardfile`, so a
  script that calls the old bin keeps working.
- Schema ids, the `@wildshard/format/<module>#<Export>` strings in
  `registeredJson.ts`, `platformFileFamilies.ts` and `nativeAssembly.ts`,
  are matched by sharddev and engine and written into JSON Schema
  exports. They are identifiers, not import paths; changing them would
  be a format change, which J308 rules out.

GitHub redirects the old URL, so a consumer pinned to
`github:project-wildshard/shardfile#<sha>` still installs.
