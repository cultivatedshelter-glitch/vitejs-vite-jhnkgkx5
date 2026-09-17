#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const thisFile = fileURLToPath(import.meta.url)
const thisDir = dirname(thisFile)
const pythonScript = join(thisDir, 'phase1_roof_vertical_slice.py')

function pythonCandidates() {
  const candidates = []
  if (process.env.SHELTER_PREP_PYTHON) candidates.push(process.env.SHELTER_PREP_PYTHON)
  if (process.env.PYTHON) candidates.push(process.env.PYTHON)
  if (process.env.HOME) {
    candidates.push(
      join(process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3'),
    )
  }
  candidates.push('python3')
  return [...new Set(candidates)]
}

function supportsPdfExtraction(command) {
  const check = spawnSync(command, ['-c', 'import pypdf'], { encoding: 'utf8' })
  return check.status === 0
}

export function resolvePythonCommand() {
  for (const command of pythonCandidates()) {
    if (command.includes('/') && !existsSync(command)) continue
    if (supportsPdfExtraction(command)) return command
  }
  throw new Error('No Python runtime with pypdf is available. Set SHELTER_PREP_PYTHON to a compatible python3.')
}

export function runVerticalSlice(args, options = {}) {
  const python = resolvePythonCommand()
  const result = spawnSync(python, [pythonScript, ...args], {
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  })
  return { python, result }
}

function main(argv) {
  const { python, result } = runVerticalSlice(argv, { stdio: 'inherit' })
  if (result.error) {
    console.error(result.error.message)
    process.exitCode = 1
    return
  }
  process.exitCode = result.status ?? 0
  if (process.env.SHELTER_PREP_DEBUG_PYTHON) {
    console.error(`Used Python: ${resolve(python)}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  try {
    main(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
