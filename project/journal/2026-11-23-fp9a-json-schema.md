# FP9a: the JSON Schema projection moves into the format

> Written by: Claude (lane opus-prune1)

The valibot-to-JSON-Schema projection lived twice: engine `src/shared/host/formatJsonSchema.ts` and the SDK's
`sharddev/formatJsonSchema.ts`, already apart by six bridges. It now lives once, at `@wildshard/format/jsonSchema`
(`src/format/json-schema.ts`), moved from the SDK copy (the newer one). The named-row and author helpers stay in the
SDK; engine and the SDK switch to this export at their next format pin (FP9b, FP9c).

The new test found what it was written for: format 0.1.0.4's identity transform (FP26a) did not project, so the SDK's
schema build would have thrown on the 0.71.0 pin. The transform now has a bridge (output carries `saveRevision`).
22 data sections and one file family never projected; they are listed, and the list only shrinks (FP9d).

The moved file's lint debt is waived at its top instead of rising the ratchet by about 400; rows that touch it pay
it down.
