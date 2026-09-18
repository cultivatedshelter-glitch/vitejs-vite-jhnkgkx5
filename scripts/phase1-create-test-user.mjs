#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'

const authorizedProjectId = 'oivzalfsjoyycbqunblk'
const authorizedUrl = `https://${authorizedProjectId}.supabase.co`

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required in ignored .env.local.`)
  return value
}

async function main() {
  const url = required('VITE_SUPABASE_URL')
  if (url !== authorizedUrl) throw new Error(`Refusing Supabase target. Test identities are restricted to ${authorizedProjectId}.`)
  const email = required('PHASE1_TEST_EMAIL')
  const password = required('PHASE1_TEST_PASSWORD')
  const admin = createClient(url, required('SUPABASE_SECRET_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError
  const existing = users.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())
  const result = existing
    ? await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { phase1_test_identity: true } })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phase1_test_identity: true } })
  if (result.error) throw result.error
  console.log(`Phase 1 test identity is ready in ${authorizedProjectId}. Sign in with PHASE1_TEST_EMAIL and PHASE1_TEST_PASSWORD from ignored .env.local.`)
}

main().catch((error) => {
  console.error(`Phase 1 test identity setup failed: ${error.message}`)
  process.exitCode = 1
})
