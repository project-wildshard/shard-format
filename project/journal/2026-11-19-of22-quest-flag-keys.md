# Keep authored quest flag keys in directors

> State: 2026-11-19. ONE-FORMAT OF22.
> Written by: Codex

Driftwood's altar records `used:altar` in quest saves. A stage can now
observe `flag:used:altar` and set namespaced quest flags. The colon is
available only in quest flag keys. Actor, event and zone rules keep
their existing grammar.
