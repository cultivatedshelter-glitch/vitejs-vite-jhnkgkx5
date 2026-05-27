# Shelter Prep Agent Instructions

## Operational Simplicity Principle

Shelter Prep should be as efficient as Larry Haun-style field execution: simple, sequenced, low-waste, and clear.

When working in this repo, make the app feel like a well-organized jobsite, not a cluttered software dashboard.

Follow these rules:

- Reduce wasted motion.
- Reduce unnecessary decisions.
- Preserve workflow rhythm.
- Stage information clearly.
- Reveal the next action naturally.
- Minimize cognitive load.
- Keep users moving from intake to execution.
- Keep one obvious next action per screen.
- Put complexity underneath the system, not on the surface.

Do not add flashy new features, expand the roadmap, or create dashboard clutter unless the user explicitly asks for that direction. Prefer dependable persistence, clear property-centered workflow, and human-reviewed operational outputs.

## Design Philosophy: Rams-Inspired Operational Minimalism

Shelter Prep should feel useful, quiet, durable, and obvious. It should not feel flashy, decorative, trendy, or over-designed.

Design rules:

- Good design is useful.
- Good design is understandable.
- Good design is unobtrusive.
- Good design is honest.
- Good design is thorough down to the last detail.
- Good design is as little design as possible.

Apply this to every interface decision:

- Prioritize function over decoration.
- Prioritize clarity over visual excitement.
- Reduce visual noise.
- Use restrained spacing, typography, and color.
- Use restrained layouts, calm spacing, functional hierarchy, quiet typography, neutral surfaces, strong alignment, and minimal color.
- Make system status obvious.
- Avoid decorative UI unless it improves comprehension.
- Avoid gradients, flashy cards, excessive shadows, and decorative motion.
- Every screen should answer: what is this, what matters, and what should I do next?
- Operational memory should feel trustworthy and inspectable, not magical.
- AI outputs must be clearly labeled by status: AI Draft, Needs Review, Human Verified, Deprecated, Rejected.
- Field lessons should read like durable records, not marketing content.
- Make the app feel like a serious field tool for property operations.

## Inspection Intelligence

Shelter Prep agents must think in systems when interpreting inspection reports:

defect -> building system -> root risk -> hidden damage -> trade -> priority -> sequence -> estimate impact.

Do not merely summarize inspection reports. Extract property address, inspection date, inspector/company, defects, recommendations, safety hazards, maintenance items, likely hidden damage, buyer/seller concern level, and repair-vs-credit context.

For each inspection finding, generate a task intelligence record with task title, defect / concern, building system, risk level, trade needed, urgency, missing information needed, photo requests, recommended next action, and human review status.

Core rule:

inspection item -> risk -> trade -> missing evidence -> next task.

Group related findings into operational bundles before drafting scopes. For example:

- Roof / water intrusion: moss, exposed nail heads, damaged shingles, cracked roof vents, active roof leak, rotted fascia.
- Exterior envelope / moisture: cracked siding, CertainTeed siding concern, rotted trim, thin paint, missing flashing, cracked caulk, vegetation against siding, negative grading.
- Plumbing risk: leaking water heater connectors, black iron fittings, high water pressure, leaking fixtures, broken waste-line straps.
- Safety: missing smoke detector, stair inconsistency, active moisture or mold concern, and dryer vent or bird activity when it creates fire or moisture risk.
- Fire suppression: painted-over, obstructed, or sealed sprinkler heads. Create "Fire suppression sprinkler issue" with life safety / fire hazard risk, fire suppression specialist / Fire Marshal trade, and missing evidence requests for close-up photos of every sprinkler head, wide room/ceiling photos, better angled photos, sprinkler head count, fire system inspection tags, and fire panel photos.

Inspection output should produce executive summary, priority repair roadmap, trade scopes, repair bundles, finding-level task records, missing-evidence requests, photo requests, immediate safety/water-intrusion items, deferred maintenance items, budget-to-replace items, DIY/simple maintenance items, contractor-ready scopes, seller prep summary, buyer credit candidates, estimate confidence, and human review status.

AI may classify, summarize, bundle, prioritize, and draft repair scopes. AI may not finalize pricing, approve repairs, or replace inspector or contractor judgment. Keep all inspection outputs in AI Draft status until human review.

## Shelter Prep Approved Contractors + Pricing Paths

Shelter Prep does not run an open bidding marketplace. It routes structured work to Shelter Prep Approved Contractors who review scope and confirm final pricing before any formal paid bid or execution opportunity.

A Shelter Prep Approved Contractor is a contractor reviewed by Shelter Prep who meets minimum requirements before receiving formal bid or execution opportunities:

- Licensed where required.
- Bonded where required.
- Insured.
- Identity and business verified.
- Service area confirmed.
- Trade and scope categories confirmed.
- Agrees to Shelter Prep workflow standards.
- Agrees to provide clear scope and pricing corrections.
- Agrees not to treat AI estimate ranges as final bids without review.

Use two separate pricing paths:

- Estimate Range: preliminary planning range generated from inspection, media, and scope data. It is AI-assisted and human-reviewed, not a final bid. It supports seller prep, repair-vs-credit decisions, and budgeting.
- Paid Contractor Bid: formal paid bid service issued only after review by a Shelter Prep Approved Contractor or internal GC/admin reviewer when applicable. It may require a walkthrough or additional media and must include assumptions, exclusions, scope limits, expiration date, and contractor/legal information. AI must never issue this automatically.

Use UI language such as Estimate Range, Request Paid Contractor Bid, Shelter Prep Approved Contractor, Contractor Review Needed, Formal Proposal, GC Review, and Site Verification Needed. Avoid language that implies random contractor bidding, marketplace bidding, lowest bid selection, open bidding, or AI-generated final bids.

Contractor approval statuses should support pending_review, approved, suspended, rejected, and expired_credentials. Contractor credential records should support license_number, license_state, license_expiration, bonded_status, insurance_status, insurance_expiration, verified_at, verified_by, service_area, approved_trades, and notes.

## Material Compatibility + Field Finish Memory

Shelter Prep should capture field-tested material compatibility lessons as human-verified operational memory, not generic product advice.

When a real field outcome teaches something about substrate, prep, product, dilution, lighting, application, finish behavior, or correction method, capture the lesson locally first with property_id, room_or_area, substrate, product_name, product_type, prep_method, dilution_ratio, application_tool, application_pattern, lighting_condition, observed_issue, correction_method, final_outcome, risk_level, confidence, verification_status, human_notes, before_photos, and after_photos.

Use statuses: AI Draft, Needs Review, Human Verified, Deprecated, Rejected.

Do not treat AI observation as final truth. Do not turn one job into a universal rule. Promote to reusable memory only after human verification with evidence.

Example: James Alexander Limewash Paint on clean new drywall in a narrow stairwell. Strong grazing light made seams, patch transitions, uneven absorption, and isolated touchups more visible. Draft correction: apply one broad diluted unifying pass across full wall planes, approximately 15-25% water, using a large block brush or wide masonry brush with broad X movement, long feather arcs, and light pressure. Avoid scrubbing, spot chasing, and flattening the mineral finish into standard beige drywall paint. Memory status remains Needs Review until the dry outcome is confirmed.

## Deck Build Field Intelligence

Shelter Prep should capture real deck build jobsite lessons as field intelligence, not just square footage, board counts, or generic deck advice.

For low-elevation garden decks in dense Pacific Northwest landscapes, look for visible site access constraints, root/landscape preservation requirements, ground prep and drainage strategy, deck block/pier logic, framing layout logic, blocking/stiffness strategy, lateral movement risk, moisture exposure risk, fastener compatibility, material staging friction, and future maintenance implications.

Operational rule: for low-elevation decks in shaded or wet Pacific Northwest environments, flag drainage under deck, airflow under framing, ground contact risk, pier/block settlement risk, lateral stiffness/racking risk, fastener compatibility with treated lumber, root/landscape protection, material handling/access constraints, and future inspection/maintenance access.

Future Deck Field Intelligence entries should support property_id, project_id, area_or_zone, deck_type, elevation_type, site_conditions, soil_or_base_condition, drainage_strategy, landscape_constraints, access_constraints, framing_material, footing_or_support_type, joist_layout_notes, blocking_strategy, fastener_type, connector_type, corrosion_protection, observed_risks, mitigation_notes, sequencing_notes, material_handling_notes, human_notes, before_photos, progress_photos, after_photos, confidence, and verification_status.

Use statuses: AI Draft, Needs Review, Human Verified, Contractor Verified, Completed / Actual Confirmed, Rejected, Deprecated.

AI may identify visible field conditions and risks from photos, but it may not create a universal structural recommendation from one photo set or say a deck is structurally approved from photos alone. Human or contractor review is required for structural approval. Treat deck intelligence as field memory and job context, not final engineering.
