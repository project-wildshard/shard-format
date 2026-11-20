# Mirror Salt find declarations

> State: 2026-11-20. MSZ38 format support.
> Written by: Codex

A player dock can require a quest flag. A shared dock cannot use a
player's unlock. This leaves the existing ungated rows byte-for-byte
compatible.

The script lane already publishes each visible numeric player field to
its owner. A spent-use condition can read that field, so one player's
pennant pickup or chest opening does not remove another player's prompt.
Undeclared and hidden fields still cannot spend the use.
