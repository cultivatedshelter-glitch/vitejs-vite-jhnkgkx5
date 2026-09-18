import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('production container serves the built app and existing Node/Python processor together', async () => {
  const dockerfile = await readFile('Dockerfile', 'utf8')
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  assert.equal(packageJson.scripts.start, 'node scripts/phase1-processing-server.mjs')
  assert.match(dockerfile, /FROM node:22-bookworm-slim AS build/)
  assert.match(dockerfile, /python3 -m venv \/opt\/shelter-prep-venv/)
  assert.match(dockerfile, /COPY --from=build \/app\/dist \.\/dist/)
  assert.match(dockerfile, /SHELTER_PREP_PYTHON=\/opt\/shelter-prep-venv\/bin\/python3/)
  assert.match(dockerfile, /CMD \["npm", "start"\]/)
})

test('production server uses same-origin API, platform port, healthcheck, and SPA review routes', async () => {
  const server = await readFile('scripts/phase1-processing-server.mjs', 'utf8')
  const client = await readFile('src/phase1ProcessingClient.ts', 'utf8')
  const experience = await readFile('src/Phase1Experience.tsx', 'utf8')
  const railway = JSON.parse(await readFile('railway.json', 'utf8'))
  assert.match(server, /process\.env\.PORT/)
  assert.match(server, /0\.0\.0\.0/)
  assert.match(server, /url\.pathname === '\/healthz'/)
  assert.match(server, /sendStatic/)
  assert.equal(railway.deploy.healthcheckPath, '/healthz')
  assert.doesNotMatch(client, /https?:\/\/(?:127\.0\.0\.1|localhost)|:8787/)
  assert.match(experience, /reviewRequestFromLocation/)
  assert.match(experience, /window\.location\.pathname\.match/)
  assert.match(experience, /loadPhase1ProcessingRequest/)
})

test('server secrets are not copied into the image or referenced by browser source', async () => {
  const dockerignore = await readFile('.dockerignore', 'utf8')
  const dockerfile = await readFile('Dockerfile', 'utf8')
  const browser = `${await readFile('src/Phase1Experience.tsx', 'utf8')}\n${await readFile('src/phase1ProcessingClient.ts', 'utf8')}`
  assert.match(dockerignore, /^\.env\.\*$/m)
  assert.doesNotMatch(dockerfile, /ARG (?:SUPABASE_SECRET_KEY|RESEND_API_KEY)/)
  assert.doesNotMatch(browser, /SUPABASE_SECRET_KEY|RESEND_API_KEY|SHELTER_PREP_REVIEW_EMAIL/)
})
