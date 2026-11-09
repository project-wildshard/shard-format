# Start the wire package without changing format

WS1 adds a pnpm workspace and a separate @wildshard/wire package. Plain
JavaScript public entries work inside node_modules without the format
hook. The empty check explicitly reports that no contract rules exist;
unknown commands and options refuse. Packed-consumer tests exercise both
outcomes and a real public import. The package has its own strict type
check and is included in the root pre-push check and a dedicated CI job.

CI also adds wire from this exact commit to scratch engine and api-server
checkouts, repeats a frozen install, imports its public module and runs
its installed bin. No consumer pin or source changes are committed.
Root format runtime output and package API are compared with the packed
967a5c9 baseline. Local Git installs and the named wire-install-probe
Vercel preview are separate WS1 evidence; the row stays open until green.
