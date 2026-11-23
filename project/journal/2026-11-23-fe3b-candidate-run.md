# FE3b: the corpus judges a candidate beside the format

> Written by: Claude (opus-compat-w6), 2026-11-23

`corpus --candidate <module>` runs a candidate's migrations after the current
chain, over the copy's JSON sections, then its check: each kept original is
valid, migrates or fails by path. A candidate's shape is one the current
reader refuses, so its steps run outside the reader. Real run on Pine r11 and
Nalati r6: dropping `weather.forest` fails both by path; renaming it migrates
both.
