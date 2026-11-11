import type { ReleaseLock } from './release-entries.ts';
/** The version rules: versions never fall; limits and grammar need a major; any change needs a minor. */
declare function versionProblems(old: ReleaseLock, next: ReleaseLock): readonly string[];
export { versionProblems };
