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
6. Estimate draft.
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

Extract these fields from inspection sources when present:

- Property address.
- Inspection date.
- Inspector and inspection company.
- All defects and recommendations.
- Safety hazards.
- Maintenance items.
- Trade category.
- Severity.
- Urgency.
- Likely hidden damage.
- Buyer/seller concern level.
- Repair-vs-credit recommendation.
- Missing information questions.

Model outputs as reviewable AI Draft records tied to the Property and source file. Store enough structured data for later review, correction, report generation, and estimating. Preserve source references where available so a reviewer can trace findings back to report language or page context.

Required output groups:

- Executive summary.
- Priority repair roadmap.
- Trade scopes.
- Repair bundles.
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
- Example roof / water intrusion inputs include moss, exposed nail heads, damaged shingles, cracked roof vents, active roof leak, and rotted fascia. Output: "Roof system aging with active water intrusion. Roofer evaluation required. Repair vs replacement economics should be reviewed."
- Example exterior envelope / moisture inputs include cracked siding, CertainTeed siding concern, rotted trim, thin paint, missing flashing, cracked caulk, vegetation against siding, and negative grading. Output: "Exterior moisture-management system risk. Coordinate siding, trim, paint, flashing, grading, and vegetation work."
- Example plumbing risk inputs include leaking water heater connectors, black iron fittings, high water pressure, leaking fixtures, and broken waste-line straps.
- Example safety inputs include missing smoke detector, stair tread/riser inconsistency, active moisture or mold concern, and dryer vent or bird activity when it creates fire or moisture risk.

AI authority rules:

- AI may classify, summarize, bundle, prioritize, and draft repair scopes.
- AI may not finalize pricing, approve repairs, or replace inspector or contractor judgment.
- Inspection Intelligence outputs must remain AI Draft until human reviewed.
- Pricing, repair approval, scope approval, and contractor dispatch require human review.

## Definition of Done

A change is done when it supports the intake-to-execution rhythm, persists after refresh, respects human review requirements, and avoids adding dashboard clutter.
