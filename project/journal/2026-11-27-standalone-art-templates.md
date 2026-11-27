# Standalone art: engine binaries and URL templates

Pine Hollow's build with an authored shardVersion found two gaps in
SF3's standalone-art check. The physics binary
`/assets/physics/rapier.wasm` is an engine build output, gitignored in
engine's public/, so SF1's tracked list missed it; it is engine art now.
A keyed sky names its files as templates such as
`/assets/<slug>/hdri/{id}_2k.key.jpg`; the check read that as one
missing file. A template is now covered when a mounted file or engine
art matches it, each placeholder standing for one path part.

Proof: the standalone-art tests and the whole format suite pass, and
Pine's header build passes the check on a local SDK pack.
