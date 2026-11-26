# For agents

This is the agent front door of {{origin}}. Every page on the site is
plain Markdown at a stable URL; fetch these instead of the HTML.

- This page: `{{origin}}/agents/index.md`
- Index of everything: `{{origin}}/llms.txt`
- Everything in one file: `{{origin}}/llms-full.txt`
- Skill: `{{origin}}/agents/skill.md`

## Ground truth

The source is the spec. The schemas and the validator in
`src/format/` of {{github}} define what a shard file may be; these
docs explain them and can lag. When a doc and the code disagree, the
code wins. Read the code when a field's exact bounds matter.

- Format version: **{{formatVersion}}** (`SHARDFILE_VERSION`,
  `src/format/version.ts`).
- npm package: `@wildshard/shard-format` {{packageVersion}}, which
  ships the schemas, the validator and the `shard-format` CLI
  (`shardfile` is the same bin). Node 24.18 or newer.
- Each reference `.md` starts with a comment naming its source file
  and the commit it was built from.

## Which page for which job

| Job | Read |
| --- | --- |
| Check a built shard | [Agent skill](/agents/skill.md) |
| Explain a refusal | [Validation codes](/docs/validation-codes.md) |
| Write or fix `shard.json` | [Shard file fields](/docs/shardfile.md) |
| Pick a section, kind or host | [Runtime contract](/docs/runtime-contract.md) |
| Write a Wasm script | [Script ABI](/docs/script-abi.md) |
| A named JSON file | [Named file families](/docs/platform-file-families.md) |
| `cook.json`, `validation.json` | [Preparation](/docs/preparation.md) |
| Music and sound | [Audio targets](/docs/audio.md) |
| Species rows | [Species layers](/docs/creature-layers.md) |
| Network protocol | [The wire](/docs/wire.md) |
| Orientation | [What a shard file is](/index.md), [tour](/tour.md), [glossary](/glossary.md) |

## Rules that bite

- **Strict JSON.** Every object is strict: an unknown key fails. Only
  plain, bounded JSON: no functions, URLs to code, or callbacks.
- **No custom sections.** A section, `client/plan` kind, server host
  or named file must be on the registered list in the runtime
  contract. You can't invent one in a shard.
- **Code is Wasm only.** Scripts ship as compiled Wasm blobs, never as
  source. A module may import only `ws_read` and `ws_list`.
- **Hashes are names.** A blob's file name is the SHA-256 of its bytes,
  and `shard.json` lists its size and costs. Edit a blob and you must
  rebuild; a hand edit fails `file-mismatch`.
- **Costs are measured, not declared.** The validator measures every
  cost again; understating one fails `blob-invalid`.
- **Match codes, not messages.** Refusal messages may be reworded;
  codes are stable.
- **Rebuild, don't patch.** A shard file is a build output. Fix the
  shard's source and run `wildshard build` again (in the shard's repo,
  with the Wildshard SDK), then validate.

## Install the skill

Save [the skill](/agents/skill.md) as
`.agents/skills/shard-format/SKILL.md` (or `.claude/skills/…`) in the
repo you work in, or fetch it when you need it.
