import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const MIGRATION_PATH = 'supabase/migrations/20260829041051_phase1_inspection_intelligence_schema.sql'
const STORAGE_MIGRATION_PATH = 'supabase/migrations/20260917112924_phase1_evidence_storage.sql'
const RUNTIME_GRANTS_MIGRATION_PATH = 'supabase/migrations/20260917113200_phase1_runtime_grants.sql'
const PROFILE_HARDENING_MIGRATION_PATH = 'supabase/migrations/20260918183427_phase1_profile_role_hardening.sql'

function migrationSql() {
  return readFileSync(MIGRATION_PATH, 'utf8')
}

function functionBody(sql, schema, name) {
  const pattern = new RegExp(
    `create or replace function ${schema}\\.${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\\n\\$\\$;`,
    'i',
  )
  const match = sql.match(pattern)
  assert.ok(match, `Expected function ${schema}.${name} to exist`)
  return match[0]
}

const protectedTables = [
  'profiles',
  'properties',
  'property_access',
  'work_requests',
  'model_runs',
  'inspection_pipeline_runs',
  'inspection_reports',
  'inspection_report_pages',
  'evidence_items',
  'inspection_findings',
  'inspection_images',
  'photo_interpretations',
  'repair_bundles',
  'verification_questions',
  'review_events',
  'workflow_events',
  'contractor_inputs',
  'contractor_scope_packets',
  'agent_reports',
]

test('Phase 1 inspection migration defines the required trust-spine tables', () => {
  const sql = migrationSql()

  for (const table of protectedTables) {
    assert.match(
      sql,
      new RegExp(`create table if not exists public\\.${table}\\b`, 'i'),
      `Missing required table: ${table}`,
    )
  }
})

test('Phase 1 inspection migration enables RLS on every protected public table', () => {
  const sql = migrationSql()

  for (const table of protectedTables) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`, 'i'),
      `Missing RLS enablement: ${table}`,
    )
  }
})

test('public RPC wrappers are not SECURITY DEFINER functions', () => {
  const sql = migrationSql()
  const publicPhase1Functions = [...sql.matchAll(/create or replace function public\.phase1_[\s\S]*?\n\$\$;/gi)]

  assert.ok(publicPhase1Functions.length > 0, 'Expected public Phase 1 wrapper functions')
  for (const match of publicPhase1Functions) {
    assert.doesNotMatch(match[0], /security definer/i)
  }
})

test('protected review and output tables are not directly writable by browser roles', () => {
  const sql = migrationSql()
  const directWriteTables = [
    'model_runs',
    'inspection_pipeline_runs',
    'inspection_reports',
    'inspection_report_pages',
    'evidence_items',
    'inspection_findings',
    'inspection_images',
    'photo_interpretations',
    'repair_bundles',
    'verification_questions',
    'review_events',
    'workflow_events',
    'contractor_inputs',
    'contractor_scope_packets',
    'agent_reports',
  ]

  for (const table of directWriteTables) {
    assert.doesNotMatch(
      sql,
      new RegExp(`grant\\s+[^;]*(insert|update|delete)[^;]*on\\s+(?:table\\s+)?public\\.${table}\\b`, 'i'),
      `Browser roles should not get direct writes to ${table}`,
    )
  }
})

test('review transitions are server-authoritative and audit producing', () => {
  const sql = migrationSql()

  for (const name of ['phase1_review_inspection_finding_impl', 'phase1_review_repair_bundle_impl']) {
    const body = functionBody(sql, 'private', name)

    assert.match(body, /security definer/i)
    assert.match(body, /private\.phase1_is_admin\(\)/i)
    assert.match(body, /insert into public\.review_events/i)
    assert.match(body, /insert into public\.workflow_events/i)
    assert.match(body, /for update/i)
    assert.match(body, /human_verified/i)
    assert.match(body, /needs_review/i)
    assert.match(body, /rejected/i)
  }
})

test('authenticated clients cannot self-assign or reactivate trusted reviewer roles', () => {
  const sql = readFileSync(PROFILE_HARDENING_MIGRATION_PATH, 'utf8')

  assert.match(sql, /before insert or update on public\.profiles/i)
  assert.match(sql, /new\.role <> 'viewer'/i)
  assert.match(sql, /new\.role is distinct from old\.role/i)
  assert.match(sql, /new\.active is distinct from old\.active/i)
  assert.match(sql, /auth\.uid\(\).*is not null/is)
  assert.match(sql, /security invoker/i)
  assert.match(sql, /revoke all[\s\S]*from authenticated/i)
})

test('contractor and agent outputs require reviewed source material', () => {
  const sql = migrationSql()
  const packet = functionBody(sql, 'private', 'phase1_create_contractor_scope_packet_impl')
  const agentReport = functionBody(sql, 'private', 'phase1_create_agent_report_impl')

  assert.match(packet, /review_status not in \('human_reviewed', 'human_verified'\)/i)
  assert.match(packet, /Contractor packets require reviewed source findings/i)
  assert.match(sql, /generated_from_reviewed_only boolean not null default true/i)

  assert.match(agentReport, /Agent-facing reports require at least one reviewed repair bundle/i)
  assert.match(agentReport, /review_status not in \('human_reviewed', 'human_verified'\)/i)
  assert.match(sql, /constraint phase1_agent_reports_reviewed_only_check/i)
})

test('provenance and duplicate-run guardrails are represented in SQL', () => {
  const sql = migrationSql()

  assert.match(sql, /phase1_evidence_no_source_no_claim_check/i)
  assert.match(sql, /phase1_findings_no_source_no_claim_check/i)
  assert.match(sql, /phase1_repair_bundles_source_link_check/i)
  assert.match(sql, /phase1_model_runs_completed_dedupe_idx/i)
  assert.match(sql, /phase1_pipeline_runs_active_dedupe_idx/i)
  assert.match(sql, /inspector_statement/i)
  assert.match(sql, /visual_observation/i)
  assert.match(sql, /shelter_prep_interpretation/i)
})

test('migration includes a manual rollback block', () => {
  const sql = migrationSql()

  assert.match(sql, /Down migration for manual rollback review only/i)
  assert.match(sql, /drop table if exists public\.agent_reports/i)
  assert.match(sql, /drop function if exists private\.phase1_review_inspection_finding_impl/i)
})

test('Phase 1 evidence storage stays private and property scoped', () => {
  const sql = readFileSync(STORAGE_MIGRATION_PATH, 'utf8')

  assert.match(sql, /values\s*\(\s*'phase1-evidence'\s*,\s*'phase1-evidence'\s*,\s*false/i)
  assert.match(sql, /for insert[\s\S]*?to authenticated[\s\S]*?storage\.foldername\(name\)[\s\S]*?phase1_user_has_property_access/i)
  assert.match(sql, /for select[\s\S]*?to authenticated[\s\S]*?phase1_user_has_property_access/i)
  assert.match(sql, /for delete[\s\S]*?to authenticated[\s\S]*?phase1_user_has_property_access/i)
  assert.doesNotMatch(sql, /to\s+(anon|public)\b/i)
})

test('Phase 1 server persistence has explicit service-role grants', () => {
  const sql = readFileSync(RUNTIME_GRANTS_MIGRATION_PATH, 'utf8')

  assert.match(sql, /grant select, insert, update, delete on table[\s\S]*?inspection_pipeline_runs[\s\S]*?inspection_reports[\s\S]*?to service_role/i)
  assert.match(sql, /revoke execute on function public\.rls_auto_enable\(\) from public, anon, authenticated/i)
})
