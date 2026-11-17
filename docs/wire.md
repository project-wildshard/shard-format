# The Wildshard wire, v1

> Written by: Claude (opus-wr8, WIRE-STABILITY WR8a)
> **State:** current at `wire-v1.0.0`, 2026-11-17. The full design, reviews and history: meta
> `docs/plans/WIRE-STABILITY-PLAN.md` sections 5 and 7.

`@wildshard/wire` (`packages/wire`) is the one home of the wire. It holds:

- the descriptors for every message, event, act, command, entity class and ride law;
- the codec;
- the frozen v0 codec;
- `wire.lock.json`;
- `wire check`.

Engine only binds accessors to the descriptors. Shard authors get the command descriptors through
`@wildshard/format`, never from engine.

## Versions

- `WIRE_MAJOR.WIRE_MINOR` (`src/major.ts`) is the wire's version, and the package and tag carry it:
  `wire-vM.m.p` is WIRE_MAJOR M and WIRE_MINOR m. A test refuses a package number that disagrees with the lock.
- **A minor** adds or deprecates: a field, arm, record, class, enum value, capability or ride law.
- **A patch** (p > 0) leaves `wire.lock.json` byte-identical.
- **A major** covers what ids can't say:
  - framing, the bootstrap bytes, a new grammar node kind or a new key on one, or a table limit;
  - a coordinate or unit change;
  - removing a required field;
  - a meaning change with no capability.

  A major needs a J-number.
- **The window is ±1 minor, tested both ways.** Outside it, an older client gets `reload` and reloads once; a newer
  client gets `retry`, shows "Server updating" and never reloads.

## Framing

- **A game message is one or more records.** Each record is `tag: uvarint`, `length: uvarint`, then the body.
  - Uvarints are minimal LEB128, at most 2^32 − 1.
  - A message is at most 64 KiB.
  - An unknown tag is skipped by its length.
  - Singletons (hello, welcome, frame, cmds, act) appear once.
  - `events` nests one record per event, so one unknown event skips alone.
- **Bodies are bit-packed** and zero-padded to a byte. A reader never reads past its body.
- **Bootstrap:** a client's first message is `0x57`, `WIRE_MAJOR: u8`, then the hello record.
  - A first byte of `1` (a v0.1.x hello) or a lower major closes `reload`.
  - A higher major closes `retry`.
- **Cold records** (hello, welcome and their table blocks) use protobuf-style keys: `id << 3 | wireType`, with
  wire types 0 uvarint, 1 fixed32, 2 fixed64 and 3 bytes. An unknown cold field is skipped.
- The transport's one-byte socket controls (0 to 8, voice on 8) wrap game messages unchanged and never reach the
  game decoder.

## Ids and the handshake

- **Seven id spaces:** messages, events, acts, classes, fields (per class or record), capabilities and ride laws.
- **Every id lives in `wire.lock.json`.**
  - 0 is invalid in every space.
  - Ids are append-only, and a removed id is reserved for good.
  - A field is its id, not its name or position. A retype is a new id plus a deprecation.
- **Hello** carries `WIRE_MINOR`, the build (telemetry only), identity and ledger fields, capability ids, and the
  client's command and act tables.
- **Welcome** carries the server's tables (every entity class, event record and ride law), the selected
  capabilities and `tableHash`. Travel omits the tables when the hash is unchanged.
- **The grammar is closed per major:** `uint`, `bool`, `f32`, `f64`, `quant`, `fixed`, `angle`, `enum`, `ref`,
  `text`, `optional`, `array`, `struct`, `union`.
  - Every node has a typed default and a bounded decode, so any unknown field is skipped by decoding and
    discarding it.
  - Absent, `false`, `0` and `''` are different values.

## Snapshots

- **The server encodes rows in its own layout:**
  - the header;
  - the owner block, with f64 for predicted fields;
  - an optional ride block (`law` id plus words);
  - per changed handle: the gone bit, a changed-field mask as wide as the server's row, and the changed columns;
  - the stale bits.
- **The client keeps raw rows in the sender's layout,** unknown classes and columns included, so masks and
  freshness bits never shift. A separate projection maps sender ids to local slots.
- **Readers see only the projection.** The interpolator, predictor and game read only it. A local field the sender
  lacks reads its default.
- **Required fields and capabilities refuse at the handshake, before play.** Required fields are row x/y/z,
  predicted owner fields and ride-law words.
- **A class has at most 32 row fields** (`maxRowFields`). An appended row field is a minor. A class's `rowFields`
  count in the lock is derived, and is not part of its form.

## The check and the harness

`wire check` runs in pre-push and CI here and in engine. It works in four steps:

1. It regenerates the lock and fails if the committed lock differs.
2. It diffs the lock against the newest `wire-vM.m.0` tag, and against every earlier release for reuse.
3. It classifies each change by the rules above.
4. It fails on any of these:
   - an id outside the lock, a duplicate, or a reused, renumbered or reserved id;
   - a removal inside its window (one minor and 14 days), or a required field removed;
   - a released id whose name, node, bounds, default, send, predicted or required changed;
   - a major-level change without a `WIRE_MAJOR` bump, or a patch tag with a lock change;
   - more than 32 row fields in a class.

   Ids added since the last release may change freely until the next minor.

`wire check --baseline` holds the frozen v0 lock (`wire.v0.lock.json`) on its own. `v0SchemaHash` in the lock is
informational: no v0 peer gets past the bootstrap byte.

The cross-version harness (`test/cross.test.ts` here, `test/contract-cross.test.ts` in engine) runs the last released
codec against HEAD's, both ways. The scenario covers:

- hello and welcome;
- 30 frames with a spawn of a class the old side lacks;
- a hit, a reward, a chat, an act and a mount;
- a lost ack, a full frame and a travel;
- a clean close.

## Changing the wire

- **Contract first.** A wire change is a small `@wildshard/wire` commit: the descriptor, its id in the lock, and
  `since`. Engine's binding follows.
- **Expand, then contract:** add a new id, read it as optional, switch behaviour behind a capability, deprecate the
  old one, and drop it after the window.
- **A schema notice is a lock diff.**
