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

## Inspection Intelligence

Shelter Prep agents must think in systems when interpreting inspection reports:

defect -> building system -> root risk -> hidden damage -> trade -> priority -> sequence -> estimate impact.

Do not merely summarize inspection reports. Extract property address, inspection date, inspector/company, all defects and recommendations, safety hazards, maintenance items, trade category, severity, urgency, likely hidden damage, buyer/seller concern level, repair-vs-credit recommendation, and missing information questions.

Group related findings into operational bundles before drafting scopes. For example:

- Roof / water intrusion: moss, exposed nail heads, damaged shingles, cracked roof vents, active roof leak, rotted fascia.
- Exterior envelope / moisture: cracked siding, CertainTeed siding concern, rotted trim, thin paint, missing flashing, cracked caulk, vegetation against siding, negative grading.
- Plumbing risk: leaking water heater connectors, black iron fittings, high water pressure, leaking fixtures, broken waste-line straps.
- Safety: missing smoke detector, stair inconsistency, active moisture or mold concern, and dryer vent or bird activity when it creates fire or moisture risk.

Inspection output should produce executive summary, priority repair roadmap, trade scopes, repair bundles, immediate safety/water-intrusion items, deferred maintenance items, budget-to-replace items, DIY/simple maintenance items, contractor-ready scopes, seller prep summary, buyer credit candidates, estimate confidence, and human review status.

AI may classify, summarize, bundle, prioritize, and draft repair scopes. AI may not finalize pricing, approve repairs, or replace inspector or contractor judgment. Keep all inspection outputs in AI Draft status until human review.
