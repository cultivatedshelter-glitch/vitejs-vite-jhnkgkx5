# Shelter Prep Internal Knowledge Architecture

## 1. Executive Summary

Shelter Prep currently has a useful repair-coordination workflow, but it does not yet have a true internal knowledge architecture. The active application is centered on leads and work requests, with related files, missing-info drafts, seller prep outputs, estimate items, invoices, material costs, labor rates, and review flags. These structures support operations, but they do not consistently preserve source-to-claim provenance, durable property identity, immutable human review events, or outcome-to-memory traceability.

The most important architectural gap is that source evidence, AI interpretation, human review, approved scope, actual cost, and reusable memory can become blended into current-state records or presentation output. This makes it hard for Shelter Prep to answer the questions that matter for compounding operational knowledge: where did this come from, who reviewed it, what remains uncertain, what happened afterward, and should this knowledge be reused?

Phase 1 should not build a large ontology, marketplace, or prediction system. It should make the existing workflow more explicit: Property, Evidence, Repair Item, Unknown/Verification Requirement, Review Event, Scope/Estimate versions, Outcome, and Memory Candidate. The report should remain a rendering. The workflow is the product. Verified operational knowledge is the compounding asset.

## 2. Canonical Repository Audit

- Branch: `auto-button-from-current-main`
- HEAD: `0cc7b9e36ec7ac0bab7b11ba65b349709a4e23c5`
- Tracked worktree status at audit time: clean before documentation creation.
- Explicitly excluded untracked artifacts: `codex-backups/seller-prep-report-refinements-2026-08-22.patch`, `security-audit-fixes.patch`.
- Documentation state before this file: no `docs/` directory; `README.md` is the generic Vite template.

Primary files inspected:

- `src/main.tsx`: renders `App` directly.
- `src/App.tsx`: active application shell, request intake, admin tabs, Supabase calls, AI calls, message center, seller prep, estimates, invoices, material costs, labor rates, and generated reports.
- `src/components/Gallery.tsx`: active gallery component imported by `App`.
- `src/types/shelterprep-ai.ts`: typed AI estimate shape with explicit `missingInfo`, `assumptions`, `exclusions`, and `risks`.
- `src/components/BidMemory.tsx` and `src/components/AiEstimator.tsx`: tracked bid-memory components that reference historical jobs and memory files, but are not wired from `src/main.tsx`.
- `src/pages/*`: tracked agent/contractor/auth pages using `react-router-dom`, but the active entrypoint does not wire a router and `package.json` does not list `react-router-dom`.
- `supabase/migrations/20260404041428_add_portfolio_and_address_fields.sql`: only canonical migration in the checkout.
- `package.json`: app dependencies and scripts.

Limitations:

- The repository does not include full database schema migrations for most referenced tables. The audit infers table shape from frontend reads/writes.
- Supabase edge functions and Railway agent endpoints are referenced but not present in this checkout, so their internal schemas and persistence behavior cannot be verified here.
- Tracked legacy/parallel components are documented as repository artifacts, but the active runtime path is `src/main.tsx` -> `src/App.tsx`.

## 3. Current Architecture

The active app is a Vite React application. `src/main.tsx` renders `App` directly. There is no active router in the entrypoint.

`src/App.tsx` defines a single-page operational surface with tabs for new requests, gallery, intake, messages, dashboard, archived leads, invoices, material costs, labor rates, and estimates. It uses Supabase directly from the client and calls external AI/agent endpoints for intake analysis, seller prep, material research, takeoff, auto-processing, invoice extraction, invoice analysis, and material updates.

The current central record is effectively a lead/work request, represented by the `WorkRequest` type in `src/App.tsx`. Property information is embedded on that record as address/city/state/zip fields. The app maps several possible lead column names into this object, including `address`, `property_address`, and `project_address`, which suggests schema drift or multiple generations of lead shape.

Current active Supabase tables inferred from `src/App.tsx`:

- `leads`
- `files`
- `message_logs`
- `missing_info_requests`
- `seller_prep_analyses`
- `seller_prep_items`
- `estimate_items`
- `estimate_research`
- `invoices`
- `invoice_cost_analyses`
- `material_costs`
- `labor_rates`

Additional tracked, apparently inactive or parallel table references:

- `profiles`
- `agents`
- `contractors`
- `matches`
- `old_bid_jobs`
- `work_requests` in `src/App.backup.tsx`

Storage buckets referenced:

- `job-files` for request photos/documents and gallery photos.
- `invoices` for uploaded invoices.
- `bid-memory` in tracked bid-memory components.

The current app already contains repeated product doctrine in the UI: AI may draft, but humans must review before estimates, proposals, ordering, emails, and final recommendations. Architecturally, however, that doctrine is mostly enforced through copy, status fields, and booleans rather than an immutable review/provenance model.

## 4. Current Knowledge Objects

### Leads and Work Requests

`WorkRequest` in `src/App.tsx` contains requester/contact fields, work type, property address fields, urgency, occupancy, timeline, description, photos, documents, status, archive fields, and an optional `aiEstimate`. It is the active operational object, but it is not a canonical Property.

The active request loader selects `leads` and maps each row to `WorkRequest`. It initializes `photos` and `documents` as empty arrays from the lead row, so uploaded file rows are not currently reattached during normal load in this code path. Request submission inserts into `leads` using `address`, `city`, `state`, `zip`, and `description`, while older tracked pages insert `property_address` and `property_zip_code`.

### Files and Evidence

`StoredFile` currently contains only `name`, `path`, and `type` (`photo` or `document`) in the canonical `src/App.tsx`. Uploads go to the `job-files` bucket under `photos/{leadId}/...` or `documents/{leadId}/...`. When a `leadId` is available, the app inserts a `files` row with `lead_id`, `file_url`, and `file_name`.

This is enough to retain attachments, but not enough to serve as an evidence ledger. The file row does not clearly preserve evidence type, origin, author, upload actor, storage path, claim linkage, or whether an AI/agent output depended on it.

`Gallery` lists image files from `job-files/photos`, creates signed URLs, and renders the images. It is a presentation utility, not a property-linked evidence view.

### Seller Prep

Seller Prep is produced by the external Railway endpoint `run-seller-prep-analysis`. The app loads the latest `seller_prep_analyses` row by `lead_id`, then loads `seller_prep_items` by `analysis_id`. The data is held in `sellerPrepReview` as `any` in canonical `src/App.tsx`, so the active implementation does not strongly type the seller prep tables.

Seller Prep includes report-style concepts such as total repair range, value/negotiation impact, seller net impact, buyer impact score, inspection risk score, recommendation, confidence, and `human_review_status`. These are useful decision-support fields, but the frontend does not show a provenance chain from specific source evidence to each item or claim.

### Estimates

`AiEstimate` is a small in-memory shape with project summary and low/standard/premium prices. It is set on local request state after the `ai-estimator` function returns, but this optional request-level estimate is not a durable versioned estimate object in the active frontend.

`EstimateItem` represents persisted line items from `estimate_items`, linked by `lead_id`. It stores item name, source, source URL, quantity, unit price, total price, confidence, and `human_approved`. `EstimateResearchRow` represents `estimate_research`, including source, search query, screenshot URL, notes, and `human_approved`.

The estimate review UI can add manual line items, edit line items, approve individual or all line items, apply a verified labor rate, and generate draft estimate/invoice HTML. This is a useful Phase 1 foundation, but there is no estimate header/version object, no immutable approval event, no reviewer identity, no prior-value preservation, and no durable link from a generated PDF to the estimate version it rendered.

### Invoices and Actual Cost

`Invoice` stores file name, file URL, storage path, vendor name, invoice number/date, property address, extraction status/error, subtotal, tax, and total. `InvoiceCostAnalysis` stores risk level, summary, client summary, overcharge flags, scope gaps, pricing risks, and recommended actions.

Invoices are uploaded to the `invoices` bucket and inserted into the `invoices` table. The app can invoke `extract-invoice` and `analyze-invoice-costs`. This supports actual cost intake in a loose sense, but invoices are not linked to a lead, repair item, approved scope, estimate version, or outcome in the active types. The property relationship is a free-text `property_address`.

### Material and Labor Memory

`MaterialCost` and `LaborRate` are reusable pricing/rate records. Both support `confidence` and `human_verified`. Approving a material price writes `confidence: 'database_verified'` and notes that future estimates may reuse it first. Approving a labor rate writes `confidence: 'labor_verified'` and notes the same reuse intent.

This is the closest current implementation to verified reusable memory. It is still current-state memory, not provenance-preserved memory: edits overwrite fields, reviewer identity is absent, prior values are not preserved, and there is no deprecation/versioning path.

### Review and Approval Structures

Review is represented mostly as mutable state:

- `RequestStatus`: `new`, `needs_info`, `estimate_ready`, `pending_approval`.
- `MessageLog`: `ai_generated`, `auto_sent`, `human_reviewed`, `human_approved`, `status`.
- `MissingInfoRequest`: booleans for missing categories, `status`, `auto_send_allowed`, `sent_at`, `human_reviewed`.
- `EstimateItem`: `human_approved`, `confidence`.
- `EstimateResearchRow`: `human_approved`.
- `MaterialCost` and `LaborRate`: `human_verified`, `confidence`.
- Seller Prep item fields include `human_review_status` by query/display, but not as a typed canonical object in active `src/App.tsx`.

These are useful workflow flags. They are not review events.

### Contractor Structures

Tracked page components include agents, contractors, matches, and contractor dashboards. The active app does not wire those pages through the entrypoint. The migration adds `portfolio_images` and `email` to `contractors`, and `property_address` to `leads`.

The current active implementation does not clearly model contractor-submitted evidence, contractor-reviewed scope, contractor-verified AI summaries, contractor execution, or contractor completion evidence. Bid-memory components accept old invoices, bids, receipts, photos, and notes, but they are not active from the current app shell.

## 5. Target Phase 1 Knowledge Model

The smallest useful Phase 1 model should evolve the current lead/request workflow into property-centered, evidence-aware repair knowledge without building a full enterprise ontology.

Minimum objects:

- Property: durable property identity and address normalization.
- Work Request: an intake/workflow object attached to Property.
- Evidence: uploaded files, report excerpts, photos, measurements, invoices, contractor sources, and admin notes with origin and storage references.
- Repair Item: the canonical unit that links observations, interpretations, scope, estimates, missing info, approvals, completion, and memory.
- Unknown / Verification Requirement: structured missing information connected to a repair item and evidence need.
- Review Event: immutable record of human decisions and corrections.
- Scope Version: proposed work as a decision object, distinct from evidence and observations.
- Estimate Version: versioned decision-support estimate with assumptions, sources, labor/material logic, and approval state.
- Outcome: what actually happened, with evidence or human confirmation.
- Memory Candidate: derived lesson from outcome/history that cannot be reused globally until reviewed.

Phase 1 should reuse existing `leads`, `files`, `missing_info_requests`, `estimate_items`, `estimate_research`, `invoices`, `material_costs`, and `labor_rates` where possible. It should add missing relationships and event history rather than duplicate every concept.

## 6. Mapping Table

| Concept | Exists Today? | Current Representation | Primary Gap | Phase |
| --- | --- | --- | --- | --- |
| Property | Partial | Address fields on `WorkRequest`/`leads`; `property_address` in older pages and invoices. | No durable property identity; duplicate address fields; no property-level graph. | Phase 1 |
| Evidence | Partial | `StoredFile`, `files`, `job-files`, `invoices`, `estimate_research.screenshot_url`, bid-memory files in inactive components. | No evidence ledger; weak origin/type metadata; no claim-level evidence links. | Phase 1 |
| Observation | Missing | Free text in descriptions, messages, seller prep outputs, invoice analyses, old bid scope notes. | No distinct observed/stated/measured fact object. | Phase 1 |
| Interpretation | Partial | AI estimate output, seller prep analysis/items, invoice cost analysis, material/takeoff outputs. | AI-derived interpretation is not consistently separated from source facts or review state. | Phase 1 |
| Assumption | Partial | `ShelterPrepAiEstimate.assumptions`, estimate notes, labor defaults, free-text prompts. | Assumptions are not durable, reviewable, or replaceable in active estimate records. | Phase 1 |
| Unknown | Partial | `missing_info_requests`, `needs_info` status, AI intake `missingInfo`, missing field checks. | Unknowns are category booleans/messages, not linked to repair items/evidence. | Phase 1 |
| Verification Requirement | Partial | Missing-info requests and generated messages approximate it. | No explicit evidence/action requirement object or resolution loop. | Phase 1 |
| Repair Scope | Partial | Work request description, seller prep item `scope_summary`, estimate item names, AI scope types. | Scope is mixed with observation/interpretation and lacks version/approval history. | Phase 1 |
| Estimate | Partial | `AiEstimate`, `estimate_items`, material/labor calculation state, generated draft HTML. | No estimate version/header; limited assumptions/source/reviewer history. | Phase 1 |
| Human Review | Partial | `human_approved`, `human_verified`, `human_reviewed`, status strings. | Review is mutable state, not an event with actor/time/prior value/reason. | Phase 1 |
| Contractor Input | Partial | Inactive contractor/matches pages; bid-memory uploads; possible invoice/estimate uploads. | No active contractor-submitted source vs AI summary distinction. | Later |
| Completion | Missing | `completed` appears only in inactive bid-memory outcome selection and status normalization maps `complete` to `estimate_ready`. | No active completion evidence/confirmation model. | Phase 1 |
| Actual Cost | Partial | `invoices.total`, old bid `final_price`, material/labor cost fields. | Invoices are not linked to estimate/scope/repair item; variance reason missing. | Phase 1 |
| Outcome | Partial | Inactive bid-memory `outcome`; invoice analysis summaries; archive status. | No active outcome object tied to repair item/property. | Phase 1 |
| Candidate Lesson | Partial | `pricing_lessons` in inactive old bid jobs; material/labor review notes. | Lessons are not explicitly candidate vs verified; weak provenance. | Phase 1 |
| Verified Memory | Partial | `material_costs.human_verified`, `labor_rates.human_verified`. | No version/deprecation/provenance back to evidence/outcomes. | Phase 1 |

## 7. Provenance Graph

Target backward chain:

Approved Scope <- Human Review <- AI Interpretation <- Observation <- Evidence <- Source

Target forward chain:

Evidence -> Observation -> Interpretation -> Repair Scope -> Estimate -> Human Approval -> Contractor Execution -> Invoice -> Outcome -> Verified Lesson

Current support by connection:

| Connection | Support | Notes |
| --- | --- | --- |
| Source -> Evidence | Partial | Uploaded files and invoice files are stored, but source actor/origin metadata is thin. |
| Evidence -> Observation | No | No observation object or evidence-to-observation relationship is visible. |
| Observation -> Interpretation | No | AI outputs may interpret request text/files, but the persisted relationship is not visible in the frontend schema. |
| Interpretation -> Repair Scope | Partial | Seller prep and AI material/takeoff flows create draft items, but scope is not a versioned decision object. |
| Repair Scope -> Estimate | Partial | Estimate items are linked to `lead_id`; source/scope relationship is implied, not explicit. |
| Estimate -> Human Approval | Partial | Line items have `human_approved`; no immutable review event or estimate-level approval. |
| Human Approval -> Contractor Execution | No | Active app does not model assignment/execution. |
| Contractor Execution -> Invoice | No | Invoices are uploaded independently by property address, not execution/scope relationship. |
| Invoice -> Outcome | Partial | Invoice cost analysis may summarize issues, but no outcome object is updated. |
| Outcome -> Verified Lesson | Partial | Material/labor memory can be approved, and inactive bid memory has lessons, but provenance is incomplete. |

What Shelter Prep can answer today:

- It can often answer "what lead/request is this item related to?" through `lead_id`.
- It can sometimes answer "what source URL or screenshot supported this estimate line?" through `estimate_items.source_url` and `estimate_research.screenshot_url`.
- It can answer "is this line/rate/price currently approved or verified?" for selected objects.

What it cannot reliably answer today:

- "Which exact evidence produced this claim?"
- "Was this statement observed, inferred, assumed, or verified?"
- "Who reviewed this and what did they change?"
- "Which approved scope version did this invoice complete?"
- "What outcome should feed future memory?"

## 8. Knowledge Quality Rules

| Rule | Current Support | Why |
| --- | --- | --- |
| No source, no claim. | Partial | Some estimate rows have source/source URL and research screenshots; many report and AI claims do not have evidence links. |
| Evidence and interpretation are separate. | Missing | Files and AI outputs are different tables/flows, but no explicit evidence/observation/interpretation model exists. |
| AI output is not automatically truth. | Partial | UI copy repeatedly requires human review; storage model still allows AI results to live as ordinary rows. |
| Confidence is not verification. | Partial | Some records distinguish `confidence` from `human_verified`; other flows use confidence/status loosely. |
| Human correction should preserve prior history. | Missing | Edits generally overwrite current rows. |
| Contractor source retains contractor provenance. | Missing | Active contractor-submitted evidence is not modeled. |
| Unknowns remain visible. | Partial | Missing-info requests exist, but unresolved unknowns are not repair-item/evidence objects. |
| Assumptions must be explicit. | Partial | AI estimate types include assumptions and estimate notes exist; active estimate item records do not preserve structured assumptions. |
| Actual outcome outranks prior estimate. | Missing | No active outcome model links completed work and actual cost back to estimate. |
| Reusable memory requires human verification. | Partial | Material/labor memory has `human_verified`; bid lessons and pricing memory lack full provenance. |
| Property-specific facts do not automatically become global rules. | Partial | Labor/material records can be local by zip/region, but promotion boundaries are not explicit. |
| Global lessons retain provenance to real evidence/outcomes. | Missing | No verified lesson object with evidence/outcome lineage is visible. |
| Memory should be versionable. | Missing | Material/labor edits overwrite values. |
| Memory should be deprecatable. | Missing | No active/deprecated/superseded memory state is visible. |
| Superseded knowledge remains in history. | Missing | No audit/history layer is visible. |
| Presentation simplification cannot rewrite canonical truth. | Partial | Generated reports include warnings and escaped content in estimate/invoice output, but presentation and domain logic are mixed in `src/App.tsx`. |

## 9. Highest-Risk Integrity Problems

1. AI output and human-reviewed truth can collapse into the same current-state records. Seller prep, estimate items, invoice analysis, and memory records use status/confidence/approval fields, but not immutable review events or source-to-claim links.
2. There is no durable Property object. The same address can appear as `address`, `property_address`, `project_address`, invoice `property_address`, or old bid `location`, making cross-workflow traceability fragile.
3. Evidence is mostly attachment metadata. Files are not consistently modeled as source evidence with origin, type, timestamp, property, repair item, and claim relationships.
4. Estimates are not versioned decision objects. Generated draft PDFs/invoices render current state, but there is no durable estimate version with assumptions, scope source, reviewer, and approval event.
5. Actual cost and outcome are not connected back to scope and estimate. Invoices can exist, but the system cannot reliably learn why actual work diverged from estimate.
6. Verified memory lacks lineage. Material and labor records can be marked verified, but there is no preserved chain back to actual evidence, outcome, reviewer, and version.

## 10. Minimum Phase 1 Architecture

Priority 1: Make Property canonical.

- Add a durable property record or canonical property identity attached to each lead/work request.
- Keep address fields, but normalize the relationship so files, repair items, estimates, invoices, outcomes, and memory candidates can trace back to one property.
- Do not build portfolio analytics or a homeowner app.

Priority 2: Treat files and source snippets as Evidence.

- Evolve `files` into an evidence-capable table or add a small `evidence` table linked to files.
- Preserve source type, origin/author, uploaded_by/source_actor, created/uploaded timestamp, storage reference, property, lead, and optional repair item.
- Allow evidence to include non-file sources such as admin notes, contractor notes, measurements, and invoice records.

Priority 3: Create a Repair Item as the operational knowledge unit.

- Link repair items to property, lead, evidence, observations, interpretations, unknowns, scope versions, estimate items, review events, and outcomes.
- Reuse seller prep items and estimate items as inputs, but do not treat them as canonical observations by default.

Priority 4: Extend `missing_info_requests` into Unknown plus Verification Requirement.

- Keep the existing missing-info workflow.
- Add repair item/property/evidence linkage and explicit requested evidence/action.
- Track status transitions from open to answered, rejected, or superseded.

Priority 5: Add Review Event before broader memory.

- Record object reviewed, reviewer, timestamp, prior value, resulting value, decision, reason/comment, and source context.
- Use this for estimate item approval, material/labor verification, seller prep review, scope approval, and memory promotion.

Priority 6: Add Scope and Estimate version records.

- A repair scope should be distinct from observation and interpretation.
- An estimate version should preserve source scope, assumptions, labor/material logic, exclusions, uncertainty, author/origin, review state, and approval event.
- Current `estimate_items` can remain line items under a version.

Priority 7: Add Outcome and Memory Candidate.

- Outcome should record what actually happened and what evidence confirms it.
- Memory candidate should be derived from outcome/history, but not become verified reusable memory until reviewed.

## 11. What To Reuse

- `leads`: keep as work request/intake workflow records, but attach to canonical Property.
- `files` and `job-files`: reuse as the foundation of source evidence, adding metadata and relationships.
- `missing_info_requests`: evolve into Unknown/Verification Requirement rather than creating a parallel missing-info system.
- `estimate_items` and `estimate_research`: reuse for estimate line items and source research under an estimate version.
- `material_costs` and `labor_rates`: reuse as early verified pricing/labor memory, adding provenance, versioning, and deprecation.
- `invoices` and `invoice_cost_analyses`: reuse for actual-cost evidence and variance analysis once linked to scope/estimate/outcome.

## 12. What To Change

Phase 1 structural changes only:

- Add canonical property identity and link `leads` to it.
- Add evidence metadata and evidence-to-claim relationships.
- Add repair item identity as the central unit under a property/work request.
- Add unknown/verification requirement fields or related table tied to repair items.
- Add review events for consequential human approvals and corrections.
- Add estimate/scope version records so generated reports render a known version.
- Add outcome records tied to repair items, completion evidence, invoice/actual cost, and memory candidates.
- Add memory candidate and verified memory lineage before broad reuse.

Avoid changing UI behavior first. The first engineering work should establish the data seams and provenance model behind the current workflow.

## 13. What NOT To Build Yet

DISTRACTION / NOT NEEDED NOW:

- Homeowner product.
- Predictive maintenance.
- Portfolio analytics.
- Global contractor scoring.
- Autonomous routing.
- Marketplace bidding.
- Complex scheduling.
- Large multi-agent systems.
- Cross-industry expansion.
- Advanced predictive intelligence.

Later, not Phase 1:

- Full contractor portal for evidence verification.
- Global lessons across many properties.
- Advanced property portfolio intelligence.
- Automated contractor quality scoring.
- Multi-property trend analysis.

## 14. Suggested Migration Sequence

Documentation only. Do not treat this as an implemented migration plan.

1. Inventory current production tables and columns.
   - Compare actual Supabase schema to frontend assumptions.
   - Resolve duplicate property field names before adding new links.

2. Add canonical Property linkage.
   - Create or identify property records.
   - Backfill leads/invoices with property IDs where safely matchable.
   - Preserve original address strings as source values.

3. Harden Evidence.
   - Add evidence metadata around existing file records.
   - Link evidence to property and lead.
   - Keep file storage paths and public/signed URL behavior intact.

4. Introduce Repair Item.
   - Start with repair items derived from request descriptions, seller prep items, or estimate items.
   - Mark origin clearly: human, AI, contractor, import, invoice, admin.
   - Do not collapse observations, interpretations, and scope into one text field.

5. Evolve missing info.
   - Extend `missing_info_requests` to link to property/repair item/evidence requirement.
   - Track open/answered/superseded/rejected states.

6. Add Review Event.
   - Begin with estimate item approval and material/labor verification.
   - Preserve reviewer, timestamp, before/after values, and reason/comment.

7. Add Scope Version and Estimate Version.
   - Move generated report inputs under versioned records.
   - Keep generated reports as renderings of those versions.

8. Link invoices to estimate/scope/outcome.
   - Preserve invoice as evidence.
   - Add variance reason fields or variance observations.

9. Add Outcome and Memory Candidate.
   - Require evidence or human confirmation for completion.
   - Generate candidates from actual outcomes, not from draft AI output.

10. Promote Verified Memory.
   - Only after review events and provenance exist.
   - Include version/deprecation fields before reuse becomes broad.

## 15. Open Questions

- What is the authoritative source of the current Supabase schema for tables not represented in local migrations?
- Should Property identity be address-normalized only in Phase 1, or does Shelter Prep already have external property IDs available elsewhere?
- Which object should become the first canonical Repair Item source: seller prep items, estimate items, or a new minimal repair item table populated from both?
- Who counts as a reviewer in Phase 1: admin PIN user only, authenticated profile, agent, contractor, or named manual reviewer?
- What minimum evidence should be required before marking work completed?
- Should contractor-uploaded estimates enter through the existing file/evidence path first, before any contractor portal work?
- What should be the first verified memory category: labor rates, material prices, or outcome-derived scope lessons?

