import { spawnSync } from 'node:child_process'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'

export function runPhase1LiveSourceIntegration(args = []) {
  const python = resolvePythonCommand()
  const result = spawnSync(python, ['scripts/phase1_live_source_integration.py', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  return { python, result }
}

if (process.argv[1]?.endsWith('phase1-live-source-integration.mjs')) {
  const { result } = runPhase1LiveSourceIntegration(process.argv.slice(2))
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  process.exitCode = result.status ?? 1
}
