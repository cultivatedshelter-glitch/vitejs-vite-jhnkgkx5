# External engineering automation preparation

Status: BLOCKED / NOT DEPLOYED.

This branch contains the bounded Builder proposal adapter, orchestration core,
GitHub-backed state adapter, read-only staging preflight, and a preparation
workflow. It does not contain an activated unattended Builder/deploy/QA loop.

Run `python3 -m unittest discover -s automation -p 'test_*.py' -v` for the 39
local tests. Model responses and worker results in tests are simulated. Actual
partial live results are recorded separately under `automation/evidence/` and
explicitly do not attest full QA PASS.

Read `DEPLOYMENT-GATES.md` for current infrastructure findings, exact credential
scopes, outstanding integration, monitoring, rollback, and release boundaries.
