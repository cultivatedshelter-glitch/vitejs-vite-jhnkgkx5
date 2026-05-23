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

Inspection Intelligence should extract and normalize, at minimum:

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

The most important product behavior is bundling. Findings must be grouped into operational repair bundles, not treated as isolated line items. Agents should reason through this chain for every meaningful defect:

```text
defect -> building system -> root risk -> hidden damage -> trade -> priority -> sequence -> estimate impact
```

This means the system should recognize how several small findings combine into a larger operational risk, repair sequence, and contractor-ready scope.

Example bundles:

- Roof / water intrusion bundle: moss, exposed nail heads, damaged shingles, cracked roof vents, active roof leak, rotted fascia. Output: "Roof system aging with active water intrusion. Roofer evaluation required. Repair vs replacement economics should be reviewed."
- Exterior envelope / moisture bundle: cracked siding, CertainTeed siding concern, rotted trim, thin paint, missing flashing, cracked caulk, vegetation against siding, negative grading. Output: "Exterior moisture-management system risk. Coordinate siding, trim, paint, flashing, grading, and vegetation work."
- Plumbing risk bundle: leaking water heater connectors, black iron fittings, high water pressure, leaking fixtures, broken waste-line straps.
- Safety bundle: missing smoke detector, stair tread/riser inconsistency, active moisture or mold concern, and dryer vent or bird activity when it creates fire or moisture risk.

Inspection output should produce:

- Executive summary.
- Priority repair roadmap.
- Trade scopes.
- Repair bundles.
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

UX direction:

- Add Inspection Intelligence as an upload/analysis mode tied to a Property.
- Keep the workflow simple: Upload inspection PDF -> Extract findings -> Review bundles -> Generate seller prep report.
- Do not create dashboard clutter.
- Use progressive reveal in this order: Summary, Priority items, Repair bundles, Trade scopes, Missing info, Estimate draft, Seller report.

## Current Execution Standard

Success means a user can submit a property, upload files, review the evidence, update status, and return later with the record intact. Each screen should make the next operational step obvious.
