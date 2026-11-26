# format.wildshard.io, the docs site (A3)

Jake asked for a public docs site for the format, for humans and agents,
on Cloudflare like www, and said the public repo's source is the spec.

- Built as plain Node in `src/scripts/site/` with its own small Markdown
  renderer: no new dependency, because package.json changes wait for
  Jake's sign-off. It renders `docs/*.md` as they are, so docs stay the
  single source, and adds a few hand-written pages in `src/site/pages/`.
- Two front doors: `/` (what a shard file is, pipeline, tour, budgets,
  glossary) and `/agents/` (Markdown twins of every page, `/llms.txt`,
  `/llms-full.txt`, and a SKILL.md for the `shard-format` CLI). The skill
  names only commands that exist; each one was run before it went in.
- The format version comes from `src/format/version.ts` at build time.
  `docs/SHARDFILE.md` still said `0.1.0.2`; fixed to `0.1.0.6`.
- The docs carry ~270 links to singleplayer-era files this repo doesn't
  have. The build keeps their text and drops the link rather than ship
  404s; links to files the repo has go to GitHub.
- Deploy mirrors www: a static-assets Worker, `wildshard-format`, with a
  custom domain on the same zone, shipped from a `git archive` of HEAD.
