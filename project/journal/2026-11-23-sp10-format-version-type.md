# SP10: the format version's type says "format version"

> Written by: Claude (opus-compat-w6), 2026-11-23

SHARD-COMPAT §2 retires "shardfile version". A census of the retired words in
engine, shard-format, api-server and sharddev code found one: the
`ShardfileVersion` type (87 uses). `FormatVersion` and `FormatVersionParts` are
now the names; the old ones stay as deprecated aliases until no consumer imports
them (ST19). Function and constant names (`parseShardfileVersion`,
`SHARDFILE_VERSION`) move one decision at a time, each with an alias.
