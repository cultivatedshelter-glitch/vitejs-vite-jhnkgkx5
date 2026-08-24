# Shelter Prep Property Canonicalization Migration Plan

## 1. Current Lead Address Model

This plan is based on the canonical checkout at branch `auto-button-from-current-main`, HEAD `0cc7b9e36ec7ac0bab7b11ba65b349709a4e23c5`.

The current active app is lead/work-request centered. `src/main.tsx` renders `src/App.tsx` directly, so the primary active lead logic is in `src/App.tsx`. Additional tracked page components reference a different, older or parallel lead shape, but they are not currently wired through the active entrypoint.

Repository-supported lead/property fields:

| Field | Evidence | Notes |
| --- | --- | --- |
| `id` | `src/App.tsx` selects and inserts `leads.id`; other tables use `lead_id`. | Type is not defined in local migrations. Treat as the existing database type when adding foreign keys. |
| `name` | Active `handleSubmit` and `ensureLeadExists` insert `name`. | Active app maps `row.name` into requester name. |
| `requester_name` | `mapLeadRowToWorkRequest` fallback; `src/App.backup.tsx`. | Referenced as legacy/alternate shape. |
| `client_name` | `mapLeadRowToWorkRequest` fallback. | Referenced as alternate shape. |
| `email` | Active inserts and mapper. | Request/contact source value. |
| `client_email`, `requester_email`, `contact_email` | `mapLeadRowToWorkRequest` fallbacks. | Referenced as alternate shapes. |
| `phone`, `client_phone`, `requester_phone` | Active inserts and mapper fallbacks. | Request/contact source value. |
| `address` | Active `handleSubmit` and `ensureLeadExists` insert `address`; mapper reads it first. | Active app's primary street/property field. |
| `property_address` | Canonical migration adds this column; older routed pages insert/read it; mapper reads it after `address`. | Duplicate/alternate property address representation. |
| `project_address` | `mapLeadRowToWorkRequest` fallback. | Referenced as alternate shape only. |
| `city` | Active inserts and mapper. | Active app requires it at form level. |
| `state` | Active inserts and mapper. | Active app requires it at form level. |
| `zip` | Active inserts and mapper. | Active app requires it at form level. |
| `postal_code` | `mapLeadRowToWorkRequest` fallback. | Referenced as alternate shape only. |
| `property_zip_code` | Older `SubmitLead`, `AgentDashboard`, and `ContractorDashboard` pages. | Not used by active `App.tsx`, but tracked repository code relies on it. |
| `job_type`, `budget`, `timeline`, `agent_id` | Older routed pages. | Not part of active `WorkRequest` insert except `timeline` in local UI state; relevant to legacy lead shape. |
| `status` | Active and older code. | Active statuses differ from older `open` status. |
| `archived`, `archived_at`, `archive_reason` | Active admin archive flow. | Property migration should not change these. |

Fields not supported by repository evidence:

- `property_id`
- `unit` as a separate lead column
- `street` as a separate lead column
- `address_line_1` / `address_line_2` on leads
- `property_type`
- `latitude`
- `longitude`
- coordinate/geocode metadata
- portfolio fields on leads

Current code that relies on exact field names:

- Active lead submission inserts `address`, `city`, `state`, `zip`, `name`, `email`, `phone`, `description`, `status` in `src/App.tsx`.
- Active lead loading uses `.select('*')` from `leads` and maps `address || property_address || project_address`, plus `zip || postal_code`.
- `ensureLeadExists` inserts the same active shape with `address`, `city`, `state`, and `zip`.
- Older `SubmitLead` inserts `property_address` and `property_zip_code`.
- Older dashboards display `property_address` and `property_zip_code`.
- The local canonical migration only proves that `leads.property_address` is added. Most other `leads` columns are inferred from frontend usage and should be verified against the live Supabase schema before writing SQL.

Adding a nullable `property_id` to `leads` should not break current Supabase queries shown in the repository:

- `select('*')` can tolerate an additional column.
- Existing inserts omit `property_id`; nullable means they continue to work.
- Existing filters and updates do not depend on column lists that would reject the new field.

## 2. Proposed Properties Table

Smallest Phase 1 table:

| Field | Required? | Rationale |
| --- | --- | --- |
| `id` | Yes | Durable Property identifier. Use the same ID type conventions as the current Supabase schema. If `leads.id` is UUID, use UUID. |
| `created_at` | Yes | Creation timestamp for auditability. |
| `updated_at` | Yes | Allows later correction/version workflows without inventing them now. |
| `address_line_1` | Nullable | Canonical street/source-line value for Phase 1. Nullable because existing leads may be blank or malformed. |
| `address_line_2` | Nullable | Unit/suite/apartment when explicitly available as a separate value or safely extracted later. Do not fabricate. |
| `city` | Nullable | Canonical city when available. |
| `state` | Nullable | Canonical state/region when available. |
| `postal_code` | Nullable | Canonical postal/ZIP value. |
| `country` | Yes, default `US` | Current app appears US-focused; this avoids leaving country implicit while not building international address intelligence. |
| `normalized_address` | Nullable | Deterministic normalized key for review/search. Not a uniqueness guarantee. |
| `source_address` | Nullable | Original address string used to create the property record. Preserves source fidelity on the Property. |
| `created_from_lead_id` | Nullable | Minimal provenance link to the lead that caused the Property record to exist. |

Fields intentionally excluded from the first table:

- `latitude` and `longitude`: no geocoding exists in the repo, and adding coordinates would imply an external verification process.
- `property_type`: no active source field supports it.
- owner/contact fields: contacts belong to leads/agents/requesters today, not Property.
- portfolio/analytics fields: not needed for Phase 1 property identity.
- fuzzy match score or AI match metadata: false merges are worse than duplicates.
- global notes/history fields: later evidence/review/outcome work should handle those explicitly.

Recommended constraints and indexes for the future migration:

- Primary key on `properties.id`.
- Index on `properties.normalized_address`.
- Index on `properties.created_from_lead_id`.
- Add `leads.property_id` as a nullable foreign key to `properties.id`.
- Index `leads.property_id`.
- Do not add a unique constraint on `normalized_address` in Phase 1.

## 3. Lead Relationship

Add `leads.property_id` as nullable initially.

Transition rules:

- Existing lead address columns stay in place.
- Existing source address values are not deleted, overwritten, renamed, or normalized in place.
- `leads.property_id` points from a lead/work request event to its canonical Property record when safe.
- Existing frontend behavior can continue using `address`, `property_address`, `city`, `state`, `zip`, and `property_zip_code`.
- Do not make `property_id` `NOT NULL` in the first migration.
- Do not require frontend code to set `property_id` immediately.

Recommended relationship semantics:

- Property is the durable operational object.
- Lead/work request is an event, intake, or request associated with a Property.
- Lead source fields remain historical evidence of what the requester/agent supplied at intake time.

## 4. Identity / Deduplication Rules

Phase 1 should prefer duplicates over incorrect merges.

Recommended normalization for matching/search only:

- Trim leading/trailing whitespace.
- Collapse repeated internal whitespace.
- Lowercase text for comparison.
- Normalize common punctuation by removing harmless separators only when doing review/search.
- Preserve unit-like text in the normalized string if it is part of the source address.
- Include city, state, postal code, and country in the normalized value when available.

Do not use fuzzy matching, AI matching, geocoding, or "same street means same property" logic in the first migration.

Conservative identity rule:

- A lead can be linked to a Property created from its own source address when the lead has a nonblank address-like value.
- Existing leads should not be automatically merged into one shared Property solely because their normalized strings match.
- Identical normalized addresses can be recorded as candidate duplicates for later human review, but the first backfill should not require deduplication to succeed.

Why not auto-merge exact duplicates immediately:

- The repository has no proven separate `unit` field.
- A street string may omit an apartment/unit even when the real property is multi-unit.
- `123 Main St Unit 1` and `123 Main St Unit 2` are distinct operational properties.
- Two leads with identical incomplete input could still represent different units or contexts.

Future manual review can merge duplicate property records once units, context, and source evidence are clear.

## 5. Backfill Strategy

Backfill objective:

- Give each sufficiently addressable existing lead a durable Property relationship without altering the original lead data.
- Avoid guessing when address identity is unclear.

Suggested source-field precedence for a lead:

1. Street/source address: `address`, then `property_address`, then `project_address`.
2. City: `city`.
3. State: `state`.
4. Postal code: `zip`, then `postal_code`, then `property_zip_code` if present in production schema.
5. Source address snapshot: concatenate available source street/address, city, state, and postal code without overwriting source columns.

Recommended handling by case:

| Case | Backfill behavior |
| --- | --- |
| Complete addresses | If street/address, city, state, and postal code are present, create a Property from that lead's source values and set `leads.property_id`. Do not alter lead address fields. |
| Incomplete addresses | If street/address exists but city/state/postal code is incomplete, create a Property only if the team accepts incomplete Phase 1 property records. Otherwise leave `property_id` null and list for manual review. |
| Missing unit numbers | Do not infer unit. Keep any unit text exactly where it appears in the source address. Do not merge no-unit records with unit-bearing records. |
| Malformed address strings | Preserve the malformed string as `source_address`; either create an incomplete Property for traceability or leave `property_id` null for manual review. Do not parse aggressively. |
| Duplicate identical addresses | Prefer duplicate Property records per lead in the first backfill, with matching `normalized_address` values for later review. Do not add uniqueness constraints. |
| Same address with different units | Treat as different properties if the unit appears in the source value. Never merge across different unit text. |
| Blank addresses | Leave `leads.property_id` null. Do not create blank Property records. |
| Inconsistent city/state capitalization | Normalize for `normalized_address`, but preserve original lead values and original `source_address`. Canonical `city`/`state` may be trimmed and consistently cased later by human/admin workflow. |
| Whitespace/punctuation differences | Normalize for candidate matching/search. Do not overwrite original fields and do not rely on this alone for automatic merging. |

Backfill should be run in a transaction if practical, with a preflight count:

- Total leads.
- Leads with nonblank address-like source.
- Leads with complete address components.
- Leads with incomplete address components.
- Leads with blank address.
- Candidate duplicate normalized addresses.

The migration should produce no destructive operations and no required application rewrite.

## 6. Provenance

Property canonicalization must preserve source fidelity.

Recommended minimal provenance:

- `properties.created_from_lead_id`: points to the lead that caused the property record to be created.
- `properties.source_address`: stores the address string assembled from that lead's original source fields at creation time.
- Existing lead address fields remain unchanged and continue to be the strongest source record for what was submitted.

Source address should remain on both:

- Lead: historical intake/source value.
- Property: creation provenance snapshot for the canonical record.

The lead remains the event/request record. The Property becomes the durable identity record.

Do not use canonical Property fields to erase or "correct" the lead's submitted values. A future review workflow can add corrected/normalized values while preserving the submitted source.

## 7. Security / RLS Impact

No RLS changes are implemented by this plan.

Security implications for the future migration:

| Area | Classification | Notes |
| --- | --- | --- |
| Existing `leads` policies | Required before pilot if policies assume a fixed column model or expose all lead columns broadly. | Adding nullable `property_id` should not weaken access by itself, but existing policies should be reviewed. |
| New `properties` table access | Required in same migration or before any client access, depending on Supabase defaults. | Property records contain addresses. Do not expose broad anon reads. Prefer no permissive policies until app behavior is designed. |
| Current browser access | Can remain unchanged during additive migration. | The active app does not need to read `properties` immediately. |
| Admin access | Required before pilot. | Admin workflows will eventually need to inspect/repair property links. |
| Agent/contractor access | Later. | Older routed pages imply agent/contractor ownership, but active app does not wire those flows. |
| Future property ownership/access | Later. | Needs a clear model for who can see a Property across multiple leads. |

No RLS weakening should occur. If the future migration creates `properties`, it should avoid any broad public `select` policy. If the team standard is to enable RLS on all exposed tables, enable it with restrictive/no client policies until the application needs property reads.

## 8. Application Impact

The first migration should be additive and should not force a frontend rewrite.

| Code path | Current relationship | Classification | Notes |
| --- | --- | --- | --- |
| Lead submission | Inserts `leads` with `address`, `city`, `state`, `zip`; older page inserts `property_address`, `property_zip_code`. | Can continue using leads temporarily. | `property_id` nullable means no immediate code change. |
| Admin lead loading | Selects `leads.*` and maps address fallbacks. | Can continue using leads temporarily. | Mapper ignores `property_id`; future UI can display/use it. |
| File uploads | Store files under lead folders and insert `files.lead_id`. | Can continue using leads temporarily. | Later evidence migration can add property linkage. |
| Seller Prep | Runs by `leadId`; loads `seller_prep_analyses.lead_id`. | Can continue using leads temporarily. | Later repair/evidence model can connect outputs to Property via lead. |
| Estimates | `estimate_items` and `estimate_research` use `lead_id`; generated reports render selected request address. | Can continue using leads temporarily. | Later estimate versions can attach to repair item/property. |
| Invoices | Active invoice upload stores free-text `property_address`, no lead link. | Later migration. | Do not alter in first property migration. Later add optional property/lead link. |
| Reports | Render current request or seller prep data. | Can continue using leads temporarily. | No report behavior change in first migration. |
| Archived leads | Uses `leads` archive fields. | Can continue using leads temporarily. | Nullable property link does not affect archive flow. |

Immediate app changes required for the additive migration: none.

Eventual app changes:

- New lead submission should create or link a Property using conservative rules.
- Admin lead view should surface property identity and unresolved property-link status.
- Invoice upload should eventually allow selecting/linking a Property instead of only free-text address.
- Evidence, repair item, and estimate versions should use Property as the top-level anchor after their later migrations.

## 9. Migration Sequence

This is a future migration plan only. Do not execute it from this document.

1. Verify production schema.
   - Confirm `leads.id` type.
   - Confirm actual columns: `address`, `property_address`, `project_address`, `city`, `state`, `zip`, `postal_code`, `property_zip_code`.
   - Confirm existing RLS policies and grants for `leads`.

2. Create `properties`.
   - Add the minimal fields listed in Section 2.
   - Do not add lat/lng, property type, owner, portfolio, analytics, or AI match fields.
   - Do not add a unique constraint on `normalized_address`.

3. Add relationship to leads.
   - Add nullable `leads.property_id`.
   - Add an index on `leads.property_id`.
   - Add a foreign key to `properties.id` using non-destructive behavior.

4. Prepare a backfill preview.
   - Count complete, incomplete, blank, malformed, and candidate duplicate lead addresses.
   - Do not update rows during preview.

5. Backfill conservatively.
   - For nonblank address-like leads, create Property rows from source values according to Section 5.
   - Set `leads.property_id` only for the lead being backfilled.
   - Preserve all original lead fields.
   - Leave blank/unsafe cases null.

6. Verify backfill.
   - No leads deleted.
   - No lead address/contact fields changed.
   - Number of linked leads matches preview expectations.
   - Ambiguous/null cases are reviewable.

7. Keep frontend unchanged for the first release.
   - Existing lead flows continue using current fields.
   - Use `property_id` only for future architecture work after review.

8. Plan next small migration.
   - Add property linkage to files/evidence or new lead submissions only after the Property migration is reviewed.

## 10. Rollback Plan

Rollback should not require reconstructing deleted information because the migration is additive.

Safe rollback sequence:

1. Drop or ignore `leads.property_id`.
2. Drop related index and foreign key.
3. Drop `properties` if no later tables depend on it.
4. Leave all original lead address/contact/request columns untouched.

Rollback does not need to restore lead address data because the migration never deletes or overwrites it.

If a partial backfill fails:

- Stop before enforcing any constraints.
- Leave `property_id` nullable.
- Clear only the newly added `property_id` values if needed.
- Preserve `properties` rows for inspection, or drop them if no downstream references exist.

## 11. Risks

Biggest risk: false property merging.

An incorrect merge can cause unrelated work requests, evidence, estimates, invoices, and eventual memory to appear attached to the same Property. This is worse than duplicate Property records because duplicates can be merged later, while false merges contaminate provenance.

Other risks:

- Current local migrations do not define the full `leads` schema, so SQL must be checked against production before execution.
- Active and older tracked code use different address column names.
- A new `properties` table may expose address data if RLS/grants are not reviewed.
- Future application code might treat canonical normalized fields as source truth unless the source-address doctrine is explicit.
- Backfilling incomplete addresses could create low-quality Property records if not clearly marked or reviewed.

## 12. Acceptance Checklist

- [ ] No existing lead is deleted.
- [ ] No original lead address value is deleted.
- [ ] No original lead address value is overwritten.
- [ ] Existing frontend behavior can continue during transition.
- [ ] `leads.property_id` is nullable at first.
- [ ] Ambiguous addresses are not guessed.
- [ ] Units are preserved when present in source text.
- [ ] Duplicate properties are allowed and preferable to false merges.
- [ ] No unique constraint forces address deduplication.
- [ ] Property identity becomes available for future repair/evidence architecture.
- [ ] Migration can be rolled back without reconstructing old data.
- [ ] No new AI behavior is introduced.
- [ ] No memory behavior changes.
- [ ] No report behavior changes.
- [ ] No existing review status changes.
- [ ] No RLS weakening occurs.

