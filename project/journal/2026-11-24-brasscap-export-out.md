# Brasscap export names its build folder (sharddev SF1)

- sdk 0.5.0 moves `wildshard build`'s default output from `<repo>/public/shardfiles/<slug>` to `<repo>/out/<slug>`.
  src/tools/brasscap-export.ts read the old default, so it would break the day Brasscap pins 0.5.0.
- It now passes the folder: `wildshard build . <scratch>/out/brasscap-mesa`, and reads shard.json there. The
  `<source> [folder]` operand is the slug folder itself in every sdk the pin can name (checked at v0.4.31, the
  pinned commit's sdk), so the bytes do not change.
- No other shard-format file reads a shard repo's `public/shardfiles` or `public/assets`; the remaining hits are
  docs and comments about engine URLs, plus the wire capture scripts reading an engine checkout.
