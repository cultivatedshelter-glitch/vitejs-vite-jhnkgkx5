import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [experience, client, context, setup] = await Promise.all([
  readFile(new URL('../src/Phase1Experience.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/phase1ProcessingClient.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/phase1PropertyContext.ts', import.meta.url), 'utf8'),
  readFile(new URL('./phase1-create-test-user.mjs', import.meta.url), 'utf8'),
])

test('guided intake uses a minimal Supabase email and password session', () => {
  assert.match(experience, /signInWithPassword/)
  assert.match(experience, /getSession\(\)/)
  assert.match(experience, /onAuthStateChange/)
  assert.match(experience, /signOut\(\)/)
  assert.doesNotMatch(experience, /signUp\(|resetPassword|admin\./)
})

test('authenticated user context is retained with the Property workspace', () => {
  assert.match(client, /userId: data\.session\.user\.id/)
  assert.match(client, /return \{ id: property\.id, address:[^}]+userId \}/)
  assert.match(context, /propertyContextBelongsToUser/)
  assert.match(context, /value\.userId/)
})

test('test identity provisioning stays server-only and project-pinned', () => {
  assert.match(setup, /oivzalfsjoyycbqunblk/)
  assert.match(setup, /SUPABASE_SECRET_KEY/)
  assert.match(setup, /email_confirm: true/)
  assert.doesNotMatch(setup, /VITE_SUPABASE_SECRET_KEY/)
  assert.doesNotMatch(experience, /SUPABASE_SECRET_KEY|service_role/)
})
