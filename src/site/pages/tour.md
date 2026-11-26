# Tour of a built shard

This is a real built shard, **{{tour.name}}** (`{{tour.slug}}`): a
canyon with bandit camps, a sheriff's quest and a boss that burrows.
The repo keeps a copy of its build in
[`corpus/exports/brasscap-mesa`](repo:corpus/exports/brasscap-mesa)
for its tests; its source is in
[shard-brasscap]({{tour.repo}}) at `{{tour.commit}}`. The numbers on
this page are read from that copy whenever the site is built.

It is format {{tour.formatVersion}}, requires engine
{{tour.engine}}, and has {{tour.sectionCount}} sections and
{{tour.fileCount}} immutable files. {{tour.omitted}} models over the repo's
1 MB file cap are left out of the copy; the index still lists them.

```text
{{tour.slug}}/
  shard.json          the index: everything else is listed here
  cook.json           preparation: mounts, and what the cook needs
  validation.json     the build's receipt
  sections/           JSON rows, one file per registered section
  blobs/              immutable bytes, named by SHA-256
  mounts/             files the cook publishes at a public URL
```

## `shard.json`, the index

The one file a reader opens first. Its top-level keys:

- `format`: always `"wildshard.shardfile"`.
- `formatVersion`: the four-part format version, here
  `"{{tour.formatVersion}}"`. An older file still admits, and is
  migrated through the data-only steps in
  [`src/format/format-migrations.ts`](repo:src/format/format-migrations.ts).
- `identity`: slug, display name, author, `saveRevision` (keys the
  save lineage) and seed.
- `requires`: the engine it was built for and any shared *commons*
  assets it uses, with their exact wire bytes and costs.
- `sections`: each section's name, path, schema id, byte size and
  SHA-256.
- `files`: every blob, with its hash, kind, path, compressed and
  decoded bytes, GPU bytes, triangles, draw calls, dependencies and
  whether it is critical. These are measured by the build and measured
  again by the validator.
- `cook`: the hash and size of `cook.json`.
- `admission`: the budgets the shard declares for itself, its
  `critical` and `library` roots, the server budget and the author
  caps. {{tour.name}} declares {{tour.criticalCount}} critical roots,
  library wire of {{tour.libraryWire}} and sim wire of
  {{tour.simWire}}, and caps a room at {{tour.players}} players moving
  at up to {{tour.speed}} m/s.
- `build`: the source hash and the validator revision that built it.

Every byte of every other file is reachable from here, by hash. A file
on disk the index doesn't list is refused without being read.

## `sections/`, the rows

Each section is one canonical JSON file under `sections/<area>/`,
with a registered schema, `wildshard:<name>@1`. The validator parses
each against its schema; unknown keys fail. {{tour.name}} ships these:

{{tour.sections}}

What each section means, and which engine host reads it, is in
[the runtime contract](/docs/runtime-contract/#1-sections). Some
examples from this shard:

- `world/terrain` binds the baked terrain: a collider and the tiles,
  each a blob by hash.
- `sim/scripts` declares the boss's decision script: its ABI
  (`"1.0"`), the encounter it binds to, the commands it may issue, the
  fields it reads, and `module`, the path of its compiled Wasm blob.
- `quests/quests` holds the dialogue and quest graph as plain rows:
  the sheriff's lines, the choices and the flags each one sets.

## `blobs/`, the bytes

Everything that isn't a row is a blob at `blobs/<kind>/<sha256>.<ext>`.
The name is the hash of the bytes, so a blob is immutable and can be
cached forever. By kind:

{{tour.blobs}}

`glb` models, `ktx2` and `image` textures, `tile` terrain tiles
(`.wtt`), `json` pages too big for a section, and `wasm`: the
shard's only code, compiled AssemblyScript. A Wasm blob is admitted by
reading it (its imports, exports, memory and instructions), never by
running it. See [the script ABI](/docs/script-abi/).

## `cook.json` and `mounts/`

`cook.json` is [preparation](/docs/preparation/): values computed from
the shard before upload so the server, the cook and the API don't
compute them again. Here it lists one mount,
`mounts/shardfiles/{{tour.slug}}/discovery.json`, which the cook
publishes at `/shardfiles/{{tour.slug}}/discovery.json`.

## `validation.json`, the receipt

The build's own verdict: the hash of the index it checked, the
validator revision, the worst-location memory totals and a
grid-readiness check (baked tiles, the four entryways at y=0, edge
profiles, the HUD accent). It is a cache hint for a host that built the
file itself. It never stands in for validation of a file that came
over the network: that file is validated in full.

## Try it

From a checkout of [the repo]({{github}}):

```sh
node src/cli/main.ts validate src/test/fixtures/cli-fixture
```

prints `ok cli-fixture r1: …` and the deprecations it carries. The
Brasscap copy in the repo does not validate as it stands: its
{{tour.omitted}} largest models are left out. To check a shard of your own, see
[the agent skill](/agents/skill/); it works for people too.
