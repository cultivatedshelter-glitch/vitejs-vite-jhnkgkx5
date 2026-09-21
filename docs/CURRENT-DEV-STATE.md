# Current Dev State

Date: 2026-09-20

## Finding-Level Investigation Quality Pass

- The current 131-page production inspection source was rerun locally through the exact reasoning entry point: 131 pages extracted, 31 atomic observations, 11 systems, 14 relationship candidates, and zero incomplete extractions.
- The resulting `shelter-prep-phase1-finding-investigation.v1` artifact passed the server artifact validator and the finding-level audit with zero paraphrase-only interpretations.
- Finding interpretation now uses issue-specific research profiles rather than repeating the inspector statement. Each matched material finding carries a corrected domain/system/trade, a consequential unknown, a concrete next task and rationale, and provenance-bearing technical guidance where relevant.
- The audited 31-finding output corrected known classification errors for electrical panel knockouts, HVAC combustion venting, laundry catch pans, bathroom wet-area caulk, and carbon-monoxide alarms.
- Repair paths remain bounded to realistic issue-specific options. Across the audited report, path pricing uses up to three compatible sources; fewer are retained when fewer defensible sources exist, and the laundry catch-pan path remains explicitly blocked rather than receiving a fabricated range.
- Technical research sources are mapped adjacent to interpretation in the reviewer and released-result UI and in the reviewed PDF. New reviewed reports reject findings that contain banned internal process language or lack independent research provenance.
- Local-professional research now runs before human review using the repository-resolved Property address and is stored on the draft artifact. `GOOGLE_PLACES_API_KEY` is not configured in Railway, so the current result honestly records `skipped_not_configured` by trade and no businesses are fabricated. The key must remain server-only and must not use a `VITE_` prefix.
- Human review, corrections, report generation, release, delivery, immutable history, auth/RLS, and private storage contracts were not weakened or bypassed. The improved 31-finding draft has not been automatically reviewed or released.
- Verification: `npm test` passed 95/95, `npm run build` passed, the Python reasoning self-test passed, the exact real-report artifact passed server validation, and `git diff --check` passed.

## Checkout

- Active branch: `shelter-prep-phase1-dev` at checkpoint `1f573a77d08c2e2d9c7d7d0d76894aed9b3c7bf5` when the local runtime work began.
- Active app path: `src/main.tsx` renders the guided `Phase1Experience` by default; the preserved legacy `App` is development-only behind `?legacy=1`.
- Pre-existing local changes kept outside the Phase 1 runtime work include `package-lock.json`, `AGENTS.md`, `codex-backups/`, and `security-audit-fixes.patch`.
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

## Round 1I Dynamic Reasoning-to-UX Integration

- Created local checkpoint commit `21d88e9` (`Checkpoint Shelter Prep Phase 1 through Round 1H`) containing only the verified Phase 1 benchmark, reasoning, pricing, live-source, schema, UX, documentation, and test files. Pre-existing dependency-lock churn, agent instructions, backup patches, and unrelated security artifacts were excluded.
- Added `src/phase1ReasoningAdapter.ts` as the single frontend boundary from existing Round 1 reasoning artifacts or Round 1G source-integration bundles to `Phase1ExperienceViewModel` and `Phase1FindingViewModel` records.
- The adapter maps finding identity, title, observation, Known/Unknown, missing information, next step, owner, rationale, review status, evidence references, linked sources, conditional weather context, pricing state/geography/basis, range history, contractor quote, categories, property address, and potential related findings without recreating reasoning rules in React.
- Normal mode no longer contains or silently loads deterministic finding values. It requests structured output only from `VITE_PHASE1_REASONING_ARTIFACT_URL`; when no endpoint is configured, the processing view reports the blocker and states that selected evidence remains local to the browser.
- Explicit development mode is available only when Vite is running in development with `?fixture=1`. Fixture-backed artifacts are visibly labeled and the adapter rejects them when presented as live output.
- Added `public/phase1-round1g-moisture.fixture.json` as the explicit deterministic test/development payload. A test invokes the Python Round 1G `--print-fixture` path and checks the UI payload's contract-critical values against the actual integration output to prevent drift.
- The overview now derives finding count, findings needing evidence, system count, titles, categories, statuses, prices, and geography from returned data. No fixed eight-finding summary remains.
- Finding cards now render returned observation, Known/Unknown, next step, owner, rationale, review status, supported or blocked price state, price basis, contractor quote, evidence, claim-linked sources, conditional weather/environment, actual range history, and related findings.
- Pricing with `BLOCKED_MISSING_SOURCED_RANGE` renders `Not yet sourced` and no dollar values. Irrelevant weather is omitted; relevant weather without a sourced result renders a quiet unavailable state. Contractor quotes remain separate from Shelter Prep ranges.
- Processing now reflects only artifact request, mapping, ready, or failure states. The timed simulated task progression from Round 1H was removed.
- Human review remains display-only. No frontend path can grant `human_verified` or `contractor_verified` authority.
- Existing Supabase upload behavior remains in the preserved legacy application. It was not duplicated or invoked because durable storage, private-bucket policy, processing handoff, and server authority are not proven for this guided flow.
- Browser verification proved the normal-mode blocker and the explicit Round 1G fixture path through dynamic overview, finding card, localized range, Known/Unknown, weather claim, next step/rationale, linked-source expansion, range history, contractor input, and Needs Human Review status. Desktop and `390x844` rendering completed with no browser console warnings or errors.
- `npm test` passed after Round 1I: 41 tests passed, 0 failed.
- `npm run build` passed after Round 1I. The repository defines no lint script.
- No migration was created or applied. No Supabase write, production system, Railway service, private fixture processing, verification event, or verified-memory action occurred.

## Round 1J Live Processing Boundary

- Created checkpoint commit `c672da6` (`Checkpoint Shelter Prep Phase 1 Round 1I`) containing only the verified Round 1I adapter, UI, fixture, tests, and documentation. Pre-existing `package-lock.json` churn and unrelated untracked files remained outside the checkpoint.
- Added an authenticated HTTP boundary for private evidence upload, processing-request creation, and request-status retrieval under `/api/phase1`. It accepts a property ID, stable evidence references, and an optional note.
- Added a Supabase repository implementation that uses the caller's JWT for RLS-governed property/report reads and private-bucket upload/download. It never creates public evidence URLs. A server-only Supabase secret is required for pipeline/model persistence and is not referenced by frontend code.
- Prepared persistence against the existing `inspection_reports`, `inspection_pipeline_runs`, and `model_runs` tables. Processing requests retain property/evidence relationships, state, timestamps, errors, input references, artifact version, and completed artifact. Model output remains `draft_created`, requires review, and is never memory-eligible.
- The server invokes `scripts/phase1_round1_reasoning_benchmark.py`; it does not duplicate inspection reasoning. The current runner truthfully supports exactly one PDF inspection report. Photo-only, document-only, video-only, and note-only reasoning remain unsupported by this processor.
- Added server-side artifact validation for observation/interpretation separation, Known/Unknown, next step/rationale, source/evidence links, observation chronology, pricing range/provenance or explicit blocked state, contractor-quote separation, weather non-causality, and untrusted review status. Malformed or fixture-backed live artifacts become explicit failed requests.
- The guided frontend now uploads evidence, submits a processing request, displays only `uploaded`, `queued`, `processing`, `completed`, or `failed` states received from the live path, and sends the completed artifact through the existing Round 1I adapter. `VITE_PHASE1_REASONING_ARTIFACT_URL` is no longer used. Live failure never falls back to fixture data; `?fixture=1` remains the only fixture path.
- A deterministic non-fixture test generates a real PDF, passes it through multipart upload, authorization, the actual Round 1 Python workflow, server validation, and the actual TypeScript frontend adapter. It also proves stable evidence/property association and that the 2030-01-02 inspection date is distinct from the later upload timestamp.
- Tests cover authorized processing, unauthorized property access, malformed artifact rejection, fixture rejection in live mode, explicit failed state, and absence of silent frontend fallback.
- `npm test` passed after Round 1J: 45 tests passed, 0 failed.
- `npm run build` passed after Round 1J. The repository defines no lint script.
- Supabase runtime verification is `BLOCKED`: no explicitly confirmed non-production target, private `phase1-evidence` bucket/policies, applied inspection schema, or server secret was authorized for this run. No migration was created or applied, no Supabase write executed, and no production system was touched.
- Human review remains read-only in this UI. No frontend or new endpoint can set `human_verified`, `human_reviewed`, `contractor_verified`, `seller_ready`, or `finalized`.

## Round 1K Visual UX Refinement

- Refined the existing guided experience without changing the reasoning adapter, pricing logic, live processing boundary, persistence mapping, or review authority.
- Step 1 now asks only for the property address. Step 2 presents four large evidence actions for an inspection, photos/video, a note/question, or a camera photo, followed by one optional note and one primary action.
- Simplified the visible progress model to `Property`, `Evidence`, and `Review` while preserving the existing internal workflow states.
- Reworked processing into a calm five-item list using only truthful coarse state mapping; later substeps remain pending until the server reports completion.
- Reworked the overview into compact status summaries and directly selectable repair rows derived from adapter data.
- Reworked finding detail so localized cost context, price sources, range history, one next step, rationale, and missing information appear before deeper reasoning on mobile. Desktop uses a restrained two-column layout with source evidence and Known/Unknown on the left and price/action context on the right.
- Preserved fixture labeling, blocked-price behavior, source/weather disclosures, contractor-quote separation, read-only review status, and live failure isolation.
- Updated the UX contract tests for the new visual and interaction contract. The complete suite and production build pass after this refinement.

## Round 1L Property Context Handoff

- Diagnosed the guided intake failure: the address existed only in React state, while live processing read `propertyId` exclusively from a manually supplied `?property=` query parameter. No guided property create/resolve call existed.
- Added `POST /api/phase1/properties/resolve` to the authenticated server boundary. It conservatively normalizes the supplied address, reuses exactly one RLS-visible match, rejects ambiguous duplicates, or inserts a real `properties` row through the caller's JWT with `created_by` set to that actor.
- The frontend now waits for the server-returned property UUID before entering Evidence. It never creates a UUID locally and no longer reads property context from the URL.
- Returned `{id,address}` context is retained in session storage for refresh continuity. Any address mismatch clears it immediately, and Continue always re-resolves through the server so retained context does not bypass current authorization.
- Evidence upload and processing now receive the retained server-issued property UUID. Existing server authorization still verifies property access and evidence ownership before processing.
- Added tests for address-to-property creation/reuse, property retention, evidence/property linkage, missing-context rejection, guided intake without a manual workspace URL, and refresh/address-change safety.
- Runtime verification remains `BLOCKED`. `npm run dev:processing` fails because `SUPABASE_SECRET_KEY` is absent; no confirmed non-production target is authorized, and the Phase 1 schema plus private `phase1-evidence` bucket policies remain unapplied/unverified. No database write or production action was attempted.

## Round 1M Clean Nonproduction Supabase Bootstrap

- The only Supabase project used was the explicitly authorized nonproduction project `oivzalfsjoyycbqunblk` (`shelter-prep-phase1-dev`). No other project was accessed or modified during this bootstrap gate.
- The target was `ACTIVE_HEALTHY` and clean before application writes: no public application tables, project migrations, storage buckets, or application data existed.
- Applied `phase1_inspection_intelligence_schema`, creating the repository's UUID-based Property trust spine. `public.properties.id` is `uuid default gen_random_uuid()`, and Phase 1 property relationships use UUID foreign keys.
- Added and applied `phase1_evidence_storage`. The `phase1-evidence` bucket is private, limited to 50 MiB per object, and has authenticated insert/select/delete policies tied to the existing `actor_id/property_id/file` path contract and `private.phase1_user_has_property_access`.
- Added and applied `phase1_runtime_grants` because this clean project does not automatically grant new Data API tables to `service_role`. Browser roles retain only the narrower repository grants; server persistence tables have explicit service-role DML grants.
- Revoked browser execution of the clean-project `public.rls_auto_enable()` security-definer event-trigger helper. The Supabase security advisor reports no remaining findings after the change.
- Project URL and publishable key are configured in ignored `.env.local`. The processing script now loads `.env.local` after tracked `.env`. No server secret is present in Git diff, source files, tests, fixtures, logs, or a `VITE_*` browser variable.
- StackBlitz stores `SUPABASE_SECRET_KEY` as a masked variable scoped to `cultivatedshelter-glitch/vitejs-vite-jhnkgkx5`. That StackBlitz-only variable is not injected into this local Codex checkout or its processing server.
- `npm test` passes with 50 tests, the focused Phase 1 schema/processing suite passes with 17 tests, `npm run build` passes, and `git diff --check` passes.
- Live Supabase runtime verification remains `BLOCKED` in this checkout: `npm run dev:processing` exits with `SUPABASE_SECRET_KEY is required`. No real test identities, Property row, storage object, processing request, or artifact row were created, so RLS/storage allow-deny behavior and the non-fixture Property-to-UI path are not yet claimed as proven.

## Round 1N Local Runtime Setup

- Chose the current local Codex checkout as the reliable runtime path. No StackBlitz or Codespaces state is required.
- Added `npm run setup:phase1` to install locked Node dependencies and an ignored `.venv` with pinned `pypdf`, Pillow, and the synthetic-PDF test dependency ReportLab.
- Added `npm run dev:phase1` as a guarded launcher for the existing frontend and processing commands. It refuses any Supabase URL other than `oivzalfsjoyycbqunblk`, checks public and server credentials without printing them, selects the project virtualenv, and stops both child processes together.
- Added `docs/LOCAL-RUNTIME-SETUP.md` with the source branch, authorized project ID, required environment-variable names, commands, tests, server-only secret warning, and stale-StackBlitz warning.
- `.env.local` remains ignored through `*.local`. `SUPABASE_SECRET_KEY` is not exposed through a `VITE_*` name or referenced by frontend code.
- `npm run setup:phase1` succeeds. The local frontend starts and rendered the Property intake at `http://127.0.0.1:5174/` because port 5173 was already occupied; HTTP returned 200 and browser console verification found no errors or warnings.
- Public connectivity to the authorized Supabase development project returned HTTP 200. The combined runtime and processing server remain `BLOCKED` because `SUPABASE_SECRET_KEY` is empty in this checkout. The launcher fails closed before starting either server and does not fall back to fixtures.
- A future server-side human-review email has a stable trigger boundary: completed processing persists pipeline status `needs_review` with stage `human_review`. No notification sender or trigger was added.
- With `SHELTER_PREP_PYTHON=.venv/bin/python3`, `npm test` passes with 52 tests, focused `scripts/phase1-*.test.mjs` passes with 46 tests, all eight Python Phase 1 self-tests pass, `npm run build` passes, and `git diff --check` passes. The repository defines no lint script.
- Live authenticated Property creation, private evidence upload, artifact persistence, RLS allow/deny behavior, storage-policy behavior, and the non-fixture end-to-end UI path remain unverified in this checkout until the server secret is supplied securely.

## Round 1O Minimal Supabase Auth And Live Runtime Verification

- Added the smallest pilot auth surface: Supabase email/password sign-in and sign-out. The browser receives a normal Supabase session; no signup, password reset, account management, role management, or browser service-role path was added.
- Added a server-only, project-pinned test-identity provisioning command. It reads `PHASE1_TEST_EMAIL`, `PHASE1_TEST_PASSWORD`, and `SUPABASE_SECRET_KEY` from ignored environment files, refuses every project except `oivzalfsjoyycbqunblk`, and never returns credentials to browser code.
- Property context now retains the authenticated user ID with the server-issued Property UUID. Missing sessions, sign-out, user changes, and retained-context user mismatches clear the context before evidence upload.
- Fixed an authenticated RLS interaction in Property creation. The caller now inserts without requesting a return representation, then reads the new row through the existing owner-scoped select policy. The UUID remains database-generated and RLS was not changed or weakened.
- Live verification used only nonproduction project `oivzalfsjoyycbqunblk`. Authenticated User A created/resolved Property `e7159608-0f14-493e-8f32-910555be4f0d`; its UUID is database-generated and its `created_by` value matches User A.
- A synthetic non-fixture inspection PDF was uploaded to the private `phase1-evidence` bucket and linked to that Property. Its inspection observation date is `2030-01-02`; its upload timestamp is `2026-09-18T05:37:13.311Z`, so upload time was not substituted for observation time.
- Processing request `b6e118c2-2a28-47e6-a981-7c7db980052b` completed at pipeline status `needs_review` and stage `human_review`. The persisted model run remains `draft_created`, `review_required=true`, and `memory_eligible=false`.
- The persisted non-fixture artifact contains two findings. The existing frontend adapter consumed it and the current findings UI rendered two repair items, both visibly marked `Needs Human Review`, with no fixture label or silent fixture fallback.
- The unauthenticated Property endpoint returned HTTP 401. User B could read zero rows for User A's Property and evidence, could not download User A's private storage object, and received HTTP 404 for User A's processing request. An unauthenticated public storage read was also denied.
- Browser code still cannot assign trusted human or contractor verification. The live result remained a draft requiring human review, and the existing static authority tests continue to protect that boundary.
- Verification passes: `npm test` 56/56, focused `scripts/phase1-*.test.mjs` 50/50, all eight Python Phase 1 self-tests, `npm run build`, and `git diff --check`. The repository defines no lint script.
- The requested authenticated non-fixture path is no longer blocked: sign in -> Property -> private evidence -> processing -> persisted artifact -> existing adapter -> findings UI works against the authorized development project. Production account lifecycle and outbound auth email are intentionally outside this minimal pilot gate.

## Round 1P Admin Review Notifications And Deployment Readiness

- Added a server-owned Phase 1 email outbox and Resend adapter. Notifications are limited to persisted `needs_review` and `processing_failed` transitions and include property address, submitting email when available, evidence summary, finding count when available, status, and a stable HTTPS review link.
- Added database and provider idempotency. The outbox has one unique record per event/request/recipient/channel, and Resend receives the notification UUID as its idempotency key. Sent or currently sending records do not send again; failed records may retry.
- Email delivery failure is persisted with status, attempt count, failure reason, and provider metadata without changing a successful processing artifact. Provider secrets remain server-only and there is no browser notification endpoint.
- Added authenticated review deep links at `/properties/{property_id}/review?request={processing_request_id}`. After sign-in, the existing RLS-governed status endpoint supplies the artifact to the existing adapter and findings UI. No storage URL is included in email.
- Applied `phase1_review_notifications` and `phase1_review_notifications_hardening` only to development project `oivzalfsjoyycbqunblk`. The table has RLS, explicit always-false anon/authenticated policies, no browser grants, service-role-only DML grants, transition deduplication, and covering foreign-key indexes. Live anon and authenticated reads both returned PostgreSQL code `42501`.
- Supabase security advisors report no notification-table finding. The development project still has a pre-existing warning that leaked-password protection is disabled; this must be enabled before inviting production pilot users.
- Added one production-capable Docker/Railway service that builds and serves the Vite frontend, runs the existing Node processing boundary, installs the pinned Python dependencies, uses Railway's platform port, exposes `/healthz`, and keeps browser API requests same-origin.
- Local production-mode smoke checks passed for `/healthz`, `/`, the deep review SPA route, and unauthenticated API denial. A real Docker build could not be run because Docker is not installed in this environment.
- Real outbound email and remote HTTPS deployment remain blocked because `RESEND_API_KEY`, `SHELTER_PREP_REVIEW_EMAIL`, a verified sender, and Railway credentials/project are not configured.
- The current Supabase project remains development-only and contains test identities/data. Recommendation: use a separate production Supabase project for real pilot agents. No second project was created, no real pilot data was moved, no DNS record was changed, and `main` was not modified.
- `npm test` passes with 63 tests, the focused Phase 1 suite passes with 57 tests, all eight Python self-tests pass, `npm run build` passes, the local production-mode HTTP smoke test passes, and `git diff --check` passes. The repository defines no lint script.

## Round 1Q Numbered Inspection Report Extraction

- Diagnosed the production `atomic observations are missing` failure against the authorized real report without committing or logging its contents. PDF extraction succeeded for all 131 pages and produced 71,790 text characters, but the original parser recognized only fixed issue-section headings and `N)` recommendations. It therefore produced zero normalized findings and serialized an otherwise versioned artifact with zero observations.
- Added deterministic support for reports that index findings with hierarchical item numbers and provide detailed observation/recommendation blocks. The parser joins blocks that cross page boundaries, preserves detail and summary page provenance, keeps source item numbers, and does not invent recommendations when the source supplies none.
- Bumped the shared evidence-cache schema to v2 so prior zero-finding caches are rebuilt. NUL characters emitted by PDF extraction are removed during text normalization.
- Added a second deterministic cover-header form for source-backed inspection dates. Observation date remains distinct from upload time.
- Zero-finding reports now fail at extraction with explicit page/text diagnostics. They no longer continue to generic artifact validation, and validation itself remains unchanged.
- The same production report format now yields 31 normalized findings and 31 atomic observations. Every observation has source page, item number, inspection date, and provenance. The unchanged server validator passes, and the existing frontend adapter produces 31 non-fixture finding view models.
- Production verification against `lbyzkvbtolpwrvjfbhlq` completed through the existing authenticated API and reused the already-uploaded private evidence object. The new run persisted one artifact, reached pipeline status `needs_review` and stage `human_review`, rendered 31 findings in the live UI, and sent one `needs_review` reviewer email with a recorded provider message.
- The original failed run persisted no model artifact. Its evidence remains durably linked to both the failed run and the successful verification run, so no orphaned evidence or partial artifact was created by this failure.
- `npm test` passes with 66 tests, `npm run build` passes, and `git diff --check` passes. The repository defines no lint script.

## Round 1R Evidence-First Review, Location, And Environmental Context

- Added source-bound `affected_location` records to every atomic observation and finding card. Orientation is emitted only from explicit report text or an explicit linked caption; unsupported orientation remains unknown with a targeted confirmation prompt. Low-confidence orientation is not promoted to fact.
- Added relevant-only historical weather enrichment through Open-Meteo. It geocodes the Property at ZIP or city precision, compares a three-day pre-inspection window through the actual observation date, preserves provider/grid provenance and units, distinguishes wet and dry timing, records explicit lookup failures, and states that correlation does not establish causation.
- Reworked the live reviewer view around primary evidence, inspector text/recommendation, page/item/section/document provenance, structured location, Shelter Prep interpretation, Known/Unknown, pricing status, environmental context, review reason, and one recommended next step. Findings are grouped into Quick Review, Careful Review, and Waiting for Evidence.
- Added authenticated Approve, Edit / Correct, Needs More Information, and Reject endpoints over the existing server-authoritative finding-review RPC. Review events retain reviewer identity, timestamp, artifact version, approved fields, delivery eligibility, and correction overlays without mutating the original source or persisted AI artifact.
- Added a separate agent view. Before review it reports only that the findings are under review. After review it exposes only human-reviewed, delivery-eligible findings and retains the issue, meaning, cost status, Known/Unknown, evidence reference, Next Step, and rationale without internal reviewer/parser machinery.
- Hardened the existing profile boundary with `20260918183427_phase1_profile_role_hardening.sql`. Authenticated clients may create only an active viewer profile and cannot change `role` or `active`; trusted reviewer assignment remains server-administered. The migration was submitted through the confirmed production SQL editor. A destructive live role-mutation test was intentionally not performed.
- Production verification used only project `lbyzkvbtolpwrvjfbhlq` and reused the existing private report reference. Request `1b5c267f-a1d2-4579-828d-1399934e7197` completed with schema `shelter-prep-phase1-round1g-source-integration-contract.v1`, 31 atomic observations, and 31 persisted finding rows. No fixture marker was present.
- Production location results: 2 explicit orientations, 29 unknown orientations, zero inferred-low-confidence orientations, and 5 findings needing location confirmation. All 31 findings contain the source evidence panel; the current parser did not produce a confidently linked primary photo for this report format.
- Production review routing produced 7 quick-review, 19 careful-review, and 5 waiting-for-evidence findings. Thirteen findings were weather-relevant; all 13 received an available historical result and none failed lookup.
- The live adapter produces 31 reviewer findings, 31 justified next steps, 13 environmental panels, zero raw source-file identifiers in human-facing evidence references, and zero agent findings before human approval. All 31 prices remain truthfully blocked because no defensible localized pricing source is connected.
- `npm test` passes with 73 tests, the Round 1 Python self-test passes, `npm run build` passes, and `git diff --check` passes. The repository defines no lint script.
- A real timed 10-15 minute human review was not performed, so no timing claim is made. The production pilot Auth user currently has no `profiles` row and therefore correctly lacks owner/admin review authority; explicit server-side role provisioning is still required before that identity can approve production findings.

## Round 1S Final Pilot Workflow Consolidation

- Consolidated the production workflow into three distinct surfaces: simple authenticated agent intake, an internal reviewer queue and finding workbench, and a released agent result. Before release, non-reviewers receive only the `under_review` state and finding count; the server withholds the draft artifact rather than relying on frontend filtering.
- Added a role-gated `/review-queue` with Needs Review, Waiting for Evidence, Failed, Reviewed, and Processing states. Queue rows show Property, submitting agent, finding count, review priority, age, and one Review action. No CRM or analytics surface was added.
- Expanded the reviewer workbench with candidate-photo confirmation, bounded source/continued/next/previous page previews, a private authenticated full-report route, orientation and rationale corrections, and source-supported price correction validation. Candidate images remain unconfirmed until a reviewer records the relationship.
- Added server-owned release gating. A request becomes completed only after every finding has a terminal human decision and at least one finding is delivery-eligible. Released agent responses contain only reviewed, delivery-eligible findings and omit reviewer identity, internal reason, source-file IDs, provenance hashes, extraction state, and reviewer controls.
- Added idempotent `reviewed_result_ready` delivery through the existing Resend outbox. Delivery targets the submitting agent, records one event per request/recipient, and leaves the human approval intact if the provider fails.
- Applied the notification event constraint and profile trusted-field guard only to production project `lbyzkvbtolpwrvjfbhlq`. The exact Auth user `cultivated.shelter@gmail.com` is email-confirmed with an active `admin` profile. Browser attempts to promote its profile role are denied.
- Production authorization checks confirmed that the reviewer can open the queue, a normal agent receives HTTP 403 for review mutation, and the agent receives no draft artifact before release. A transaction exercised approve, edit, needs-more-information, and reject through the production review RPC under the exact reviewer JWT claims, then rolled back every test decision.
- A fresh non-fixture production run reused the existing private 131-page report evidence and created request `0d6aea11-b658-448f-8639-1a0ee5f38fe6`. It persisted 31 atomic observations and 31 finding rows, remained `needs_review` at `human_review`, appeared in the reviewer queue, and recorded exactly one sent needs-review notification.
- The fresh artifact contains source page/item provenance for all 31 findings and 105 bounded page previews: 31 source-page, 40 continued-source-page, 15 next-page, and 19 previous-page previews. This report produced no extractable image candidate records, so no photo relationship was fabricated; the reviewer receives page previews and the private full-report fallback.
- Thirteen weather-relevant findings received 13 sourced historical-weather claims with no lookup failure. All 31 price ranges remain blocked because no defensible localized price source is attached.
- A real timed human review was not performed. No production finding was substantively approved, corrected, rejected, or left waiting as a claimed human judgment, so the reviewed agent result and post-approval agent email remain blocked on that human review. No 10-15 minute timing claim is made.
- Final verification passes: `npm test` 78/78, the Round 1 Python self-test, `npm run build`, and `git diff --check`. The repository defines no lint script. The build emits only the existing stale `caniuse-lite` advisory.

## Round 1T Decision-Ready Review Pass

- Added deterministic repair-path decision support over the existing atomic observations. The catalog supplies one to three realistic paths where supported, keeps uncertainty in assumptions/exclusions and low-confidence ranges, uses explicitly labeled United States national fallback pricing, and leaves a path blocked when no defensible source matches.
- The existing 31-finding production report title/section contract maps to 48 paths across 30 findings with 37 distinct source records. `No catch pan` remains `BLOCKED_MISSING_SOURCED_RANGE`; no generic plumbing range was stretched to imply unsupported scope.
- Every sourced path carries the provider, URL, supported geography, published and retrieval dates where available, scope basis, assumptions, exclusions, confidence reason, review state, and an initial immutable range-history entry. Finding-level envelopes are explicitly non-additive and are not presented as project totals.
- Added a whole-report decision overview with major category counts, likely decision-changing facts, immediate tasks, and an explicit prohibition on summing overlapping or mutually exclusive ranges. The reviewer workbench now orders primary evidence, source report context, location, interpretation, paths and adjacent pricing sources, Known/Unknown, decision-changing information, next task/rationale, and review controls.
- Submission notes are retained as attributed human observations with authenticated identity, role, submission date, directness, professional status, verification status, and related evidence references. Buyer, seller, or owner emphasis is applied only when explicitly stated; it changes considerations, not underlying facts.
- Price corrections now target a named repair path and require low/high values, source reference, and source geography. The immutable review event preserves the correction; the released projection applies it without exposing reviewer events or internal review machinery.
- Environmental context now presents provider, observation window, provider location, retrieval date, and source link alongside the claim. Existing non-causation language and observation-date comparison remain unchanged.
- The released agent result now includes a whole-property overview and, for each released finding, report provenance, interpretation, reviewed paths and adjacent price sources, Known/Unknown, decision-changing facts, next task, and rationale. Draft findings and substantive reviewer machinery remain server-withheld.
- Local verification passes: `npm test` 78/78, `npm run build`, the Round 1 Python self-test, and `git diff --check`. Narrow-viewport browser inspection confirmed evidence-first ordering and no visible overlap. The build emits only the existing stale `caniuse-lite` advisory.
- Production deployment `1be2c459-1274-4c81-aa04-64bd620b122b` succeeded from commit `f4d4310`; `https://shelterprep.com/healthz` returned HTTP 200 from Railway. An initial production verification failed closed before artifact persistence because a sourced unit-price path had been represented as a finding-level non-blocked range without a quantity. The contract now keeps the unit price and source while correctly blocking the finding-level range until quantity is known; validation was not weakened and no partial artifact or finding rows were persisted by that failed attempt.
- Final non-fixture production request `b8be5c1e-be83-4788-bbd8-79600e0a4bb5` reused the existing private 131-page report evidence and completed with 31 atomic observations, 48 repair paths, 30 priced findings, 1 explicitly blocked finding, 37 repair-cost sources, 31 persisted finding rows, one attributed human observation, and no fixture marker. Its `needs_review` notification was recorded as sent exactly once.
- The timed 31-finding human review, substantive approvals or corrections, review-time metrics, released agent result, and post-approval exactly-once email remain intentionally unperformed. Those outcomes are blocked on the real human review and are not claimed complete.

## Round 1U Role-Based Dashboards And Operational Continuity

- Added server-authoritative role resolution through the authenticated profile boundary. Active owner/admin identities land on the Admin Dashboard; non-reviewers land on My Properties when they have submissions and otherwise begin at Add Property. Typed dashboard and review-queue routes redirect non-reviewers and the server endpoints independently enforce reviewer authorization.
- Added a mobile-first Admin Dashboard with Continue Where You Left Off, search, Needs Review, In Review, Waiting for Evidence, Ready / Released, Failed, Processing, and Recent Properties. New Property remains a secondary action. Queue records contain the Property, stored submitter identity, review counts, last activity, next action, release version, and delivery result.
- Reviewer continuity is durable. The protected pipeline row stores the last viewed observation, workflow state, next responsible role/action, and activity timestamp. Resume restores that finding when it still exists and otherwise selects the first unresolved finding.
- Completed the submitter handoff as Property -> Evidence -> Review Submission -> Submitted. Evidence is uploaded before the review step, the durable draft survives reload/back navigation, edits refresh the request input hash and primary evidence pointer, and processing begins only after final Submit to Shelter Prep.
- Review Submission defaults the result recipient to the authenticated submitter email and permits an authenticated pre-submit change. The final recipient and whether it was defaulted or changed are recorded in the server-owned submission row and submission workflow event. Reviewed-result delivery now uses this stored recipient while preserving the existing exactly-once outbox behavior.
- Added a lightweight My Properties history using only submitter-facing statuses: Submitted, Processing, Under Review, Needs Information, and Ready. It displays address, submission date, result recipient, release/delivery state when applicable, and one useful next action without exposing reviewer priority or parser state.
- Applied `20260919143539_phase1_operational_continuity.sql` only to production project `lbyzkvbtolpwrvjfbhlq`. It extends the existing protected UUID pipeline record; no duplicate Property or workflow model was added. RLS remains enabled, anon has no table privileges, authenticated retains SELECT without direct insert/update/delete, and the service boundary owns consequential writes.
- Railway production deployment `eaea8dfe-c8a9-4e59-8db6-5e2b418ba420` succeeded from commit `c1a7061`. `https://shelterprep.com/healthz` returned HTTP 200 from Railway. Production authentication resolved the pilot identity as active admin, the dashboard returned ten durable requests, and My Properties returned existing Under Review and Processing submissions.
- Production resume verification saved the first observation on an existing 31-finding request and then read the same position back through the dashboard with 0 reviewed and 31 remaining. No finding decision, release, email, or other substantive review state was changed. Unauthenticated identity, dashboard, and My Properties calls returned HTTP 401.
- Local verification passes: `npm test` 82/82, `npm run build`, the Round 1 Python self-test, and `git diff --check`. The build emits only the existing stale `caniuse-lite` advisory. Automated tests cover non-reviewer dashboard denial, review-mutation denial, recipient persistence, draft reload/edit behavior, and mobile layout constraints.
- Remaining live acceptance gap: the stored non-admin credential available in this checkout does not authenticate against production, so a fresh live non-admin typed-route check and a complete live non-admin submission were not repeated. The authenticated Chrome session reached the new `/dashboard` landing, but the Mac locked before final iPhone-width visual inspection; no visual claim beyond the automated mobile contract is made. The timed human review and post-approval delivery validation remain intentionally deferred to the real reviewer.

## Round 1V Reviewer Efficiency And Atomic Corrections

- Reworked the existing finding workbench into one continuous review surface with durable finding progress, Previous/Next navigation, Quick and Careful review modes, inline report-page controls, expandable repair paths, adjacent pricing provenance, and sticky review actions. The Property address returns to the same Property review overview; source drawers and report controls preserve the current request and finding context.
- Added inline correction controls for the supported canonical fields, repair-path labels, evidence relationship, and attributed reviewer field knowledge. Price adjustment is path-specific and records the reviewed range, confidence, geography, assumptions, exclusions, evidence state, supporting source IDs or explicit Reviewer / Professional Judgment, reviewer reason, reviewer identity, timestamp, original range/source set, and per-path version history.
- Added `20260919162309_phase1_atomic_finding_corrections.sql`. Its server-authoritative RPC locks the finding, checks the expected review event for stale edits, validates the correction whitelist and path/source membership, writes immutable previous/new changed-field values, updates the canonical reviewed value, persists workflow continuity, and creates the review/workflow events in one transaction. A failed canonical update cannot create a successful corrected review state.
- The frontend treats the RPC result as provisional until the request reload returns the exact new review event ID. A failed save stays on the current finding with `Changes were not saved`; a verified save advances directly to the next unresolved finding. Canonical reviewed values are overlaid server-side so a stale AI draft cannot replace a human correction after reload or in the released projection.
- Expanded deterministic price research with useful Angi and Fixr comparisons while preserving the existing source-quality ordering and compatible-scope/unit checks. Up to three independent sources are retained where defensible; overlapping sources synthesize an intersection and otherwise use a broader envelope. Missing quantity or scope still blocks a finding-level range rather than manufacturing precision.
- The current production 31-finding artifact has 48 repair paths. The deployed baseline contains 47 one-source paths and 1 blocked zero-source path. Running that same persisted artifact through the updated local decision-support layer produces 17 one-source paths, 25 two-source paths, 5 three-source paths, and the same 1 explicitly blocked path. No production finding or artifact was mutated for this measurement.
- Narrow-width verification at an exact 390 by 844 CSS viewport showed a 390-pixel document width with no horizontal overflow. The ordered evidence-first surface and finding navigation rendered at that width. Fixture mode intentionally hides live review mutation controls and contains no repair paths, so the live source drawer and database save were not claimed as production click-tested.
- Interaction design requires two primary controls for routine approval (`Approve & Next`, then save), two for a finding edit (`Edit finding`, then save), two for a price correction (`Adjust Price`, then save), and two for source inspection (open, then close). Successful saves advance without a page transition or menu; reviewer position is retained in the finding URL and protected pipeline continuity record.
- Applied `20260919162309_phase1_atomic_finding_corrections.sql` only to production project `lbyzkvbtolpwrvjfbhlq`. The production migration history contains five older remote migrations that are absent locally, so the reviewed migration was applied directly without rewriting migration history or replaying unrelated legacy files. Existing finding/review counts were unchanged by the migration. The function remains a private security-definer boundary with an empty search path; `PUBLIC` and `anon` have no execute access, `authenticated` may call the guarded wrapper, RLS remains enabled, and browser roles retain read-only table grants.
- Production rollback-only tests passed for atomic canonical edit plus review event, path-specific price-version persistence, stale-write rejection, a deliberately late failure rolling back both the finding and review event, and the outer verification rollback. Separate authorization checks confirmed anonymous and authenticated non-reviewer mutations are denied. The approved persistent verification used only request `49f28990-2999-4cb3-8e84-1d02bdac69e6` and observation `atomic-observation-3-2-1`: it corrected the title to `CRACKS - MINOR`, recorded immutable previous/new values, and created price version 1 while retaining the original sourced `$300-$750` range and source set.
- Commit `9cabe04ca0da2c9aa8df3a84704fd2f69db0f842` was pushed to `shelter-prep-phase1-dev`. Railway deployment `3e1da53f-11f4-4bd9-86c0-6a87951e1bdb` succeeded from that exact commit, the service instance is running, and `https://shelterprep.com/healthz` returns HTTP 200. The production review route and deep-link fallback return HTTP 200; unauthenticated processing-request access returns HTTP 401.
- Live reviewer verification confirmed durable navigation and source inspection. Previous/Next changes the finding URL, the protected pipeline record retains the last-viewed observation, Dashboard -> Continue Where You Left Off resumes that exact finding, and opening/closing a pricing-source drawer preserves finding context. A fresh browser load of the approved `49f` finding showed `CRACKS - MINOR`, 2 reviewed / 29 remaining, the reviewed `$300-$750` path, pricing source provenance, original range, and reviewed version 1.
- The separate request `b8be5c1e-be83-4788-bbd8-79600e0a4bb5` was undergoing a real human review during verification and was not mutated by the verifier. It now has 31 human decisions and appears in Ready / Released with delivery sent; its refreshed agent-facing result shows the reviewed findings. No timed-review duration, correction-quality metric, or reviewer-research metric is inferred from those database events.
- Verification passes: `npm test` 84/84, `npm run build`, the Round 1 Python self-test, and `git diff --check`. The build emits only the existing stale `caniuse-lite` advisory. Exact 390 by 844 local viewport coverage remains the mobile visual check; production desktop reviewer controls, navigation, source presentation, correction reload, and price-version reload were exercised live.
- Remaining acceptance gap: a complete production interaction pass on an actual iPhone-width browser was not repeated. The approved persistent correction was submitted through the authenticated production API and then verified through fresh production UI loads; the frontend click/advance contract remains covered by automated tests. No human decisions were automated.

## Round 1W Reviewer Compression And Explicit Release

- Compressed the default finding surface to the decision sequence: issue, inspector report and evidence, Shelter Prep interpretation, likely paths with adjacent price/source controls, the most important unknown, next task/rationale, and review actions. Location detail, full Known/Unknown lists, decision-changing facts, field knowledge, environmental provenance, source context, review routing, and recorded action remain available under `More Details`; the duplicate environmental panel was removed.
- Replaced the all-fields correction form with single-field editors for issue, interpretation, important unknowns, location, next task, rationale, likely trade, and attributed field knowledge. Each editor opens and saves independently while remaining on the finding. Price adjustment remains path-specific and preserves the existing atomic correction, provenance, and immutable range-history contract.
- Added compact structured review reasons for Interpretation, Price, Missing Evidence, Location, Scope, Source, and Other, with an optional note. Routine approval is one `Approve & Next` action and requires no prose.
- Review counts now derive from the current request's current review event action. Only approve, needs-more-information, and reject are terminal; an edit alone remains unresolved. The overview shows findings, reviewed, approved, needs info, rejected, and remaining, and resumes at the first unresolved finding.
- Added an explicit completion sequence: Remaining 0 -> Generate Reviewed Report -> recipient-equivalent Preview -> Release Report -> Send Reviewed Result. Preview is read-only and uses the same recipient-facing result component. Release no longer happens as a side effect of the final finding decision, and send is rejected unless a persisted `released_at` exists. Existing notification idempotency remains authoritative.
- The released projection retains approved, needs-more-information, and rejected dispositions. Repair paths appear only for approved findings; unresolved and rejected outcomes are labeled and cannot appear as approved recommendations. A fully terminal report may be released even when no finding is approved.
- Local verification passes: `npm test` 85/85, `npm run build`, the Round 1 Python self-test, and `git diff --check`. The build emits only the existing stale `caniuse-lite` advisory. Exact 390 by 844 local inspection found no horizontal overflow and confirmed the compressed decision content and progressive disclosure.
- Commit `5f2aad6` deployed successfully to Railway as deployment `680b0283-dfc1-4059-a1af-3379ba003038`; `https://shelterprep.com/healthz` returns HTTP 200 with notifications configured.
- Authenticated production inspection at 390 by 844 on request `49f28990-2999-4cb3-8e84-1d02bdac69e6` confirmed no horizontal overflow, visible issue/evidence/interpretation/unknown/next-task/action content, a usable pricing-source sheet, source-page access with finding context retained, Previous/Next navigation, field editor open/cancel, price editor open/cancel, and reachable sticky actions. No finding value or human decision was changed.
- Measured interaction design: routine approval is one decision tap; a field correction is two taps to edit/save and one additional tap to move next; a price correction is two taps to adjust/save and one additional tap to move next; source inspection is two taps to open/close. These interactions require no menu, inline editing and source inspection cause no page transition, and the production check recorded zero lost-context events, zero full-PDF opens, and zero external-research exits. Approval/save counts are design measurements only because substantive production judgment was intentionally not automated.
- Remaining acceptance boundary: the active `49f` request has 2 terminal decisions and 29 remaining, so a real reviewer must complete those decisions before the new production Generate/Preview/Release flow can be exercised end to end. Previously released request `b8be5c1e-be83-4788-bbd8-79600e0a4bb5` contains 9 edit-only findings created under the former terminal-state rule; the corrected preview and release endpoints now reject it with HTTP 409 instead of treating those edits as terminal. Its prior delivery remains recorded, and an idempotency check returned the existing sent result with `duplicate: true` and sent no second email. No historical review decision was rewritten.

## Round 1X Durable Reviewed Report PDF And Property History

- Added a server-owned `phase1_reviewed_reports` ledger with Property-scoped monotonic versions, the processing request, reviewer, recipient, canonical reviewed artifact, finding/review-event versions, pricing corrections, local-professional research provenance, PDF object identity and checksum, release state, and delivery state. Generated snapshots become immutable; subsequent corrections require a new version.
- Added the private `phase1-reviewed-reports` storage contract. Browser roles have no table or bucket access. Authenticated report retrieval is mediated by the server and returns a five-minute signed URL only after reviewer or released-report submitter authorization. The expiring URL is not stored as artifact identity.
- Report generation now requires every finding to have a terminal human decision, reserves a version transactionally, builds one canonical recipient document, generates a real ReportLab PDF, uploads the PDF, and persists the snapshot. A generation or storage failure cannot create a releasable report. Release and exactly-once email delivery operate on the durable report ID/version rather than a reconstructed request result.
- Added released-report history to My Properties and a durable `/properties/{property_id}/reports/{report_id}` result route. Reviewers may retrieve draft history; submitters receive only released or superseded versions tied to their own request. The web result and PDF consume the same canonical reviewed artifact.
- Added optional server-only Google Places research for up to two deduplicated local professionals per approved trade. Listings retain provider identity, rating/count when returned, retrieval time, Maps source link, and `Not verified by Shelter Prep`. Lookup failure or a missing `GOOGLE_PLACES_API_KEY` omits listings and does not block report generation. Licensing and endorsement are never inferred.
- Added five focused tests for terminal review/version identity, no-key omission, provider deduplication/capping, private/immutable migration contracts, and real PDF generation. `npm test` reaches 90 tests after this change; the focused report tests pass 5/5. The production build and `git diff --check` pass. The generated two-page QA PDF was parsed successfully and its first page was rendered and visually inspected with no overlap or clipping.
- Applied only `20260920184539_phase1_durable_reviewed_reports.sql` to production project `lbyzkvbtolpwrvjfbhlq` through its authenticated SQL editor; migration history was not rewritten and `supabase db push` was not used. Read-only verification confirmed the report table and RLS, no anon/authenticated table grants, service-role-only table/RPC access, all four browser-deny storage policies, a private 25 MiB PDF-only bucket, notification report columns, and an initially empty report ledger.
- Commit `87cc9a54b1818f7b9a7cb4a4dadafb9f43779584` deployed successfully from `shelter-prep-phase1-dev` as Railway deployment `85b49f40-991a-409b-80ff-df4d087d794f`. `https://shelterprep.com/healthz` returns HTTP 200 from Railway with notifications configured. Railway has no `GOOGLE_PLACES_API_KEY`; local-professional lookup is therefore omitted and nonblocking, and no browser-exposed key was added.
- A new synthetic, non-fixture production request `03681307-b885-407c-951f-7a54647c4536` on Property `0eb32e71-8ae6-422b-9f5e-930e8ca1b972` exercised the complete authenticated path without changing existing customer review history. It uploaded one private PDF, parsed two source-backed findings, recorded two terminal approvals, generated durable report `aabf74fd-c2c5-4f65-b386-bafba51c6abc` version 1, stored a 7,038-byte private PDF, survived refresh-equivalent retrieval and a new login, released the exact version, retained it in Property history after a second draft was created, and delivered the result once. A duplicate send returned the existing delivery with `duplicate: true` and sent no second email.
- The acceptance report is retrievable from Property history without a request ID; its web view and PDF are based on the same canonical reviewed document. The PDF access URL expires after five minutes. Anonymous report and PDF-access requests both returned HTTP 401. The initial synthetic parser probe failed before report generation because its test PDF lacked a parser-supported observation date; it left a linked failed test request/evidence record but no report artifact. The corrected parseable test then completed end to end.
- Authenticated production inspection at exactly 390 by 844 CSS pixels passed for Dashboard, report history, the durable report, and the released review route. Every page measured a 390-pixel document/body width with no horizontal overflow. Report history exposed `View` and `Download PDF`; the canonical report exposed `View PDF`; controls remained accessible and screenshots showed no overlap or clipping.

## Round 1Y Durable Report Release Runtime Repair

- Traced the live release path from `Phase1Experience` through `POST /api/phase1/processing-requests/{request_id}/reviewed-report/release`, `phase1ProcessingService`, `createPhase1SupabaseRepository`, and the private `phase1_release_reviewed_report` RPC. The production Supabase repository exposed only `releaseReviewedReportVersion`, while the service's omitted-report fallback called `releaseReviewedReport`; that factory mismatch caused `repository.releaseReviewedReport is not a function`.
- The production repository now exposes one canonical `releaseReviewedReport` method. It authorizes the reviewer, constrains report lookup to the processing request, accepts the generated report ID when supplied, resolves the latest draft for stale clients that omit it, and delegates the state transition to the existing server-only release RPC. The service no longer regenerates a preview or relies on mock-only release behavior.
- Added an integration test that instantiates the same Supabase repository factory used in production, routes both current and stale client payloads through the actual HTTP handler and service, verifies request/report scoping, and confirms both paths invoke `phase1_release_reviewed_report`. Property history now also exposes `Release Report` for an authorized durable draft, using that same endpoint.
- Review and report screens received only light visual refinement: subtle boxes and dividers separate Known, Unknown, decision-changing facts, next task, rationale, and pricing while preserving the existing mobile-first hierarchy.
- Commits `4527d77c2e3c1f9688568220d9211f8655ea2e53` and `b50e2eb604fc3f3dea4516db2c68c4a02c0bd394` deployed from `shelter-prep-phase1-dev`; Railway deployment `2aad45b3-0acb-460e-aaf1-e0adeed83722` reports `SUCCESS` for the latter commit.
- Production verification used only the already-human-reviewed synthetic smoke request `03681307-b885-407c-951f-7a54647c4536`. It generated draft report `1900d089-1c45-4107-bf2f-1a0cc36a6949` version 2, then clicked the actual `Release Report` control on `https://shelterprep.com`. The release request returned HTTP 200 and persisted version 2 as `released`; Property history contains it, protected PDF access returned HTTP 200 with `application/pdf`, and the earlier sent version remains preserved as `superseded`.
- No reviewed-result send was triggered during this repair. Version 2 remains `not_sent`, while version 1 retains its original sent delivery record; exactly-once delivery state was not duplicated. The production check at 390 by 844 CSS pixels found no horizontal overflow and showed the refined decision sections without overlap.
- Verification passes: `npm test` 92/92, `npm run build`, the Round 1 Python self-test, and `git diff --check`. The repository defines no lint script. The build emits only the existing stale `caniuse-lite` advisory.
