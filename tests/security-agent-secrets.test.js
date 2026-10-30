import test from 'node:test'
import assert from 'node:assert/strict'
import { findServiceRoleCredentialExposures } from '../scripts/security-agent-secrets.mjs'

test('configuration references do not count as service role credentials', () => {
  const variableName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')
  const docs = [
    `Set ${variableName} in your server-side environment.`,
    `const service_role = process.env.${variableName}`,
    'Keep the service_role value on the server and out of browser code.',
  ].join('\n')

  assert.deepEqual(findServiceRoleCredentialExposures(docs), [])
})

test('a committed service role JWT assignment is detected', () => {
  const variableName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')
  const token = [
    `eyJ${'a'.repeat(20)}`,
    'b'.repeat(24),
    'c'.repeat(24),
  ].join('.')

  assert.deepEqual(findServiceRoleCredentialExposures(`${variableName}=${token}`), [0])
})

test('a committed Supabase secret key assignment is detected', () => {
  const keyName = ['service', 'role'].join('_')
  const token = `sb_secret_${'a'.repeat(24)}`

  assert.deepEqual(findServiceRoleCredentialExposures(`${keyName}: '${token}'`), [0])
})
