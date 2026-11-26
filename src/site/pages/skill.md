---
name: shard-format
description: Validate, pack and inspect a Wildshard shard file (a built shard folder with shard.json, or its tarball) with the shard-format CLI, and find the rule behind a refusal. Use when asked to check, validate, debug or explain a built shard, a shard.json, or a validator refusal.
---

# Validate and inspect a shard file

A shard file is a built Wildshard shard: a folder with `shard.json`,
`sections/`, `blobs/` and usually `cook.json` and `validation.json`,
or a tarball of that folder. The `shard-format` CLI from npm package
`@wildshard/shard-format` checks one. The source at {{github}} is the
spec; the docs at {{origin}} explain it.

Needs Node 24.18 or newer. No install needed: `npx` fetches the CLI.
In a repo that already depends on the package, `pnpm exec shard-format`
or `npx shard-format` runs the pinned copy.

## Validate

```sh
npx @wildshard/shard-format validate <folder-or-tarball>
```

- It checks the format only: schema, inventory, hashes, sizes, costs,
  budgets and admission rows. It never runs script bytes.
- Exit `0`: valid. It prints
  `ok <slug> r<revision>: <n> sections, <n> assets, source <sha256>`,
  then one `warning: …` line per deprecated shape the file still
  carries. Warnings don't fail; each names the chain step that mends it.
- Exit `3`: invalid. stderr says
  `shard-format: <path> is not a valid shardfile: <reason>`.
- Exit `1`: bad usage. Exit `2`: the CLI crashed.

The CLI prints the reason, not the refusal code. To map a reason to a
rule, find it in {{origin}}/docs/validation-codes.md, then read the
section of the reference it names.

## Pack

```sh
npx @wildshard/shard-format pack <folder> [--out <file>]
```

Tars a folder into a shard file (strict ustar), after the validator
passes. It writes `<slug>.tar` unless `--out` says otherwise, and
prints `packed <file>: <bytes> bytes, <sha256>`. Exit `3` if the folder
doesn't validate or pack.

## Inspect

There is no inspect command; read `shard.json`, the index. For a
tarball, unpack it first: `mkdir x && tar -xf <file>.tar -C x`.

```sh
# Identity, format version, engine, counts
node -e 'const s=require("./shard.json");console.log(s.identity,s.formatVersion,s.requires.engine,s.sections.length+" sections",s.files.length+" files")'

# Sections: name, bytes, schema
node -e 'for (const x of require("./shard.json").sections) console.log(x.name, x.bytes, x.schema)'

# Blobs by kind: count and wire bytes
node -e 'const k={};for (const f of require("./shard.json").files){k[f.kind]??=[0,0];k[f.kind][0]++;k[f.kind][1]+=f.compressed}console.log(k)'

# Declared budgets and caps
node -e 'const a=require("./shard.json").admission;console.log(JSON.stringify({budgets:a.budgets,serverBudget:a.serverBudget,authorCaps:a.authorCaps},null,1))'
```

Run these from inside the shard folder. Every path in `sections` and
`files` is relative to it; `sections/<area>/<name>.json` holds the rows.

## When it refuses

1. Read the reason. It names the file, the field path or the check.
2. Look up the rule: fields in {{origin}}/docs/shardfile.md, sections,
   kinds and hosts in {{origin}}/docs/runtime-contract.md, Wasm in
   {{origin}}/docs/script-abi.md.
3. Fix the shard's **source** and rebuild it (`wildshard build` in the
   shard's repo, with the Wildshard SDK), then validate again. Don't
   hand-edit a built file: names are hashes and costs are measured, so
   an edit fails `file-mismatch` or `blob-invalid`.

Common causes:

- an unknown key (every object is strict);
- a section, `client/plan` kind or server host that isn't registered;
- a blob whose bytes, size or measured cost differ from its row;
- a Wasm module with an import other than `ws_read` and `ws_list`;
- a cost over a budget the shard declares or a platform cap.

## From a checkout of the repo

```sh
git clone {{github}} && cd shard-format && pnpm install
node src/cli/main.ts validate <folder-or-tarball>
node src/cli/main.ts format-diff <git-ref-a> <git-ref-b>
```

`format-diff` classifies every change between two format locks
(additive, deprecation, breaking or review) and suggests a migration
op. It reads `src/format/lock` at each ref, so it needs the repo.
