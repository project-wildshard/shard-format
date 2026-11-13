# 2026-11-12: npm publish prep (NPM-PUBLISH NP1)

- Jake, 23:10 Cancún: "publish stuff to npm so it can be installed without git
  links". Plan: meta `docs/plans/NPM-PUBLISH-PLAN.md`.
- `@wildshard/shard-format` and `@wildshard/wire` drop `"private": true` and
  gain `license` (UNLICENSED, today's all-rights-reserved state until Jake picks
  one), `repository` (trusted publishing matches it exactly) and
  `publishConfig.access: public`. Both already had a `files` list; nothing is
  built, the TypeScript ships raw as J53/J82 already require.
- `.github/workflows/npm-publish.yml`: a `vX.Y.Z` tag publishes shard-format,
  `wire-vX.Y.Z` publishes wire, by OIDC with no token. It checks the tag is the
  package.json version and every bin and export is in the tarball, and skips
  with a notice while the package does not exist yet: npm only trusts a
  publisher for a package that exists, so Jake publishes each first version.
- Measured with `npm pack --dry-run`: shard-format 743 files, 4.1 MB packed;
  wire 215 files, 166 kB.
