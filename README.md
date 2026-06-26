# Shelter Prep

Vite React app for Shelter Prep intake, lead operations, files, invoices, labor/material memory, AI estimating, and report workflows.

## Local Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` for local development.

## Required Vite Env Vars

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ADMIN_PIN=
```

Optional AI agent vars:

```text
VITE_AGENT_API_URL=
VITE_AGENT_API_KEY=
```

When Supabase env vars are missing, the app runs in preview mode so StackBlitz can render the UI without white-screening. Data-backed actions will show setup messages until Supabase is configured.

## Property Lookup

Frontend property lookup calls the Supabase Edge Function:

```text
supabase/functions/property-lookup
```

Provider secrets belong in Supabase, not in Vite:

```text
PROPERTY_DATA_API_URL=
PROPERTY_DATA_API_KEY=
```

If the Edge Function or provider is not configured, the intake form falls back to report-ready placeholders.

## Pilot Roadmap

The two-week pilot strategy lives in:

```text
STRATEGIC_SUMMARY.md
PILOT_BUILD_PLAN.md
```

The first pilot migration adds property intelligence and contractor profile foundations:

```text
supabase/migrations/202605090001_property_intelligence_pilot.sql
```

## Active Branch

Use `full-agent-intake-report-api` for the current full-app work.

Do not use `shelter-prep-agent-intake`; that branch came from a small prototype copy.

## Build

```bash
npm run build
```

## Tests

```bash
npm test
```

The regression suite uses Node's built-in test runner and covers inspection scope bundling plus admin task draft-estimate safety.

## Security Agent

```bash
npm run security:agent
```

The security agent checks for hard-coded secrets, risky browser APIs, Supabase Edge Function guardrails, build health, and high-severity dependency audit findings. See `SECURITY_AGENT.md` for the production checklist.
