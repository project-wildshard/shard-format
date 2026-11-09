import { type NetClass, type NetField } from './schema.ts';
export declare const V0_SCHEMAS: {
    cls: "animal" | "encounter" | "flag" | "player" | "script" | "state";
    fields: Record<string, NetField<never>>;
    relevance?: {
        readonly radius: 160;
    };
}[];
export declare const V0_CLASSES: readonly NetClass<never>[];
export declare const V0_DESCRIPTIONS: string[];
