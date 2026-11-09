/** Who receives a field. `initial` goes once in the spawn event, then never again (COND_InitialOnly). */
export type NetSend = 'all' | 'owner' | 'others' | 'initial';
/** A value a decoded field yields: a number, a flag, a string, or a `ref` handle (0 for none). */
export type NetValue = number | boolean | string;
interface NetFieldBase {
    readonly send?: NetSend;
    /** The owner's client predicts this field; it arrives unquantised in the owner block, and is compared unless a correction takes it. */
    readonly predicted?: true;
}
/** One declared field: its wire form and the accessor that reads it from a server-side view `S`. */
export type NetField<S> = NetFieldBase & ({
    readonly kind: 'f32q';
    readonly min: number;
    readonly max: number;
    readonly bits: number;
    readonly read: (view: S) => number;
} | {
    readonly kind: 'f32' | 'f64';
    readonly read: (view: S) => number;
} | {
    readonly kind: 'angle';
    readonly bits: 8 | 10 | 16;
    readonly read: (view: S) => number;
} | {
    readonly kind: 'u8' | 'u16' | 'u32';
    readonly read: (view: S) => number;
} | {
    readonly kind: 'bool';
    readonly read: (view: S) => boolean;
} | {
    readonly kind: 'enum';
    readonly values: readonly string[];
    readonly read: (view: S) => string;
} | {
    readonly kind: 'ref';
    readonly read: (view: S) => string | null;
} | {
    readonly kind: 'text';
    readonly read: (view: S) => string;
});
/** One entity class's declaration. */
export interface NetSchema<S> {
    readonly cls: string;
    readonly fields: Readonly<Record<string, NetField<S>>>;
    /** Replicated only within this many metres of the receiver's player; absent means everywhere in the cell. */
    readonly relevance?: {
        readonly radius: number;
    };
}
/** Declare a class. Typed as a function so a table's accessors infer `S`. */
export declare function netSchema<S>(schema: NetSchema<S>): NetSchema<S>;
/** Maps stable string ids to the receiver's net handles for `ref` fields (§3.4). */
export type NetRefs = (id: string) => number;
/** One compiled field. `sample` reads and quantises; `value` undoes it; `step` is one quantisation step (0 when exact). An `f64` is 64 bits: only an owner block, which holds doubles, carries it. */
export interface NetColumn<S> {
    readonly name: string;
    readonly kind: NetField<S>['kind'];
    readonly bits: number;
    readonly step: number;
    readonly sample: (view: S, refs: NetRefs) => number;
    readonly value: (quantised: number) => NetValue;
}
/** A compiled class: its fields split by audience. A row holds one quantised value per `row` column. */
export interface NetClass<S> {
    readonly id: number;
    readonly cls: string;
    /** Delta rows for everyone: `all` and `others` fields. */
    readonly row: readonly NetColumn<S>[];
    /** The owner block, written whole every frame: `all`, `owner` and `predicted` fields. */
    readonly owner: readonly NetColumn<S>[];
    /** Spawn-only fields that fit a row value. */
    readonly initial: readonly NetColumn<S>[];
    /** Spawn-only strings. */
    readonly text: readonly {
        readonly name: string;
        readonly read: (view: S) => string;
    }[];
    readonly radius: number | null;
    /** Indices of the row's x, y and z, which relevance measures with; null for a class with no position. */
    readonly position: readonly [number, number, number] | null;
}
/** The most row fields a class may declare: the changed-field mask is one 32-bit word. */
export declare const MAX_ROW_FIELDS = 32;
/** Compile one declaration, refusing a table the wire cannot carry. */
export declare function compileSchema<S>(schema: NetSchema<S>, id: number): NetClass<S>;
/** The word NET_SCHEMA_HASH is: FNV-1a over every class's canonical text, so it changes whenever the wire does. */
export declare function netSchemaHash(descriptions: readonly string[]): number;
/** One class's contribution to the hash. */
export declare function schemaDescription<S>(schema: NetSchema<S>): string;
export {};
