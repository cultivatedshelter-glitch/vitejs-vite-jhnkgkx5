# Shelter Prep Agent Architecture

Canonical source: `/docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md`.

This file extracts the agent doctrine, run rules, lifecycle states, and Phase 1 agent responsibilities. It is architecture canon only; it does not authorize adding agents or autonomous behavior.

## Governing Doctrine

Agents are not autonomous employees.

Agents are controlled functions that create draft outputs.

Every consequential output requires human review.

Do not build agent chaos.

Build explicit, button-triggered agent runs.

Core phrase:

```text
Contractors author scope. AI structures it. Shelter Prep verifies it. Agents use it. Memory learns from approved outcomes.
```

AI notices. Humans approve. Contractors author professional scope. Shelter Prep verifies. Memory learns only from approved outcomes.

## Agent Run Rules

- No always-on agents.
- No background agent debate.
- No agents approving each other.
- No agent writes directly to verified tables.
- No automatic memory commitment.
- No model output becomes agent-visible or seller-visible without review gate.

Agent output must include:

- source inputs
- `evidence_ids`
- assumptions
- confidence
- missing information
- `review_required`
- `review_owner`
- draft status
- `created_at`
- `prompt_version`

## Core Agent States

Use a shared lifecycle:

- `idle`
- `queued`
- `running`
- `failed`
- `draft_created`
- `needs_review`
- `admin_reviewing`
- `edited`
- `approved`
- `rejected`
- `superseded`
- `archived`

Never skip `needs_review` for consequential outputs.

## Review Statuses

Use these review statuses:

- `ai_draft`
- `needs_review`
- `human_reviewed`
- `human_verified`
- `contractor_uploaded_source`
- `ai_structured_from_contractor_source`
- `admin_verified_structured_summary`
- `contractor_verified_structured_summary`
- `agent_visible`
- `memory_candidate`
- `memory_verified`
- `rejected`
- `deprecated`

## Intake Agent

Purpose:

Turns messy input into structured property/work-request data.

Inputs:

- property address
- request description
- inspection report
- photos
- files
- agent notes
- PM notes

Outputs:

- property summary
- work request summary
- missing information
- recommended next action
- likely workflow type
- `review_required = true`

Questions:

- What is the property?
- Who submitted this?
- What is being requested?
- Is this inspection-driven, maintenance-driven, seller-prep, turnover, or emergency?
- What files are attached?
- What information is missing?
- What is the next safest action?

## Inspection Intelligence Agent

Purpose:

Interpret inspection reports proficiently, not merely summarize them.

Inputs:

- inspection PDF/text
- property record
- uploaded photos/files
- admin notes

Outputs:

1. Property summary
2. Inspection metadata
3. Extracted findings
4. Operational bundles
5. Priority repair roadmap
6. Missing information list
7. Contractor review recommendations
8. Evidence-linked observations

For each extracted finding:

- original report excerpt
- plain-language issue
- trade category
- severity
- urgency
- safety concern true/false
- moisture concern true/false
- likely hidden damage
- missing information questions
- recommended next action
- repair vs credit recommendation
- confidence
- `evidence_ids`
- `review_status = needs_review`

Operational bundle examples:

- Roof / water intrusion
- Exterior envelope / moisture
- Electrical safety
- Plumbing risk
- HVAC / ventilation
- Structural / framing
- Drainage / grading
- Safety / habitability
- Cosmetic / deferred maintenance

Priority roadmap:

- Must Address
- Needs Contractor Review
- Negotiation / Credit Candidate
- Maintenance / Monitor
- Cosmetic / Optional

Key question:

What does this inspection item mean operationally, and who needs to verify it?

## Photo Interpreter Agent

Purpose:

Read photos as field evidence, not just images.

Inputs:

- uploaded photos
- property context
- repair items
- admin notes

Outputs:

- what photo shows
- trade category
- equipment seen
- visible damage
- access constraints
- possible hidden labor
- field consequence
- estimate impact
- required follow-up photos
- confidence
- `evidence_ids`
- `review_status = needs_review`

Questions:

- What is visible?
- What is not visible?
- What field consequence might this imply?
- What line items could be missing?
- What should a contractor verify?
- What should never be claimed from this photo alone?

## Scope Drafting Agent

Purpose:

Turn reviewed findings into draft repair scopes.

Inputs:

- repair items
- evidence items
- photo observations
- inspection findings
- contractor notes if available

Outputs:

- draft scope by repair item
- included work
- excluded work
- assumptions
- missing info
- trade needed
- contractor review needed
- `review_status = needs_review`

Questions:

- What work appears required?
- What assumptions are being made?
- What must be excluded until verified?
- What should the contractor confirm?
- What should the agent tell the seller?

## Job Execution Scope Agent

Purpose:

Create step-by-step job execution logic.

Outputs per repair item:

- step number
- title
- labor scope
- trade/skill
- estimated labor hours low/high
- materials/tools
- equipment
- safety notes
- access notes
- cleanup/disposal
- confidence
- review status

Questions:

- What has to happen before the visible repair?
- What protection/setup is needed?
- What sequence matters?
- What cleanup is usually forgotten?
- What access constraint changes labor?
- What could cause rework?

## Gap Detection Agent

Purpose:

Find missing information that blocks reliable scope.

Outputs:

- missing photos
- missing measurements
- missing access notes
- missing contractor confirmation
- missing permit/code questions
- missing seller decision
- missing budget context

Questions:

- What do we need to know before pricing?
- What do we need before contractor review?
- What do we need before seller report?
- What do we need before work starts?
- What unknown could create cost drift?

## Contractor Input Structuring Agent

Purpose:

Convert contractor-authored source into structured data.

Inputs:

- contractor-uploaded PDF/image/text
- contractor notes
- related repair items
- related inspection excerpts
- property context

Outputs:

- structured line items
- labor assumptions
- material assumptions
- exclusions
- warranty notes
- walkthrough requirements
- missing information
- price range if present
- source references
- `review_status = needs_admin_review`

Critical rule:

Do not mark as contractor verified unless contractor explicitly confirms structured summary.

In Phase 1, admin verification is required before agent-facing use.

Questions:

- What did the contractor actually include?
- What did the contractor exclude?
- What labor is implied?
- What materials are specified?
- What is ambiguous?
- What needs admin review?
- What should the agent see only after verification?

## Seller Prep Agent

Purpose:

Turn verified repair data into seller-ready decision support.

Inputs:

- reviewed repair items
- contractor-informed scope
- estimate ranges if approved
- agent notes
- seller budget concern

Outputs:

- must-fix list
- repair-vs-credit candidates
- optional items
- monitor/defer items
- seller explanation
- risks if ignored
- contractor review status
- missing info
- report draft

Questions:

- What matters most to the transaction?
- What can likely be deferred?
- What should become a credit?
- What needs contractor verification?
- What should the seller understand without panic?
- What should the agent not overpromise?

## Report Drafting Agent

Purpose:

Generate reports only from approved or clearly labeled draft data.

Report types:

- seller summary
- contractor scope packet
- inspection response summary
- completed work report

Rules:

- show status labels
- separate known vs unknown
- cite evidence
- show review status
- do not imply AI certainty
- do not include rejected items
- do not use unverified memory as fact

## Memory Candidate Agent

Purpose:

Prepare memory candidates only after approval.

Inputs:

- approved repair item
- contractor correction
- admin-reviewed summary
- outcome data
- estimate adjustment
- `evidence_ids`

Outputs:

- proposed memory lesson
- `applies_when`
- `does_not_apply_when`
- source provenance
- confidence level
- `memory_scope` recommendation
- `memory_status = needs_review`

Questions:

- What did we learn?
- Where does it apply?
- Where does it not apply?
- Who verified it?
- What evidence supports it?
- What future agent should retrieve it?
- Is this project-specific or reusable?

## Source Research Rules

External research is allowed only as admin-directed research.

Flow:

1. Admin asks a specific question.
2. Admin selects source categories.
3. Agent researches only inside selected scope.
4. Agent returns source-backed draft.
5. Admin reviews.
6. Only approved conclusions become memory.

Source priority:

1. Uploaded evidence
2. Extracted report text
3. Property facts
4. Admin notes
5. Prior verified findings
6. Shelter Prep memory
7. Official jurisdiction/code sources
8. Manufacturer documentation
9. Supplier pages
10. General web only if explicitly allowed

Rules:

- Do not claim code requirement unless source is official or clearly labeled.
- Do not treat supplier prices as final pricing.
- Do not treat web results as verified.
- Do not save internet lessons as memory without human approval.
- All research output remains `needs_review` until approved.

Product phrase:

```text
Admin-directed intelligence. Human-verified memory.
```

## Workflow Status Model

Keep visible statuses simple.

Primary visible statuses:

- New
- In Progress
- Ready
- Done

Secondary flags:

- Needs Info
- Needs Review
- Contractor Assigned
- Contractor Requested Walkthrough
- Contractor Uploaded Scope
- AI Structured Contractor Upload
- Admin Review Required
- Admin Verified
- Agent Visible
- Estimate Drafted
- Seller Report Ready
- Blocked
- Memory Candidate

This keeps the app calm while preserving operational detail underneath.
