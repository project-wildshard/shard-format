# What a shard file is

A **shard** is one playable place in Wildshard: a 500 m cube of world
with its terrain, buildings, creatures, quests, sound and rules. A
**shard file** is a built shard as the game takes it: a folder (or a
tarball of one) holding a `shard.json` index, JSON sections and
content-addressed blobs. It carries data and sandboxed Wasm, never
JavaScript, TypeScript or a URL to fetch code from.

This site explains that format. It is written for two readers:
people, on these pages, and agents, at [For agents](/agents/) and
[llms.txt](/llms.txt), where every page is plain Markdown.

> **The source is the spec.** There is no separate, versioned spec
> document. The schemas and the validator in
> [the public GitHub repo]({{github}}) (`src/format/`) define what a
> shard file may be; this site only explains them. Where a page here
> and the code disagree, the code is right. Today's format version is
> **{{formatVersion}}** ([`src/format/version.ts`](repo:src/format/version.ts)),
> published on npm as `@wildshard/shard-format` {{packageVersion}}.

## The pipeline

A shard goes from an author's source to a running world in five steps.
This repo owns the format and the validator in the middle; it builds
nothing and runs nothing.

1. **Author.** The shard's source lives in its own git repo: config
   and generators in TypeScript, AssemblyScript for behaviour, models
   and images. None of that ships.
2. **Build.** The Wildshard SDK's `wildshard build` turns the source
   into a built folder, `out/<slug>/`: the index, the sections, every
   asset as an immutable file named by its SHA-256, and the compiled
   Wasm. TypeScript runs here, at build time, and nowhere else.
3. **Prepare.** `wildshard prepare` computes what the server, the
   cook and the API would otherwise compute from the shard, and writes
   it into the file as [preparation](/docs/preparation/): `cook.json`
   and the `validation.json` receipt.
4. **Validate and upload.** The validator in this repo admits the
   file: every section re-parsed against its schema, every blob
   re-hashed, every cost re-measured, every budget checked. The SDK
   runs it before upload and the API runs it again on the way in, so
   an author's own numbers are never taken on faith.
5. **Cook and play.** The engine cooks the admitted file into runtime
   packs and runs it. The server owns the gameplay; a page draws it.

You can run step 4 yourself on any built shard:

```sh
npx @wildshard/shard-format validate out/<slug>
```

## What is inside

A built shard is a folder. [The tour](/tour/) walks through a real
one, {{tour.name}}, file by file. In short:

- **`shard.json`**, the index: identity, the format version, what it
  requires, the list of sections, every file with its hash, kind and
  costs, and the admission rows (budgets, critical and library roots).
- **`sections/<area>/<name>.json`**, the rows: terrain, creatures,
  strikes, quests, UI and so on. Each names a registered schema,
  `wildshard:<name>@1`; there are no custom sections.
- **`blobs/<kind>/<sha256>.<ext>`**, the immutable bytes: GLB models,
  KTX2 and other images, terrain tiles, JSON pages and Wasm.
- **`mounts/`**, files the cook publishes at public URLs.
- **`cook.json`** and **`validation.json`**, the preparation and the
  build's receipt.

Every object is strict: an unknown key fails, and only plain, bounded
JSON is accepted. [Shard file fields](/docs/shardfile/) lists every
field; [the runtime contract](/docs/runtime-contract/) lists what a
shard may declare.

## How gameplay gets in

A shard can't ship code the engine imports. Gameplay gets in three
ways, and nothing else:

1. **Data rows.** Most of a shard is rows in its sections and
   registered [named files](/docs/platform-file-families/): spawns,
   strikes, loot, quests, day and weather, UI.
2. **Wasm scripts.** Behaviour is written in AssemblyScript (or any
   language that makes the right Wasm) and ships only as the compiled
   module. Admission reads the bytes and never runs them: a module may
   import only `ws_read` and `ws_list`, must export the ABI entry
   points, and is held to a memory, size and fuel budget. Decision
   scripts run on the server at 10 Hz. See [the script ABI](/docs/script-abi/).
3. **Engine hosts, picked by name.** A shard drives shared engine code
   with data: a `client/plan` kind on the page, a native-assembly host
   on the server. The list is fixed and registered; a name not on it is
   refused. [The runtime contract](/docs/runtime-contract/) has them all.

The server is authoritative, even offline, where the server runs in
the browser. A script declares its side (`sim` or `view`), and the
validator refuses one on the wrong side.

## Budgets

A shard declares its own ceilings in `shard.json` `admission`, and
validation holds its measured costs to them, inside platform caps. MB
means 1,000,000 bytes.

| What | Platform cap |
| --- | --- |
| Library wire / resident | ≤ 8 MB / ≤ 25 MB |
| Critical wire (before control) | ≤ 2 MB |
| Sim resident | ≤ 25 MB |
| Server tick / memory | ≤ 16,666 µs / ≤ 25 MB |
| Server entities / commands | ≤ 10,000 / ≤ 1,024 per tick |
| Players, in-cell speed | 1–32, ≤ 15 m/s |
| One Wasm module | ≤ 256 KiB |
| The shard's own audio | green to 6 MB, red over 10 MB |

Memory caps report and don't refuse yet; the rest refuse. The
numbers and their constants are in [the runtime
contract](/docs/runtime-contract/#6-budgets) and
[audio targets](/docs/audio/).

## Read next

- [Tour of a built shard](/tour/): every file in {{tour.name}}.
- [Glossary](/glossary/): the words the reference uses.
- [Reference](/docs/): the repo's docs, rendered as they are.
- [Validation codes](/docs/validation-codes/): what each refusal means.
- [For agents](/agents/): the same docs as Markdown, and a skill.
