# Shelter Prep Master Plan

Shelter Prep helps move a property from intake to field execution with clear evidence, human-reviewed estimates, and contractor-ready scope context. The product should stay property-centered, calm, and practical.

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
