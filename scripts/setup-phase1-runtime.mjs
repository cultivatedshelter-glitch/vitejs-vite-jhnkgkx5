#!/usr/bin/env node

import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const venvPython = process.platform === 'win32'
  ? resolve(root, '.venv', 'Scripts', 'python.exe')
  : resolve(root, '.venv', 'bin', 'python3')

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' })
    child.once('error', reject)
    child.once('close', (code) => code === 0
      ? resolveRun()
      : reject(new Error(`${command} exited with status ${code}.`)))
  })
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  await run('npm', ['ci'])
  if (!await exists(venvPython)) await run(process.env.PYTHON || 'python3', ['-m', 'venv', '.venv'])
  await run(venvPython, ['-m', 'pip', 'install', '--disable-pip-version-check', '--requirement', 'requirements-phase1.txt'])
  await run(venvPython, ['-c', 'import pypdf, PIL, reportlab'])
  console.log('Phase 1 runtime setup complete. Run npm run dev:phase1.')
}

main().catch((error) => {
  console.error(`Phase 1 runtime setup failed: ${error.message}`)
  process.exitCode = 1
})
