import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { enrichPhase1EnvironmentalContext } from './phase1EnvironmentalEnrichment.mjs'

const SCRIPT = resolve('scripts/phase1_round1_reasoning_benchmark.py')

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (code) => code === 0 ? resolveRun() : reject(new Error(stderr.trim() || `Reasoning process exited with status ${code}.`)))
  })
}

function pythonCommand() {
  return process.env.SHELTER_PREP_PYTHON
    || (process.env.HOME ? join(process.env.HOME, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3') : 'python3')
}

export async function runExistingPhase1Reasoning({ evidence }) {
  const reports = evidence.filter((item) => item.mediaType === 'application/pdf')
  if (reports.length !== 1) throw new Error('Exactly one PDF inspection report is required by the current Phase 1 processor.')
  const workDir = await mkdtemp(join(tmpdir(), 'shelter-prep-phase1-'))
  try {
    const outputName = 'artifact.json'
    await run(pythonCommand(), [
      SCRIPT,
      '--pdf', reports[0].localPath,
      '--shared-cache', join(workDir, 'evidence-cache.json'),
      '--output-dir', workDir,
      '--output-file', outputName,
    ])
    const artifact = JSON.parse(await readFile(join(workDir, outputName), 'utf8'))
    return process.env.SHELTER_PREP_ENABLE_LIVE_WEATHER === 'true'
      ? enrichPhase1EnvironmentalContext(artifact)
      : artifact
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
