import { readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'

import {
  array,
  exactOptional,
  parse,
  record,
  strictObject,
  string,
} from 'valibot'

import {
  assemblyStages,
  clientPlanKinds,
  constantLimits,
  fileFamilies,
  nativeAssemblyHosts,
  runtimePlanKinds,
  sectionHolds,
  sectionNames,
} from './contract-lists.ts'

import type { Limit, Sided } from './contract-lists.ts'

// SHARD-AUTHORING SA19: docs/RUNTIME-CONTRACT.md lists what a shard may declare. Every list shard-format holds is
// generated between `<!-- generated:<block> -->` and `<!-- /generated:<block> -->`; the engine-only columns come from
// runtime-hosts.json, copied by hand from engine. `node src/tools/runtime-contract.ts write` rewrites the blocks;
// runtime-contract.test.ts fails when the page drifts from the code or the host file misses a name.

const ROOT = new URL('../../', import.meta.url)
const CONTRACT_PATH = 'docs/RUNTIME-CONTRACT.md'
const HOSTS_URL = new URL('runtime-hosts.json', import.meta.url)
const NONE = '—'
const EMPTY = 0
const FIRST = 0
const COMMAND_ARG = 2
const EXIT_USAGE = 2

const Names = array(string())
const SectionHostSchema = strictObject({
  hosts: Names,
  note: exactOptional(string()),
})
const KindHostSchema = strictObject({ page: Names, reads: Names })
const HostsSchema = strictObject({
  $doc: string(),
  engine: string(),
  sections: record(string(), SectionHostSchema),
  kinds: record(string(), KindHostSchema),
})

/** The engine-only facts: section hosts and client plan kind hosts. */
type RuntimeHosts = Readonly<{
  engine: string
  sections: Readonly<
    Record<string, Readonly<{ hosts: readonly string[]; note?: string }>>
  >
  kinds: Readonly<
    Record<
      string,
      Readonly<{ page: readonly string[]; reads: readonly string[] }>
    >
  >
}>

/** What each constant limits, keyed `<constant>.<key>`. A new key without a line here refuses. */
const LIMIT_MEANS: Readonly<Record<string, string>> = Object.freeze({
  'SHARDFILE_ADMISSION_LIMITS.sourceBytes':
    'bytes of canonical `shard.json` source; also all sections together',
  'SHARDFILE_ADMISSION_LIMITS.files': 'file rows',
  'SHARDFILE_ADMISSION_LIMITS.commons': 'commons references',
  'SHARDFILE_ADMISSION_LIMITS.stateFields': 'state fields per scope',
  'SHARDFILE_ADMISSION_LIMITS.waterBodies': 'water bodies',
  'SHARDFILE_ADMISSION_LIMITS.idCharacters': 'characters in an id or name',
  'SHARDFILE_ADMISSION_LIMITS.textCharacters': 'characters of free text',
  'SHARDFILE_ADMISSION_LIMITS.wireBytes':
    'distinct declared download bytes, commons included',
  'SCRIPT_V1_LAYOUT.major': 'script ABI v1 major version',
  'SCRIPT_V1_LAYOUT.slotBytes': 'bytes per slot (one f64)',
  'SCRIPT_V1_LAYOUT.header': 'header slots',
  'SCRIPT_V1_LAYOUT.state': 'declared state slots per script',
  'SCRIPT_V1_LAYOUT.params': 'declared parameters per script',
  'SCRIPT_V1_LAYOUT.events': 'events delivered per call',
  'SCRIPT_V1_LAYOUT.eventWidth': 'slots per event',
  'SCRIPT_V1_LAYOUT.commands': 'commands per call',
  'SCRIPT_V1_LAYOUT.commandWidth': 'slots per command',
  'SCRIPT_V1_LAYOUT.fixedHz': 'fixed simulation steps per second',
  'SCRIPT_V1_LAYOUT.decisionDivisor':
    'steps per decision tick (60 / 6 = 10 Hz)',
  'SCRIPT_V1_LAYOUT.maximumPages': '64 KiB memory pages per v1 module',
  'SCRIPT_ABI.version': 'core script ABI version (v0)',
  'SCRIPT_ABI.assemblyscript': 'pinned AssemblyScript compiler',
  'SCRIPT_ABI.binaryen': 'pinned Binaryen',
  'SCRIPT_ABI.maxBytes': 'bytes per Wasm module',
  'SCRIPT_ABI.memoryPages': '64 KiB memory pages per v0 module',
  'SCRIPT_ABI.maxFunctions': 'functions and types per module',
  'SCRIPT_ABI.maxGlobals': 'globals per module',
  'SCRIPT_ABI.maxLocals': 'locals per function',
  'SCRIPT_ABI.callDepth': 'call depth',
})

/** Read and check runtime-hosts.json. */
async function readRuntimeHosts(): Promise<RuntimeHosts> {
  const text = await readFile(HOSTS_URL, 'utf8')
  const parsed: unknown = JSON.parse(text)
  return parse(HostsSchema, parsed)
}

/** `code` in Markdown. */
function code(text: string): string {
  return `\`${text}\``
}

/** Each name as `code`, joined with commas, or a dash for none. */
function codes(names: readonly string[]): string {
  return names.length === EMPTY
    ? NONE
    : names.map((name: string): string => code(name)).join(', ')
}

/** One Markdown table row; a `|` inside a cell is escaped, even in code. */
function line(cells: readonly string[]): string {
  const escaped = cells.map((cell: string): string =>
    cell.replaceAll('|', String.raw`\|`),
  )
  return `| ${escaped.join(' | ')} |`
}

/** One Markdown table. */
function table(
  head: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const rule = line(head.map((): string => '---'))
  const body = rows.map((cells: readonly string[]): string => line(cells))
  return [line(head), rule, ...body].join('\n')
}

/** `name (side)` for each `side name` host entry. */
function hostCells(hosts: readonly string[]): string {
  return hosts
    .map((entry: string): string => {
      const [side = '', name = ''] = entry.split(' ')
      return `${code(name)} (${side})`
    })
    .join(', ')
}

/** What one section holds, as a cell. */
function holdsCell(name: string): string {
  const holds = sectionHolds(name)
  return holds === 'plain' ? 'plain value' : `root ${codes(holds)}`
}

/** The sections table. */
function sectionsBlock(hosts: RuntimeHosts): string {
  const rows = sectionNames().map((name: string): string[] => {
    const row = hosts.sections[name]
    if (row === undefined) {
      throw new Error(`runtime-hosts.json has no section ${name}`)
    }
    const engine =
      row.hosts.length === EMPTY
        ? `none: ${row.note ?? 'metadata'}`
        : hostCells(row.hosts)
    const schema = code(`wildshard:${name}@1`)
    return [code(name), schema, holdsCell(name), engine]
  })
  return table(['Section', 'Schema', 'Holds', 'Engine host'], rows)
}

/** The side word and server host cell of one sided row. */
function sideCells(row: Sided): readonly [string, string] {
  return row.side.side === 'view'
    ? ['view', NONE]
    : [row.side.side, code(row.side.server)]
}

/** The `client/plan` kinds table. */
function kindsBlock(hosts: RuntimeHosts): string {
  const rows = clientPlanKinds().map((sided: Sided): string[] => {
    const row = hosts.kinds[sided.kind]
    if (row === undefined) {
      throw new Error(`runtime-hosts.json has no kind ${sided.kind}`)
    }
    const [side, server] = sideCells(sided)
    return [code(sided.kind), side, server, codes(row.page), codes(row.reads)]
  })
  const head = ['Kind', 'Side', 'Server host', 'Page host', 'Reads sections']
  return table(head, rows)
}

/** The `world.assembly` stage kinds table. */
function stagesBlock(): string {
  const rows = assemblyStages().map((sided: Sided): string[] => {
    const [side, server] = sideCells(sided)
    return [code(sided.kind), side, server]
  })
  return table(['Stage', 'Side', 'Server host'], rows)
}

/** The server-class plans and their host names. */
function serverBlock(): string {
  const hosts = nativeAssemblyHosts()
  const count = String(hosts.length)
  return [
    `\`server/native-assembly.json\` \`features[].host\`, ${count} hosts: ${codes(hosts)}.`,
    '',
    `\`sim/runtime-plan\` \`kind\`: ${codes(runtimePlanKinds())}.`,
  ].join('\n')
}

/** The registered named-file families table. */
function familiesBlock(): string {
  const rows = fileFamilies().map((family): string[] => [
    code(family.pattern),
    code(family.schema),
  ])
  return table(['Name pattern', 'Defining schema'], rows)
}

/** The limits table; a limit without a meaning refuses. */
function limitsBlock(): string {
  const rows = constantLimits().map((limit: Limit): string[] => {
    const means = LIMIT_MEANS[`${limit.constant}.${limit.key}`]
    if (means === undefined) {
      throw new Error(`No meaning for ${limit.constant}.${limit.key}`)
    }
    return [code(limit.key), limit.value, means, code(limit.constant)]
  })
  return table(['Limit', 'Value', 'Means', 'Constant'], rows)
}

/** Every generated block, as [name, body]. */
function generatedBlocks(hosts: RuntimeHosts): (readonly [string, string])[] {
  return [
    ['sections', sectionsBlock(hosts)],
    ['kinds', kindsBlock(hosts)],
    ['stages', stagesBlock()],
    ['server', serverBlock()],
    ['families', familiesBlock()],
    ['limits', limitsBlock()],
  ]
}

/** The page with every generated block replaced; a missing marker refuses. */
function renderContract(
  page: string,
  blocks: readonly (readonly [string, string])[],
): string {
  let out = page
  for (const [name, body] of blocks) {
    const open = `<!-- generated:${name} -->\n`
    const close = `\n<!-- /generated:${name} -->`
    const start = out.indexOf(open)
    const end = out.indexOf(close, start)
    if (start < FIRST || end < FIRST) {
      throw new Error(`${CONTRACT_PATH} has no generated:${name} block`)
    }
    out = `${out.slice(FIRST, start + open.length)}${body}${out.slice(end)}`
  }
  return out
}

/** The page as committed. */
async function readContract(): Promise<string> {
  return await readFile(new URL(CONTRACT_PATH, ROOT), 'utf8')
}

if (import.meta.main) {
  if (process.argv[COMMAND_ARG] === 'write') {
    const page = await readContract()
    const hosts = await readRuntimeHosts()
    const next = renderContract(page, generatedBlocks(hosts))
    await writeFile(new URL(CONTRACT_PATH, ROOT), next)
    const said = page === next ? 'unchanged' : 'rewritten'
    process.stdout.write(`${CONTRACT_PATH} ${said}\n`)
  } else {
    process.stderr.write('usage: node src/tools/runtime-contract.ts write\n')
    process.exitCode = EXIT_USAGE
  }
}

export {
  CONTRACT_PATH,
  generatedBlocks,
  readContract,
  readRuntimeHosts,
  renderContract,
}
export type { RuntimeHosts }
