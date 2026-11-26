# Glossary

The words the reference uses, in plain terms. Each points at the page
that defines it properly.

**Admission.** The check a host runs before it takes a shard file:
schema, closure, exact sizes and SHA-256 of every file, script
admission and budgets. Admission never trusts a number the author
wrote; it measures again. See [Shard file fields](/docs/shardfile/).

**Blob.** An immutable file in `blobs/<kind>/`, named by the SHA-256
of its bytes: a model, texture, terrain tile, JSON page or Wasm module.

**Budget.** A ceiling on a cost: wire bytes, resident memory, server
tick time, entities. A shard declares its own in `admission`, inside
the platform caps. See [the runtime contract](/docs/runtime-contract/#6-budgets).

**Build.** `wildshard build` (the SDK): the step that turns a shard's
source into a shard file. Nothing in this repo builds.

**Cell.** The 500 × 500 × 500 m cube every shard occupies, with four
8 m entryways at y = 0, one in the middle of each side.

**Commons.** Shared assets several shards use, referenced by hash in
`requires` with their exact wire bytes and costs.

**Cook.** The engine step that turns an admitted shard file into the
runtime packs it plays from. `cook.json` carries what the cook needs.

**Critical.** The files a shard needs before the player has control.
Critical wire is capped at 2 MB. The rest is **library**: loaded
around the player as needed.

**Entryway.** One of the four 8 m openings at the cell's edge where a
road meets the shard. The validator proves each is flat, clear and dry.

**Format version.** The four-part number naming a shard file's shape,
`SHARDFILE_VERSION` in `src/format/version.ts`, today
{{formatVersion}}. It is separate from the npm package version
({{packageVersion}}). The fourth part adds fields; the third changes
their meaning.

**Host.** Shared engine code a shard drives with data, picked by name:
a `client/plan` kind on the page or a native-assembly host on the
server. The list is registered; a shard can't add one.

**Index.** `shard.json`, the file that lists every other file.

**Migration chain.** The data-only steps that carry an older shard
file to the current format version. An older file still admits as
written; the chain writes its migrated copy.

**Named file.** A JSON file of a registered family, validated by that
family's schema. See [named file families](/docs/platform-file-families/).

**Preparation.** Values computed from the shard, not authored, that
the author's machine makes before upload: `cook.json`, with its own
preparation spec version. See [preparation](/docs/preparation/).

**Receipt.** `validation.json`, the build's verdict. A cache hint for
the host that built the file, never proof for a file from elsewhere.

**Refusal code.** The stable `code` on every validator refusal, such
as `index-invalid` or `file-mismatch`. Match the code, not the
message. See [validation codes](/docs/validation-codes/).

**Script ABI.** The contract between a Wasm module and the engine:
imports `ws_read` and `ws_list` only, exports `ws_abi`, `ws_init`,
`ws_io` and `ws_handle`, an IO block of slots for events and commands.
See [the script ABI](/docs/script-abi/).

**Section.** One JSON file of rows under `sections/<area>/<name>.json`,
with the schema `wildshard:<area>/<name>@1`. Only registered sections
exist.

**Shard.** One playable place: a cell of world with its content and
rules. **Shard file** (also *shardfile*): a built shard, as a folder or
a tarball.

**Side.** Where a script or feature runs: `sim` scripts run on the
server, which owns the gameplay; `view` runs only on the page and
writes no gameplay.

**The source is the spec.** There is no separate spec document: the
schemas and validator in [the repo]({{github}}) define the format, and
these pages explain it.

**Wire.** Bytes sent over the network: a shard's download, or
`@wildshard/wire`, the game's network protocol. See [the wire](/docs/wire/).
