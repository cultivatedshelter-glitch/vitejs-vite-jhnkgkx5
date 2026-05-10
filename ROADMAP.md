# Shelter Prep Roadmap

## Current Branch

Use `full-agent-intake-report-api`. Do not merge `shelter-prep-agent-intake`; that branch came from a small prototype copy.

## Now

- Verify StackBlitz loads the full app and shows the preview-mode banner when Supabase secrets are missing.
- Test `New Request` -> `Pull property info`.
- Add StackBlitz secrets when ready:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_ADMIN_PIN`
- Confirm real Supabase-backed actions show helpful errors rather than blank screens.

## Next Build Cycle

1. Property Lookup
   - Deploy `supabase/functions/property-lookup`.
   - Select a provider using cost, coverage, building facts, terms of use, and API reliability.
   - Add provider secrets in Supabase:
     - `PROPERTY_DATA_API_URL`
     - `PROPERTY_DATA_API_KEY`
   - Cache lookup results in Supabase to avoid repeated paid API calls.
   - Store lookup source, confidence, and timestamp for auditability.

2. Agent Intake Report
   - Add `Generate Agent Report` from dashboard cards.
   - Include property facts, photos/docs, scope notes, seller prep analysis, estimate summary, and human-review status.
   - Store report metadata in `generated_reports`.
   - Store generated PDFs in Supabase Storage with signed URLs.
   - Support versioning and regeneration.

3. Measurements / Takeoff
   - Add manual rows: item, quantity, unit, notes.
   - Save rows to a `measurements` table or structured JSON while the schema settles.
   - Feed measurements into estimator prompts and material list generation.

4. Supabase Hardening
   - Add/confirm tables:
     - `property_facts`
     - `measurements`
     - `generated_reports`
     - storage metadata for uploaded files
   - Enable Row Level Security on new tables.
   - Keep service-role keys server-side only.
   - Add updated-at triggers for records edited by humans or AI.

5. Testing / Observability
   - Add a small service-health panel for Supabase and property lookup.
   - Add an intake-to-report smoke test.
   - Track lookup success/failure and report-generation events.

## Later

- Contractor-facing report view.
- Seller-friendly report template.
- MLS/CRM integrations.
- Private developer-only competitor research dashboard.
- Scheduled health checks and background testing automation.
