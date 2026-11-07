#!/usr/bin/env node
import { installFormatHook } from '../hook/format-hook.mjs'

// The `shardfile` bin. Node will not strip types under node_modules (J53), so
// an installed CLI needs the hook before its first .ts. This file is plain
// JavaScript for the same reason `format-hook.mjs` is.
installFormatHook()
await import('./main.ts')
