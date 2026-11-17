# Admit author browser launches through the machine broker

J402 BR5: route the existing Playwright launchers through the portable
machine-provider bridge. Preserve the exact browser library, options and
rendering workload. The shared provider owns one four-core browser slot
through close and limits the machine to two physical launches.

An absent machine policy leaves external author machines portable. An
unsafe or broken present policy refuses. The source census failed before
these imports changed. The machine cap is not live until the whole cohort
lands and its shared policy is installed; no artwork or pins change.

Format's private Node benchmarks keep their bridge beside the existing
`src/scripts/` tools, outside the published library. Its normal typecheck
now checks the bridge in a dedicated Node project; the common 12 private
policy controls run against that exact module. Existing lint policy for
plain Node scripts stays intact. No SDK dependency or library graph added.
