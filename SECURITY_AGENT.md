# Security Agent

This app has a lightweight local security agent that checks for the common risks most likely to hurt Shelter Prep:

- hard-coded secrets and private keys
- committed local env files
- risky browser APIs such as raw HTML rendering and dynamic code execution
- Supabase Edge Functions with permissive CORS or unclear authorization
- TypeScript/build failures
- high-severity dependency audit findings

Run it from the app folder:

```bash
npm run security:agent
```

Run only the dependency audit:

```bash
npm run security:audit
```

## Env Rules

Keep local values in `.env`; it is ignored by git.

Use `.env.example` only for placeholders and setup instructions. Anything named `VITE_*` is bundled into the browser, so never put private service-role keys, payment secrets, or admin-only API keys there.

Current public configuration:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ADMIN_PIN=
VITE_AGENT_API_URL=
VITE_AGENT_API_KEY=
```

`VITE_AGENT_API_KEY` is only acceptable as a short-term compatibility bridge because browser env vars are visible to users. The production-safe version is a server-side proxy through Supabase Edge Functions or Railway.

## Production Checklist

- Rotate any agent key that was ever hard-coded in source.
- Move privileged AI/Railway calls behind a server-side function before public launch.
- Restrict `Access-Control-Allow-Origin` on Supabase Edge Functions to the deployed app domain.
- Confirm Supabase Row Level Security policies for leads, files, invoices, profiles, and cost tables.
- Run `npm run security:agent` before deploys and whenever auth, storage, AI, or invoice code changes.
