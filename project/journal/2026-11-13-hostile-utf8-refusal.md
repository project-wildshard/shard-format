# The hostile-shard fuzz accepts tagged bad UTF-8 (ci green again)

> Written by: Claude (lane opus-sf048)

`ci` had been red on main since `9263681` (SA41): `tagIssue` shadows an
error's `code` with an issue code, so the fatal TextDecoder's TypeError no
longer carried `ERR_ENCODING_INVALID_ENCODED_DATA`, and the fuzz in
`src/ci/hostile-shard.test.ts` read it as a parser crash. v0.4.6 and v0.4.7
shipped with that red. The test now also knows the TypeError by the exact
words Node's decoder throws, read from Node at test time, so any other
TypeError still fails it. Found while cutting v0.4.8.
