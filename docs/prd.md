# shardfile: PRD

Status: draft 2026-11-05: drafted by Claude from `Raynos/project-wildshard-meta` plans, for Jake to correct.

Living doc: **what** this repo does and **why**. How it is built is
`docs/design.md`; decisions are `docs/decisions.md`; the first plan is
in `docs/plans/`. Requirement ids (`R-1`) are stable: cite them from
plans, commits and tests.

## In Jake's words (REPOS.md)

> The raw shardfile spec, the raw shardfile validator, raw spec, raw validator. Depends on nothing. Validator can be CLI too.

## One line

The raw shardfile format: the spec, the validator and a validate CLI. The public, versioned contract every other repo builds on.

## Requirements

- **R-1**: The shardfile spec (`shard.json`, file families, the script ABI) and `SHARDFILE_VERSION`
- **R-2**: The validator: schema, hashes, budgets, admission rows
- **R-3**: The JSON Schema
- **R-4**: The `shardfile validate` CLI (format checks only)

## Not this repo

- Baking or building a shardfile from source (sharddev)
- Cooking runtime packs (engine)
- Re-executing shard scripts to prove them (sharddev, the engine cook worker)

## Who uses it

- engine
- api-server
- sharddev
- www.wildshard.io
