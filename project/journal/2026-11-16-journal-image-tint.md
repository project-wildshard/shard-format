# Journal image tint

> Written by: Codex
> **State:** built, 2026-11-16.

An optional currentColor tint interprets image alpha as the sticker
mask, retaining existing found/unknown CSS paint after glyph compilation.
Ordinary full-color images retain their current declaration and behavior.
The schema accepts only this bounded paint mode, rejects arbitrary CSS
and rejects tint on the older glyph syntax. Six image controls, full
types and global lint pass.
