/** What the release rules say: the ref compared, and its problems. */
interface ReleaseResult {
    readonly against: string | undefined;
    readonly problems: readonly string[];
}
/** The release rules for the lock at `current`, against `against` or the last reachable release. */
declare function checkRelease(cwd: string, current: string, against: string | undefined): Promise<ReleaseResult>;
export { checkRelease, type ReleaseResult };
