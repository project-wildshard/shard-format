import { parse } from 'valibot';
declare const ZERO = 0;
declare const ONE = 1;
declare const TWO = 2;
declare const MAX_EXPANDED = 100000000;
declare const MAX_NODES = 500000;
declare const NodeSchema: import("valibot").UnionSchema<[import("valibot").TupleSchema<[import("valibot").LiteralSchema<0, undefined>, import("valibot").UnionSchema<[import("valibot").NullSchema<undefined>, import("valibot").BooleanSchema<undefined>, import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").FiniteAction<number, undefined>]>, import("valibot").StringSchema<undefined>], undefined>], undefined>, import("valibot").TupleSchema<[import("valibot").LiteralSchema<1, undefined>, import("valibot").ArraySchema<import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, undefined>], undefined>, import("valibot").TupleSchema<[import("valibot").LiteralSchema<2, undefined>, import("valibot").ArraySchema<import("valibot").TupleSchema<[import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>, import("valibot").SchemaWithPipe<readonly [import("valibot").NumberSchema<undefined>, import("valibot").IntegerAction<number, undefined>, import("valibot").MinValueAction<number, 0, undefined>]>], undefined>, undefined>], undefined>], undefined>;
type Scalar = null | boolean | number | string;
type Node = readonly [typeof ZERO, Scalar] | readonly [typeof ONE, readonly number[]] | readonly [typeof TWO, readonly (readonly [number, number])[]];
declare function nodeOf(value: unknown): ReturnType<typeof parse<typeof NodeSchema>>;
declare class Dictionary {
    readonly nodes: Node[];
    private readonly keys;
    private node;
    put(value: unknown): number;
    private retain;
}
/** Validate every reference and expansion bound before constructing any output container. */
declare function expand(nodes: readonly Node[], root: number): unknown;
export { Dictionary, expand, nodeOf, MAX_EXPANDED, MAX_NODES, type Node };
