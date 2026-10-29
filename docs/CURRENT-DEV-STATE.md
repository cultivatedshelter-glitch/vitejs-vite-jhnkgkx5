# Shelter Prep Current Development State

## Current External Engineering Status — 2026-10-29

**BLOCKED. Production isolation has not been verified and the three engineering
credential bindings remain unavailable. No full Builder/staging/QA cycle or live
QA-failure recovery has been executed.**

### Work continued from existing components

- Reused the existing orchestration core, GitHub state branch, task #8, workflows,
  and health monitor; no duplicate infrastructure or paid service was created.
- Corrected retry enforcement so Builder is not invoked after its attempt budget.
  Malformed adapter results now persist a blocker rather than leaving an exception
  path outside the state transition handler.
- Added a fixed-purpose hosted checkpoint using the existing GitHubState adapter.
  It records actual environment-scoped credential evidence and the production
  isolation blocker on the existing state branch. It cannot clear that blocker,
  grant approval, invoke Builder, deploy, or attest QA PASS.
- Passed all 47 guardrail tests locally and on GitHub-hosted infrastructure.
- Verified a real GitHub-backed state write and replay: task #8 reached revision 3;
  replay of the same hosted operation returned the same revision without another
  state transition. Approval flags, source commit, task digest and prior audit
  history were preserved.
- Updated the existing six-hour health monitor to use the tested guardrails.
  Its push-triggered hosted run passed. A cron-triggered occurrence has not yet
  been observed during this task.

### Actual infrastructure and release boundary

- Production still names `shelter-prep-phase1-dev` as its source branch. This
  branch remains unprotected, and the repository ruleset list is empty.
- The connected tools do not expose Disable-autodeploy or branch-protection
  mutation. The available source-switch operation immediately builds/deploys,
  so it cannot be used under the no-production-deployment requirement.
- Production source/settings were not changed. The deployed build and rollback
  options are preserved. Production health returned HTTP 200 with status ok.
- Staging remains a separate service/project with no connected GitHub source.
  Its previous deployment remains in place; no new candidate was deployed.
- All automation code updates are isolated from the production-connected branch.
  Its source commit remains unchanged. No production credentials were accessed.

### Credential activation

Hosted scoped probes in run 40823115376 confirmed all three bindings unavailable:

| GitHub environment | Secret | Required scope |
| --- | --- | --- |
| engineering-builder | OPENAI_API_KEY | Reuse the founder-approved existing model key. |
| engineering-staging-deploy | RAILWAY_STAGING_TOKEN | Staging-project/environment-only project token; never an account token. |
| engineering-qa | SUPABASE_DEV_SECRET_KEY | Development Supabase project only. |

No secret values were displayed or copied. Scope cannot be verified for an
unavailable credential. Presence checks alone will not establish safe scope
when credentials are later bound.

### Exact next founder action

In the production Railway service, open Settings -> Source and choose **Disable**
for GitHub autodeploy. Preserve the connected branch, current deployment and
rollback history. Do not choose Deploy Latest Commit or reconnect the source.
This is the provider's documented non-deploying control:
https://docs.railway.com/deployments/github-autodeploys#disable-automatic-deployments

Then securely bind the three environment secrets above through GitHub settings.
Do not paste secret values into chat, issues, task text or commits. Codex can
continue engineering and hosted verification after those access gates are clear.

### Evidence and durable state

- Hosted tests/checkpoint/replay (full QA gate stays BLOCKED):
  https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/actions/runs/40823115376
- Checkpoint artifact:
  https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/actions/runs/40823115376/artifacts/12874999183
- Updated read-only health monitor:
  https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/actions/runs/40823003626
- Automation implementation commit: `f3c2c480b606f669db6f4fb85f55a8564c1446e0`.
- Monitor update commit: `8c13cc6f7485ba89b224c7cf015ec0955e013d02`.
- Durable state commit: `b015bdc0920411f4521a0696bc5893c7e9b7fbdc` on `automation/engineering-state`.
- Structured production/rollback and activation evidence:
  `docs/engineering-evidence/production-activation-verification.json`.

The scheduled monitor and checkpoint execute without a laptop process. This does
not establish offline operation of the unfinished full engineering loop. The
existing unrelated default-branch Security Agent continues its prior failure;
it was not modified. Full Builder publication/validation/deployment integration,
authenticated independent QA, task/defect/deployment routing, and live controlled
failure recovery remain unfinished.

## Earlier Verification Records — Historical

# Shelter Prep Current Development State

## External Engineering Verification — 2026-10-29

Status: **BLOCKED / NOT DEPLOYED**. Current configuration was inspected directly;
the historical record below does not establish current release readiness.

- Work is isolated on `automation/external-engineering` in the requested repository.
- The named development branch remains the production service's autodeploy source.
  No commit was pushed to that branch and no production setting was changed.
- Staging is a separate project with no GitHub source attached. Its health endpoint
  returned HTTP 200, notifications disabled; unauthenticated identity, review queue,
  and dashboard access were denied in live probes.
- Development database catalog checks show RLS on all 21 public tables, both
  evidence/report Storage buckets private, and no configured foreign servers.
  These catalog checks do not prove synthetic-only contents or staging key provenance.
- Security advisors report leaked-password protection disabled; see the provider's
  password-security guidance. No Auth configuration was changed.
- The source branch tracks an environment file; its values were not read. Source
  and bundle credential validation remains mandatory before any agent deployment.
- The existing model credential is approved for reuse but is not bound to an
  unattended engineering runtime. Railway OAuth provides variable names only.
- A bounded proposal adapter, GitHub state-store adapter, orchestration core,
  read-only live preflight, workflow definition and 39 passing local tests are
  prepared. Unit tests use simulated workers and model responses.
- `automation/evidence/local-live-preflight.json` records actual partial live
  checks. It explicitly records BLOCKED for the full QA contract.
- Hosted workflow publication and read-only execution are now verified; see the
  exact run evidence below. Full engineering-agent operation remains blocked.
- Builder publication/validation integration, deployment adapter, authenticated
  independent synthetic QA, approval intake, live retry recovery, state-branch
  integration and alerting remain uninstalled. The separate read-only health/core
  regression schedule is installed; full authenticated QA is not scheduled.
- No real engineering cycle, controlled live QA-failure recovery, or queued-task
  offline advancement has been demonstrated. No new paid service was provisioned.

Exact scopes, activation gates, limitations and rollback instructions are recorded
in `automation/DEPLOYMENT-GATES.md`. Production, customer data and mail were
untouched. No production or development schema changes were performed.

## Verified Hosted Results — 2026-10-29

- Automation source: `fc5997393dd291680e0b30bb654eeee3b3e3a41c`.
- Hosted preflight run: https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/actions/runs/40821728102
  All 39 tests pass; the full-QA gate intentionally remains BLOCKED.
- Default-branch health workflow commit: `fffaeb6bd4f97c81b21645f8313c094c5c92455f`.
  The read-only workflow is installed with UTC cron `17 */6 * * *`.
- First health execution (push-triggered): https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/actions/runs/40821551466
  It passed all 39 tests and live staging health/disabled-notification/unauthenticated
  denial probes on a GitHub-hosted runner. No laptop process was involved.
  A cron-triggered occurrence has not yet been observed.
- Health artifact: https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/actions/runs/40821551466/artifacts/12875085611
  This is partial health evidence, not authenticated end-to-end QA evidence.
- Hosted environment-scoped probes confirm these bindings are unavailable:
  `engineering-builder/OPENAI_API_KEY`,
  `engineering-staging-deploy/RAILWAY_STAGING_TOKEN`, and
  `engineering-qa/SUPABASE_DEV_SECRET_KEY`. Only booleans were recorded.
- Approved harmless synthetic task: https://github.com/cultivatedshelter-glitch/vitejs-vite-jhnkgkx5/issues/8
- Durable task state: `automation/engineering-state:engineering-state.json`,
  commit `0caa125c645f16606d2f8e68e706e0872b20c883`.
  It records the approved task digest, actor/provenance, explicit credential blocker,
  current agent/stage, commit, deployment, QA and founder approval status, and audit
  events. No Builder completion, staging candidate or QA PASS was fabricated.
- No new staging deployment was created. Final provider inspection confirms that
  production's deployment, source branch and settings remain unchanged.
- The existing default-branch Security Agent job still fails. Its prior runs
  also failed before these changes. It was not altered by this task.

Remaining: secure credential bindings, production-branch protection before any
write-capable broker, staging secret/data isolation attestation, Builder validation
and publication integration, trusted deploy adapter, independent authenticated
synthetic QA, task/deployment/defect routing, live failure recovery and full offline
queue advancement. The read-only monitor does not satisfy those requirements.

## Historical Record — not reverified by this task

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
