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

function submissionContext(note, actorId, evidence) {
  const text = String(note || '').trim()
  if (!text) return { humanObservations: [], transactionContext: { perspective: 'not_stated', source_basis: 'no_submitter_context' } }
  const perspective = /\bbuyer\b/i.test(text) ? 'buyer'
    : /\bseller\b/i.test(text) ? 'seller'
      : /\bhomeowner\b|\bowner\b/i.test(text) ? 'owner' : 'not_stated'
  return {
    humanObservations: [{
      id: 'submission-observation-1',
      observation: text,
      source: {
        identity: actorId || 'authenticated_submitter',
        role: 'authenticated_submitter',
        observed_at: null,
        submitted_at: new Date().toISOString(),
        directness: 'not_stated',
        professional_status: 'not_established',
        verification_status: 'source_material_needs_review',
        related_evidence_ids: evidence.map((item) => item.id).filter(Boolean),
      },
    }],
    transactionContext: {
      perspective,
      source_basis: perspective === 'not_stated' ? 'not_stated_by_submitter' : 'explicit_submitter_note',
      decision_rule: 'Context changes emphasis and tradeoffs, not the underlying evidence or verified finding.',
    },
  }
}

function applyTransactionPerspective(artifact, perspective) {
  if (perspective === 'not_stated') return
  const considerations = perspective === 'buyer'
    ? [
        'Compare routine repair and replacement paths for longer-term reliability and ownership budgeting.',
        'Confirm concealed conditions that could materially change post-closing scope or cost.',
      ]
    : perspective === 'seller'
      ? [
          'Compare which supported path resolves the documented condition within the transaction timeline.',
          'Confirm the narrowest defensible scope before choosing repair, replacement, or further evaluation.',
        ]
      : [
          'Compare routine repair and replacement paths for service life, disruption, and budget implications.',
          'Confirm the listed decision-changing conditions before selecting the field scope.',
        ]
  for (const observation of artifact.atomicObservations || []) {
    if (observation.finding_card) observation.finding_card.transaction_considerations = considerations
  }
}

export async function runExistingPhase1Reasoning({ evidence, note = '', actor = null }) {
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
    const context = submissionContext(note, actor?.id, evidence)
    Object.assign(artifact, context)
    applyTransactionPerspective(artifact, context.transactionContext.perspective)
    return process.env.SHELTER_PREP_ENABLE_LIVE_WEATHER === 'true'
      ? enrichPhase1EnvironmentalContext(artifact)
      : artifact
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}
