# Shelter Prep Agent Instructions

Before changing code, read:

- /docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md
- /docs/security-model.md
- /docs/schema-plan.md
- /docs/agent-architecture.md
- /docs/phase-1-build-order.md

Shelter Prep is operational infrastructure for property repair coordination.

Do not build it as:
- a chatbot
- an AI wrapper
- a contractor marketplace
- a feature-heavy dashboard
- autonomous estimating software

Build it as:
- property-centered workflow software
- inspection-to-scope coordination
- contractor-authored scope capture
- admin-verified structured summaries
- human-reviewed outputs
- secure Supabase-backed operational memory

Core principle:
Contractors author scope. AI structures it. Shelter Prep verifies it. Agents use it. Memory learns from approved outcomes.

Operating doctrines:

1. Field Team Communication
Shelter Prep should communicate like a calm field lead. Important work should reduce to Finding / Move / Owner / Status. Do not turn operational reality into vague dashboards, generic summaries, or AI monologues. The user should always understand what was found, what should happen next, who owns it, and whether it is draft, blocked, reviewed, or done.

2. Jam-Clearing Communication
When work is blocked, explain the jam instead of merely labeling it blocked. A blocked state should say what is stuck, why it matters, who owns the next move, what unblocks it, and what can continue meanwhile. The app should clear jams without blame or panic.

3. Pink Panther / Clue-Based AI
AI should behave like an observant clue finder, not a final authority. AI findings should use Known / Unknown / Clues / Next Evidence Needed / Review Status. Final claims require evidence and review status.

4. Vlad / Asymmetric Focus
Shelter Prep should apply asymmetric focus to the highest-leverage constraint in the property workflow. Prefer one decisive next move over broad generic advice. Do not scatter user attention across equal-looking tasks when one jam, risk, missing file, owner, or review action matters most.

5. Real-Life Intelligence
Real properties, field evidence, contractor judgment, corrections, photos, files, timelines, and completed outcomes are the source of truth. Contractor corrections become memory candidates with provenance, not automatic truth. Never turn one field outcome or AI inference into universal memory without human review.

6. AI Draft Estimating
AI may draft industry-standard pricing assumptions, labor steps, material lists, missing information, and pricing-memory comparisons for admin review. AI may not finalize pricing, create seller-ready estimate language, send outputs externally, approve contractor scope, or save pricing memory. Every estimating output must show knowns, unknowns, assumptions, missing evidence, pricing sources, confidence, review status, and admin notes. If live source research is not implemented, material prices must be marked as placeholder/draft and needs source verification.

7. Admin Task Workbench
The admin side may behave like a property-specific LLM task console, not an autonomous agent. Admins can request tasks such as estimate this bundle, generate material list, research material costs, draft contractor scope, identify missing information, draft seller summary, compare to pricing memory, review contractor upload, or create repair-vs-credit options. Task results are AI Draft / Needs Review until an admin reviews, edits, approves, rejects, or requests more information. Approved drafts may later become memory candidates, but never automatic truth.

Workflow gating principle:
Do not protect the sentence. Protect the system around the sentence.

Shelter Prep must not become a generic answer machine. Free or preview output may identify the shape of the problem, but valuable outputs should stay tied to the property workspace, evidence chain, review status, role-based links, contractor/admin feedback, decision history, and final report generation.

Generated outputs must be property-specific. Stamp reports and copied text with property address, report date, source file or inspection reference, review status, "Not valid for unrelated properties", and "AI draft until reviewed" unless the output is reviewed/finalized.

Use these report status labels for property-specific outputs:
- AI Draft
- Needs Review
- Human Reviewed
- Contractor Reviewed
- Seller Ready
- Finalized

Use these workflow states:
- preview
- workspace_active
- reviewed_report
- contractor_packet
- finalized_report

Role-based views must not leak unrelated/internal data:
- Agent View: transaction strategy, seller talking points, status, next steps, reviewed repair-vs-credit guidance when available.
- Seller View: plain-language summary, priority repairs, approved repair-vs-credit options, reviewed estimate range when available; no internal notes or unverified AI reasoning.
- Contractor View: scope packet, photos/files, inspection excerpts, missing info, site/access notes, walkthrough and upload actions; no seller strategy or unrelated property data.
- Admin View: full evidence, AI drafts, review controls, contractor feedback, approval history, internal notes.

Security rules:
- Never expose service role keys in frontend code.
- Do not use hardcoded admin PINs in production.
- Use Supabase Auth, profiles, roles, RLS, private buckets, and signed URLs.
- Browser is untrusted.
- Server controls approvals, verification, agent visibility, and memory creation.

UX rules:
- Reduce wasted motion.
- Reduce unnecessary decisions.
- Preserve workflow rhythm.
- Stage information clearly.
- Reveal the next action naturally.
- Keep one obvious next action per screen.
- Put complexity underneath the system, not on the surface.

Design philosophy:
Shelter Prep should feel useful, quiet, durable, and obvious.
Prioritize function over decoration.
Prioritize clarity over visual excitement.
Reduce visual noise.

Phase 1 focus:
Build the trust spine before adding features.

Do not build:
- full contractor portal
- marketplace logic
- predictive maintenance
- homeowner app
- LiDAR
- autonomous purchasing
- automatic memory learning
