import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('Phase 1 local runtime stays pinned to the authorized development project', async () => {
  const launcher = await readFile(new URL('./phase1-dev.mjs', import.meta.url), 'utf8')
  assert.match(launcher, /oivzalfsjoyycbqunblk/)
  assert.match(launcher, /Refusing Supabase target/)
  assert.match(launcher, /SUPABASE_SECRET_KEY/)
  assert.doesNotMatch(launcher, /VITE_SUPABASE_SECRET_KEY/)
})

test('Phase 1 setup uses an ignored virtualenv and pinned Python dependencies', async () => {
  const [gitignore, requirements, packageJson] = await Promise.all([
    readFile(new URL('../.gitignore', import.meta.url), 'utf8'),
    readFile(new URL('../requirements-phase1.txt', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ])
  assert.match(gitignore, /^\.venv\/$/m)
  assert.match(requirements, /^pypdf==[^\s]+$/m)
  assert.match(requirements, /^Pillow==[^\s]+$/m)
  assert.match(requirements, /^reportlab==[^\s]+$/m)
  assert.equal(packageJson.scripts['setup:phase1'], 'node scripts/setup-phase1-runtime.mjs')
  assert.match(packageJson.scripts['dev:phase1'], /phase1-dev\.mjs/)
})
