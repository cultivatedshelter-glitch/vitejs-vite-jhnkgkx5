# Shelter Prep Execution Contract

This is the practical operating procedure for future Codex work in this
repository. It implements the permanent doctrine in `AGENTS.md` without
expanding Phase 1 beyond the explicit task.

## Authority And Reading Order

Before changing application code, database schema, tests, or repository-canon
documents:

1. Read `AGENTS.md`.
2. Read this execution contract.
3. Read `docs/CURRENT-DEV-STATE.md` for verified current state.
4. Read `docs/phase-1-executable-spec.md` when the task invokes a named
   historical gate or needs one of its acceptance contracts.
5. Read `docs/master-plan.md` and supporting architecture, security, schema, or
   deployment docs only when relevant.

Explicit system and user instructions control the current task. `AGENTS.md`
contains permanent doctrine. `CURRENT-DEV-STATE.md` records facts, not desired
architecture. A named executable-spec gate controls scope only when explicitly
invoked. The master plan guides product direction but does not authorize
later-stage features by itself.

Do not rely on sibling worktrees, invisible history, or remembered state when
the active repository can establish the fact directly.

## Before Changes

1. Inspect the current branch, HEAD, upstream, Git status, and recent commits.
2. Preserve unrelated modified and untracked files exactly as found.
3. Read the relevant implementation, migrations, tests, and current-state notes.
4. Classify the request as Phase 1, later-stage, or a distraction from the
   current trust spine.
5. Identify protected behavior that must not regress, including auth, RLS,
   provenance, review state, immutable history, versioning, storage, release,
   delivery, and archive semantics.
6. Determine whether production, a database, private fixtures, external services,
   or secrets are involved and confirm explicit authorization before using them.
7. Make the smallest change that solves the verified problem.

## Implementation Rules

- Trace the actual production call path for runtime bugs: UI -> API -> service ->
  repository -> database/storage/external provider.
- Do not rely solely on mocks. Exercise the same implementation factory and
  boundary production uses.
- Do not create duplicate models, repositories, adapters, or reasoning paths when
  canonical logic exists.
- Keep Property identity durable across intake, evidence, processing, review,
  reporting, and history.
- Preserve provenance and immutable report/review history.
- Preserve human approval boundaries and distinct source, draft, reviewed, and
  released states.
- Preserve stale or historical requests when needed for audit; do not rewrite
  them to look current.
- Do not infer current canonical state from an old artifact. Resolve current data
  through the authoritative repository or reviewed model.
- Do not weaken validation, RLS, private storage, authorization, or source
  requirements to make a test pass.
- Use structured parsers and repository-native patterns instead of ad hoc string
  manipulation when practical.

## UX Changes

For meaningful UX changes:

- verify desktop behavior
- verify mobile at 390 x 844
- verify no horizontal overflow, clipping, or incoherent overlap
- verify readable type and usable controls
- verify the obvious next action remains obvious
- verify loading, empty, failure, blocked, and success states where relevant
- verify internal enum, benchmark, and process language does not leak
- preserve progressive reveal and avoid nested-card or dashboard clutter

Use browser-level verification for the affected live workflow when production
verification is authorized. A component test alone is not enough for a reported
production UX defect.

## Report Changes

Verify that:

- the primary report is decision-first and concise
- finding title, price, path, and next task have clear visual priority
- pricing ranges and confidence use human-readable labels
- research and pricing sources are usable adjacent to the claim
- public links are clickable on the web and real URI annotations in the PDF
- next tasks are specific and reduce consequential uncertainty
- rejected and needs-information states remain distinct
- universal caveats are not repeated on every finding
- detailed research, raw evidence, pricing provenance, assumptions, exclusions,
  corrections, and history remain available underneath or in the appendix
- customer-facing transcription is cleaned without mutating raw evidence
- PDF and web derive from the same canonical reviewed artifact
- all findings and consequential repair paths remain represented

For PDF work, record total pages, primary-page count, appendix start, and actual
URI hyperlink count. Render representative pages and inspect them visually.

## Production Changes

When deployment is required and authorized:

1. Confirm the intended branch and exact commit.
2. Keep server secrets out of Git, browser code, command output, and chat.
3. Deploy only the scoped commit.
4. Verify `GET /healthz` against the public production domain.
5. Verify the actual affected workflow in production.
6. Verify persistence after refresh, navigation, or re-login where relevant.
7. Verify no unintended release, send, email, or fixture fallback occurred.
8. Record the deployment ID, branch, commit, health result, and workflow result in
   `docs/CURRENT-DEV-STATE.md`.

Do not intentionally redeploy documentation-only changes. Before a documentation
push, inspect the connected service's current watch-path behavior. A commit
message is not a verified Railway skip mechanism for this repository. If branch
autodeploy still creates a documentation-only deployment, report it accurately,
verify health, and do not invent application work to justify it.

## Database And Supabase Changes

- Inspect migration history, existing schema, grants, RLS, RPCs, triggers, storage
  buckets, and policies before writing.
- Confirm the exact authorized Supabase project ID before any remote operation.
- Do not use destructive migration shortcuts or force-convert incompatible data.
- Preserve RLS and verify grants separately from policies.
- Keep protected buckets private and Property-scoped.
- Verify allow and deny cases, including cross-Property and cross-user access.
- Verify browser roles cannot assign trusted review, contractor verification, or
  release state.
- Do not infer migration safety from static or local tests alone.
- Do not copy development identities or data into production.

## Verification And Git

- Run the repository-defined relevant tests, build/typecheck, Python self-test,
  and `git diff --check` when code changes warrant them.
- Scale test breadth to risk. Documentation-only changes require structural and
  diff validation, not an unnecessary application rebuild.
- Review the final diff and confirm only intended files are staged.
- Commit only task-owned files. Never stage unrelated local changes.
- Push the current branch normally; never force-push.
- Confirm local HEAD, upstream HEAD, and remote branch HEAD match after push.
- Confirm unrelated local files remain untouched.
- If GitHub authentication fails, stop with the exact single human action needed
  to restore the existing credential path. Do not embed credentials in a remote
  URL or create an alternate secret-bearing workaround.
- Update `docs/CURRENT-DEV-STATE.md` after verified work. Move detailed obsolete
  milestones into the historical record instead of preserving stale values as
  current truth.

## Definition Of Done

A task is complete only when:

- the requested behavior works
- protected behavior still works
- applicable checks pass
- production is verified when the task requires it
- `docs/CURRENT-DEV-STATE.md` reflects verified current truth
- relevant commits are pushed when authentication permits

Do not call a task complete while a known acceptance criterion remains
unverified.

## Future Prompt Contract

The repository carries the repeated operating context. Future user prompts may
remain short and task-specific, for example:

```text
Read AGENTS.md, docs/SHELTER_PREP_EXECUTION_CONTRACT.md, and
docs/CURRENT-DEV-STATE.md first.

Task:
[task]

Follow the standard Shelter Prep execution and verification contract.
```

The short prompt does not expand the executable gate or waive production,
security, review, or provenance safeguards.

## Completion Report

Report facts, not aspiration:

- what changed
- files created or updated
- tests and verification performed
- deployment/database actions, or confirmation that none occurred
- exact remaining blockers or intentionally deferred work

Do not claim completion merely because implementation or tests passed when the
requested user-facing workflow remains unverified.

Use one of these result shapes when the user requests the standard format:

### A. LIVE AND VERIFIED

Include what changed, production verification, deployment ID, commit, checks,
and remaining optional gaps.

### A. LIVE AND SYNCED

Use when repository synchronization is also part of the task. Include local and
remote heads, branch, deployment state, and intentionally untouched files.

### B. BLOCKED

Include only the exact blocker, exact human action required, and what has already
been safely completed.
