# Shelter Prep Permanent Doctrine

These rules apply to every task in this repository. Task procedure belongs in
`docs/SHELTER_PREP_EXECUTION_CONTRACT.md`; verified implementation state belongs
in `docs/CURRENT-DEV-STATE.md`.

## Phase 1 Purpose

Shelter Prep helps real estate agents turn inspection reports, photos, notes,
and repair questions into clear, human-reviewed repair workflows and
contractor-ready information.

The Phase 1 trust spine is:

```text
inspection / photos / notes
-> evidence extraction
-> repair interpretation
-> known vs unknown
-> missing information
-> human review
-> contractor-ready scope / information
-> verified outcome / memory
```

Protect this loop from feature sprawl. A broader idea remains later-stage unless
it directly improves this loop and the explicit task authorizes it.

## Property-Centered Model

The Property is the central object. Evidence, processing requests, findings,
review decisions, contractor input, reports, delivery, and verified outcomes
remain tied to the correct Property and provenance chain.

Do not turn Shelter Prep into a chatbot, generic AI wrapper, contractor
marketplace, autonomous estimator, homeowner product, predictive-maintenance
system, or unrelated dashboard.

## AI And Human Roles

AI may:

- notice
- organize
- classify
- draft
- research
- surface missing information
- propose likely repair paths
- provide sourced cost context

Humans remain responsible for:

- consequential interpretation approval
- pricing approval or correction
- scope approval
- contractor decisions
- final means and methods
- verified memory
- release and send decisions

Core principle: **Powered by AI. Approved by humans.**

Contractors author field scope. AI may structure it. Shelter Prep verifies it.
Contractor input remains attributed source material and does not become verified
Property truth without human review.

## Provenance And Evidence

- No source, no claim.
- Preserve the distinction between source evidence, AI interpretation, human
  verification, contractor input, and committed or verified memory.
- Do not turn AI inference or correlation into verified fact or causation.
- Preserve original evidence, raw extraction, corrections, review events, and
  immutable history.
- Keep contractor quotes separate from Shelter Prep cost context.
- Only reviewed operational knowledge may become reusable memory.

Private material under `local-fixtures/` must never be committed or copied into
tests. Process it only when the current user request explicitly authorizes that
use. Sanitized derived fixtures may be committed only when they contain no
client-identifying information.

## Uncertainty

- Separate observations, known facts, assumptions, interpretations, unknowns,
  and field-verification needs.
- Prefer evidence over confident guesses.
- Reduce uncertainty with the smallest useful next question, measurement, test,
  or document.
- Do not invent certainty to complete a workflow.
- State what evidence would change the decision or select between repair paths.

## Construction Reasoning

Account for:

- access
- setup and staging
- sequencing and dependencies
- hidden labor
- material handling
- equipment
- cleanup and disposal
- weather and environmental context
- safety
- concealed conditions

Shelter Prep defines the problem, evidence, options, uncertainty, cost context,
and next decision. Qualified trades determine final field scope and means and
methods.

## Pricing And Repair Paths

- Show a sourced range for every meaningful price when a defensible range exists.
- Uncertainty widens the range rather than silently removing it.
- Retain pricing source, date when available, scope basis, and defensible
  geography.
- Prefer local evidence when available, but never label national or metro pricing
  as ZIP-level or local pricing.
- Source relevance is more important than source count.
- Keep contractor quotes separate from general or modeled cost context.
- Present realistic response paths rather than a fake single answer.
- Do not manufacture alternatives merely to fill a template.
- State the evidence that selects between paths.

## Product And UX

- Build mobile-first.
- Use progressive reveal and a calm interface.
- Keep one obvious next action.
- Reduce wasted motion and unnecessary decisions.
- Show the decision; keep machinery underneath until it is needed.
- The user sees calm while the system handles complexity underneath.

Reports must be concise, decision-first, source-transparent, and readable. Deep
research, full provenance, assumptions, exclusions, and raw evidence belong in
technical detail or an appendix. Do the sifting and preserve human judgment. Do
not expose internal process language, enum strings, benchmark language, or AI
transcript artifacts in recipient-facing output.

## Safety And Release

- Never auto-release.
- Never auto-send.
- Never silently approve a human decision.
- Human review completion and recipient readiness are separate states.
- The browser is untrusted. Server boundaries control trusted review,
  verification, agent visibility, release, delivery, and memory creation.
- Preserve Supabase Auth, role checks, RLS, private storage, signed access, and
  server-only secrets.
- Never expose service-role or server secret values in frontend code, logs,
  fixtures, tests, commits, URLs, or chat.
- Do not touch production or apply migrations without explicit authorization and
  a verified target.

## Code And Repository Safety

- Fix root causes, not UI workarounds.
- Prefer the existing canonical architecture over duplicate or parallel logic.
- Preserve auth, RLS, provenance, immutable history, and versioning unless the
  task explicitly changes them.
- Make the smallest change that solves the verified problem.
- Do not modify, stage, discard, or commit unrelated local files.
- Do not force-push, rewrite verified production history unnecessarily, or embed
  credentials in remote URLs.
- Keep generated outputs Property-specific and visibly tied to their source and
  review status.

## Definition Of Success

Tests alone do not establish success. When user-facing behavior can be verified
safely, verify the actual workflow at the affected boundary and in production
when the task explicitly authorizes production verification.
