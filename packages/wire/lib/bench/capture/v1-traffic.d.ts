import type { PreparedTraffic } from './benchmark-data.ts';
import type { CapturedSession } from './session-data.ts';
/** Which bytes to count: v1's tables, or the per-field-tag shape (5.6). */
type Shape = 'tables' | 'tags';
/** A captured session's traffic, as v1 work for `measureTraffic`; `tags` counts the per-field-tag shape's bytes instead. */
declare function prepareV1Traffic(session: CapturedSession, shape?: Shape): PreparedTraffic;
export { prepareV1Traffic };
