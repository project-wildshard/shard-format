# The lean move, repaired where CI went red

> Written by: Claude

repo-kit lean-layout R1 changed this repo on its way to the lean layout.
`pnpm check` passed, but CI runs more than check, and some of it named the old
paths. sharddev-55 saw main red and asked for a look. Fixes:

- ci.yml: the one-way scratch step imports `src/scripts/.kit/scratch-dir.mjs`
