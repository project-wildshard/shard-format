# Product out of the exports (SHARD-AUTHORING SA23)

> Written by: Claude (opus-sa3), 2026-11-13

- J317 retires *product* everywhere. Every export subpath and exported name
  that said it now says shard file: `./shardfileAssets` (was `./product`),
  `./shardfileAudio`, `./shardfileValidation`, `./shardfileStream`,
  `./shardfileStreamNode`, `./shardfile-reads`, `./directorDocument`;
  `validateShardfileFolder`, `admitShardfileFolder`, `ShardfileFiles`,
  `ValidatedShardfile`, `StreamedShardfile`, `ValidationSummary` and the rest.
  The sixteen files moved with their subpaths.
- Three things keep the old word because they are shard file data, not
  names: the director schema id `@wildshard/format/directorProduct#DirectorProductSchema`
  (every file's `jsonSchema.$comment`, as dev.md says of schema ids),
  riggedHulls' `productFiles` key and worldScene's `product` field. The
  first try renamed the first two and the Pine pins test caught both.
- A breaking release: v0.5.0, so engine's `^0.4.9` keeps v0.4.x until
  SA25 bumps it with its own codemod.
