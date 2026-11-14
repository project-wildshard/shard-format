/**
 * `look.sky` (meta SHARD-SOURCE AP14): a painted sky, as a material graph the engine draws on its sky dome in place of
 * the two-colour gradient. The engine filters the look's environment (`look.light.environment`) from the same dome, so
 * a shiny surface or a pond reflects the painted sky, not the gradient. Absent, the dome keeps its keys' zenith and
 * horizon and an older shard file keeps its bytes.
 *
 * The graph is an unlit material (`kind: 'material'`, `model: 'unlit'`) whose `surface.colour` is the sky's linear
 * colour along the dome's direction: the dome is centred on the camera, so `normalize(positionLocal)` is the view ray
 * (y up). It may read params (bound to a day key or public state like any graph), time and the sky light's direction,
 * but no texture, and it draws no vertex stage, alpha, outline or lighting stage. It is costed under its own budget,
 * {@link LOOK_SKY_BUDGET}: the dome covers at most the screen once, like one post pass. A sky is inline graph IR
 * (`{ graph }`); the SDK writes it from TSL (`world.sky(...)`).
 *
 * Plain data and checks, no three.js.
 */
import { pipe, rawTransform, strictObject, unknown } from 'valibot'

import { isJsonData } from './json.ts'
import { validateGraph } from './materialGraph.ts'

import type { GraphBudget, GraphIr } from './materialGraph.ts'
import type { GenericSchema } from 'valibot'

/** What validation names beside the graph: the day keys and public state fields its params may bind (any when absent). */
interface LookSkyBindings {
  readonly dayKeys?: readonly string[]
  readonly stateFields?: readonly string[]
}
/** The bindings a shard admits, as `graphBindingSources` reads them. */
interface LookSkySources {
  readonly day: ReadonlyMap<string, unknown>
  readonly state: readonly string[]
}
/** A checked sky: the graph, or every reason it is not one. */
type LookSkyCheck =
  | { readonly ok: true; readonly graph: GraphIr }
  | { readonly ok: false; readonly errors: readonly string[] }
/** Admitted data contracts. */
type LookSkyGraphInput = unknown
type LookSkyGraph = GraphIr
interface LookSkyInput {
  graph: LookSkyGraphInput
}
interface LookSky {
  graph: LookSkyGraph
}

/** A sky's ceilings: a painted dome with clouds is a few hundred nodes of value noise; no samplers */
const LOOK_SKY_BUDGET: GraphBudget = Object.freeze({
  nodes: 640,
  samplers: 0,
  instructions: 1024,
})
const NONE = 0

/** A sky is an unlit dome material: no points, no other model. */
function modelErrors(graph: GraphIr): string[] {
  const errors: string[] = []
  if (graph.kind !== 'material' || graph.model !== 'unlit') {
    errors.push('sky: an unlit material graph (kind material, model unlit)')
  }
  if (graph.primitive !== undefined && graph.primitive !== 'mesh') {
    errors.push('sky: drawn on the dome mesh, not points')
  }
  return errors
}

/** A sky draws only its surface colour. */
function stageErrors(graph: GraphIr): string[] {
  const errors: string[] = [],
    stages = Object.keys(graph.stages).filter(
      (stage: string): boolean => stage !== 'surface',
    )
  if (stages.length > NONE) {
    errors.push(`sky: only the surface stage (not ${stages.join(', ')})`)
  }
  const surface = Object.keys(graph.stages.surface ?? {})
  if (!surface.includes('colour')) {
    errors.push('sky: surface.colour is the sky colour')
  }
  const extra = surface.filter((output: string): boolean => output !== 'colour')
  if (extra.length > NONE) {
    errors.push(`sky: surface.colour only (not ${extra.join(', ')})`)
  }
  return errors
}

/** The sky graph, or every reason `ir` is not one. */
function checkLookSky(
  ir: unknown,
  bindings: LookSkyBindings = {},
): LookSkyCheck {
  if (!isJsonData(ir)) {
    return { ok: false, errors: ['sky: plain JSON data'] }
  }
  const checked = validateGraph(ir, { ...bindings, budget: LOOK_SKY_BUDGET })
  if (!checked.ok) {
    return {
      ok: false,
      errors: checked.errors.map((error: string): string => `sky: ${error}`),
    }
  }
  const errors = [...modelErrors(checked.graph), ...stageErrors(checked.graph)]
  return errors.length === NONE
    ? { ok: true, graph: checked.graph }
    : { ok: false, errors }
}

/** Every reason `ir` is not a sky (empty: it is one). */
function lookSkyErrors(
  ir: unknown,
  bindings: LookSkyBindings = {},
): readonly string[] {
  const checked = checkLookSky(ir, bindings)
  return checked.ok ? [] : checked.errors
}

const SkyGraphSchema: GenericSchema<LookSkyGraphInput, LookSkyGraph> = pipe(
  unknown(),
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- valibot's transform context, which it owns
  rawTransform(({ dataset, addIssue, NEVER }): GraphIr => {
    const checked = checkLookSky(dataset.value)
    if (!checked.ok) {
      addIssue({ message: checked.errors.join('; ') })
      return NEVER
    }
    return checked.graph
  }),
)

/** `look.sky`: the dome's painted sky. */
const LookSkySchema: GenericSchema<LookSkyInput, LookSky> = strictObject({
  graph: SkyGraphSchema,
})

/** The schema's rule for a sky (`look.sky?.graph`): its params bind only to the shard's day keys and public numeric state. */
function lookSkyRules(
  graph: unknown,
  sources: LookSkySources,
): readonly string[] {
  if (graph === undefined) {
    return []
  }
  return lookSkyErrors(graph, {
    dayKeys: [...sources.day.keys()],
    stateFields: sources.state,
  })
}

export {
  LOOK_SKY_BUDGET,
  LookSkySchema,
  checkLookSky,
  lookSkyErrors,
  lookSkyRules,
}
export type {
  LookSky,
  LookSkyBindings,
  LookSkyCheck,
  LookSkyGraph,
  LookSkyGraphInput,
  LookSkyInput,
  LookSkySources,
}
