# Every audio file counts toward the budget (AUDIO AU5 gap)

> Written by: Claude (lane opus-au5gap)

opus-au7 found that AU5's budget only counted `.m4a` and `.wav` mounts, so a
`.flac` or `.aiff` under `/assets/music` or `/assets/sfx` cost nothing. Now a
mount there counts when its extension is any audio one or its bytes sniff as
audio (`audioContainer`, `isRecordingMount`); `music.json` still doesn't. The
bytes pick the container, never the URL: AU7's build keeps source URLs, so a
`.wav` URL can hold AAC, and it is measured as AAC. Containers AU5 doesn't read
(FLAC, AIFF, Ogg, MP3, WebM, CAF, unknown) get the new red `audio-container`
code and their bytes still count.
