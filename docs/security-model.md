# Shelter Prep Security Model

Canonical source: `/docs/SHELTER_PREP_MASTER_CODEX_PROMPT.md`.

This file extracts the security, access-control, server-authority, environment, and acceptance-test rules that control Phase 1 work.

## Core Principle

Security is not optional.

The founder is launching solo, so the product must be simple and safe enough to operate without a full engineering team.

Access is based on assignment and ownership, not vibes.

The browser may request an action. The server decides whether it is allowed.

## Core Security Rules

Use Supabase Auth.

Use a `profiles` table for app roles.

Use Row Level Security on every protected table.

Use private Supabase Storage buckets.

Use signed URLs for file access.

Use Edge Functions or RPC for sensitive actions.

Never trust the browser.

Never allow the browser to set protected fields like:

- `human_verified`
- `contractor_verified_structured_summary`
- `admin_verified_structured_summary`
- `memory_verified`
- `agent_visible`
- `approval_timestamp`
- `approved_by`
- `committed`
- `review_required = false`

## No Hardcoded Admin PIN

Do not use hardcoded admin PIN long-term.

Temporary demo PINs are acceptable only in local demos.

Production must use:

- Supabase Auth
- `profiles` table
- roles
- RLS policies
- server-side permission checks

## Roles

Use these app roles:

- `owner`
- `admin`
- `agent`
- `property_manager`
- `contractor`
- `seller_owner`
- `viewer`

Optional future roles:

- `reviewer`
- `estimator`
- `field_operator`
- `auditor`

## Assignment-Based Access

A user can only access a property if:

- they own it
- they created it
- they are assigned to it
- they are an admin/owner
- they have a specific report-level access grant

A contractor can only access:

- assigned contractor review session
- files explicitly linked to that assignment
- repair items explicitly included in that assignment
- upload fields for their own contribution

A contractor cannot see the whole property unless explicitly allowed.

## File Security

All uploads go to private buckets.

Recommended buckets:

- `property-files-private`
- `inspection-reports-private`
- `contractor-uploads-private`
- `report-exports-private`

Every file must have a database record. Do not rely only on storage path.

The `files` table must include:

- `id`
- `property_id`
- `work_request_id`
- `uploaded_by`
- `bucket`
- `storage_path`
- `original_filename`
- `file_type`
- `mime_type`
- `size_bytes`
- `upload_source`
- `visibility_scope`
- `created_at`
- `deleted_at`
- `checksum` optional
- `related_assignment_id` optional
- `related_repair_item_id` optional

File access must be logged.

The `file_access_events` table must include:

- `id`
- `file_id`
- `user_id`
- `access_type`
- `created_at`
- `ip_address` optional
- `user_agent` optional

## Signed URL Rules

Signed URLs must:

- be generated server-side or through a controlled RPC/Edge Function
- expire quickly
- be available only to authorized users
- never expose private bucket paths broadly
- be logged in `file_access_events`

## Audit Rules

Audit all major events:

- property created
- work request created
- file uploaded
- file opened
- AI output generated
- repair item edited
- contractor assignment created
- contractor link opened
- contractor upload submitted
- contractor response submitted
- AI structured contractor upload
- admin review started
- admin review approved
- admin edit made
- agent-facing output generated
- report generated
- memory candidate created
- memory approved
- user role changed

Do not allow destructive deletion for critical workflow data.

Use soft delete where possible.

## Data Minimization

Do not collect more sensitive data than necessary.

Avoid storing:

- unnecessary personal documents
- payment data
- passwords outside Supabase Auth
- full legal transaction files unless needed
- private seller/buyer information unrelated to repair coordination

## RLS Policy Requirements

Every protected table must have RLS enabled.

General rules:

- owner/admin can manage all
- agent can view own properties and granted properties
- PM can view assigned/owned portfolio
- contractor can only access assigned review/session data
- seller_owner can only view approved report-level data
- viewer has no protected access unless granted

Policy logic, expressed in plain language:

`profiles`:

- user can read own profile
- admin can read all
- only admin/owner can update roles

`properties`:

- admin/owner can select all
- creator can select own
- users in `property_access` can select
- only admin/owner/assigned manager can update

`work_requests`:

- same as property access
- insert allowed for authenticated agent/PM/admin
- update limited by role and assignment

`files`:

- admin can select all
- property-access users can select allowed files
- contractors can select files linked to their assignment
- signed URL generation must check permission first

`contractor_assignments`:

- admin can manage
- assigned contractor token can read only relevant assignment through controlled function
- agent can view assignments linked to their property if allowed

`structured_contractor_summaries`:

- admin can see drafts
- agent can see only `agent_visible = true`
- contractor can see summary only if linked and permitted
- browser cannot set admin-verified fields

`memory_candidates`:

- admin can create/review
- agents/contractors cannot create verified memory
- no public access

`workflow_events`:

- insert through server function
- select limited by property access
- no update/delete by normal users

## Edge Functions And Server Functions

Use server-side functions for sensitive actions.

Required functions:

`create_property_with_request`:

- Validates user and creates property/work request.

`upload_file_record`:

- Creates file metadata after storage upload and logs event.

`get_signed_file_url`:

- Checks access and returns short-lived signed URL.

`generate_inspection_findings`:

- Runs inspection agent and stores draft outputs.

`approve_repair_item`:

- Admin review function.

`create_contractor_assignment`:

- Creates assignment and secure token.

`contractor_submit_response`:

- Validates token and submits contractor response.

`contractor_upload_source`:

- Validates token, stores upload record, marks source evidence.

`structure_contractor_upload`:

- Runs AI on contractor source, creates draft structured summary.

`admin_verify_structured_summary`:

- Only admin can approve/edit structured contractor summary.

`make_summary_agent_visible`:

- Only after admin or contractor verification.

`create_memory_candidate`:

- Requires approved source and full provenance.

`log_workflow_event`:

- Immutable event logging helper.

## Environment Variables

Use `.env` locally and Vercel environment variables in deployment.

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` server only
- `OPENAI_API_KEY` server only
- `APP_BASE_URL`
- `SIGNED_URL_EXPIRY_SECONDS`
- `CONTRACTOR_LINK_EXPIRY_HOURS`

Never expose:

- service role key
- OpenAI key
- private webhook secrets
- admin secrets

Frontend may only use:

- Supabase URL
- Supabase anon key

## Solo Founder Security Checklist

Before pilot launch:

- Supabase Auth enabled
- RLS enabled on all tables
- anon key only in frontend
- service role key never exposed to browser
- private storage buckets used
- signed URLs working
- admin role created through secure method
- hardcoded PIN removed
- file access logged
- contractor links scoped and expiring
- no public bucket for private property documents
- environment variables set in Vercel
- no secrets committed to GitHub
- npm audit reviewed
- test user roles created
- test contractor cannot see unrelated property
- test agent cannot see unrelated property
- test seller cannot see draft/internal notes
- admin can revoke access

## Security Learning Path

Week 1 - Auth and Roles:

- Learn authentication, Supabase Auth, `profiles`, role-based access, and why app role is separate from login identity.
- Build login, logout, profile fetch, and admin role check.
- Test that admin sees the admin screen and agent does not.

Week 2 - RLS:

- Learn Row Level Security, why frontend checks are not enough, how policies control database access, and why the anon key is safe only with RLS.
- Build RLS on `properties`, RLS on `work_requests`, and `property_access`.
- Test that agent A cannot see agent B property and contractor cannot query unrelated data.

Week 3 - Storage Security:

- Learn public vs private buckets, signed URLs, file metadata table, and access logging.
- Build private upload, signed URL retrieval, and `file_access_events`.
- Test that direct public URL does not work, signed URL expires, and unauthorized user cannot generate signed URL.

Week 4 - Server Authority:

- Learn why the browser is untrusted, what Edge Functions do, service role key danger, and server-side validation.
- Build functions for approving repair items, contractor assignment, and signed URL retrieval.
- Test that browser cannot update `admin_verified` directly and malicious requests are rejected.

Week 5 - Audit Logs and Immutability:

- Learn `workflow_events`, audit trails, soft deletion, and why memory needs provenance.
- Build `workflow_events` insert helper, admin review events, and memory candidate provenance checks.
- Test that every major action creates an event and edits store previous and new values.

Week 6 - Secure Contractor Links:

- Learn token hashing, token expiration, scoped access, and revocation.
- Build contractor assignment token, no-login review link, token expiration, and token revocation.
- Test that expired links fail, contractor sees only assigned repair items, and revoked links fail.

## Non-Negotiable Security Acceptance Tests

Before real pilot:

1. Admin can create property.
2. Agent can create property.
3. Agent cannot see another agent's property.
4. Contractor cannot log in and browse properties.
5. Contractor review link only shows assigned items.
6. Contractor upload is stored as source evidence.
7. AI-structured contractor summary is draft.
8. Agent cannot see unverified contractor summary.
9. Browser cannot set `agent_visible` directly.
10. Browser cannot set `admin_verified_structured_summary` directly.
11. Admin can approve structured summary.
12. Approved summary becomes agent-visible through server function.
13. File uploads land in private bucket.
14. Admin can open file through signed URL.
15. Unauthorized user cannot open file.
16. Signed URL expires.
17. Every file access is logged.
18. Every admin approval is logged.
19. Memory candidate cannot be created without provenance.
20. No service role key exists in frontend bundle.
21. No admin PIN remains in production.
22. RLS is enabled on every protected table.
23. Test contractor cannot access unrelated assignment.
24. Test seller can only view approved report.
25. npm build passes.
26. Typecheck passes.
27. No secrets committed to GitHub.
