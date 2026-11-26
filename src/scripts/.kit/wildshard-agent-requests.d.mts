export const AGENT_HEADER: string;
export function agentUserAgent(base: string): string;
export function markedFetch(read: typeof fetch): typeof fetch;
export const agentFetch: typeof fetch;
