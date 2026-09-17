import { spawnSync } from 'node:child_process'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'

export function runPhase1PricingContract(args = []) {
  const python = resolvePythonCommand()
  const result = spawnSync(python, ['scripts/phase1_pricing_contract.py', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  return { python, result }
}

if (process.argv[1]?.endsWith('phase1-pricing-contract.mjs')) {
  const { result } = runPhase1PricingContract(process.argv.slice(2))
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  process.exitCode = result.status ?? 1
}
