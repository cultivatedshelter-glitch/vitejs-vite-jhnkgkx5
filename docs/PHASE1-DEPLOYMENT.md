# Shelter Prep Phase 1 Deployment

## Source Of Truth

- Repository: `cultivatedshelter-glitch/vitejs-vite-jhnkgkx5`
- Deployment branch: `shelter-prep-phase1-dev`
- Intended product domain: `https://shelterprep.com`
- Current development Supabase project: `oivzalfsjoyycbqunblk` (`shelter-prep-phase1-dev`)

The development Supabase project is verified for development and remote smoke testing only. Do not place real pilot-agent data in it or silently relabel it as production.

## Architecture

Use one Railway Docker service. The multi-stage `Dockerfile` builds the Vite application, installs the Node server and isolated Python dependencies, and serves the frontend plus `/api/phase1/*` from one origin. Railway supplies HTTPS, a temporary `.railway.app` domain, health checks, and the later custom-domain attachment.

The runtime uses:

- Vite/React static build
- existing Node Phase 1 processing service
- Python 3 with pinned `pypdf`, Pillow, and ReportLab dependencies
- Supabase Auth, Postgres, RLS, and private Storage
- Resend transactional email API
- request-driven historical weather retrieval already present in the Phase 1 reasoning boundary

## Required Variables

Browser-safe build variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Server-only runtime variables:

```text
SUPABASE_SECRET_KEY
SHELTER_PREP_REVIEW_EMAIL
SHELTER_PREP_EMAIL_FROM
SHELTER_PREP_PUBLIC_URL
RESEND_API_KEY
SHELTER_PREP_PYTHON
```

Railway supplies `PORT`. The container sets `SHELTER_PREP_PYTHON` to its private virtualenv. Never create `VITE_` variants of server secrets.

## Email

Resend is the Phase 1 provider. Verify a sending domain in Resend and set `SHELTER_PREP_EMAIL_FROM` to an address on that verified domain. Resend supplies the DNS values required for sender verification; add only those exact records.

The server reserves a unique outbox record for `(event_type, processing_request_id, recipient, email)` before delivery. Triggers are limited to:

- persisted transition to `needs_review`
- persisted transition to `failed`

Provider failures are stored as `failed`, do not change the processing result, and may be retried. Browser roles cannot read or write the outbox and no browser notification endpoint exists.

## Deploy

1. Create a separate production Supabase project after approval, then apply the verified Phase 1 migrations in order.
2. Create invite-only pilot and reviewer identities. Give the reviewer an existing `admin` profile role through a server-authoritative operation; do not expose role editing in the browser.
3. Configure Supabase Auth Site URL as `https://shelterprep.com`, add the temporary Railway HTTPS URL during smoke testing, and keep public signup disabled.
4. Create a Railway service from the GitHub repository and select branch `shelter-prep-phase1-dev`.
5. Add the required variables in Railway. Mark all server-only values as secrets. Set `SHELTER_PREP_PUBLIC_URL` to the temporary Railway URL for the first smoke test.
6. Generate a Railway domain and confirm `GET /healthz` returns HTTP 200.
7. Run the complete remote smoke test before attaching `shelterprep.com`.
8. Change `SHELTER_PREP_PUBLIC_URL` to `https://shelterprep.com`, configure the exact Railway-provided domain records, and update the Supabase Auth Site URL only after the temporary deployment passes.

## Domain

Do not remove or alter existing DNS until the temporary deployment passes. Railway will provide one `CNAME` record and one ownership-verification `TXT` record for the custom domain; both are required. Their hostnames and values are generated for the deployed service and cannot be known safely before the service exists.

## Smoke Test

Verify in order:

1. `GET /healthz` returns `status: ok` and `notifications: configured`.
2. Sign in with an invite-only pilot identity.
3. Resolve/create a Property and confirm a database UUID.
4. Upload a private non-fixture inspection PDF.
5. Confirm processing persists an artifact and reaches `needs_review`.
6. Confirm findings render through the existing adapter with no fixture label.
7. Confirm one `sent` outbox record and a provider message ID.
8. Open the email review link as the reviewer and confirm it loads the correct request.
9. Repeat unauthenticated, cross-user Property/evidence, private Storage, and trusted-review denial checks.
10. Scan the browser bundle and deployment logs for secret values.

## Rollback

Redeploy the previous known-good Railway deployment or previous commit from `shelter-prep-phase1-dev`. Do not force-push or rewrite Git history. The notification migrations are additive; leave outbox records in place during application rollback. If email must be stopped while processing remains available, remove the deployment from public traffic and redeploy the prior version rather than weakening database controls.
