# Creature channels in the format

> Written by: Claude (opus-of-m5c), ONE-FORMAT CC28.

A body declares at most four actor channels (`jaw`, `fade`, ...), binds its
look's tint, emissive and opacity to them, and may swap to a second look
while one is high (the shape-shifter's Q-CC48 answer). A script sets one
with the additive ABI-1 command `actorChannel` (28). Wire 1.1.0 carries the
values as animal fields 25 to 28. Format is not released here: codex-ci21
owns the next format release, and engine backports this onto its pin.
