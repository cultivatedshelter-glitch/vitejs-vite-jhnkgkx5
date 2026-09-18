# Shelter Prep Phase 1 Local Runtime

## Source Of Truth

- Repository: `cultivatedshelter-glitch/vitejs-vite-jhnkgkx5`
- Branch: `shelter-prep-phase1-dev`
- Authorized development Supabase project: `oivzalfsjoyycbqunblk` (`shelter-prep-phase1-dev`)

Do not use stale StackBlitz copies as a source of truth. Start from the branch above.

## Required Environment

Create ignored `.env.local` entries for these names:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SECRET_KEY=
PHASE1_TEST_EMAIL=
PHASE1_TEST_PASSWORD=
SHELTER_PREP_REVIEW_EMAIL=
SHELTER_PREP_EMAIL_FROM=
SHELTER_PREP_PUBLIC_URL=
RESEND_API_KEY=
```

`SUPABASE_SECRET_KEY` is server-only. Never prefix it with `VITE_`, place it in browser code, print it, or commit it. `.env.local` is ignored by Git through the repository's `*.local` rule.

`PHASE1_TEST_EMAIL` and `PHASE1_TEST_PASSWORD` are optional pilot credentials used only by the test-user provisioning command. They are not Vite variables and are not bundled into browser code.

The four notification variables are server-only. When all are configured, the processing server sends one idempotent admin email through Resend when a request reaches `needs_review`, and one when processing reaches `failed`. Local processing remains usable when notification configuration is absent; production startup fails closed when any notification variable is missing.

## Pilot Sign-In

Provision or reset one confirmed test identity in the authorized development project:

```bash
npm run auth:phase1:test-user
```

Open the app and sign in with the `PHASE1_TEST_EMAIL` and `PHASE1_TEST_PASSWORD` values from ignored `.env.local`. The Phase 1 UI supports only email/password sign-in and sign-out. It does not expose signup, password reset, role management, or service-role credentials.

Supabase persists the browser session. Retained Property context is accepted only when its stored user ID matches the authenticated session; signing out or changing users clears that context before evidence can be attached.

## Setup And Start

Install Node dependencies and the isolated Python runtime dependencies:

```bash
npm run setup:phase1
```

Start the frontend and processing server together:

```bash
npm run dev:phase1
```

The launcher checks that all required variables exist, refuses any Supabase project other than `oivzalfsjoyycbqunblk`, validates public and server connectivity, selects `.venv/bin/python3`, and starts both existing commands.

The individual commands remain available:

```bash
npm run dev
SHELTER_PREP_PYTHON=.venv/bin/python3 npm run dev:processing
```

## Verification

```bash
npm test
npm run build
node --test scripts/phase1-*.test.mjs
git diff --check
```

The repository does not define a lint command.

Phase 1 processing persists a server-controlled `needs_review` pipeline state and a draft model artifact after reasoning completes. When notification variables are configured, that persisted transition triggers the server-side reviewer email.
Phase 1 review notifications are persisted in `public.phase1_notifications`. Browser roles have explicit deny policies and no table grants. Delivery failure is recorded without invalidating a completed reasoning artifact, and a later notification attempt may retry the failed outbox record.
