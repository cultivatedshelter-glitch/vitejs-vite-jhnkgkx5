# Shelter Prep Schema Plan

Canonical source: `/docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md`.

This file extracts the recommended Supabase table plan for Phase 1. Build these in phases. Do not build all UI at once.

## `profiles`

Purpose: attach app roles to Supabase users.

Fields:

- `id uuid primary key references auth.users(id)`
- `email text`
- `full_name text`
- `role text check in owner/admin/agent/property_manager/contractor/seller_owner/viewer`
- `company_name text`
- `phone text`
- `created_at timestamptz`
- `updated_at timestamptz`
- `active boolean default true`

## `properties`

Fields:

- `id uuid primary key`
- `created_at timestamptz`
- `created_by uuid`
- `address_line1 text`
- `address_line2 text`
- `city text`
- `state text`
- `zip text`
- `property_type text`
- `owner_name text`
- `agent_id uuid`
- `property_manager_id uuid`
- `status text`
- `notes text`

## `property_access`

Purpose: explicit access grants.

Fields:

- `id uuid primary key`
- `property_id uuid`
- `user_id uuid`
- `role_on_property text`
- `access_level text`
- `created_by uuid`
- `created_at timestamptz`
- `revoked_at timestamptz`

## `work_requests`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `created_by uuid`
- `requester_name text`
- `requester_email text`
- `requester_phone text`
- `request_type text`
- `urgency text`
- `occupancy text`
- `description text`
- `status text`
- `secondary_flags text[]`
- `budget_concern text`
- `review_owner_type text`
- `created_at timestamptz`
- `updated_at timestamptz`

## `files`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `uploaded_by uuid`
- `bucket text`
- `storage_path text`
- `original_filename text`
- `mime_type text`
- `file_type text`
- `size_bytes bigint`
- `visibility_scope text`
- `upload_source text`
- `related_assignment_id uuid`
- `related_repair_item_id uuid`
- `created_at timestamptz`
- `deleted_at timestamptz`

## `file_access_events`

Fields:

- `id uuid primary key`
- `file_id uuid`
- `user_id uuid`
- `access_type text`
- `created_at timestamptz`
- `metadata jsonb`

## `inspection_reports`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `file_id uuid`
- `uploaded_by uuid`
- `report_date date`
- `inspector_name text`
- `inspection_company text`
- `extraction_status text`
- `review_status text`
- `created_at timestamptz`

## `evidence_items`

Purpose: no source, no claim.

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `source_type text`
- `source_file_id uuid`
- `source_excerpt text`
- `observation text`
- `claim_type text`
- `confidence text`
- `requires_field_verification boolean`
- `created_by_agent text`
- `created_at timestamptz`

## `repair_items`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `inspection_report_id uuid`
- `title text`
- `plain_language_issue text`
- `trade_category text`
- `severity text`
- `urgency text`
- `safety_concern boolean`
- `moisture_concern boolean`
- `likely_hidden_damage text`
- `missing_info_questions text[]`
- `recommended_next_action text`
- `repair_vs_credit_recommendation text`
- `review_status text`
- `contractor_review_needed boolean`
- `evidence_ids uuid[]`
- `created_at timestamptz`
- `updated_at timestamptz`

## `operational_bundles`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `title text`
- `bundle_type text`
- `related_repair_item_ids uuid[]`
- `operational_interpretation text`
- `transaction_concern_level text`
- `likely_trade_needed text`
- `next_verification_step text`
- `contractor_review_needed boolean`
- `review_status text`
- `created_at timestamptz`

## `contractor_assignments`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `contractor_id uuid nullable`
- `contractor_name text`
- `contractor_email text`
- `contractor_phone text`
- `assignment_status text`
- `access_token_hash text`
- `token_expires_at timestamptz`
- `assigned_by uuid`
- `assigned_at timestamptz`
- `revoked_at timestamptz`

## `contractor_review_sessions`

Fields:

- `id uuid primary key`
- `contractor_assignment_id uuid`
- `opened_at timestamptz`
- `contractor_contact_email text`
- `status text`
- `can_upload_scope boolean default true`
- `can_review_draft boolean default true`
- `phase2_confirmation_placeholder_visible boolean default true`
- `created_at timestamptz`

## `contractor_responses`

Fields:

- `id uuid primary key`
- `contractor_assignment_id uuid`
- `repair_item_id uuid nullable`
- `response_type text check in looks_right/needs_correction/need_walkthrough/cannot_determine/uploaded_scope`
- `notes text`
- `created_at timestamptz`
- `submitted_by_name text`
- `submitted_by_email text`

## `contractor_uploaded_sources`

Purpose: contractor-authored estimate/scope source evidence.

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `contractor_assignment_id uuid`
- `contractor_id uuid nullable`
- `source_file_id uuid nullable`
- `source_text text nullable`
- `source_type text`
- `source_uploaded_by text`
- `source_uploaded_at timestamptz`
- `contractor_uploaded_source boolean default true`
- `contractor_verified_ai_summary boolean default false`
- `created_at timestamptz`

## `structured_contractor_summaries`

Purpose: AI-structured contractor upload.

Fields:

- `id uuid primary key`
- `contractor_uploaded_source_id uuid`
- `property_id uuid`
- `work_request_id uuid`
- `ai_structured_from_contractor_source boolean default true`
- `original_ai_summary jsonb`
- `structured_line_items jsonb`
- `labor_assumptions jsonb`
- `material_assumptions jsonb`
- `exclusions text[]`
- `notes text`
- `admin_review_required boolean default true`
- `admin_verified_structured_summary boolean default false`
- `contractor_verified_structured_summary boolean default false`
- `agent_visible boolean default false`
- `review_status text default 'needs_admin_review'`
- `created_at timestamptz`
- `updated_at timestamptz`

## `admin_review_events`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `reviewed_object_type text`
- `reviewed_object_id uuid`
- `reviewer_id uuid`
- `review_action text`
- `previous_value jsonb`
- `new_value jsonb`
- `reason text`
- `created_at timestamptz`

## `job_execution_steps`

Fields:

- `id uuid primary key`
- `repair_item_id uuid`
- `property_id uuid`
- `work_request_id uuid`
- `step_number integer`
- `title text`
- `labor_scope text`
- `trade text`
- `estimated_hours_low numeric`
- `estimated_hours_high numeric`
- `materials_tools text[]`
- `equipment text[]`
- `safety_notes text`
- `access_notes text`
- `cleanup_notes text`
- `disposal_needed boolean`
- `confidence text`
- `review_status text`
- `created_at timestamptz`

## `estimate_items`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `repair_item_id uuid`
- `source_type text`
- `source_id uuid`
- `description text`
- `labor_hours_low numeric`
- `labor_hours_likely numeric`
- `labor_hours_high numeric`
- `material_cost_low numeric`
- `material_cost_high numeric`
- `total_low numeric`
- `total_high numeric`
- `review_owner_type text`
- `review_status text`
- `approved_by uuid`
- `approved_at timestamptz`
- `created_at timestamptz`

## `reports`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `report_type text`
- `report_status text`
- `generated_from_verified_only boolean`
- `content jsonb`
- `created_by uuid`
- `created_at timestamptz`

## `memory_candidates`

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `contractor_id uuid nullable`
- `source_document_id uuid`
- `source_document_type text`
- `source_uploaded_by text`
- `source_uploaded_at timestamptz`
- `ai_structured_output_id uuid`
- `original_ai_summary jsonb`
- `admin_reviewed_summary jsonb`
- `admin_reviewer_id uuid`
- `admin_review_status text`
- `admin_edit_history jsonb`
- `approval_timestamp timestamptz`
- `related_repair_item_ids uuid[]`
- `related_evidence_ids uuid[]`
- `confidence_level text`
- `memory_scope_recommendation text`
- `memory_status text default 'needs_review'`
- `created_at timestamptz`

## `memory_records`

Fields:

- `id uuid primary key`
- `memory_candidate_id uuid`
- `title text`
- `lesson text`
- `applies_when text`
- `does_not_apply_when text`
- `memory_scope text`
- `authority_level text`
- `verified_by uuid`
- `verified_at timestamptz`
- `active boolean default true`
- `created_at timestamptz`

## `workflow_events`

Immutable event log.

Fields:

- `id uuid primary key`
- `property_id uuid`
- `work_request_id uuid`
- `actor_id uuid nullable`
- `actor_type text`
- `event_type text`
- `event_title text`
- `event_body text`
- `object_type text`
- `object_id uuid`
- `metadata jsonb`
- `created_at timestamptz`
