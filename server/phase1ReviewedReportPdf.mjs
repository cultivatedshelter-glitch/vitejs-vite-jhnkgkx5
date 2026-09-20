import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

export async function generateReviewedReportPdf(document, { python = process.env.SHELTER_PREP_PYTHON || (existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3') } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shelter-prep-report-'))
  const input = join(directory, 'report.json')
  const output = join(directory, 'report.pdf')
  try {
    await writeFile(input, JSON.stringify(document))
    await new Promise((accept, reject) => {
      const child = spawn(python, [resolve('scripts/phase1_reviewed_report_pdf.py'), input, output], { stdio: ['ignore', 'ignore', 'pipe'] })
      let error = ''
      child.stderr.on('data', (chunk) => { error += chunk })
      child.on('error', reject)
      child.on('close', (code) => code === 0 ? accept() : reject(new Error(`PDF generation failed (${code}): ${error.slice(0, 1000)}`)))
    })
    return new Uint8Array(await readFile(output))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
