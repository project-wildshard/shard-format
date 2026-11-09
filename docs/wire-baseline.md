# Frozen wire v0 baseline

WS2 freezes engine v0.1.2 at full commit
`cfd668102efcb7c10a6fb57d3021c1f3d23c37a5`. Nothing switches engine or
api-server to this package. No v1 compatibility claim exists.

`pnpm --dir packages/wire build` regenerates plain JavaScript under
`lib/`; those outputs ship so Git subdirectory consumers need no build
hook or TypeScript loader. `pnpm check:wire` rebuilds them, refuses output
divergence, runs strict checks and exercises a packed consumer.
`wire check --baseline` checks frozen hashes, regenerates `wire.lock.json`
byte for byte and replays the original-engine goldens.

`frozen/v0/provenance.json` names every original codec source blob at
that commit. The eight codec bodies are unchanged: imports become local,
pure FNV/button constants are extracted, type-only dependencies are
inlined, and the format netCommand grammar is frozen from its exact pin.
Immutable vendor sources and generated output are not style-fixed; new
CLI, adapters and tests remain under strict lint. The entire frozen
TypeScript closure is typechecked. Hashes and original byte fixtures
prevent a style edit from silently becoming a codec change.

The actual engine class declarations were executed to capture tables,
all column layouts and six canonical descriptions as data. Their FNV
schema hash is **3951578209**, identical to engine at that SHA. The lock
lists every class index and planned v1 id, field order, kind, bounds,
send and predicted status, message/event/act tags and forms, and the
command layout. Field ids are the planned ordered v1 baseline; no v1
wire has shipped.

`fixtures/v0.json` contains 47 bytestrings captured by the actual engine
encoders: hello, welcome, commands with absent/targeted/untargeted attack
and high buttons, every event and act kind and enum arm, and full
on-foot/mounted frames with exact owner doubles. Decode and re-encode
must retain every byte. A flipped hello string-length bit and an unknown
event between known events refuse in v0. V1 varints, bounded unknown
record skipping and new malformed framing cases belong to WR3.

WS3 adds real traffic recordings on the same frozen engine, isolated
locally. Live proofs never use production (J205).

The public `@wildshard/wire/fixed` codec stores an integer divisor. Its
encode is `round(value * divisor) - offset`, and its decode is
`(word + offset) / divisor`. Steering is `(8, 127, -128)`. The public wire
`quantiseCommand` uses this codec. Tests compare all 256 bytes and every
half step plus adjacent doubles against the independent frozen command
code. No reciprocal scale is permitted. The current engine still uses
its original correct arithmetic; gated WR adoption switches its caller.

WS3 frame capture tees each actual `rowFrom(handle)` and `due(handle)`
call, preserving its result and call order. It stores per-handle source
ticks/row words, absence, false due, visibility, class bindings and IEEE
owner/ride bits. Capture never calls those callbacks a second time. A
record can leave `FrameTrace.finish` only after JSON round-trip and
byte-identical frozen-v0 replay; missing/extra calls or bytes refuse.
The four full recordings and CPU results remain separate milestones.
