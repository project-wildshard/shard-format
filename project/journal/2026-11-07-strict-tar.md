# Strict tar reader

- The test audit built hostile tarballs by hand and `readTar` took them:
  `..\..\evil`, 200,000 entries, `a/./b`, a file that is also a folder,
  `Sh` beside `sh`, a directory with a size, non-zero padding.
- `readTar` now refuses all of them, and `writeTar` refuses to write
  them. The entry cap is `files` plus 1,024 for `tar -C product .`'s
  directories and the two root files. One test per bug, through
  `readTar`, per J186.
- All 61 tarballs in `~/.cache/wildshard` still read. The largest has
  1,286 files, so the cap is far from any real shard.
- Padding was the easy identity hole. The header's own spare bytes,
  such as mtime and uname, still let one set of files take many hashes,
  and a system `tar` writes them, so the reader can't refuse them.
- J186 says new tests never go in hooks, so the audit's cases moved to
  `src/ci`, which `pnpm test:ci` runs in CI. The refusal corpus is off
  the list too: only the bugs get tests.
