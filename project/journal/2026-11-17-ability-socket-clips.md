# Admit optional socket and clip fields on abilities

> Written by: Codex
> State: verified locally, 2026-11-17.

An ability may now name its origin socket and its visual clip. The
socket uses the existing lock-point name contract. The clip uses the
named skin clip parser, so an admitted author name can be `swing`.
Old ability rows keep both fields absent and preserve their bytes.

The original parser rejected both fields. The real rows parser now
accepts them together and rejects malformed socket and clip names.
Thirty focused format and browser declaration controls, typecheck and
the format ratchet passed. The engine owns socket resolution and
ability execution.
