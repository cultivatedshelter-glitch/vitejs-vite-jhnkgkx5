# Shelter Prep Master Plan

Shelter Prep helps move a property from intake to field execution with clear evidence, human-reviewed estimates, and contractor-ready scope context. The product should stay property-centered, calm, and practical.

## Product Thesis: Property Work Organization

Shelter Prep starts with inspection and repair chaos because that is the sharpest first wedge for real estate agents.

Phase 1 remains focused on inspection repair clarity: helping real estate agents turn inspection findings, photos, notes, uploaded files, and contractor input into clear repair priorities, missing-information questions, role-specific outputs, and next actions.

Long term, Shelter Prep organizes property work more broadly. A property work request may begin as an inspection finding, seller-prep task, maintenance issue, remodel idea, addition, deck, garage, ADU, or other property project.

The same core structure should support all of them:

```text
Property
-> Work Request
-> Evidence / Notes / Files
-> Scope Items
-> Missing Information / Missing Decisions
-> Review Status
-> Role-Specific Output
-> Next Action
-> Outcome / Property Memory
```

Important mode distinction:

- Repair / Inspection Mode starts from a problem: "What is wrong, what matters, what needs verification, and what should happen next?"
- Remodel / Addition Mode starts from an intent: "What does the owner want to build, what decisions are missing, what constraints may matter, and what should happen next?"

Current positioning:

- Shelter Prep is not a contractor marketplace.
- Shelter Prep does not provide contractors.
- Shelter Prep does not replace contractors, inspectors, engineers, designers, agents, or permit authorities.
- Shelter Prep is a neutral coordination layer that organizes property work into clear next steps.

## Roadmap Doctrine

- Phase 1: Inspection Repair Clarity.
- Phase 2: Controlled Sharing + Contractor Scope Review.
- Phase 3: Remodel / Addition Planning Intake.
- Phase 4: Property Work Memory.

Phase 3 is roadmap only. Do not build remodel/addition UI, full remodel workflows, or new remodel-specific AI behavior during Phase 1.

## Operating Doctrines

These doctrines translate founder strategy into concrete product, app, and LLM behavior. They do not authorize new behavior by themselves; they guide future build choices.

### 1. Field Team Communication

Shelter Prep should communicate like a calm field lead, not a dashboard or chatbot.

Operational communication should reduce important work to:

```text
Finding / Move / Owner / Status
```

- Finding: what was observed or decided.
- Move: the next useful action.
- Owner: the person or role responsible.
- Status: draft, blocked, needs review, reviewed, done, or another explicit workflow state.

Future Operational Feed events should use this structure so users can scan the property like a field handoff.

### 2. Jam-Clearing Communication

Shelter Prep should clear jams instead of merely reporting problems.

Blocked states should explain:

- what is stuck
- why it matters
- who owns the next move
- what unblocks it
- what can continue meanwhile

The tone should be direct, calm, and practical. The app should not create panic, blame, or vague "blocked" labels without a next move.

### 3. Pink Panther / Clue-Based AI

AI should behave like an observant clue finder, not a final authority.

AI findings should organize uncertainty with:

```text
Known / Unknown / Clues / Next Evidence Needed / Review Status
```

- Known: evidence-backed facts.
- Unknown: what cannot be concluded yet.
- Clues: observations that may matter.
- Next Evidence Needed: photos, files, contractor input, inspection excerpts, or admin review needed to advance.
- Review Status: AI Draft, Needs Review, Human Reviewed, Contractor Reviewed, Seller Ready, Finalized, or an equivalent controlled state.

Final claims require evidence and review status.

### 4. Vlad / Asymmetric Focus

Shelter Prep should apply asymmetric focus to the highest-leverage constraint in the workflow.

The app should prefer one decisive next move over broad generic advice. When a property has many tasks, Shelter Prep should help identify the one jam, missing file, contractor input, owner decision, safety risk, or review action that most changes the outcome.

This doctrine protects users from scattered AI output and dense task noise.

### 5. Real-Life Intelligence

Shelter Prep starts from reality and uses AI to organize it.

Real properties, field evidence, uploaded files, photos, inspection excerpts, contractor judgment, corrections, timelines, pricing decisions, seller decisions, and completed outcomes are the source of truth.

Contractor corrections become memory candidates with provenance, not automatic truth. AI may draft field observations and organize corrections, but human review decides whether an observation becomes reusable memory.

### 6. AI Draft Estimating

Shelter Prep may draft industry-standard estimating assumptions for admins, but it must not become autonomous final estimating software.

Core rule:

```text
AI may draft pricing and material assumptions. Admin must review, edit, approve, or reject before anything becomes seller-ready, contractor-ready, or memory.
```

AI Draft Estimating may support:

- estimating a repair bundle
- generating material lists
- researching material costs
- drafting labor steps
- identifying missing information
- drafting contractor scope
- drafting seller summaries
- comparing a current bundle to reviewed pricing memory

Estimating output must include:

- `bundle_id`
- `trade_owner`
- `scope_summary`
- `labor_steps`
- `labor_hours_low`
- `labor_hours_likely`
- `labor_hours_high`
- `material_items`
- `material_cost_low`
- `material_cost_likely`
- `material_cost_high`
- `equipment_or_access_notes`
- `hidden_damage_risks`
- `missing_info`
- `pricing_sources`
- `confidence`
- `review_status`
- `admin_notes`

Material items must include:

- `material_name`
- `quantity_assumption`
- `unit_cost_low`
- `unit_cost_likely`
- `unit_cost_high`
- `source`
- `source_date`
- `confidence`
- `substitution_notes`

Rules:

- No final estimate without admin approval.
- No seller-ready pricing unless reviewed.
- No contractor-verified status unless contractor reviewed.
- No generic unsupported pricing claims.
- Pricing must show knowns, unknowns, assumptions, and missing evidence.
- If live source research is not implemented, material prices are placeholder/draft and need source verification.
- Contractor corrections become memory candidates, not automatic truth.

### 7. Material Cost Agent

The Material Cost Agent is a controlled draft function, not an autonomous buyer or pricing authority.

It may:

- draft material items and quantity assumptions
- identify likely product categories
- suggest low/likely/high placeholder material costs
- note source status and source dates
- compare to reviewed pricing memory when available

It may not:

- purchase materials
- lock pricing
- treat placeholder assumptions as verified supplier pricing
- promote one property outcome into universal memory
- expose material pricing as seller-ready without review

### 8. Labor Scope Agent

The Labor Scope Agent is a controlled draft function that turns bundles into reviewable labor assumptions.

It may:

- draft labor steps
- estimate low/likely/high labor-hour assumptions
- identify equipment, access, sequencing, and hidden-damage risks
- identify what contractor/admin input is needed before pricing can be trusted

It may not:

- finalize labor hours
- override contractor judgment
- mark contractor verified without contractor review
- create final estimate totals automatically

### 9. Admin Task Workbench

The admin side should behave like a property-specific LLM task console. Admins can type plain-language requests tied to a property, bundle, evidence set, or contractor upload.

Admin task types:

- `estimate_bundle`
- `generate_material_list`
- `research_material_costs`
- `draft_contractor_scope`
- `draft_seller_summary`
- `identify_missing_info`
- `compare_to_memory`
- `review_contractor_upload`
- `create_repair_vs_credit_options`

Admin task model:

- `id`
- `property_id`
- `bundle_id` optional
- `task_type`
- `admin_prompt`
- `input_evidence_ids`
- `status`
- `output_summary`
- `output_json`
- `review_status`
- `created_at`
- `reviewed_by` optional
- `approved_at` optional

Task results must appear as AI Draft / Needs Review until admin action. Admins may approve, edit, reject, or request more information. Approved estimates may later feed pricing memory, but approval does not automatically create memory or externally visible output.

## Workflow Gating Reference

The existing Workflow Gating Principle remains intact:

```text
Do not protect the sentence. Protect the system around the sentence.
```

Shelter Prep gates by workflow value. Free output identifies the shape of the problem. Paid, active, reviewed, contractor, and finalized workflows move the transaction forward through property context, evidence, review status, role-based views, decision history, controlled sharing, and final report generation.

The Operating Doctrines should strengthen Workflow Gating rather than duplicate it. Copied text should lose value outside Shelter Prep because it loses evidence, context, status, role permissions, and workflow movement.

## Operational Simplicity Principle

Shelter Prep should be as efficient as Larry Haun-style field execution: simple, sequenced, low-waste, and clear.

The app should feel like a well-organized jobsite, not a cluttered software dashboard. It should help users keep rhythm from intake to execution without forcing them to sort through unnecessary choices.

Core rules:

- Reduce wasted motion.
- Reduce unnecessary decisions.
- Preserve workflow rhythm.
- Stage information clearly.
- Reveal the next action naturally.
- Minimize cognitive load.
- Keep users moving from intake to execution.
- Provide one obvious next action per screen.
- Keep complexity underneath the system, not on the surface.

This principle limits how new work should be added. Do not add flashy modules, roadmap expansion, or dashboard clutter when a simpler sequenced workflow would solve the problem.

## Design Philosophy: Rams-Inspired Operational Minimalism

Shelter Prep should feel useful, quiet, durable, and obvious. It should not feel flashy, decorative, trendy, or over-designed.

Design principles:

- Good design is useful.
- Good design is understandable.
- Good design is unobtrusive.
- Good design is honest.
- Good design is thorough down to the last detail.
- Good design is as little design as possible.

Application to Shelter Prep:

- Prioritize function over decoration.
- Prioritize clarity over visual excitement.
- Reduce visual noise.
- Use restrained spacing, typography, and color.
- Use restrained layouts, calm spacing, and functional hierarchy.
- Make system status obvious.
- Avoid decorative UI unless it improves comprehension.
- Avoid gradients, flashy cards, excessive shadows, and decorative motion.
- Every screen should answer: what is this, what matters, and what should I do next?
- Operational memory should feel trustworthy and inspectable, not magical.
- AI outputs should be clearly labeled by status: AI Draft, Needs Review, Human Verified, Deprecated, Rejected.
- Field lessons should read like durable records, not marketing content.
- Use quiet typography, neutral surfaces, strong alignment, and minimal color.
- Make the app feel like a serious field tool for property operations.

## Product Direction

- Treat the property as the center of the workflow.
- Keep media, scope, missing information, materials, estimates, assignment, and history in consumable layers.
- Prefer progressive reveal over dense dashboards or heavy tabs.
- Keep AI outputs draft-only until a human reviews or verifies them.
- Use uploaded files and approved data sources only.
- Make persistence dependable before adding new capabilities.

## Inspection Intelligence

Shelter Prep must interpret inspection reports proficiently, not merely summarize them. Inspection reports should become operational seller-prep intelligence tied to a Property.

Core workflow:

1. Upload inspection PDF.
2. Extract findings.
3. Review repair bundles.
4. Generate seller prep report.

Inspection Intelligence should extract and normalize report-level context, at minimum:

- Property address.
- Inspection date.
- Inspector and inspection company.

For each inspection finding, the system must create a reviewable task intelligence record with:

- Task title.
- Defect / concern.
- Building system.
- Risk level.
- Trade needed.
- Urgency.
- Missing information needed.
- Photo requests.
- Recommended next action.
- Human review status.

The most important product behavior is bundling. Findings must be grouped into operational repair bundles, not treated as isolated line items. Agents should reason through this chain for every meaningful defect:

```text
defect -> building system -> root risk -> hidden damage -> trade -> priority -> sequence -> estimate impact
```

The core operating rule is:

```text
inspection item -> risk -> trade -> missing evidence -> next task
```

This means the system should recognize how several small findings combine into a larger operational risk, repair sequence, and contractor-ready scope.

Example bundles:

- Roof / water intrusion bundle: moss, exposed nail heads, damaged shingles, cracked roof vents, active roof leak, rotted fascia. Output: "Roof system aging with active water intrusion. Roofer evaluation required. Repair vs replacement economics should be reviewed."
- Exterior envelope / moisture bundle: cracked siding, CertainTeed siding concern, rotted trim, thin paint, missing flashing, cracked caulk, vegetation against siding, negative grading. Output: "Exterior moisture-management system risk. Coordinate siding, trim, paint, flashing, grading, and vegetation work."
- Plumbing risk bundle: leaking water heater connectors, black iron fittings, high water pressure, leaking fixtures, broken waste-line straps.
- Safety bundle: missing smoke detector, stair tread/riser inconsistency, active moisture or mold concern, and dryer vent or bird activity when it creates fire or moisture risk.

Example task intelligence:

- Finding: Fire sprinklers are painted over, obstructed, or sealed shut.
- Task title: Fire suppression sprinkler issue.
- Defect / concern: Sprinkler heads may be impaired by paint, sealant, obstruction, or visible tampering.
- Building system: Fire suppression / life safety.
- Risk level: Life safety / fire hazard.
- Trade needed: Fire suppression specialist / Fire Marshal.
- Urgency: Immediate review before occupancy, sale closeout, or any representation that the system is functional.
- Missing information needed: Sprinkler head count, affected locations, whether the system is active, recent inspection status, visible tags, and any fire panel status.
- Photo requests: Close-up photos of every sprinkler head, wide photos of the rooms and ceilings, better angled photos where obstruction or paint is unclear, count documentation, fire system inspection tags, and fire panel photos.
- Recommended next action: Request missing evidence, then route to a licensed fire suppression specialist or Fire Marshal for review before pricing or seller/buyer guidance.
- Human review status: AI Draft until a qualified human reviewer confirms evidence, trade route, and next action.

Inspection output should produce:

- Executive summary.
- Priority repair roadmap.
- Trade scopes.
- Repair bundles.
- Finding-level task intelligence records.
- Missing-evidence request list.
- Photo request list.
- Immediate safety and water-intrusion items.
- Deferred maintenance items.
- Budget-to-replace items.
- DIY/simple maintenance items.
- Contractor-ready scopes.
- Seller prep summary.
- Buyer credit candidates.
- Estimate confidence.
- Human review status.

AI rules:

- AI may classify, summarize, bundle, prioritize, and draft repair scopes.
- AI may not finalize pricing, approve repairs, or replace inspector or contractor judgment.
- All outputs remain AI Draft until reviewed.
- Shelter Prep may provide preliminary Estimate Ranges for planning, but formal Paid Contractor Bids require a Shelter Prep Approved Contractor or internal GC/admin review.

UX direction:

- Add Inspection Intelligence as an upload/analysis mode tied to a Property.
- Keep the workflow simple: Upload inspection PDF -> Extract findings -> Review bundles -> Generate seller prep report.
- Do not create dashboard clutter.
- Use progressive reveal in this order: Summary, Priority items, Repair bundles, Trade scopes, Missing info, Estimate Range draft, Seller report.

### Review Packet Size + Fast Human Review Doctrine

Goal: Shelter Prep must support fast, lightweight human review of inspection and report interpretations.

Core principle: Store everything. Show only what matters.

Operating phrase: Confirm fast. Research when needed. Never fake certainty.

Inspection reports, uploaded photos, videos, and source documents should be stored in full, but the reviewer-facing interpretation packet should remain lightweight, ideally under 250KB. The app should not dump raw reports into the reviewer workflow by default. Instead, Shelter Prep should compress raw evidence into a structured Review Packet containing only what is needed for fast human confirmation.

The Review Packet should include:

- Property summary.
- Report metadata.
- Executive summary.
- Grouped repair bundles.
- Safety / water intrusion flags.
- Missing information questions.
- Estimate confidence.
- AI confidence.
- Source references.
- Key page/image references.
- Recommended next action.
- Human review controls.

Full source files remain accessible only when deeper review is required.

Review speed model:

- Standard Review: target under 320 seconds.
- Deep Review: target up to 10 minutes.
- Extended Reliable Data Review: 1-2 business days when more evidence, source research, contractor input, or reliable data is required.

Review lane definitions:

1. standard_review.
   Used when inspection text/photos are clear and AI confidence is sufficient. Goal: reviewer confirms, edits, or flags quickly.

2. deep_review.
   Used when issues require deeper judgment but not a full delay. Examples include unclear roof issue, water intrusion concern, electrical/plumbing uncertainty, low estimate confidence, conflicting photos/report text, and repair-vs-credit judgment.

3. extended_review.
   Used when Shelter Prep should not produce a reliable recommendation yet. Examples include code/jurisdiction question, structural concern, mold/moisture concern, permit issue, specialty system question, pricing that requires contractor/supplier confirmation, source research required, or insufficient uploaded evidence.

Each report interpretation or repair item should support:

- review_lane: standard_review | deep_review | extended_review.
- target_review_time_seconds.
- review_status: ai_draft | needs_review | human_reviewed | human_verified | needs_more_info | extended_review | rejected.
- confidence: high | medium | low.
- reason_for_delay.
- next_action.
- reviewer_id.
- review_started_at.
- review_completed_at.
- agent_message.
- source_reference_ids.
- packet_size_bytes.

UX rules:

- Reviewer should see the lightweight review packet first.
- Do not show full PDF/page dump by default.
- Keep review UI mobile-first and fast.
- Use progressive reveal: Property -> Summary -> Repair Bundles -> Missing Info -> Estimate Confidence -> Sources -> Review Action.
- Full source document button should be available but secondary.
- If packet exceeds 250KB, show a warning in development/admin mode.
- Media should be referenced by thumbnails or links, not embedded full-size in the review packet.
- Source references should be short citations/page links, not long copied text.
- Extended review should clearly explain why more time is needed.

Customer-facing extended review message:

"This item requires additional verification before Shelter Prep can provide a reliable recommendation. We are gathering better source data, expert input, or additional evidence and will update the report."

Keep the product lean while adding this doctrine. Do not overbuild new features, add a heavy dashboard, create a full marketplace workflow, or remove existing functionality.

Success condition: A reviewer can open a property/report, view a lightweight interpretation packet, confirm or flag most normal reports in under 320 seconds, escalate complex cases to deep review, and mark uncertain cases for extended reliable data review.

## Shelter Prep Approved Contractors + Pricing Paths

Shelter Prep does not run an open bidding marketplace. It routes structured work to Shelter Prep Approved Contractors who review and confirm formal pricing. The product must not imply random contractor bidding, lowest-bid matching, open marketplace competition, or AI-generated final bids.

A Shelter Prep Approved Contractor is a contractor who has been reviewed by Shelter Prep and meets minimum requirements before receiving formal bid or execution opportunities:

- Licensed where required.
- Bonded where required.
- Insured.
- Identity and business verified.
- Service area confirmed.
- Trade and scope categories confirmed.
- Agrees to Shelter Prep workflow standards.
- Agrees to provide clear scope and pricing corrections.
- Agrees not to treat AI estimate ranges as final bids without review.

Pricing paths:

1. Estimate Range.
   - Preliminary planning range.
   - Generated from inspection, media, and scope data.
   - AI-assisted and human-reviewed.
   - Not a final bid.
   - Useful for seller prep, repair-vs-credit decisions, and budgeting.

2. Paid Contractor Bid.
   - Formal paid bid service.
   - Issued only after review by a Shelter Prep Approved Contractor or internal GC/admin reviewer when applicable.
   - May require walkthrough or additional media.
   - Includes assumptions, exclusions, scope limits, expiration date, and contractor/legal information.
   - Never issued automatically by AI.

Use UI language such as Estimate Range, Request Paid Contractor Bid, Shelter Prep Approved Contractor, Contractor Review Needed, Formal Proposal, GC Review, and Site Verification Needed.

Contractor approval statuses should support:

- pending_review.
- approved.
- suspended.
- rejected.
- expired_credentials.

Contractor credential fields should support:

- license_number.
- license_state.
- license_expiration.
- bonded_status.
- insurance_status.
- insurance_expiration.
- verified_at.
- verified_by.
- service_area.
- approved_trades.
- notes.

## Admin Research Confirmation Links

Shelter Prep must keep source confirmation available for admin review without turning consumer reports into research machinery. When a work group, finding, estimate assumption, material assumption, permit question, code question, safety issue, manufacturer issue, or contractor scope note needs verification, admins should see Research Confirmation Links.

Purpose:

- Help admins quickly verify the basis of an AI Draft before Human Verify.
- Preserve internal proof links even when they are not appropriate for consumer-facing reports.
- Keep consumer reports clean by showing only approved Helpful Resources.

Source confirmation fields:

- source_title.
- source_url.
- publisher.
- source_category.
- source_quality.
- relevance_note.
- admin_confirmation_status: not_reviewed, confirms, partially_supports, does_not_support, needs_more_research.
- report_visibility: internal_only, report_candidate, report_approved, report_hidden, rejected.
- consumer_summary.
- admin_notes.
- checked_at.
- checked_by.

Rules:

- Source Research tasks should return admin-facing confirmation links when sources are available.
- Admin confirmation links may be shown internally even if they are not approved for the consumer report.
- If no links are found, show: "No confirmation links found yet. Run additional research or add source manually."
- Admin can manually add a source link with title, publisher, relevance note, category, confirmation status, and report visibility.
- Consumer reports only show report_approved links under Helpful Resources.
- Internal-only, hidden, rejected, and unreviewed links never appear in consumer reports.
- Do not allow AI to Human Verify based only on general web sources. General web may support context, but official, manufacturer, supplier, jurisdiction, and internal verified sources are preferred.

Category preferences:

- Fire/life safety: fire marshal, fire district, city permit office, official safety resources.
- Electrical: city/county/state electrical permit resources, official code guidance where available, manufacturer installation manuals when relevant.
- Roofing/water intrusion: roofer verification, manufacturer/installation guidance, and building department permit guidance when applicable.
- Plumbing: permit office, licensed plumber verification, manufacturer guidance.
- Materials/parts: manufacturer, supplier, or product spec pages as reference only.
- Jurisdiction/code: official jurisdiction sources.

## Material Compatibility + Field Finish Memory

Shelter Prep should learn from real field outcomes when material compatibility, prep method, lighting, and finish behavior affect the job. This is not generic product advice. It is human-verified operational memory tied first to the property, room, substrate, product, photos, and observed result.

Shelter Prep should capture field-tested material compatibility lessons:

- Substrate.
- Prep method.
- Product used.
- Dilution ratio.
- Lighting condition.
- Application method.
- Observed issue.
- Successful correction.
- Outcome.
- Confidence.
- Human verification status.

These lessons must start as local field lessons. AI observation is never final truth. A single job may explain what happened in that property and room, but it must not become a universal recommendation until a human verifies the outcome and decides it is reusable.

Required statuses:

- AI Draft.
- Needs Review.
- Human Verified.
- Deprecated.
- Rejected.

Example field lesson:

- Property context: Interior remodel with new drywall and stairwell walls.
- Material: James Alexander Limewash Paint.
- Substrate: Clean new drywall.
- Prep method: Diluted limewash first coat used as bonding/base coat.
- Observed condition: Narrow stairwell/tunnel geometry with strong grazing light amplified drywall seams, patch transitions, and uneven absorption.
- Issue: Localized touchups increased contrast and made seams/patches more visible.
- Successful correction: Apply one broad, diluted unifying pass across full wall planes instead of spot-patching.
- Recommended mix: Limewash diluted approximately 15-25% with water for the unifying pass.
- Application method: Use large block brush or wide masonry brush. Work full wall planes, top-to-bottom. Use broad X movement, long feather arcs, and light pressure. Do not scrub or chase small patches.
- Design intent: Reduce contrast while preserving soft mineral movement. Do not flatten into standard beige drywall paint.
- Recommendation: For stairwells and narrow circulation spaces with grazing light, use softer movement and lower contrast than main living areas. Avoid isolated repairs. Use full-plane feather blending.
- Memory status: Needs human review until outcome is confirmed after drying.

Product requirements for future Material Compatibility Memory entries:

- property_id.
- room_or_area.
- substrate.
- product_name.
- product_type.
- prep_method.
- dilution_ratio.
- application_tool.
- application_pattern.
- lighting_condition.
- observed_issue.
- correction_method.
- final_outcome.
- risk_level.
- confidence.
- verification_status.
- human_notes.
- before_photos.
- after_photos.

AI may draft field-finish observations, organize evidence, and suggest the missing evidence needed for review. AI may not treat a wet finish, single angle photo, or one field outcome as a final material rule. Promote a lesson to reusable memory only after human verification, with before/after evidence and notes about where the lesson does and does not apply.

## Deck Build Field Intelligence

Shelter Prep must learn from real jobsite deck builds as operational intelligence, not just estimate square footage or material quantities. Deck memory should capture visible field conditions, construction logic, sequencing friction, access constraints, material compatibility, and maintenance implications without pretending photos alone create structural approval.

Example project:

Low-elevation, garden-integrated deck build in a dense Pacific Northwest landscape.

Observed site conditions:

- Mature landscaping and tree/root zones.
- Irregular terrain.
- Shaded moisture-prone garden environment.
- Limited material staging/access.
- Existing nearby deck/house transition.
- Gravel drainage layer.
- Concrete deck blocks / pier blocks.
- Pressure-treated framing.
- Segmented joist layout.
- Dense blocking.
- Hot-dipped galvanized Simpson connector nails.

Core field lesson:

A low-elevation garden deck is not just a square-foot deck estimate. It is a terrain-adaptive, drainage-sensitive, landscape-integrated framing system.

Shelter Prep should capture:

- Site access constraints.
- Root/landscape preservation requirements.
- Ground prep and drainage strategy.
- Deck block/pier logic.
- Framing layout logic.
- Blocking/stiffness strategy.
- Lateral movement risk.
- Moisture exposure risk.
- Fastener compatibility.
- Material staging friction.
- Future maintenance implications.

Operational rule:

For low-elevation decks in shaded or wet Pacific Northwest environments, Shelter Prep should flag:

1. Drainage under deck.
2. Airflow under framing.
3. Ground contact risk.
4. Pier/block settlement risk.
5. Lateral stiffness/racking risk.
6. Fastener compatibility with treated lumber.
7. Root/landscape protection.
8. Material handling/access constraints.
9. Future inspection/maintenance access.

Product requirements for future Deck Field Intelligence entries:

- property_id.
- project_id.
- area_or_zone.
- deck_type.
- elevation_type.
- site_conditions.
- soil_or_base_condition.
- drainage_strategy.
- landscape_constraints.
- access_constraints.
- framing_material.
- footing_or_support_type.
- joist_layout_notes.
- blocking_strategy.
- fastener_type.
- connector_type.
- corrosion_protection.
- observed_risks.
- mitigation_notes.
- sequencing_notes.
- material_handling_notes.
- human_notes.
- before_photos.
- progress_photos.
- after_photos.
- confidence.
- verification_status.

Required statuses:

- AI Draft.
- Needs Review.
- Human Verified.
- Contractor Verified.
- Completed / Actual Confirmed.
- Rejected.
- Deprecated.

AI may identify visible field conditions and risks from photos, but it may not declare a deck structurally approved from photos alone. Do not create a universal structural recommendation from one photo set. Human or contractor review is required for structural approval. Treat deck intelligence as field memory and job context, not final engineering.

## Current Execution Standard

Success means a user can submit a property, upload files, review the evidence, update status, and return later with the record intact. Each screen should make the next operational step obvious.
