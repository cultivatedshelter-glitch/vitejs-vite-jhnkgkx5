# Current Dev State

Date: 2026-09-17

## Checkout

- Active branch: `auto-button-from-current-main`
- Active app path: `src/main.tsx` renders `src/App.tsx` directly.
- Dirty worktree before this benchmark task included user/untracked artifacts: `package-lock.json`, `codex-backups/`, and `security-audit-fixes.patch`.
- This checkout did not contain `AGENTS.md`, `docs/phase-1-executable-spec.md`, `docs/codex-build-spec.md`, `docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md`, or this file before the benchmark task.
- The sibling `import/request-to-review` worktree contains the Phase 1 instruction/spec documents that were read as repository context.

## Active Implementation Summary

- The active product is lead/request-centered, not yet fully property-centered.
- Request intake stores rows in `leads`.
- Request files upload to Supabase Storage bucket `job-files`.
- File metadata inserted from `App.tsx` is limited to `lead_id`, `file_url`, and `file_name`.
- Inspection reports are not represented by a first-class local object in this checkout.
- No local inspection PDF extraction, OCR, or inspection-finding extraction function is present.
- Seller Prep analysis is triggered through an external Railway endpoint and reviewed from `seller_prep_analyses` / `seller_prep_items`.
- Invoice extraction and cost analysis are referenced as Supabase Edge Functions, but their implementations are not present in this checkout.

## Benchmark Added

- Added a local Phase 1 inspection report capability benchmark.
- The benchmark accepts real founder-supplied reports without code changes.
- The benchmark keeps system output separate from human-reviewed truth.
- The benchmark does not touch production, deploy, apply migrations, or alter app behavior.
- Real reports and run outputs are ignored by Git by default.

## Not Yet Proven

- No safe non-production Supabase database has been verified for applying or runtime-testing the Phase 1 inspection-intelligence migration.
- Database behavior, RLS behavior, RPC behavior, rollback behavior, and Supabase runtime behavior remain unproven.
- Finding recall is not meaningful until human-reviewed truth and system matches are recorded.
- Cost remains `NOT MEASURED` unless supplied by the current system output.

## Step 4 Local Roof Slice

- Added a local roof-only Step 4 extraction adapter in `scripts/`.
- Processed the private real inspection fixture at `local-fixtures/1837-sw-jo-ct-inspection.pdf` only after explicit Step 4 authorization.
- Local output was written under ignored `local-fixtures/step4-roof-vertical-slice/`.
- The local adapter extracted 52 pages of text, one Roof Issues written finding, 66 item 1.x roof photo captions, 66 linked embedded roof images, 67 evidence records, and one Roof System bundle.
- The adapter preserved inspector statements separately from visual observations and Shelter Prep interpretation.
- Semantic visual analysis was not implemented; extracted captions were not treated as visual analysis.
- Human review and agent-facing output were simulated locally only. They were not verified through Supabase, RPC, RLS, or a real human review workflow.
- No migration was run or applied.
- No application UI/runtime code was changed.

## Step 5 Local Roof Visual Slice

- Added local ignored Step 5 output under `local-fixtures/step5-roof-visual-interpretation/`.
- The 66 extracted roof JPEGs from Step 4 were analyzed through caption-free contact sheets.
- Step 5 preserved inspector captions, independent visual observations, Shelter Prep interpretations, unknowns, agreement statuses, processing statuses, and provenance as separate fields.
- The local Roof System bundle snapshot references visual evidence without overwriting Step 4 source evidence.
- Human review remains required; no Step 5 output is `human_verified`.

## Step 6 Local Electrical Slice

- Added an Electrical-only Step 6 adapter in `scripts/`.
- The adapter implements a shared evidence contract and one configurable Electrical Specialist profile without creating autonomous domain agents.
- Existing Step 4 and Step 5 artifacts are reused for source identity, property metadata, and omission of irrelevant roof evidence.
- Because Step 4 did not persist full page text or non-roof images, the first Electrical run used deterministic local PDF extraction to cache only Electrical source pages, Electrical caption pages, Electrical metadata, and linked electrical images.
- Local Step 6 output is written under ignored `local-fixtures/step6-electrical-slice/`.
- The Electrical slice routed 8 source findings, linked 9 electrical photo captions/images, reused visual observations by image hash, generated one Electrical Safety bundle, and generated an 8-item human review queue.
- Model use was limited to one vision call over one caption-free contact sheet containing only electrical-related images; text extraction, routing, bundling, and interpretation were deterministic.
- Human review remains required; no Step 6 output is `human_verified`.
- No migration was run or applied.
- No production system was touched.
- No application UI/runtime code was changed.

## Step 6 Local Moisture / Exterior Envelope Slice

- Added a Moisture / Exterior Envelope-only Step 6 adapter in `scripts/`.
- The adapter reuses the shared evidence utilities and executes one controlled domain profile only.
- Existing Step 4 source identity/property metadata is reused; roof and electrical evidence are not loaded into the Moisture / Exterior Envelope Specialist context.
- Because Step 4 did not persist full page text or non-roof images, the first run used deterministic local PDF extraction to cache only moisture/envelope source pages, relevant caption pages, moisture/envelope metadata, and linked images.
- Local Step 6 output is written under ignored `local-fixtures/step6-moisture-envelope-slice/`.
- The Moisture / Exterior Envelope slice routed 23 source findings, linked 42 photo captions/images, reused visual observations by image hash, generated 23 logical suspicions, generated seven review bundles, and generated a 23-item human review queue.
- Model use was limited to caption-free visual inputs for the 42 routed images; text extraction, routing, bundling, and logical suspicion assembly were deterministic.
- Logical suspicions preserve uncertainty and do not assert concealed damage, exact causation, final repair scope, or pricing.
- Human review remains required; no Step 6 output is `human_verified`.
- No migration was run or applied.
- No production system was touched.
- No application UI/runtime code was changed.

## Shared Local Inspection Evidence Cache

- Added a deterministic shared inspection evidence cache for the canonical private fixture.
- Cache output lives under ignored `local-fixtures/shared-inspection-evidence-cache/1837-sw-jo-ct/`.
- The cache stores source document hash, page text by page, report section index, normalized findings, photo caption index, extracted image manifest, image hashes, finding-to-photo relationships, section-to-finding relationships, domain-routing candidates, compatible visual-cache indexes, and provenance.
- The canonical fixture was scanned once to build the shared cache: 52 pages, 88 normalized findings, 203 photo captions, and 203 indexed images.
- Same-hash cache reuse was verified with zero PDF page scans on a subsequent cache command.
- Electrical and Moisture / Exterior Envelope adapters now consume shared-cache page text and materialized shared-cache images where practical.
- Verification reruns were written to ignored `local-fixtures/shared-cache-verification/` to avoid overwriting existing Step 4/5/6 artifacts.
- Shared-cache verification preserved the prior Electrical behavior: 8 findings, 9 images, one bundle, 8 review items, zero model calls executed on rerun.
- Shared-cache verification preserved the prior Moisture / Exterior Envelope behavior: 23 findings, 42 images, seven bundles, 23 review items, zero model calls executed on rerun.
- Existing visual analyses are reused by image hash; unchanged images are not re-analyzed in the shared-cache reruns.
- No migration was run or applied.
- No production system was touched.
- No application UI/runtime code was changed.

## Round 1 Local Reasoning Benchmark

- Added a local/private Round 1 reasoning benchmark gate to `docs/phase-1-executable-spec.md`.
- Added a cache-consuming reasoning adapter in `scripts/` that runs on the canonical private fixture without rescanning the PDF when the shared cache source hash is unchanged.
- Local output is written under ignored `local-fixtures/round1-reasoning-benchmark/`.
- The Jo Court benchmark output reused the shared cache with zero PDF pages scanned in the Round 1 run.
- Round 1B replaced the single noisy overlap bucket with four explicit relationship types: 7 `potential_condition_relationship`, 14 `operational_review_bundle`, 12 `shared_location_context`, and 14 `shared_system_context` records.
- The prior 29 generic overlap candidates were reduced to 7 condition hypotheses; the larger 47-record total reflects newly explicit non-causal context and review-bundle records, not more causal claims.
- Same location, system, or trade alone no longer creates a potential condition relationship. Condition hypotheses require compatible specific mechanisms plus proximity/pathway/source support, remain atomic, and default to `relationship_status: potential` and `cause_status: not_established`.
- Mechanism routing was narrowed for fireplace/chimney, smoke/CO alarms, garage-door safety, roof weatherproofing, electrical hazards, and low-confidence finish damage. A regression check prevents “smoke chamber” from being classified as a smoke-alarm mechanism or life-safety device.
- Directional location conflicts no longer imply adjacency merely because both locations name the same room/system area, and relationship confidence no longer becomes `strong` from proximity plus mechanism fit alone.
- Next-evidence records now state the blocking uncertainty, smallest material fact/photo/measurement/test, owner, why it matters, and whether new evidence is actually requested. Context and operational bundles request no evidence solely because of grouping.
- The output preserves property/report reconstruction, inspection coverage and limitations, all 88 atomic observations, provenance, epistemic separation, Known/Unknown separation, and the human review packet.
- Potential condition relationships remain unconfirmed hypotheses requiring human review; current semantic success remains `PARTIAL` rather than inferred from test success.
- The benchmark reuses compatible cached visual observations by image hash where available and does not infer new visual observations from captions.
- No pricing, estimating, contractor routing, final scope, marketplace, production Supabase, Railway, UI wiring, migration, or reusable verified memory behavior was added.
- Human review remains required; semantic success is marked PARTIAL until reviewed by a human.

## Round 1C Local Human-Review Border

- Added a local/private Round 1C review-layer generator over the immutable Round 1B machine output.
- Local output is written under ignored `local-fixtures/round1c-human-review/` as one machine-readable JSON artifact and one concise Markdown worksheet.
- The Jo Court worksheet contains 43 primary review cards: 7 potential condition relationships, 22 materially unresolved conditions, and 14 operational review bundles.
- All 12 shared-location contexts and 14 shared-system contexts remain supporting context rather than standalone review decisions.
- The review cards represent all 88 Round 1B source findings with 100% provenance coverage while preserving detailed evidence behind progressive disclosure.
- Human decisions, human corrections, missing relationships, global review notes, and interaction telemetry start empty. Original source and machine-generated fields are retained separately and are not overwritten by review fields.
- Only `approve`, or `edit` with a completed correction, may transition a card to `human_reviewed_interpretation`. Reject, split, keep-separate, and needs-evidence decisions remain non-promoting terminal or waiting states.
- Round 1C reused the same-hash Round 1B artifact with zero PDF pages scanned and no model calls.
- No production system, Supabase runtime, Railway service, application UI, pricing, estimating, contractor routing, final scope, marketplace behavior, or reusable verified memory was changed.
- Round 1C success remains `PARTIAL`; a real timed human review has not yet been completed.

## Round 1D Context / Provenance Guardrails

- Updated the local/private Round 1 reasoning artifact schema to `shelter-prep-phase1-round1d-context-provenance.v1`.
- Each atomic observation now carries `when_observed` using the inspection report date when available, plus a basis label so source observation timing is explicit.
- Each atomic observation now has a `recommended_next_step` wrapper that exposes the move, owner, why that move is appropriate, and review status from the existing smallest-useful-next-evidence logic.
- Weather/environmental context is represented as a relevance and provenance structure. Moisture, roof, drainage, ventilation, and similar evidence is flagged as weather-relevant, but no weather claim is made because no sourced weather research was run.
- The environmental-context guardrail states that weather may only contextualize evidence when sourced weather data is compared against the actual inspection/evidence date, and that no causal claim may be made from weather correlation alone.
- Localized cost context is represented as a supportability structure, not an estimate. It records the most defensible available geography from the property data and carries the rule that ZIP-level precision cannot be claimed unless cited price sources are ZIP-specific.
- No cost range, pricing, material source, contractor bid, seller-ready price, final scope, or estimate total was generated. Round 1D still records cost context as not supportable until scope is defined and sources are reviewed.
- Added artifact-level external-claim controls for weather, prices, codes, and materials. All remain `claims_made: false` with required-source rules.
- Added an artifact-level contractor input model that keeps contractor source material distinct from contractor verification. No contractor input records were present in this local benchmark run.
- Reran the Jo Court Round 1 benchmark against the shared cache: `cache_reused=true`, `source_hash_matched=true`, `pdf_pages_scanned_this_run=0`, `atomic_observations=88`, `systems_indexed=14`, `relationship_candidates=47`, `potential_condition_relationship_candidates=7`, `human_review_packet_items=88`, `model_calls=0`, and private output gitignored.
- Reran Round 1C after the Round 1D artifact refresh: 43 primary review cards, 7 condition-relationship cards, 22 unresolved-condition cards, 14 operational-bundle cards, 88 source findings represented, 100% provenance coverage, zero PDF page scans, and human review not completed.
- `npm test` passed after the Round 1D change: 26 tests passed, 0 failed.
- `npm run build` passed after the Round 1D change.
- No migration was run or applied.
- No production system was touched.
- No application UI/runtime code was changed.

## Round 1E Chronology Guardrails

- Updated the local reasoning schema to `shelter-prep-phase1-round1e-chronology-guardrails.v1`.
- Each observation now carries an explicit chronology object that uses the inspection/source observation date for environmental comparison and records that file upload time was not substituted for the observation date.
- The environmental-context contract now lists the required weather provenance fields and states how sourced dry-weather timing may reduce support for a rain-driven hypothesis without ruling out other moisture sources.
- The acceptance check now requires weather observations, weather claims, and weather sources all to remain empty when no weather research was performed; an unsourced weather value can no longer satisfy the guardrail merely because the source list is empty.
- Synthetic coverage includes a later upload timestamp and proves that the inspection date remains the environmental comparison date.
- The canonical private fixture was not reprocessed for Round 1E because this pass did not need private evidence to prove the chronology contract; its existing ignored Round 1D artifact was left untouched.
- Live weather retrieval, dry-weather claims, and localized pricing remain unimplemented in this Round 1 gate.
- At the time of Round 1E, the executable spec still prohibited pricing implementation. Round 1F supersedes that restriction with a sourced pricing-contract gate.
- `npm test` passed after the Round 1E change: 26 tests passed, 0 failed.
- `npm run build` passed after the Round 1E change. The repository defines no lint script.
- No migration was run or applied. No production, Supabase runtime, Railway service, or application UI was changed.

## Round 1F Pricing Contract / UI Integration Preparation

- Updated the controlling Phase 1 executable spec to authorize sourced localized repair-cost range contract support in Round 1.
- The spec now requires a range for every material finding once a supportable price source is available, while requiring an explicit blocked state when no sourced range exists. It prohibits fabricated ranges, unsupported point prices, false geographic precision, silent source averaging, contractor-quote conflation, and silent range-history replacement.
- Added `scripts/phase1_pricing_contract.py` with source and revision validation, the ZIP-to-national geography hierarchy, immutable range history, initial/tightened/widened movement classification, conflict preservation, contractor-quote separation, and AI/browser verification restrictions.
- Added the Node wrapper and test entry points `scripts/phase1-pricing-contract.mjs` and `scripts/phase1-pricing-contract.test.mjs`.
- Updated the local reasoning schema to `shelter-prep-phase1-round1f-pricing-contract-integration.v1`.
- Each reasoning record now exposes a finding-card contract containing the requested pricing, Known/Unknown, context, next-step, review, evidence, and source fields.
- Because no provenance-bearing price source is supplied to the current local reasoning run, finding cards use `BLOCKED_MISSING_SOURCED_RANGE` with null low/high values. This is an honest contract state, not a fabricated repair-cost range.
- Synthetic tests prove a wide sparse-evidence range, tightening after uncertainty-reducing evidence, widening after added risk, immutable prior-range preservation, metro-to-ZIP precision rejection, unsourced-range rejection, visible conflicting sources, contractor-quote separation, and rejection of AI-authored verified status.
- `npm test` passed after the Round 1F change: 28 tests passed, 0 failed.
- `npm run build` passed after the Round 1F change. The repository defines no lint script.
- Live price retrieval remains separate and is not implemented. No live prices were fetched or fabricated.
- Application UI wiring remains separate and is not implemented. The artifact contract is prepared for later integration only.
- The canonical private fixture was not reprocessed; existing ignored private artifacts were left untouched.
- No migration was run or applied. No production, Supabase runtime, Railway service, or application UI was changed.

## Round 1G Live Source Integration

- Updated the controlling executable gate to authorize finding-specific pricing-source ingestion, bounded historical-weather retrieval, deterministic fixtures, local persistence contracts, and Supabase payload preparation without database execution.
- Added `scripts/phase1_live_source_integration.py` with normalized pricing-evidence ingestion for contractor, completed-job, supplier/material, public labor, permit/valuation, local benchmark, regional benchmark, and national-fallback sources.
- Pricing records preserve source identity and authority, raw URL/internal reference, retrieval/publication time, property geography, source geography, geographic match level, repair category, trade, supplied values and basis, scope inclusions/exclusions, notes, limitations, field-condition knowns/unknowns, and review state.
- Point-value contractor quotes remain separate from Shelter Prep ranges. Range-eligible sources require supplied low/high evidence; absent sourced ranges remain blocked rather than fabricated.
- Added an on-demand Open-Meteo Historical Weather API adapter using coordinates, the source observation timestamp, a bounded historical window, UTC timestamps, and explicit measurement units. This is request-driven historical context, not monitoring.
- Live provider verification succeeded against a public Portland city-center coordinate for a 48-hour historical window. The returned record was marked `fixture_backed: false` and preserved the provider URL, requested period, provider location, retrieval time, measurements, units, finding/evidence links, and review status.
- Added deterministic wet- and dry-weather providers for tests. Dry-weather output reduces support for rain timing without proving another cause; wet-weather output states relevance without asserting causation.
- Added source-to-claim validation. Unsourced weather claims, missing source references, and causal promotion from weather correlation fail validation.
- Added append-only local JSON persistence for development/tests and prepared `evidence_items` insert payloads plus finding-link instructions for the existing Phase 1 Supabase schema. No Supabase write was executed.
- Retrieved source, AI interpretation, human review, and verified operational knowledge remain separate states. AI, browser, and system paths cannot mark source evidence verified.
- Updated the reasoning artifact schema to `shelter-prep-phase1-round1g-source-integration-contract.v1` for the explicit weather-context frontend field.
- The finding-card contract now exposes an explicit `weather_context` field in addition to `relevant_context`.
- Added `scripts/phase1-live-source-integration.mjs` and `scripts/phase1-live-source-integration.test.mjs`.
- The end-to-end deterministic moisture fixture proves: inspection observation date, weather relevance, historical weather source, Known/Unknown separation, specific missing evidence, sourced city-level price evidence, a distinct contractor quote, a Shelter Prep range, field-condition unknowns, next step and rationale, claim/source references, persistence payloads, and Needs Human Review status.
- `npm test` passed after Round 1G: 30 tests passed, 0 failed.
- `npm run build` passed after Round 1G. The repository defines no lint script.
- Automated live pricing retrieval remains unimplemented because no defensible price provider is configured. Real pricing records can be ingested when supplied with provenance.
- Supabase database persistence, RLS behavior, RPC behavior, and browser/server authority remain unverified at runtime because no explicitly verified non-production database was authorized.
- No migration was created or applied. No production system, Railway service, application UI, or private fixture was changed.

## Round 1H Guided Inspection UX

- Updated the controlling executable gate to authorize one narrow local UI vertical slice without authorizing production writes, migrations, autonomous decisions, monitoring, marketplace behavior, or broader product expansion.
- Added a mobile-first guided sequence: Property -> Add Evidence -> Processing -> Review Findings -> Close Gaps -> Next Steps.
- The default local app now opens the guided experience. The existing application and its backend/admin workflows remain unchanged and are available only in development with `?legacy=1`.
- Intake asks only for a property address and evidence type, then accepts PDF, document, image, video, or note input. Selected browser files remain local UI state; this round does not claim durable upload or persistence.
- Added one deterministic moisture-finding fixture with visible fixture labeling, observation date, Known/Unknown separation, a specific missing-evidence question, recommended next step and rationale, relevant weather timing without a causal claim, Needs Human Review status, and collapsed evidence/source details.
- The fixture exposes a city-level `$900-$3,000` range without ZIP-level precision, a separate `$1,475` contractor quote, immutable-looking initial/current range history, and a separate `Not yet sourced` blocked-price example. These values are fixture UI data, not live estimates or contractor verification.
- Human review is read-only. No browser action can mark a finding `human_verified` or `contractor_verified` while server authority remains unverified.
- Added `scripts/phase1-ux-contract.test.mjs` to protect the six-stage flow, minimal intake, evidence formats, epistemic labels, weather non-causality, pricing geography, quote separation, review boundary, collapsed disclosures, and mobile control constraints.
- `npm test` passed after Round 1H: 35 tests passed, 0 failed.
- `npm run build` passed after Round 1H. The repository defines no lint script.
- Browser verification completed across the full flow at the default desktop viewport and at `390x844`. The range-history disclosure, one-question gap screen, and final property next-step summary rendered successfully with no browser console warnings or errors.
- No migration was created or applied. No Supabase write, production system, Railway service, live source retrieval, private fixture processing, or verified-memory action occurred.
