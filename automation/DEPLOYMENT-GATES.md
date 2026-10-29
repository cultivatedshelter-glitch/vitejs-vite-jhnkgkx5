# External engineering deployment gates

This branch is preparation, not a deployed engineering system. Its preflight
workflow has read-only repository permission, performs no customer-data queries,
and intentionally ends BLOCKED until the hosted cycle is verified. A failed
preflight is not a successful engineering-agent deployment.

## Current findings

- The named development branch is still the production service's autodeploy
  source. Builder must never push or merge to it. Use isolated candidate branches
  and draft pull requests; production promotion stays with the founder.
- Staging is a separate Railway project/service with no connected GitHub source.
  Its health endpoint reports notifications disabled.
- Development Supabase is a separate project. Catalog checks show RLS on all
  public tables, private evidence/report buckets, and no foreign servers. This
  does not prove absence of customer data or validate staging's secret values.
- Connected Railway OAuth exposes variable names, not values. An existing model
  key is configured elsewhere; it has not been copied or exercised.
- The source branch tracks an environment file. Its contents have not been read
  for this task. It must not enter model context, test logs, build artifacts, or
  staging images. Complete source/bundle credential validation before deployment.
- The GitHub connector cannot inspect Actions administration or secret settings.
  Repository user permission metadata does not establish the app's Actions or
  workflow-write permission. An actual workflow publication/run is required.

## Exact credential configuration

Use existing GitHub Actions environments to separate capabilities. Do not add
production secrets to repository-wide Actions secrets.

| Environment | Secret | Required scope |
| --- | --- | --- |
| `engineering-builder` | `OPENAI_API_KEY` | Reuse the approved existing model key; model usage budget must be bounded. |
| `engineering-staging-deploy` | `RAILWAY_TOKEN` | Project token for the separately verified staging project/environment only. Never an account/API token. |
| `engineering-qa` | `SUPABASE_SECRET_KEY` | Development project only, used by trusted synthetic identity provisioning; never exposed to candidate code. |

The automatically issued `GITHUB_TOKEN` is sufficient for repository operations;
do not provision an account-wide PAT. Builder/test jobs use `contents: read`
and checkout without persisted credentials. A trusted broker may receive
`contents: write` only to commit validated patches to isolated candidate/state
refs; the model and candidate processes must not receive that token. Protect
the production-connected branch before enabling any broker with write authority.
Workflow publication requires the connection's Workflows write capability.

No secrets are needed for the read-only preflight workflow on this branch.
Do not paste credential values into issues, task text, commits, logs, or chat.

## Activation order

1. Publish and execute the read-only preflight; inspect its actual hosted run.
2. Verify Actions administration and environment isolation through an authenticated
   settings-capable connection. Bind only the existing approved credentials.
3. Protect the production-connected branch against automated writes/merges while
   retaining founder release authority. Do not change production service settings.
4. Verify rendered staging variables inside the trusted deploy job, emitting
   booleans/status codes only. Require development URL/ref, private storage,
   no mail capability, no extra cloud credentials, and valid development-only keys.
5. Install isolated Builder and deployment workers plus independent QA. Bind
   candidate evidence to exact source commit and successful deployment ID.
6. Install authenticated approval intake, durable state branch, bounded queue
   ticks, deployment-complete handoff, QA-failure handback, monitoring and alerts.
7. Exercise a real synthetic change, an actual successful staging deployment,
   independent live QA, then one controlled QA failure and automatic recovery.
8. Install the scheduled regression workflow on the repository's default branch
   only after the credential and source gates pass. A schedule on a nondefault
   branch is not an active schedule. Do not claim offline PASS until a queued task
   advances on hosted runners with no local process.

## Audit, rollback, and limits

Persist state in the dedicated engineering state branch, with immutable QA
artifacts in Actions and commit/deployment references in state. No state branch
has been provisioned yet. Alerts must include the task and hosted run link, never
raw provider output or secret values. Preflight artifacts are retained for 30
days; durable candidate evidence must also be committed through the trusted
broker rather than relying on artifact retention alone.

For preparation-only changes, leave this branch unmerged. After activation,
disable scheduling/intake first, preserve all state/evidence, then roll staging
back to its recorded prior deployment. Never roll back report/version history or
modify production as part of engineering-worker recovery.

Known limits: model-backed Builder, hosted broker, live synthetic QA, staging
deployment adapter, operational triggers, alerts and scheduled regression remain
uninstalled. Local tests use simulated worker results and cannot prove live
deployment, QA, isolation or offline operation. After this system proves stable,
add a read-only security/regression auditor.
