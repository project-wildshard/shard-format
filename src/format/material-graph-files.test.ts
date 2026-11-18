import { expect, test } from 'vitest';
import * as v from 'valibot';
import { INLINE_GRAPH_REFUSAL, MaterialsSchema, graphFileRules, inlineGraphRules, materialGraphIr, materialGraphRules } from './materials.ts';
import { PostStackSchema, postStackCost } from './postStack.ts';
import type { Shardfile } from './shardSchema.ts';

const graph = { version: 1, kind: 'material', model: 'toon', nodes: { paint: { op: 'const', type: 'vec3', value: [1, 1, 1] } }, stages: { surface: { colour: 'paint' } } };

const state: Shardfile['state'] = { version: 1, sharedOwner: 'host', playerKey: 'actorId', shared: [], player: [] };
const baseBudget: Shardfile['budgets'] = { library: { resident: 1, compressed: 1 }, sim: { resident: 1, compressed: 1 }, overlap: 0 };
// oxlint-disable-next-line unicorn/no-null -- the nullable authored look and LUT have explicit empty wire values
const baseLook: Shardfile['look'] = { families: [], familyLooks: {}, materials: {}, keys: [], clock: 'engine', dayOverride: null, grade: { exposure: 0, saturation: 1, contrast: 1, lut: null } };

test('a built product refuses an inline catalogue graph with its reason (D74: the SDK lowers it into a graph file)', () => {
  // the authored declaration still parses with its inline graph; product admission is the wire boundary
  const authored = v.parse(MaterialsSchema, { cel: { family: 'graph', graph }, file: { family: 'graph', file: 'a'.repeat(64) } });
  expect(inlineGraphRules(authored)).toEqual([`material cel: ${INLINE_GRAPH_REFUSAL}`]);
  expect(INLINE_GRAPH_REFUSAL).toBe('material catalogue holds no inline graph: the SDK lowers an authored graph into a graph file { family: "graph", file }');
});

test('a reader takes a graph file only', () => {
  const bytes = new TextEncoder().encode(JSON.stringify(graph)), file = 'a'.repeat(64);
  expect(materialGraphIr({ family: 'graph', file }, hash => (hash === file ? bytes : undefined)).model).toBe('toon');
  const inline = v.parse(MaterialsSchema, { cel: { family: 'graph', graph } })['cel'];
  if (inline === undefined) throw new Error('Missing fixture entry');
  expect(() => materialGraphIr(inline, () => undefined)).toThrow('material graph IR needs a graph file');
});

test('OF10c4 validates authored and packed graphs against the named tier', (): void => {
  const file = 'a'.repeat(64);
  const input = { ...graph, budget: { nodes: 1024, samplers: 16, instructions: 8192 },
    nodes: { ...graph.nodes, ...Object.fromEntries(Array.from({ length: 520 }, (_unused, index): [string, { op: string; type: string; value: number }] => [`node${index}`, { op: 'const', type: 'float', value: 1 }])) } };
  const inline = v.parse(MaterialsSchema, { cel: { family: 'graph', graph: input } });
  const packed = v.parse(MaterialsSchema, { cel: { family: 'graph', file } });
  const look = { ...baseLook, materials: inline };
  const graphFiles = new Map([[file, new TextEncoder().encode(JSON.stringify(input))]]);
  const check = (tier: 'small' | 'large'): string[][] => {
    const budgeted = { look, state, files: [], budgets: { ...baseBudget, tier } };
    return [materialGraphRules(budgeted), graphFileRules({ ...budgeted, look: { ...look, materials: packed } },
      (hash): Uint8Array | undefined => graphFiles.get(hash))];
  };
  for (const notes of check('small')) { expect(notes.join(' ')).toMatch(/512/u); }
  expect(check('large')).toEqual([[], []]);
});

const emptyFiles = new Map<string, Uint8Array>();
const noFile = (hash: string): Uint8Array | undefined => emptyFiles.get(hash);

test('OF10c4 caps the full authored post stack at its tier', (): void => {
  const post = { version: 1, kind: 'post', nodes: { paint: { op: 'const', type: 'vec3', value: [1, 1, 1] } }, stages: { post: { colour: 'paint' } } };
  const look = { ...baseLook, post: v.parse(PostStackSchema, [{ graph: post }, { graph: post }, { graph: post }]) };
  expect(postStackCost({ look, state, budgets: { ...baseBudget, tier: 'small' } }, noFile).errors).toContain('post: 3 passes (at most 2)');
  expect(postStackCost({ look, state, budgets: { ...baseBudget, tier: 'large' } }, noFile).errors).toEqual([]);
});
