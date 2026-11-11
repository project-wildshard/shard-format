import type { NetField } from '../frozen/v0/schema.ts';
import type { WireClassField } from './grammar.ts';
/** A v0 field form, without its accessor: one variant per v0 kind. */
type V0FieldSpec = NetField<never> extends infer Field ? Field extends NetField<never> ? Readonly<Omit<Field, 'read'>> : never : never;
/** A class field's whole v0 form: kind, bounds, audience and prediction. */
declare function v0Field(field: WireClassField): V0FieldSpec;
export { v0Field, type V0FieldSpec };
