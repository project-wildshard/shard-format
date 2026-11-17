import { parseDecisionScripts } from './decisionScripts.ts'

import type { CreaturePerchBody } from './creature-perch.ts'
import type { ScriptAdmissionRows } from './scriptContract.ts'

type Frozen<Value> = Value extends readonly (infer Item)[]
  ? readonly Frozen<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: Frozen<Value[Key]> }
    : Value

const ZERO = 0
const ABI_TWO = 2
type Row = ScriptAdmissionRows[number]

function admissionIdentity(row: Frozen<Row>): string {
  return JSON.stringify(
    row.abi === ABI_TWO
      ? [
          row.side,
          row.abi,
          row.pages,
          row.lane,
          row.ioBytes,
          row.compilerRevision,
          row.admissionRevision,
        ]
      : [row.side, row.abi, row.pages],
  )
}

function programRow(body: Frozen<CreaturePerchBody>): Row {
  const { program } = body
  const artifact = program.v2?.artifact
  const module =
    artifact === undefined
      ? program.script.module
      : `blobs/wasm/${artifact.hash}.wasm`
  const id = `perch.${module.slice('blobs/wasm/'.length, -'.wasm'.length)}`
  if (artifact !== undefined) {
    return {
      id,
      side: 'sim' as const,
      module,
      abi: ABI_TWO,
      lane: artifact.lane,
      pages: artifact.pages,
      ioBytes: artifact.ioBytes,
      compilerRevision: artifact.compilerRevision,
      admissionRevision: artifact.admissionRevision,
    }
  }
  const [row] = parseDecisionScripts([{ ...program.script, id }])
  if (row === undefined) {
    throw new Error('Missing perch module contract')
  }
  return row
}

/** Add only the actual runtime VM to normal file, byte and whole-host admission.
 * An ABI-2 program's ABI-1 witness is not another live simulation instance. */
function creaturePerchAdmissionRows(
  bodies: readonly Frozen<CreaturePerchBody>[],
  existing: readonly Frozen<Row>[] = [],
): ScriptAdmissionRows {
  const rows: Row[] = []
  for (const body of bodies) {
    const row = programRow(body)
    const matches = [...existing, ...rows].filter(
      (candidate: Frozen<Row>): boolean => candidate.module === row.module,
    )
    if (
      matches.some(
        (previous: Frozen<Row>): boolean =>
          admissionIdentity(previous) !== admissionIdentity(row),
      )
    ) {
      throw new Error('Conflicting perch module contracts')
    }
    if (matches.length === ZERO) {
      rows.push(row)
    }
  }
  return rows
}
export { creaturePerchAdmissionRows }
