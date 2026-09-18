#!/usr/bin/env node

import { access } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const authorizedProjectId = 'oivzalfsjoyycbqunblk'
const authorizedUrl = `https://${authorizedProjectId}.supabase.co`
const venvPython = process.platform === 'win32'
  ? resolve(root, '.venv', 'Scripts', 'python.exe')
  : resolve(root, '.venv', 'bin', 'python3')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required. Add it to ignored .env.local.`)
  return value
}

async function verifySupabase(url, publishableKey, secretKey) {
  if (url !== authorizedUrl) throw new Error(`Refusing Supabase target. Phase 1 local runtime is restricted to ${authorizedProjectId}.`)

  const publicResponse = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: publishableKey },
  })
  if (!publicResponse.ok) throw new Error(`Supabase public health check failed with status ${publicResponse.status}.`)

  const serverResponse = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: { apikey: secretKey, authorization: `Bearer ${secretKey}` },
  })
  if (!serverResponse.ok) throw new Error(`Supabase server credential check failed with status ${serverResponse.status}.`)
}

function start(name, args, env) {
  const child = spawn('npm', args, { cwd: root, env, stdio: 'inherit' })
  child.once('error', (error) => {
    console.error(`${name} failed to start: ${error.message}`)
  })
  return child
}

async function main() {
  const url = required('VITE_SUPABASE_URL')
  const publishableKey = required('VITE_SUPABASE_ANON_KEY')
  const secretKey = required('SUPABASE_SECRET_KEY')
  const python = process.env.SHELTER_PREP_PYTHON || (await exists(venvPython) ? venvPython : 'python3')
  const pythonCheck = spawnSync(python, ['-c', 'import pypdf, PIL'], { cwd: root, encoding: 'utf8' })
  if (pythonCheck.status !== 0) throw new Error('Python runtime is missing pypdf or Pillow. Run npm run setup:phase1.')

  await verifySupabase(url, publishableKey, secretKey)
  console.log(`Supabase target verified: ${authorizedProjectId}`)

  const env = { ...process.env, SHELTER_PREP_PYTHON: python }
  const children = [
    start('processing server', ['run', 'dev:processing'], env),
    start('frontend', ['run', 'dev'], env),
  ]
  let stopping = false
  const stop = (signal = 'SIGTERM') => {
    if (stopping) return
    stopping = true
    for (const child of children) {
      if (!child.killed) child.kill(signal)
    }
  }
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))

  await new Promise((resolveRun) => {
    for (const child of children) {
      child.once('close', (code) => {
        stop()
        process.exitCode = code || 0
        resolveRun()
      })
    }
  })
}

main().catch((error) => {
  console.error(`Phase 1 runtime did not start: ${error.message}`)
  process.exitCode = 1
})
