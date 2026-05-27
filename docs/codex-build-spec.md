# Shelter Prep Codex Build Spec

This file guides implementation work in Shelter Prep. Build in small, dependable steps and protect the property-centered workflow.

## Operational Simplicity Principle

Shelter Prep should be as efficient as Larry Haun-style field execution: simple, sequenced, low-waste, and clear.

The interface should feel like a well-organized jobsite, not a cluttered software dashboard. Implementation choices should reduce wasted motion, preserve workflow rhythm, and keep users moving from intake to execution.

Build rules:

- Reduce unnecessary decisions on each screen.
- Stage information in the order the user needs it.
- Reveal the next action naturally.
- Minimize cognitive load.
- Keep one obvious next action per screen.
- Keep complexity in data models, services, and review flows rather than exposing it as surface clutter.
- Do not add flashy new modules when an existing property card, reveal section, or admin control can carry the work.
- Do not expand the roadmap while implementing narrow reliability or workflow improvements.

## Design Philosophy: Rams-Inspired Operational Minimalism

Shelter Prep should feel useful, quiet, durable, and obvious. It should not feel flashy, decorative, trendy, or over-designed.

Implementation rules:

- Good design is useful: every element must support intake, review, evidence, estimating, routing, memory, or follow-up.
- Good design is understandable: every screen should answer what this is, what matters, and what the user should do next.
- Good design is unobtrusive: use restrained layouts, calm spacing, quiet typography, neutral surfaces, strong alignment, and minimal color.
- Good design is honest: label AI outputs by status and never make draft intelligence feel like final truth.
- Good design is thorough down to the last detail: file evidence, timestamps, statuses, source links, and human review states must be inspectable.
- Good design is as little design as possible: avoid decorative UI unless it improves comprehension.
- Prioritize function over decoration.
- Reduce visual noise.
- Use restrained spacing, typography, and color.
- Make system status obvious.
- Clearly label AI Draft, Needs Review, Human Verified, Deprecated, and Rejected states wherever operational judgment or memory appears.
- Avoid gradients, flashy cards, excessive shadows, and decorative motion.
- Make every screen answer: what is this, what matters, and what should I do next?

Operational memory and field lessons must read like durable records, not marketing content. Use clear labels such as AI Draft, Needs Review, Human Verified, Deprecated, and Rejected. The app should feel like a serious field tool for property operations.

## UX Direction

- Keep the UI calm, property-centered, and mobile-first.
- Prefer stacked reveal cards or lightweight expandable sections over heavy tabs.
- Address, media, and scope interpretation should remain easy to scan.
- Media should never be hidden when a user is trying to understand a job.
- Missing information should appear as exact questions.
- Estimate, material, labor, media, and AI findings remain drafts until human review.

### Inspection Intelligence UX

Add Inspection Intelligence as a simple upload/analysis mode tied to a Property, not as a standalone dashboard area.

Primary flow:

Upload inspection PDF -> Extract findings -> Review bundles -> Generate seller prep report.

Use progressive reveal in this order:

1. Summary.
2. Priority items.
3. Repair bundles.
4. Trade scopes.
5. Missing info.
6. Estimate Range draft.
7. Seller report.

Keep the surface quiet. The user should see the property, the source report, the AI Draft status, and the next review action before seeing deeper analysis.

## Engineering Direction

- Use Supabase as the source of truth for persisted data.
- Keep uploaded photos/documents in Supabase Storage with database rows that can be loaded after refresh.
- Use signed URLs for private storage and graceful fallbacks for older public URLs.
- Avoid local-only storage as the main source of truth.
- Keep schema changes safe to rerun when possible.
- Preserve existing role rules: admin/owner can manage; estimator can create/read drafts where allowed; viewer/client cannot manage operational findings.

### Inspection Intelligence Data And Logic

Inspection Intelligence must interpret reports into structured operational intelligence, not plain summaries.

Extract report-level context from inspection sources when present:

- Property address.
- Inspection date.
- Inspector and inspection company.

For each inspection finding, model a reviewable AI Draft task record tied to the Property and source file. Store enough structured data for later review, correction, report generation, and estimating. Preserve source references where available so a reviewer can trace findings back to report language or page context.

Required per-finding task fields:

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

Core transformation rule:

```text
inspection item -> risk -> trade -> missing evidence -> next task
```

Required output groups:

- Executive summary.
- Priority repair roadmap.
- Trade scopes.
- Repair bundles.
- Finding-level task intelligence records.
- Missing-evidence request list.
- Photo request list.
- Immediate safety/water-intrusion items.
- Deferred maintenance items.
- Budget-to-replace items.
- DIY/simple maintenance items.
- Contractor-ready scopes.
- Seller prep summary.
- Buyer credit candidates.
- Estimate confidence.
- Human review status.

Bundling rules:

- Group findings into operational bundles before producing scopes or seller reports.
- Prefer building-system bundles over isolated defect lists.
- Connect each defect to building system, root risk, likely hidden damage, trade, priority, sequence, and estimate impact.
- Each finding must still preserve its own task title, risk level, trade, urgency, missing information, photo requests, recommended next action, and human review status after bundling.
- Example roof / water intrusion inputs include moss, exposed nail heads, damaged shingles, cracked roof vents, active roof leak, and rotted fascia. Output: "Roof system aging with active water intrusion. Roofer evaluation required. Repair vs replacement economics should be reviewed."
- Example exterior envelope / moisture inputs include cracked siding, CertainTeed siding concern, rotted trim, thin paint, missing flashing, cracked caulk, vegetation against siding, and negative grading. Output: "Exterior moisture-management system risk. Coordinate siding, trim, paint, flashing, grading, and vegetation work."
- Example plumbing risk inputs include leaking water heater connectors, black iron fittings, high water pressure, leaking fixtures, and broken waste-line straps.
- Example safety inputs include missing smoke detector, stair tread/riser inconsistency, active moisture or mold concern, and dryer vent or bird activity when it creates fire or moisture risk.
- Example fire suppression input: painted-over, obstructed, or sealed sprinkler heads. Output task title: "Fire suppression sprinkler issue." Risk level: "Life safety / fire hazard." Trade needed: "Fire suppression specialist / Fire Marshal." Missing information and photo requests must ask for close-up photos of every sprinkler head, wide room/ceiling photos, better angled photos where condition is unclear, sprinkler head count, fire system inspection tags, and fire panel photos. Recommended next action: request evidence, then route to the proper fire suppression reviewer before pricing or seller/buyer guidance.

AI authority rules:

- AI may classify, summarize, bundle, prioritize, and draft repair scopes.
- AI may not finalize pricing, approve repairs, or replace inspector or contractor judgment.
- Inspection Intelligence outputs must remain AI Draft until human reviewed.
- Pricing, repair approval, scope approval, and contractor dispatch require human review.
- Preliminary planning prices must be labeled Estimate Range. Formal Paid Contractor Bids require a Shelter Prep Approved Contractor or internal GC/admin review and are never issued automatically by AI.

### Shelter Prep Approved Contractors And Pricing Paths

Shelter Prep does not run an open bidding marketplace. Do not build language or flows that imply random contractor bidding, marketplace competition, lowest-bid selection, open bidding, or AI-generated final bids.

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

Implementation must keep two pricing paths distinct:

- Estimate Range: preliminary planning range from inspection, media, and scope data. It may be AI-assisted and human-reviewed, but it is not a final bid. Use it for seller prep, repair-vs-credit decisions, and budgeting.
- Paid Contractor Bid: formal paid bid service issued only after Shelter Prep Approved Contractor or internal GC/admin review when applicable. It may require walkthrough or additional media and must include assumptions, exclusions, scope limits, expiration date, and contractor/legal information.

Preferred UI language:

- Estimate Range.
- Request Paid Contractor Bid.
- Shelter Prep Approved Contractor.
- Contractor Review Needed.
- Formal Proposal.
- GC Review.
- Site Verification Needed.

Contractor approval statuses:

- pending_review.
- approved.
- suspended.
- rejected.
- expired_credentials.

Contractor credential fields:

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

### Admin Research Confirmation Links

Build Source Research so admins always have proof links available when an AI Draft needs verification. This applies to work groups, findings, estimate assumptions, material assumptions, permit/code questions, safety issues, manufacturer issues, and contractor scope notes.

Admin review uses Research Confirmation Links. Consumer reports use Helpful Resources.

Data fields on source records:

- source_title.
- source_url.
- publisher / source_publisher.
- source_category.
- source_quality.
- relevance_note.
- admin_confirmation_status: not_reviewed, confirms, partially_supports, does_not_support, needs_more_research.
- report_visibility: internal_only, report_candidate, report_approved, report_hidden, rejected.
- consumer_summary.
- admin_notes.
- checked_at.
- checked_by.

Implementation rules:

- Every Source Research task should show admin-facing confirmation links when source rows exist.
- If no links exist, show: "No confirmation links found yet. Run additional research or add source manually."
- Admin can manually add a confirmation link and choose category, confirmation status, and report visibility.
- Admin can mark a source as confirming, partially supporting, not supporting, or needing more research.
- Consumer Helpful Resources must include only report_approved links.
- Internal-only links must never appear in consumer reports.
- Do not dump excerpts or technical flags by default. Put raw excerpts, source metadata, and technical details behind Show Details.
- Do not allow AI to Human Verify a finding based only on general web sources.
- Prefer official/jurisdiction sources for code and permit questions, fire authority resources for life safety, manufacturer documentation for products, supplier pages as reference only, and internal verified records where available.

### Material Compatibility + Field Finish Memory

Material Compatibility + Field Finish Memory records field-tested lessons about how a product behaved on a substrate under real site conditions. Build this as operational memory, not generic product advice and not a broad recommendation engine.

The first implementation should stay small and property-centered. Store lessons locally against the property/room/evidence first. Only promote them to reusable memory after human verification.

Required data model fields for future entries:

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

Supported verification statuses:

- AI Draft.
- Needs Review.
- Human Verified.
- Deprecated.
- Rejected.

Required safeguards:

- Do not treat AI observation as final truth.
- Do not create universal recommendations from one job.
- Keep new observations local to the property/room until reviewed.
- Require human notes and evidence before promotion to reusable memory.
- Keep before and after photos attached where available.
- Capture uncertainty, drying time, lighting condition, and limits of applicability.

Example record:

- property_id: current property.
- room_or_area: Stairwell / narrow circulation walls.
- substrate: Clean new drywall.
- product_name: James Alexander Limewash Paint.
- product_type: Limewash paint / mineral finish.
- prep_method: Diluted limewash first coat used as bonding/base coat.
- dilution_ratio: Approximately 15-25% water for unifying pass.
- application_tool: Large block brush or wide masonry brush.
- application_pattern: Full wall planes, top-to-bottom, broad X movement, long feather arcs, light pressure; avoid scrubbing or spot chasing.
- lighting_condition: Narrow stairwell/tunnel geometry with strong grazing light.
- observed_issue: Grazing light amplified drywall seams, patch transitions, uneven absorption, and localized touchup contrast.
- correction_method: Apply one broad diluted unifying pass across full wall planes instead of isolated touchups.
- final_outcome: Needs confirmation after drying.
- risk_level: Medium finish-risk in narrow/grazing-light areas.
- confidence: Needs review until dry outcome is confirmed.
- verification_status: Needs Review.
- human_notes: Preserve soft mineral movement; reduce contrast without flattening into standard beige drywall paint.
- before_photos: Attach stairwell/seam/patch photos where available.
- after_photos: Attach dry final-condition photos before promotion.

### Deck Build Field Intelligence

Deck Build Field Intelligence captures real jobsite deck build lessons as operational memory. It should help Shelter Prep remember terrain, drainage, access, framing logic, fastener compatibility, sequencing friction, and maintenance implications. It is not a structural approval system and must not reduce deck builds to only square footage or material quantity.

Example project:

Low-elevation, garden-integrated deck build in a dense Pacific Northwest landscape with mature landscaping/root zones, irregular terrain, shaded moisture exposure, limited material staging/access, an existing nearby deck/house transition, gravel drainage layer, concrete deck/pier blocks, pressure-treated framing, segmented joist layout, dense blocking, and hot-dipped galvanized Simpson connector nails.

Core field lesson:

A low-elevation garden deck is a terrain-adaptive, drainage-sensitive, landscape-integrated framing system.

Required data model fields for future Deck Field Intelligence entries:

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

Supported verification statuses:

- AI Draft.
- Needs Review.
- Human Verified.
- Contractor Verified.
- Completed / Actual Confirmed.
- Rejected.
- Deprecated.

For low-elevation decks in shaded or wet Pacific Northwest environments, flag these review items:

- Drainage under deck.
- Airflow under framing.
- Ground contact risk.
- Pier/block settlement risk.
- Lateral stiffness/racking risk.
- Fastener compatibility with treated lumber.
- Root/landscape protection.
- Material handling/access constraints.
- Future inspection/maintenance access.

Required safeguards:

- Do not create a universal structural recommendation from one photo set.
- Do not say a deck is structurally approved from photos alone.
- AI may identify visible field conditions and risks.
- Human/contractor review is required for structural approval.
- Treat this as field intelligence and job memory, not final engineering.
- Keep photo-derived deck intelligence in AI Draft or Needs Review until reviewed.

## Definition of Done

A change is done when it supports the intake-to-execution rhythm, persists after refresh, respects human review requirements, and avoids adding dashboard clutter.
