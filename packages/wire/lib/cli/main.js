import { checkBaseline } from './baseline.js';
const FIRST_CLI_ARGUMENT = 2;
const ONE_ARGUMENT = 1;
const BASELINE_ARGUMENTS = 2;
const EXIT_USAGE = 1;
const EXIT_OK = 0;
async function runBaseline() {
    await checkBaseline();
    process.stdout.write('wire check --baseline: frozen v0 lock verified\n');
    return EXIT_OK;
}
async function run() {
    const args = process.argv.slice(FIRST_CLI_ARGUMENT);
    const [command, option] = args;
    if (command === 'check' &&
        option === '--baseline' &&
        args.length === BASELINE_ARGUMENTS) {
        return await runBaseline();
    }
    if (command === 'check' && args.length === ONE_ARGUMENT) {
        process.stdout.write('wire check: scaffold only; use --baseline for frozen v0; no v1 rules installed\n');
        return EXIT_OK;
    }
    process.stderr.write('Usage: wire check [--baseline] | --version\n');
    return EXIT_USAGE;
}
try {
    process.exitCode = await run();
}
catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = EXIT_USAGE;
}
