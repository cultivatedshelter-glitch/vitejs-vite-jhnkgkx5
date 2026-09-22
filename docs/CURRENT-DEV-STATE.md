# Shelter Prep Current Development State

Last verified: 2026-09-21 (America/Los_Angeles)

This file records changing operational truth. Permanent doctrine lives in
`AGENTS.md`; execution procedure lives in
`docs/SHELTER_PREP_EXECUTION_CONTRACT.md`; detailed prior milestones live in
`docs/PHASE1-VERIFICATION-HISTORY.md`. The accumulated named gates in
`docs/phase-1-executable-spec.md` are historical contracts unless a task
explicitly invokes one.

## Repository

- Current branch: `shelter-prep-phase1-dev`
- Local repository: `/Users/kathleenbot/Documents/Codex/2026-05-08/add-supabase-file-storage-to-my/vitejs-vite-jhnkgkx5`
- GitHub repository: `cultivatedshelter-glitch/vitejs-vite-jhnkgkx5`
- Git sync status before this normalization: local, upstream, and remote matched at `248246a66b18aea373db52132e700b8d0902d5ec`.
- Canonical operating files are tracked: `AGENTS.md`, `docs/SHELTER_PREP_EXECUTION_CONTRACT.md`, and this file.
- Intentionally unrelated local files remain uncommitted: `package-lock.json`, `codex-backups/`, `output/`, and `security-audit-fixes.patch`.

## Production

- Public URL: `https://shelterprep.com`
- Health endpoint: `https://shelterprep.com/healthz`
- Railway project: `5c6c6e36-0bde-42f7-8342-2c5ed8e5d785`
- Railway service: `0b8c52c8-889f-4268-b864-957f2b004dc1`
- Current production application code commit: `b997b26f6a6cf3bfafdc216271e1c0207abfe2b4`
- Latest application-bearing Railway deployment: `26845094-a1ed-4423-bb2b-d2ca1608a3a2`
- Latest deployment verified before this normalization: `841f55ef-a972-46b7-8b76-449603350201`; it was an automatic documentation-only redeploy and did not change application code.
- Last health verification: HTTP 200 with service `shelter-prep-phase1` and notifications configured.

Railway currently autodeploys every push to the connected branch. Commit-message
`[skip ci]` did not prevent a documentation-only deploy. Documentation-only
deployments must be reported accurately; do not invent application work to
justify them. Railway watch paths are not currently configured.

## Supabase And Auth

- Development project: `oivzalfsjoyycbqunblk` (`shelter-prep-phase1-dev`)
- Production project: `lbyzkvbtolpwrvjfbhlq` (`Shelter Prep Production`)
- Production uses Supabase Auth with the pilot email/password flow.
- Properties use database-generated UUIDs and authenticated ownership.
- Evidence storage is private and Property-scoped.
- RLS, grants, server-owned review mutations, and cross-Property denial checks are implemented and verified.
- Browser clients cannot assign trusted human or contractor verification state.
- Server secrets remain server-only and must never use a `VITE_` prefix.

## Current Phase 1 Workflow

The live flow is:

```text
sign in
-> Property resolve/create
-> private evidence upload
-> processing
-> reasoning artifact
-> human review
-> recipient-readiness validation
-> durable reviewed report / PDF
-> explicit release
-> explicit delivery
```

Human review completion and recipient-report readiness are separate
server-authoritative states. Release and send remain explicit human actions.
There is no fixture fallback in the live flow.

## Research And Pricing

- Findings preserve source observation, Shelter Prep interpretation, knowns,
  unknowns, specific next task, rationale, and provenance.
- Current production reasoning generated 31 findings with independent research
  and specific next tasks, with zero paraphrase-only findings in the verified
  request.
- Repair paths use sourced ranges where defensible. Uncertainty widens ranges;
  unsupported paths remain honestly blocked.
- Geographic labels reflect the source's defensible precision and never present
  metro or national data as ZIP-level pricing.
- Source relevance takes priority over source count.
- Contractor quotes remain separate from Shelter Prep cost context.
- Verified path-pricing distribution for the current report: 5 paths with three
  sources, 25 with two, 17 with one, and 1 blocked path.

## Reviewer UX

- Reviewer navigation, queue continuity, role-gated review controls, and atomic
  finding corrections are implemented.
- Finding corrections and review events persist atomically with previous/new
  values and immutable history.
- Reviewer output is decision-first: issue, evidence, interpretation, likely
  paths, pricing, key unknown, next task, rationale, and sources.
- Recipient-readiness validation blocks report generation for stale,
  paraphrase-only, internal-process, or otherwise invalid recipient content.

## Durable Reports And Property History

- Reviewed reports are immutable, versioned Property records with private stored
  PDFs, release state, delivery records, and exactly-once delivery behavior.
- Web and PDF use the same canonical `phase1-reviewed-decision-brief.v1` model.
- The primary report is a compact decision brief; full evidence, known/unknown
  detail, research, pricing provenance, assumptions, exclusions, corrections,
  and review history remain in the technical appendix.
- Latest verified redesigned draft: version 12,
  `8f652062-976d-43aa-880b-294d5dd40f9a`, for request
  `cd235456-12fe-4ef1-bc41-ca8891f5fae7`.
- Version 12 contains 31 findings and 48 repair paths. Its PDF has a 9-page
  primary brief, appendix beginning on page 10, 37 total pages, 185 URI
  annotations, and 67 unique public URI targets.
- Version 12 remains draft and was not released or delivered during verification.
- Latest verified released compact report: version 7,
  `dccd50ff-f68b-4f9e-80bc-ac64e5003136`.

## Local Professionals

- `GOOGLE_PLACES_API_KEY` is not configured in Railway.
- Local-professional lookups record `skipped_not_configured`; no businesses are
  fabricated.
- This is an optional configuration gap and does not block the reviewed report.

## Property Archive

- Owner/admin-only Archive and Restore are implemented.
- Archive preserves evidence, processing requests, findings, review decisions,
  reports, PDFs, delivery records, provenance, and workflow history.
- Archived Properties are excluded from active lists, queues, search, evidence
  upload, draft creation, and processing.
- Restore returns a Property to its existing authoritative workflow state.
- There is no hard-delete workflow and no automatic archive of existing
  Properties.

## Known Issues And Deferred Items

- Optional: configure server-only `GOOGLE_PLACES_API_KEY` to enable sourced local
  professional suggestions.
- Operational: Railway watch paths are not configured, so documentation-only
  branch pushes currently trigger a redeploy.
- Historical failed and stale requests remain preserved for audit and must not be
  treated as canonical current findings.
- No known production blocker is open for the current Phase 1 reviewed-report
  workflow.

## Latest Verification

- Production request: `cd235456-12fe-4ef1-bc41-ca8891f5fae7`
- Draft report: `8f652062-976d-43aa-880b-294d5dd40f9a` (version 12)
- Released report: `dccd50ff-f68b-4f9e-80bc-ac64e5003136` (version 7)
- Browser: authenticated desktop and measured 391 x 844 CSS viewport; no
  horizontal overflow and all 31 finding blocks present.
- Last full application checks: `npm test` 107/107, `npm run build`, Round 1
  Python self-test, focused report/source tests 15/15, and `git diff --check`.
- This operating-structure normalization changes documentation only; application
  checks are not rerun solely for documentation ceremony.
