# Stable codes on every issue (SHARD-AUTHORING SA41)

- SA21's follow-up (J317 Q19): sharddev's refusal table matches shard-format's message words. Every issue now carries a
  stable kebab-case `code` from one table, `src/format/issue-codes.ts`: validator refusals as `error.code` (sync and
  stream validators, `readTar`), `PerformanceIssue.code`, `AudioFinding.code`, and `assertAudioAdmission`'s refusal.
  53 codes in four families (validate, stream, performance, audio). Messages keep their exact words; the fields are
  additive.
- Validators tag by the check that refused (`withIssueCode(code, run)`); a nearer tag wins. A code that is not the
  table's is replaced: Node's TextDecoder gives `ERR_ENCODING_INVALID_ENCODED_DATA` on bad UTF-8 in `shard.json` and a
  Worker gives none, so keeping host codes would make the same refusal's code differ by host. No consumer reads `.code`
  off a validator error (engine's `ENOENT` check is on its own `realpath`).
- `product-stream.test.ts` now compares `[code] message` between the two validators on every corpus mutation, so the
  stream's deferred refusals (pack verdicts, file errors) must land in the same check as the old validator's.
- Not coded: the admitted-with-a-warning lines (`warnings: string[]`), which are not refusals; adding codes there changes
  a type consumers read. sharddev's switch from regexes to codes needs the next shard-format release.
