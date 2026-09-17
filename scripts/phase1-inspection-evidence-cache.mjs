#!/usr/bin/env node

import { resolve } from 'node:path'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { resolvePythonCommand } from './phase1-inspection-vertical-slice.mjs'

const thisFile = fileURLToPath(import.meta.url)
const thisDir = dirname(thisFile)
const pythonScript = join(thisDir, 'phase1_inspection_evidence_cache.py')

export function runInspectionEvidenceCache(args, options = {}) {
  const python = resolvePythonCommand()
  const result = spawnSync(python, [pythonScript, ...args], {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  })
  return { python, result }
}

function main(argv) {
  const { result } = runInspectionEvidenceCache(argv, { stdio: 'inherit' })
  if (result.error) {
    console.error(result.error.message)
    process.exitCode = 1
    return
  }
  process.exitCode = result.status ?? 0
}

if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
