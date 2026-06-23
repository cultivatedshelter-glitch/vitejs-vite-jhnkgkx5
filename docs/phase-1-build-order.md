# Shelter Prep Phase 1 Build Order

Canonical source: `/docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md`.

This file extracts the Phase 1 build sequence and restraint rules. It is planning canon only; it does not authorize implementing multiple stages in one pass.

Do not build flashy AI first.

Build the trust spine first.

## Stage 0 - Repo Canon

Create:

- `AGENTS.md`
- `docs/master-plan.md`
- `docs/phase-1-executable-spec.md`
- `docs/security-model.md`
- `docs/agent-architecture.md`
- `docs/schema-plan.md`

Acceptance for this repo-canon pass:

- Canon docs exist and reflect the master prompt.
- No app behavior changes.
- No UI changes.
- No agents added.
- No database migrations added.
- No Supabase behavior changed.
- No `src` files edited.
- No `supabase/migrations` files edited.
- `App.tsx` untouched.

## Stage 1 - App Stabilization

Goal:

- `App.tsx` under 300 lines
- screens moved to pages
- components extracted
- Supabase client isolated
- no behavior changes
- build passes
- typecheck passes

## Stage 2 - Supabase Auth And Profiles

Build:

- Supabase Auth
- `profiles` table
- role assignment
- current user helper
- no hardcoded admin PIN

Acceptance:

- admin can log in
- agent can log in
- contractor can access assigned link later
- role appears in profile

## Stage 3 - Properties And Work Requests

Build:

- `properties` table
- `work_requests` table
- `property_access` table
- basic create/view/update

Acceptance:

- agent/admin can create property
- work request attaches to property
- unauthorized user cannot view unrelated property

## Stage 4 - Private File Upload

Build:

- private buckets
- `files` table
- upload component
- signed URL retrieval
- `file_access_events`

Acceptance:

- upload inspection PDF
- upload photos
- admin opens files
- unauthorized user cannot open files
- access logged

## Stage 5 - Inspection Intelligence Draft

Build:

- `inspection_reports` table
- `evidence_items` table
- `repair_items` table
- explicit Generate Repair Items button
- save output as draft
- admin review screen

Acceptance:

- admin triggers AI
- AI creates draft findings
- every claim has evidence/source link
- outputs are `needs_review`
- admin can approve/edit/reject

## Stage 6 - Operational Bundles And Missing Info

Build:

- `operational_bundles` table
- gap detection output
- missing questions
- contractor review needed flag

Acceptance:

- inspection findings grouped
- missing info visible
- contractor review candidates selected

## Stage 7 - Contractor Assignment And No-Login Review Link

Build:

- `contractor_assignments` table
- secure token system
- token hash storage
- token expiration
- scoped review page

Acceptance:

- admin/agent sends selected items to contractor
- contractor opens link
- contractor sees only assigned items
- contractor cannot browse app
- contractor action logged

## Stage 8 - Contractor Review And Upload

Build:

- `contractor_responses`
- `contractor_uploaded_sources`
- contractor upload UI
- review draft and upload own estimate in same session
- Phase 2 placeholder text

Acceptance:

- contractor can mark Looks Right
- contractor can request walkthrough
- contractor can upload own estimate/scope
- upload stored as source evidence
- `contractor_uploaded_source` true
- `contractor_verified_ai_summary` false by default

## Stage 9 - AI Structures Contractor Upload

Build:

- `structured_contractor_summaries` table
- explicit admin-triggered structuring
- `status = needs_admin_review`

Acceptance:

- AI structures contractor upload
- output is draft
- admin review required
- agent cannot see until verified

## Stage 10 - Admin Verification Gate

Build:

- admin review screen
- edit summary
- approve summary
- reject summary
- event logging
- `agent_visible` server-side update only

Acceptance:

- admin verifies structured summary
- previous and edited values logged
- agent sees only approved version
- browser cannot set approval fields directly

## Stage 11 - Seller Summary

Build:

- `reports` table
- generate seller summary from approved data
- label known/unknown/review status

Acceptance:

- report uses approved/visible data
- draft data labeled clearly
- no rejected items included
- report can be viewed/exported

## Stage 12 - Memory Candidate

Build:

- `memory_candidates` table
- candidate generation from approved outcome
- provenance required
- no automatic memory commitment

Acceptance:

- memory candidate cannot be created without source, admin reviewer, approval timestamp, evidence IDs
- candidate status = `needs_review`
- admin can later approve memory

## Build Restraint Rules

Do not build these in Phase 1:

- full contractor portal
- public contractor marketplace
- contractor subscription billing
- homeowner app
- predictive maintenance
- LiDAR
- full mobile native app
- automated purchasing
- automated emails to clients without approval
- autonomous estimator
- complex scheduling engine
- AI agent debate system
- always-on background agents
- unreviewed memory learning
- public file buckets for private data
- remodel/addition UI
- full remodel workflows
- remodel-specific AI calls or autonomous planning

Phase 1 is:

- inspection repair clarity
- property intake
- inspection/file upload
- repair organization
- contractor input
- admin verification
- seller-ready direction
- memory candidate foundation
- secure solo-operated backend

Roadmap context:

- Phase 1: Inspection Repair Clarity.
- Phase 2: Controlled Sharing + Contractor Scope Review.
- Phase 3: Remodel / Addition Planning Intake.
- Phase 4: Property Work Memory.

Shelter Prep's broader long-term category is property-work organization, but Phase 1 remains the inspection and repair wedge for real estate agents. Remodel/addition work starts from owner intent and belongs to later roadmap planning, not current implementation.

## Operating Doctrine Guidance

These doctrines are canon for future app and LLM behavior. Do not implement new behavior from them until a task explicitly asks for it.

1. Field Team Communication
   - Future Operational Feed events should use Finding / Move / Owner / Status.
   - Avoid generic activity feed noise.

2. Jam-Clearing Communication
   - Blocked states should explain what is stuck, why it matters, who owns it, what unblocks it, and what can continue.
   - Do not use "blocked" as a dead-end label.

3. Pink Panther / Clue-Based AI
   - AI findings should use Known / Unknown / Clues / Next Evidence Needed / Review Status.
   - Final claims require evidence and review status.

4. Vlad / Asymmetric Focus
   - Prefer one decisive next move over broad generic advice.
   - Surface the highest-leverage jam, missing evidence, owner, review action, or risk.

5. Real-Life Intelligence
   - Real property evidence and reviewed field outcomes are the source of truth.
   - Contractor corrections become memory candidates, not automatic truth.

Workflow Gating already exists and should be referenced, not duplicated. These doctrines should support the same property-specific value chain: evidence, context, review status, role-based views, decision history, contractor/admin feedback, controlled sharing, and final report generation.

## Codex Operating Instructions

When editing code:

1. Read `/docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md` first.
2. Do not expand scope without explicit instruction.
3. Preserve security rules.
4. Preserve human review.
5. Preserve contractor-upload vs contractor-verified distinction.
6. Keep Phase 1 narrow.
7. Build backend trust before AI features.
8. Use server-side functions for protected actions.
9. Ensure RLS exists before relying on frontend role checks.
10. Add tests or manual acceptance steps with every major change.
11. Never expose service keys.
12. Never commit secrets.
13. Never create public buckets for private property documents.
14. Never let AI output become memory automatically.
15. Never let contractor uploads become agent-visible without verification.

If there is a conflict between speed and trust, choose trust.

If there is a conflict between AI convenience and human approval, choose human approval.

If there is a conflict between feature expansion and Phase 1 focus, choose Phase 1 focus.
