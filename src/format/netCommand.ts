// WIRE-STABILITY WR2: the command and act admission schemas live in
// `@wildshard/wire` (packages/wire/src/net-command.ts). This entry re-exports
// them unchanged, so `@wildshard/shard-format/netCommand` keeps its API.
export {
  NetActSchema,
  NetCommandSchema,
  type NetAct,
  type NetAim,
  type NetCommand,
  type NetSteer,
} from '../../packages/wire/src/net-command.ts';
