# Copy decoded recording bytes directly

Dense wire admission failed on Linux before SF-BAKE at 11.03 s
and after it at 11.10 s, with identical wire inputs and a 9.5 s
limit. Another run on that input passed at 8.61 s. The new GLB
proof runs in a separate job.

The local dense profile spent 2.33 s converting the binary string
returned by atob to a byte array. Copy its code units directly.
The 771 valid spellings and five malformed inputs in the local
comparison match the old bytes and error class. The complete dense
case went from 6.285 s to 3.316 s. All eight graph cases passed.
The frozen codec, recordings, hash and replay checks are unchanged.
