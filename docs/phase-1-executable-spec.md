# Shelter Prep Phase 1 Executable Spec

This file controls the current implementation gate for the active Shelter Prep repository.

## Authority Order

1. `docs/phase-1-executable-spec.md`
2. `docs/CURRENT-DEV-STATE.md`
3. `docs/master-plan.md`
4. Supporting architecture, schema, security, and historical docs only when present and relevant.

If documents conflict, this executable spec controls implementation scope.

`docs/CURRENT-DEV-STATE.md` records verified implementation state. It is not desired future architecture.

`docs/master-plan.md` records product doctrine and strategy. It does not authorize features beyond the current executable gate.

## Execution Rules

- Run one executable gate per Codex pass.
- Stop and report after every gate.
- Do not implement all Phase 1 steps at once.
- Do not add Phase 2+ features.
- Do not add agents beyond the allowed Phase 1 shape.
- The app becomes reliable first, then intelligent.
- Do not process private fixtures unless the current user request explicitly authorizes it.
- Do not apply migrations unless the current gate and user request explicitly authorize safe database execution.
- Do not touch production.

## Current Verified Status

Historical completed gates from the source Phase 1 spec:

- Step 1 Job Zero: complete at commit `bc9230e`.
- Step 2 Build Pass: complete at commit `bc9230e`.

Step 3, Supabase Tables migration files only:

- Complete at the file/static-contract level in the active repo.
- Migration file exists at `supabase/migrations/20260829041051_phase1_inspection_intelligence_schema.sql`.
- Static contract checks, existing npm tests, and application build/typecheck have passed for the migration-file work.
- The migration has not been applied to a database.
- Database behavior, RLS behavior, RPC behavior, rollback behavior, and Supabase runtime behavior remain unproven.
- No real inspection PDF extraction, image extraction, review workflow, or agent-facing output has been proven.

Step 4, Inspection Intelligence Vertical Slice:

- Complete for the local/executable roof-only proof.
- The private fixture at `local-fixtures/1837-sw-jo-ct-inspection.pdf` was opened and processed after explicit Step 4 authorization.
- Local output exists under ignored `local-fixtures/step4-roof-vertical-slice/`.
- The local adapter extracted 52 pages of text, one Roof Issues written finding, 66 item 1.x roof photo captions, 66 linked embedded roof images, 67 evidence records, and one Roof System bundle.
- Caption evidence, extracted image references, and Shelter Prep interpretation were kept as separate fields.
- Semantic visual analysis of image pixels was not implemented.
- Human review and agent-facing output were simulated locally only.
- Database execution remained BLOCKED because no explicitly verified non-production Supabase database was available.
- No migration was run or applied.
- No production system was touched.

Step 5, Roof Visual Evidence Interpretation:

- Complete for the local/executable roof-only proof.
- Local output exists under ignored `local-fixtures/step5-roof-visual-interpretation/`.
- Actual extracted roof JPEG pixels were inspected through caption-free contact sheets generated from the 66 Step 4 roof images.
- The Step 5 artifact persisted 66 roof visual evidence records, each with inspector statement, independent visual observation, Shelter Prep interpretation, unknowns, agreement status, human review status, processing status, and provenance.
- Agreement status distribution from the local Step 5 artifact: `supports_caption: 26`, `partially_supports_caption: 36`, `unclear: 4`, `apparent_discrepancy: 0`.
- The local Step 5 review queue contains 40 partial or unclear items.
- The local Roof System bundle snapshot references written inspector evidence, inspector photo captions, and independent visual observations without overwriting source evidence.
- Human review remains required; no Step 5 artifact is `human_verified`.
- The exact underlying model version for Codex local image inspection was not exposed by the runtime and is recorded as `runtime_model_version_not_exposed`.
- Database execution remained BLOCKED because no explicitly verified non-production Supabase database was available.
- No migration was run or applied.
- No production system was touched.

Current gate:

`ROUND 1 - LOCAL INSPECTION REASONING BENCHMARK`

This gate is authorized as a local/private Phase 1 benchmark only. It must build a reusable inspection reasoning layer on top of the existing shared evidence cache for the canonical private fixture:

`local-fixtures/1837-sw-jo-ct-inspection.pdf`

It must not rescan the PDF when the shared evidence cache is present and the source hash is unchanged.

It must not hard-code benchmark answers, expected findings, expected overlap groups, or Jo Court-specific reasoning. Jo Court is only the acceptance benchmark.

Do not touch production. Do not apply migrations. Do not wire this into Supabase runtime or Railway. Phase 1 source ingestion and the narrow local UI slice described below are authorized, but final estimating, contractor routing, final scopes, marketplace logic, continuous monitoring, and reusable verified memory remain outside this gate.

## ROUND 1 - LOCAL INSPECTION REASONING BENCHMARK

Purpose:

Prove a reusable local reasoning framework that turns cached inspection evidence into human-reviewable Property + Inspection understanding:

```text
property/report reconstruction
-> inspection coverage/limitations
-> atomic observations
-> epistemic separation
-> system/component/condition organization
-> cautious interpretation
-> potential overlap/relationship candidates
-> Known / Unknown
-> smallest useful next evidence
-> human review packet
```

## Round 1 Source Boundary

Round 1 must consume the shared inspection evidence cache when valid:

`local-fixtures/shared-inspection-evidence-cache/1837-sw-jo-ct/inspection-evidence-cache.json`

Allowed:

- compute the source file hash to verify cache validity
- reuse page text, section index, normalized findings, photo captions, image manifest, image hashes, and relationship indexes from the shared cache
- reuse cached visual observations by image hash when compatible
- produce a local private reasoning artifact under ignored `local-fixtures/`
- add sanitized synthetic tests that do not include client-identifying fixture content
- define and test the Phase 1 localized repair-cost range contract
- accept explicitly supplied, provenance-bearing price sources without fetching or fabricating live prices
- produce UI-ready finding-card fields when a valid sourced range is available
- ingest explicitly supplied contractor, completed-job, supplier, labor, benchmark, regional, or national-fallback pricing evidence
- retrieve historical weather on demand through a configured provider only when a finding is environmentally relevant
- produce deterministic fixture-backed source-integration and persistence-contract tests
- prepare local persistence envelopes and Supabase payload mappings without applying a migration or writing to a database

Not allowed:

- rescan page text or embedded images when the cache hash matches
- infer visual observations from captions, filenames, or item numbers
- overwrite source evidence
- convert potential overlap into confirmed causation without source support
- treat extraction completeness as inspection coverage
- mark any output `human_verified`
- send private evidence to production, Railway, or Supabase
- fabricate price ranges when no supportable source is supplied
- use an unconfigured price provider, fabricate a live-price retrieval, or present a benchmark range as a contractor bid
- run continuous weather or pricing research, monitoring, polling, or background jobs

## Round 1G Live Source Integration Boundary

Round 1G may normalize provenance-bearing pricing inputs and retrieve historical weather for a specific finding, property location, observation timestamp, and bounded historical window.

Pricing ingestion must preserve source identity, source class, raw reference, retrieval/publication time, property geography, source geography, geographic match level, repair category, trade, supplied values and basis, scope inclusions/exclusions, limitations, field conditions, and review status. Point-value contractor quotes remain separate from Shelter Prep ranges.

Historical weather retrieval must be request-driven rather than continuous. Provider requests must use the source observation timestamp rather than upload time. Every normalized weather record and claim must retain provider, source reference, location used, observation period, retrieval time, measurements and units, linked finding/evidence, and review status. Weather correlation may contextualize a hypothesis but may not establish causation.

When provider credentials or network access are unavailable, the provider interface, deterministic fixture provider, validation, source-to-claim linkage, persistence envelope, and frontend data contract may be proven locally. Live-provider execution must remain `BLOCKED`, not simulated.

No retrieved source becomes verified memory automatically. External source retrieval, AI interpretation, human review, and verified operational knowledge remain distinct states.

## Phase 1 Localized Repair-Cost Range Contract

Every material finding should show a localized repair-cost range once a supportable price source is available. Missing sourced pricing is an explicit blocked state; it must never be filled with an invented range merely to satisfy the UI contract.

Range behavior:

- sparse evidence may support a wide range
- evidence that reduces scope uncertainty may tighten the range
- evidence that adds plausible scope, access difficulty, structural involvement, equipment, permits, hidden-condition risk, or trade dependencies may widen the range
- new evidence does not automatically tighten a range
- every range remains an AI draft until an authorized human review action changes its status
- a Shelter Prep range and a contractor quote are separate objects

Every range must preserve:

- `price_low`
- `price_high`
- `price_stage`
- `price_geography`
- `price_source_refs`
- `price_range_explanation`
- assumptions
- unresolved unknowns
- author/reviewer
- timestamp
- review status

Every range revision must preserve:

- prior low and high values
- new low and high values
- evidence causing the change
- assumptions
- unresolved unknowns
- source references
- geography
- author/reviewer
- timestamp
- review status
- whether the range was initial, tightened, widened, or otherwise revised

Prior revisions are immutable history. Do not silently overwrite a prior range.

Allowed price-source classes:

- contractor quote or contractor input
- human-verified Shelter Prep completed job
- local supplier or material price
- manufacturer price
- government or public labor data
- permit or valuation data
- reputable local benchmark
- regional benchmark
- national fallback

Price-source geography must use the most defensible available level:

1. exact ZIP
2. neighborhood or local market
3. city
4. metro
5. county
6. state
7. regional
8. national fallback

Never claim greater precision than the source supports. Preserve property geography, source geography, geographic match quality, source type, and retrieval or publication date when available. A metro source must never be relabeled as ZIP-specific.

No source, no price claim. Unsupported single-point prices, unsourced ranges, false geographic precision, silent averaging of conflicting sources, and silent replacement of range history are prohibited. Credible source disagreement must remain visible with an explanation of likely scope, geography, or inclusion differences.

Supported pricing statuses are `ai_draft`, `needs_human_review`, `human_verified`, `contractor_informed`, `contractor_verified`, and `rejected`. AI or browser-authored paths may not set `human_verified` or `contractor_verified`.

Live price retrieval requires a configured, defensible provider and must remain blocked when none is available. Explicit pricing-evidence ingestion is authorized.

## Round 1H Guided Inspection UX Boundary

Round 1H may expose one local, mobile-first vertical slice of the existing Phase 1 reasoning contract through this guided sequence:

```text
Property
-> Add Evidence
-> Processing
-> Review Findings
-> Close Gaps
-> Next Steps
```

The default experience must use progressive reveal, one obvious primary action per view, and a deterministic development fixture that is visibly identified as fixture data. It may demonstrate a moisture finding with evidence, Known/Unknown separation, relevant weather context, missing information, next step and rationale, localized price context, range history, source provenance, contractor input, and Needs Human Review status.

The UI must not claim durable persistence, live pricing, live weather, or completed verification unless those paths are actually executed and proven. Consequential review controls remain read-only while server authority is unverified. Existing backend and admin code must be preserved, and may remain available through a non-advertised development-only switch while the guided flow becomes the default local experience.

Round 1H does not authorize new migrations, production writes, autonomous repair decisions, contractor routing, a marketplace, homeowner features, monitoring, predictive maintenance, or expansion beyond this single Phase 1 vertical slice.

## Round 1I Dynamic Reasoning-to-UX Boundary

Round 1I may replace the hard-coded Round 1H finding presentation with a frontend adapter that consumes the existing Round 1 reasoning artifact and Round 1G source-integration bundle contracts. The adapter may normalize those contracts into UI view models, but it must not recreate or change reasoning, pricing, provenance, review, or relationship rules in React.

Normal mode must obtain structured reasoning output from an explicitly configured application boundary. It must never silently substitute deterministic fixture findings. Fixture-backed output is permitted only in explicit development/test mode, must remain visibly labeled, and must be rejected when supplied to normal mode.

The UI must derive finding counts, categories, titles, review states, pricing states, geography labels, weather relevance, contractor input, source links, and range history from returned structured data. Null or blocked contract states remain visible and must not be filled with invented values. Environmental context is omitted when irrelevant and may show a quiet unavailable state only when the artifact marks it relevant but no sourced result is available.

The processing view may report only request states the application actually knows: waiting for structured output, output received, mapping complete, failure, or ready. It may not simulate granular backend work or percentage progress when the backend exposes none.

Round 1I may reuse the existing local evidence-selection state while durable upload and processing authority remain unverified. It does not authorize a second upload system, production persistence, new migrations, verification authority, new product modules, new pricing providers, monitoring, predictive maintenance, marketplace behavior, or autonomous dispatch.

## Phase 1 Finding-Card Contract

The reasoning artifact must expose, or explicitly mark blocked when sourced pricing is absent:

- finding title
- `price_low`
- `price_high`
- `price_stage`
- `price_geography`
- `price_source_refs`
- `price_range_explanation`
- `range_history`
- what we know
- what we do not know
- relevant context
- recommended next step
- next-step owner
- why the next step is appropriate
- review status
- evidence references
- source references

## Round 1 Reasoning Contract

For each atomic source observation, preserve:

- source page
- source section
- source item number
- inspector statement
- inspector recommendation
- inspector locations when present
- linked captions/images when present
- provenance
- extraction status

For each reasoning record, keep separate:

- source observation
- source-stated cause when present
- source recommendation
- Shelter Prep interpretation
- AI inference/hypothesis
- unknowns/limitations
- human correction state

System organization must include:

- building system/domain
- component when determinable from source text
- condition category
- mechanism/pathway only when evidence supports it
- technical attention category
- review status

Relationship candidates must remain hypotheses unless source evidence explicitly establishes the relationship. They may be based on shared system, shared location, shared mechanism keywords, dependency, or consequence pathway, but must include a `confirmation_status` that remains unconfirmed until reviewed.

## Round 1 Acceptance Criteria

Round 1 may be reported as PROVEN only where the artifact actually demonstrates:

1. Shared evidence cache reused with zero PDF page rescan when the source hash is unchanged.
2. Property/report reconstruction is derived from source evidence.
3. Inspection coverage/limitations are separate from extraction completeness.
4. Atomic source observations are preserved and not prematurely merged.
5. Inspector statements and Shelter Prep interpretation remain distinct.
6. Known/Unknown separation is explicit.
7. Potential overlaps are represented as unconfirmed candidates unless directly supported.
8. Provenance remains attached to observations, evidence links, bundles, and review packet entries.
9. Human review remains required.
10. Pricing-contract support preserves source provenance, geography, range history, source disagreement, contractor-quote separation, and human-review authority without fetching or fabricating live prices.
11. No final estimating, contractor routing, final scope, marketplace, production, Railway, Supabase runtime, migration, or reusable memory behavior is added.
12. Tests cover provenance, epistemic separation, incomplete extraction handling, Known/Unknown separation, unconfirmed overlap hypotheses, no benchmark-specific hard-coding, range presence for material priced findings, tightening, widening, history preservation, geography precision, source disagreement, contractor-quote separation, unsourced-range rejection, and review authority.
13. `npm test` passes.
14. `npm run build` passes when application code changes or when the user asks for build verification.

If semantic confidence depends on human review, report it as PARTIAL rather than treating test success as semantic success.

## Round 1 Final Report Format

When Round 1 is complete or blocked, report:

1. Files changed
2. Reasoning artifact structure
3. Jo Court benchmark output
4. Tests and results
5. Weaknesses/failures observed
6. What required human correction

Clearly label claims as PROVEN, PARTIAL, BLOCKED, or NOT IMPLEMENTED.

## STEP 4 - INSPECTION INTELLIGENCE VERTICAL SLICE

Purpose:

Prove one narrow real-file workflow:

```text
Real Hawkeye inspection PDF
-> document extraction
-> actual image extraction attempt
-> roof findings/evidence
-> one Roof System bundle
-> Known / Unknown
-> human review
-> reviewed agent-facing output
```

Step 4 must remain roof-only initially.

Do not authorize or process all inspection systems yet.

## Step 4 Database Boundary

Step 4 may include safe database verification only in an explicitly verified non-production environment.

Production must remain untouched.

Before applying any migration:

1. Identify the Supabase/database target.
2. Verify that it is non-production.
3. Report the verification basis.
4. Stop if the environment is ambiguous.

If a safe database environment exists:

- apply the existing migration there only
- verify all new tables exist
- verify foreign keys and constraints
- verify required RLS is enabled
- verify browser/public roles cannot directly mark findings `human_verified`
- verify browser/public roles cannot create immutable review events outside authorized paths
- verify browser/public roles cannot commit memory
- verify server-authoritative review transitions
- verify duplicate model-run protections
- verify no-source/no-claim provenance constraints
- verify rollback assumptions where practical

If no safe database environment exists:

- database execution remains BLOCKED
- do not apply anything to production
- continue only with Step 4 portions that can be proven without database application
- label database persistence and Supabase runtime behavior as BLOCKED or NOT PROVEN
- do not fake database success

## Step 4 Local/Executable Boundary

When explicitly asked to begin Step 4, it may build the smallest server-side or executable adapter needed for the roof-only proof.

Allowed without database application:

- local PDF opening/extraction checks against the private fixture
- local document metadata extraction
- local written roof-finding extraction
- local embedded-image extraction attempt with honest success/failure status
- local evidence-linking data structures
- local Roof System bundle generation
- local human-review transition simulation or tests, clearly labeled as non-database
- sanitized derived test fixtures with no sensitive identifying information
- tests that distinguish real-file, sanitized-fixture, and synthetic coverage

Not allowed without safe database verification:

- claiming persisted database behavior
- claiming RLS behavior
- claiming RPC/server-authoritative database transitions
- claiming Supabase runtime behavior

## Step 4 Real Fixture

Private fixture path:

`local-fixtures/1837-sw-jo-ct-inspection.pdf`

Known verified fixture facts:

- real inspection PDF
- 52 pages
- readable
- gitignored
- private

The fixture must never be committed.

Do not copy client-identifying source material into committed tests.

Sanitized derived fixtures may be committed only when they contain no sensitive identifying information.

## Step 4 Roof-Only Acceptance

Step 4 passes only if the report can truthfully label each item as PROVEN, PARTIAL, BLOCKED, or NOT IMPLEMENTED:

1. Safe non-production database verification completed, or explicitly documented as blocked.
2. Real Hawkeye PDF opened and processed after explicit Step 4 authorization.
3. Property address extracted as `1837 SW Jo Ct, Milwaukie, OR 97267`.
4. Inspection metadata extracted.
5. Roof narrative finding extracted.
6. Roof Item 1.x photo relationships extracted where present.
7. Actual image extraction attempted and result recorded honestly.
8. Photo caption is not treated as visual analysis.
9. Inspector statement, visual observation, and Shelter Prep interpretation remain distinct.
10. One Roof System bundle produced.
11. Known and Unknown states remain separate.
12. Hidden roof damage is not invented.
13. Human review transition is proven through server authority, or labeled as blocked without a safe database.
14. Immutable review/workflow provenance is proven, or labeled as blocked without a safe database.
15. One reviewed agent-facing Roof System output is produced only after a review step.
16. Every substantive claim traces to evidence.
17. Tests pass.
18. Build passes when application code is changed.

## Do Not Build In Step 4

Do not implement:

- every inspection bundle
- all inspection systems
- pricing engine
- estimator
- contractor marketplace
- routing automation
- seller report system
- predictive maintenance
- homeowner features
- generalized multi-agent orchestration
- autonomous source research
- memory commitment
- UI redesign unrelated to the roof-only slice

The objective is proof, not breadth.

## Step 4 Final Report Format

When Step 4 is complete, report verified facts under:

1. Files changed
2. Migration/database verification
3. Real PDF processing result
4. Images actually extracted
5. Findings actually extracted
6. Roof bundle result
7. Provenance result
8. Human review result
9. Agent-facing output result
10. Tests/build
11. Blockers
12. What remains unimplemented

Clearly label each result:

- PROVEN
- PARTIAL
- BLOCKED
- NOT IMPLEMENTED

Do not infer completion from code presence.

Do not claim real-file, real-image, model, database, or Supabase behavior unless it actually executed successfully.

## STEP 5 - ROOF VISUAL EVIDENCE INTERPRETATION

Purpose:

Add semantic visual interpretation to the 66 real roof JPEGs already extracted from the private Step 4 fixture output:

`local-fixtures/step4-roof-vertical-slice/extracted-images/`

This remains a local/private Phase 1 benchmark gate.

Do not touch production.

Do not expand beyond the Roof System.

This historical Step 5 visual gate did not implement pricing. Current Round 1 pricing-contract authority is defined above and does not retroactively change Step 5 results.

Do not process other inspection systems.

## Step 5 Vision Boundary

Step 5 may claim visual understanding only if actual extracted JPEG pixels are passed to a vision-capable model or service.

The visual model must analyze the image independently. It must not treat the inspector caption as visual evidence.

Caption text may be supplied only as a separate comparison field after or alongside independent image analysis, and outputs must keep caption-derived statements separate from pixel-derived observations.

If no vision-capable model or service is available in the current environment:

- STOP the visual-analysis portion as BLOCKED
- do not simulate visual observations from captions
- do not fabricate agreement statuses from captions alone
- do not update the Roof System bundle as if visual evidence had been analyzed
- report the blocker clearly

## Step 5 Required Per-Image States

For each of the 66 extracted roof images, preserve:

1. Inspector statement/caption
2. Visual observation from image pixels
3. Shelter Prep operational interpretation
4. Unknowns / limitations
5. Agreement status between visual observation and inspector statement
6. Human review status

Allowed agreement statuses:

- `supports_caption`
- `partially_supports_caption`
- `unclear`
- `apparent_discrepancy`

Every image must receive an explicit processing status, even when analysis fails or is blocked.

## Step 5 Provenance Requirements

For each visual interpretation retain:

- source PDF
- source PDF page
- item number
- inspector caption
- extracted image path
- extracted image hash
- model name
- model run id
- prompt/version identifier
- processing status
- created timestamp
- human review status

Do not overwrite source evidence from Step 4. Add visual interpretation as a separate derived layer that points back to the written finding, caption evidence, and extracted image.

## Step 5 Claim Restrictions

Visual observations may describe only what is visibly supported by the image pixels.

Shelter Prep interpretation may cautiously say an image appears consistent with a reported defect when the visual observation supports that conclusion.

Unknowns must remain unknown unless visible in the image.

Do not generate unsupported claims such as:

- structural failure
- concealed rot
- exact decking damage
- code violation
- final repair scope
- final cost

Concealed decking, framing, moisture intrusion, repair quantities, final scope, and final pricing remain unknown unless directly visible and still require human review.

## Step 5 Roof Bundle Update

After successful pixel-level analysis, update the local Roof System bundle using both:

- written inspector evidence
- independent visual observations

The bundle must reference visual evidence without merging or replacing original source evidence.

The bundle must keep:

- known written facts
- visual observations
- Shelter Prep interpretation
- unknowns
- limitations
- source evidence references
- visual interpretation references
- human review status

## Step 5 Discrepancy / Review Queue

Generate a local discrepancy/review queue for images where:

- visual evidence is unclear
- visual observation only partially supports the caption
- apparent discrepancy exists
- image analysis failed
- image quality, angle, crop, or visibility limits confidence

Human review remains required before any output becomes verified or externally usable.

## Step 5 Acceptance Criteria

Step 5 may be reported as PROVEN only if:

1. Actual JPEG pixels are passed to a vision-capable model or service.
2. Visual observations are persisted separately from captions.
3. All 66 roof images receive an explicit processing status.
4. Caption and visual observation are never merged into one source field.
5. Agreement status is generated.
6. Unknown conditions remain unknown.
7. The Roof System bundle references visual evidence.
8. Provenance remains intact.
9. Human review remains required.
10. Tests pass.
11. Build passes if application code changes.

If the environment cannot provide real pixel-level vision analysis, Step 5 visual interpretation is BLOCKED rather than PARTIAL or PROVEN.

## Step 5 Final Report Format

When Step 5 is complete or blocked, report:

1. Images attempted
2. Images successfully analyzed
3. Failures
4. Agreement-status distribution
5. Discrepancies/unclear cases
6. Example evidence records
7. Roof System bundle changes
8. Tests/build
9. Blockers

Clearly label each result:

- PROVEN
- PARTIAL
- BLOCKED
- NOT IMPLEMENTED

Do not claim visual understanding unless image pixels were actually analyzed.

## STEP 6 - MULTI-SYSTEM INSPECTION INTELLIGENCE

Purpose:

Generalize the proven roof evidence architecture across all major inspection systems present in the canonical private fixture:

`local-fixtures/1837-sw-jo-ct-inspection.pdf`

This remains a local/private Phase 1 benchmark gate.

Do not touch production.

Do not apply migrations.

This historical Step 6 multi-system gate did not implement pricing. Current Round 1 pricing-contract authority is defined above and does not retroactively change Step 6 results.

Do not create a swarm of independent autonomous agents.

Do not convert any output to `human_verified`.

## Step 6 Shared Evidence Pipeline

Step 6 must use a shared evidence pipeline:

```text
Document Reader
+
Visual Evidence Reader
-> Common Evidence Layer
-> Domain Specialist
-> Evidence Fusion
-> Repair Interpretation
-> Human Review
-> Reviewed Output
```

The document reader and visual evidence reader are common infrastructure.

Domain specialists are configurable reasoning profiles, not necessarily separate model processes.

Do not create a separate bespoke evidence architecture per trade.

## Step 6 Domain Specialist Profiles

Create domain specialist profiles only for systems actually present in the report.

Required candidate profiles for this fixture:

1. Roof System Specialist
2. Exterior Envelope / Siding / Trim Specialist
3. Moisture Intrusion Specialist
4. Attic / Ventilation / Insulation Specialist
5. HVAC Specialist
6. Fireplace / Chimney Specialist
7. Crawlspace / Drainage / Pest-Pathway Specialist
8. Electrical Specialist
9. Plumbing Specialist
10. Window / Door / Finish-Carpentry Specialist
11. Floor / Drywall / Interior-Finish Specialist
12. Smoke / CO / Garage-Door Safety Specialist
13. Dryer / Exhaust Ventilation Specialist
14. Site / Grading / Drainage Specialist
15. Deferred Maintenance / FYI Specialist

If source extraction shows that a required candidate profile has no report evidence, record it as `not_present_in_source` rather than fabricating findings.

## Step 6 Domain Profile Contract

Each domain specialist profile must define:

- `domain_name`
- `supported_report_sections`
- common locations
- likely trades
- allowed interpretations
- prohibited conclusions
- common unknowns
- common hidden-condition risks
- common verification questions
- bundling rules
- consequence/review rules

Allowed domain behavior:

- route extracted source findings to a domain
- group related source findings into operational bundles
- distinguish source evidence, visual evidence, fusion, and interpretation
- identify likely professional review
- surface specific missing information
- generate AI Draft / Needs Human Review output

Prohibited domain behavior:

- final code determination without official source and human review
- hidden wiring, pipe, framing, decking, mold, or rot diagnosis without evidence
- exact water-entry path without verification
- final repair scope
- final pricing or estimate total
- seller-ready or contractor-final language
- automatic memory commitment

## Step 6 Finding Evidence Contract

For every finding, preserve:

Source evidence:

- report page
- report section
- item number
- inspector statement
- inspector recommendation
- location when present
- linked photo ids
- source file id

Visual evidence:

- independent pixel-based observation
- image provenance
- processing status

Evidence fusion:

- `supports`
- `partially_supports`
- `unclear`
- `apparent_discrepancy`

Repair interpretation:

- building system
- operational meaning
- likely trade
- known facts
- unknowns
- hidden-condition risks
- sequencing/dependencies
- missing information
- next verification step

Human review:

- `needs_review` by default
- `approve`
- `edit/correct`
- `needs_more_info`
- `reject`

Never automatically set `human_verified`.

## Step 6 Canonical Fixture Coverage

Use the real inspection report to derive findings.

Do not hard-code expected outputs.

Expected major systems exist in the report, including:

- Roof Issues
- Moisture Damage
- Condensation/mold
- Exterior Issues
- Eave Issues
- HVAC Issues
- Chimney/Fireplace Issues
- Crawlspace Issues
- Electrical Issues
- Plumbing Issues
- Insulation Issues
- Window Issues
- Door Issues
- Floor Issues
- Countertop Issues
- Smoke/CO Alarm Issues
- Wall & Ceiling Facings
- Cabinetry Issues
- Garage Door Issues
- Ventilation/Exhaust Issues
- Site Issues
- Minor Repairs/Deferred Maintenance
- For Improved Safety
- FYI

Derive the actual normalized specialist routing from source evidence.

If extraction fails to find a listed section, record whether it was absent, unparseable, or skipped with reason.

## Step 6 Processing Rules

1. Do not re-run document extraction if existing Step 4 artifacts already contain valid source extraction for the needed text/image inputs.
2. Reuse the proven 66 roof image records from Step 5.
3. Extract and visually analyze non-roof photos only where this Step 6 gate requires it and a real vision-capable model/service is available.
4. Never use captions as visual observations.
5. Every image must have explicit processing status: `analyzed`, `failed`, `unsupported`, or `skipped_with_reason`.
6. Never silently drop evidence.
7. Do not convert multiple weak signals into a verified fact.
8. Corroboration increases evidence support only.
9. Human verification remains the authority boundary.
10. Keep private fixture input and local benchmark output under ignored `local-fixtures/`.

If no vision-capable model or service is available for non-roof photos:

- mark non-roof visual analysis as BLOCKED
- do not simulate visual observations from captions, filenames, item numbers, or report text
- continue only with source-text routing and bundle scaffolding when it can be proven without fake visual evidence

## Step 6 Bundling Rules

Group findings into operational bundles rather than isolated jobs.

Likely bundle families for this fixture include:

- Roof System
- Exterior Envelope / Rot
- Family-Room Window Moisture
- Primary-Bath Moisture
- Attic Moisture / Ventilation / Insulation
- HVAC
- Fireplace / Chimney
- Crawlspace / Drainage / Pest Pathway
- Electrical Safety
- Plumbing / Bathroom Fixtures
- Doors / Windows / Finish Carpentry
- Floors / Drywall / Interior Finishes
- Life Safety
- Dryer / Exhaust
- Site Drainage / Exterior Maintenance
- Deferred / FYI

These are behavioral expectations, not hard-coded output.

Bundles must preserve:

- source findings
- photo evidence
- visual observations where proven
- corroboration status
- known facts
- unknowns
- likely trade
- verification questions
- next action
- review status

## Step 6 Review Queue

Generate human review queues based on consequence and uncertainty.

High-priority review examples:

- moisture
- safety
- electrical
- roof
- structural implications
- hidden damage
- contractor-facing scope
- anything with apparent discrepancy
- anything unclear

Lower-consequence cosmetic/FYI items may still require review but should not dominate the queue.

## Step 6 Output

Produce one local inspection intelligence artifact containing:

- property summary
- domain profiles used
- source findings
- image evidence records
- system bundles
- review queue
- agent-facing draft
- acceptance status

For each bundle include:

- source findings
- photo evidence
- visual observations
- corroboration status
- known facts
- unknowns
- likely trade
- verification questions
- next action
- review status

The agent-facing draft must remain clearly marked:

`AI Draft / Needs Human Review`

Do not make it seller-ready or contractor-final until human approval exists.

## Step 6 Acceptance Criteria

Step 6 may be reported as PROVEN only if:

1. All major report findings are extracted and routed to a domain.
2. Every finding retains source provenance.
3. Linked photos retain provenance.
4. Independent visual observations remain separate from captions.
5. Domain specialists use the shared evidence contract.
6. No duplicate bespoke evidence architecture is created per trade.
7. Findings are consolidated into operational bundles.
8. Known/Unknown separation is preserved.
9. Hidden damage is not asserted without evidence.
10. Missing-information questions are specific.
11. Likely trade/professional review is assigned where appropriate.
12. Human review remains required.
13. Review queue is generated.
14. Agent-facing draft is generated but not `human_verified`.
15. `npm test` passes.
16. `npm run build` passes.
17. Private fixture/output remains gitignored.
18. No production is touched.

If any major system cannot be extracted, routed, analyzed, bundled, or reviewed under these rules, report the exact portion as PARTIAL or BLOCKED.

## Do Not Build In Step 6

Do not implement:

- final pricing
- estimator automation
- contractor marketplace
- autonomous routing
- memory commitment
- predictive maintenance
- homeowner product
- final seller report
- generalized research agents
- code-compliance determinations
- unrelated UX redesign

## Step 6 Final Report Format

When Step 6 is complete or blocked, report:

1. Domains created
2. Findings routed per domain
3. Images analyzed per domain
4. Agreement distribution per domain
5. Review queue size
6. Bundles generated
7. Unknowns surfaced
8. Files changed
9. Tests/build
10. Blockers

Clearly label each result:

- PROVEN
- PARTIAL
- BLOCKED
- NOT IMPLEMENTED

Do not claim any domain behavior that did not execute.
