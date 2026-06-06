# Shelter Prep — Master Codex Prompt, Product Doctrine, Agent Architecture, and Solo Security Guide

## Purpose of This Document

This document is the canonical operating prompt for building Shelter Prep.

Codex must treat this document as the controlling product, architecture, security, and implementation guide unless a newer explicit instruction says otherwise.

Shelter Prep must be built as a focused, solo-operable MVP first.

The founder plans to launch solo, operate manually where needed, and learn security while building. Therefore:

* keep the architecture simple
* keep the product focused
* keep all security rules explicit
* avoid unnecessary automation
* avoid building future features too early
* preserve human review
* make every important action auditable

Do not build a giant fantasy SaaS cathedral.

Build the trust spine first.

---

# 1. Core Thesis

Shelter Prep is operational infrastructure for property repair coordination.

It helps real estate agents, property managers, sellers, and contractors turn messy real-world repair inputs into structured workflows, human-reviewed scopes, contractor-ready work packages, seller-prep recommendations, and reusable operational memory.

Those inputs include:

* inspection reports
* photos
* notes
* field conditions
* access constraints
* material usage
* contractor feedback
* pricing decisions
* contractor-authored estimates
* seller priorities
* completed outcomes

The core problem is not simply estimating.

The real problem is:

Property repair coordination is fragmented, manual, and full of hidden field variables.

Shelter Prep turns real-world repair chaos into organized operational intelligence.

Shortest positioning:

Repair coordination without the chaos.

Professional positioning:

Operational infrastructure for seller prep, repair coordination, and property work intelligence.

Founder/investor positioning:

Shelter Prep is building the operating layer for property repair coordination. It turns inspection reports, photos, field notes, contractor-authored scopes, job-site activity, pricing corrections, seller decisions, and completed outcomes into structured repair workflows, human-reviewed scopes, contractor-ready work packages, seller-prep reports, and reusable operational memory.

---

# 2. Product Is Not AI

Shelter Prep is not an AI product.

AI is infrastructure inside the system.

The product is:

* organized repair coordination
* field intelligence
* contractor-authored scope capture
* pricing memory
* workflow clarity
* human-verified scope decisions
* seller-prep decision support
* contractor routing
* property-centered operational memory

AI may assist with:

* organizing photos
* summarizing inspection items
* suggesting repair categories
* identifying missing information
* drafting scope structure
* structuring contractor-uploaded estimates
* retrieving similar past jobs
* surfacing prior human corrections
* preparing draft reports

AI may not:

* approve estimates
* send proposals automatically
* purchase materials
* finalize pricing
* replace contractor/admin review
* communicate autonomously with clients
* approve contractor bids
* turn unverified lessons into permanent memory
* expose protected data to unauthorized users

Governing phrase:

Powered by AI. Approved by humans.

Stronger internal doctrine:

AI notices. Humans approve. Contractors author professional scope. Shelter Prep verifies. Memory learns only from approved outcomes.

---

# 3. Real-Life Intelligence Principle

Shelter Prep brings real-life field intelligence into AI.

Most AI starts from internet abstraction and tries to infer reality.

Shelter Prep starts from reality and uses AI to organize it.

The system should learn from:

* actual properties
* actual repair conditions
* actual photos
* actual inspection reports
* actual job-site constraints
* actual contractor judgment
* actual contractor-uploaded estimates
* actual material usage
* actual pricing corrections
* actual project timelines
* actual seller decisions
* actual completed outcomes

The strongest form of Shelter Prep is not:

AI estimates repair work.

It is:

Real repair work teaches the system what matters.

AI supports the system in the background.

Human-verified reality is the source of truth.

---

# 4. Product Philosophy

## 4.1 Property Is the Center

Everything attaches to the Property.

Property contains:

* work requests
* photos
* files
* inspection reports
* repair items
* job execution steps
* estimates
* contractor assignments
* contractor-uploaded documents
* contractor feedback
* job sessions
* daily logs
* pricing decisions
* seller reports
* verified lessons
* memory candidates

The user should think:

Start property → upload inspection/photos → organize repairs → send for contractor input → review scope → generate seller-ready direction → save verified memory.

Not:

Open AI estimator → open pricing module → open contractor module → open report module.

Modules should exist underneath the workflow, not as visible complexity.

## 4.2 One Obvious Next Action

Every screen must answer:

What should I do next?

Examples:

* Start New Property
* Upload Inspection
* Upload Photos
* Review Repair Items
* Send for Contractor Input
* Review Contractor Upload
* Approve Structured Scope
* Generate Seller Summary
* Save Memory Candidate
* Close Request

Avoid cluttered dashboards and visible machinery.

## 4.3 Calm Operational Compression

Shelter Prep should feel:

* calm
* simple
* professional
* mobile-first
* low-friction
* field-aware
* trustworthy
* organized

Avoid:

* dense dashboards
* too many modules
* AI-heavy language
* construction software clutter
* giant tables
* overcomplicated navigation
* too many visible statuses
* pretending the AI is the authority

The user should feel:

Finally, this repair chaos is organized.

---

# 5. The Updated Phase 1 Wedge

The Phase 1 wedge is:

Inspection upload → organized findings → contractor input → admin-verified structured scope → seller-ready repair direction.

Phase 1 is not merely:

Agent uploads inspection and receives AI summary.

That is too weak.

The stronger loop is:

1. Agent uploads inspection.
2. Shelter Prep extracts and organizes findings.
3. Agent selects items needing contractor input.
4. Contractor receives a no-login scoped review link.
5. Contractor can review the Shelter Prep draft and/or upload their own estimate or scope.
6. AI structures the contractor-uploaded source.
7. Shelter Prep admin verifies the structured version.
8. Agent receives contractor-informed repair direction.
9. Seller-ready summary can be generated.
10. Approved outputs may become memory candidates with full provenance.

Primary Phase 1 North Star:

How fast can Shelter Prep turn an inspection report into contractor-informed, admin-verified repair direction?

Primary adoption signal:

An agent or PM uses Shelter Prep again to get contractor input on another inspection, repair scope, or work request.

Not just file upload.

Confirmed or contractor-informed scope is the business signal.

---

# 6. Contractor Scope Principle

Lock this sentence everywhere:

Contractors author scope. AI structures it. Shelter Prep verifies it. Agents use it. Memory learns from approved outcomes.

This is the cleanest product description.

It avoids:

* AI replacing contractors
* agents pretending to be contractors
* contractors being treated like inventory
* Shelter Prep becoming a lead marketplace
* unverified AI becoming memory

## 6.1 Contractor UX Rule

The contractor review session must support both paths in one flow.

Path A: Review Shelter Prep Draft

Actions:

* Looks Right
* Needs Correction
* Need Walkthrough
* Cannot Determine From Provided Info

Path B: Upload My Estimate / Scope

Allowed uploads:

* PDF estimate
* image/photo of estimate
* text notes
* invoice draft
* contractor-generated scope document

The contractor must be able to do both in the same session:

* review the Shelter Prep draft
* decide it is incomplete or wrong
* upload their own estimate or scope instead

Do not force the contractor to choose a mode upfront.

## 6.2 Verification Doctrine

Contractor Uploaded does not equal Contractor Verified Summary.

Schema must preserve this distinction.

A contractor-uploaded source is evidence.

An AI-structured summary of that source is a draft.

The summary is not contractor-verified unless the contractor explicitly confirms it.

In Phase 1, Shelter Prep admin/operator holds the verification gate before agent-facing use.

Only admin-verified or contractor-verified structured outputs may become memory candidates.

Memory candidates require full provenance.

No provenance, no memory.

---

# 7. Detective Doctrine

Shelter Prep should behave like a detective, not a dictator.

The app should not say:

AI determined the deck must be replaced.

The app should say:

Clues detected:

* visible rot at lower post base
* missing post-to-footing connection
* water staining present
* prior repair visible
* guardrail movement possible

Suggested next investigation:

* probe wood condition
* verify footing attachment
* photograph opposite side
* check guardrail rigidity
* send to contractor for scope input

Core detective model:

Observation → Interpretation → Missing Info → Reviewer → Decision → Outcome → Memory

AI collects and organizes clues.

Contractors add field judgment.

Admin verifies structure.

Agents use the result.

Memory learns only from approved outcomes.

## 7.1 Detective Questions Every Agent Should Ask

For every repair item:

* What was observed?
* What evidence supports it?
* What is known?
* What is unknown?
* What could be hidden?
* What trade should review it?
* What happens if ignored?
* Is this safety-related?
* Is this moisture-related?
* Is this cosmetic?
* Is this likely repair, credit, monitor, or optional?
* What photos are missing?
* What contractor input is needed?
* Who owns the next decision?
* What can be said confidently?
* What must remain marked as uncertain?
* What should the seller understand?
* What should the agent not overclaim?
* What should become memory later?
* What must never become memory yet?

---

# 8. User Types and Roles

## 8.1 Admin / Shelter Prep Operator

The admin is the Phase 1 control tower.

Admin can:

* manage all properties
* review all files
* approve or reject AI outputs
* assign contractors
* verify structured contractor summaries
* approve agent-facing reports
* create memory candidates
* approve memory candidates
* manage users and roles
* audit events
* override statuses

Admin must not be bypassed for critical Phase 1 outputs.

## 8.2 Agent

Agent can:

* create properties
* upload inspection reports
* upload photos
* select items needing contractor input
* view approved repair roadmap
* view contractor-informed scope after admin verification
* view seller-ready report
* add client/seller notes
* request contractor review

Agent cannot:

* verify contractor scope
* approve pricing memory
* modify protected contractor-uploaded source
* see unrelated properties
* bypass admin review
* treat AI drafts as final

## 8.3 Property Manager

Property manager can:

* create and manage assigned properties
* upload maintenance requests
* upload photos/files
* assign or request contractor input if permitted
* view status timeline
* view approved scopes and reports
* track recurring issues

Property manager cannot:

* see unrelated properties
* approve global memory unless authorized
* access private admin audit tools

## 8.4 Contractor

Contractor is a scoped workflow participant, not an open marketplace bidder.

Contractor can:

* access assigned review link
* review selected scope items
* upload own estimate/scope
* mark Looks Right
* mark Needs Correction
* request walkthrough
* say Cannot Determine From Provided Info
* add notes/files/photos
* later, in Phase 2, confirm AI-structured summary directly

Contractor cannot:

* browse unrelated properties
* see unrelated client information
* edit protected scope fields directly
* influence pricing memory automatically
* approve memory directly
* view admin-only notes
* become a marketplace participant by default

## 8.5 Seller / Owner

Seller/owner can:

* view approved seller-facing report
* review budget notes
* see repair-vs-credit recommendations
* approve seller decisions if workflow supports it

Seller/owner cannot:

* edit contractor pricing
* access contractor private notes unless exposed
* see admin-only drafts
* approve operational memory

---

# 9. Security Model

Security is not optional.

The founder is launching solo, so the product must be simple and safe enough to operate without a full engineering team.

## 9.1 Core Security Rules

Use Supabase Auth.

Use profiles table for app roles.

Use Row Level Security on every protected table.

Use private Supabase Storage buckets.

Use signed URLs for file access.

Use Edge Functions or RPC for sensitive actions.

Never trust the browser.

Never allow the browser to set protected fields like:

* human_verified
* contractor_verified_structured_summary
* admin_verified_structured_summary
* memory_verified
* agent_visible
* approval_timestamp
* approved_by
* committed
* review_required = false

The browser may request an action.

The server decides whether it is allowed.

## 9.2 No Hardcoded Admin PIN

Do not use hardcoded admin PIN long-term.

Temporary demo PINs are acceptable only in local demos.

Production must use:

* Supabase Auth
* profiles table
* roles
* RLS policies
* server-side permission checks

## 9.3 Roles

Use these app roles:

* owner
* admin
* agent
* property_manager
* contractor
* seller_owner
* viewer

Optional future roles:

* reviewer
* estimator
* field_operator
* auditor

## 9.4 Security Principle

Access is based on assignment and ownership, not vibes.

A user can only access a property if:

* they own it
* they created it
* they are assigned to it
* they are an admin/owner
* they have a specific report-level access grant

A contractor can only access:

* assigned contractor review session
* files explicitly linked to that assignment
* repair items explicitly included in that assignment
* upload fields for their own contribution

A contractor cannot see the whole property unless explicitly allowed.

## 9.5 File Security

All uploads go to private buckets.

Recommended buckets:

* property-files-private
* inspection-reports-private
* contractor-uploads-private
* report-exports-private

Every file must have a database record.

Do not rely only on storage path.

files table must include:

* id
* property_id
* work_request_id
* uploaded_by
* bucket
* storage_path
* original_filename
* file_type
* mime_type
* size_bytes
* upload_source
* visibility_scope
* created_at
* deleted_at
* checksum optional
* related_assignment_id optional
* related_repair_item_id optional

File access must be logged.

file_access_events table:

* id
* file_id
* user_id
* access_type
* created_at
* ip_address optional
* user_agent optional

## 9.6 Signed URL Rules

Signed URLs must:

* be generated server-side or through a controlled RPC/Edge Function
* expire quickly
* be available only to authorized users
* never expose private bucket paths broadly
* be logged in file_access_events

## 9.7 Audit Rules

Audit all major events:

* property created
* work request created
* file uploaded
* file opened
* AI output generated
* repair item edited
* contractor assignment created
* contractor link opened
* contractor upload submitted
* contractor response submitted
* AI structured contractor upload
* admin review started
* admin review approved
* admin edit made
* agent-facing output generated
* report generated
* memory candidate created
* memory approved
* user role changed

Do not allow destructive deletion for critical workflow data.

Use soft delete where possible.

## 9.8 Data Minimization

Do not collect more sensitive data than necessary.

Avoid storing:

* unnecessary personal documents
* payment data
* passwords outside Supabase Auth
* full legal transaction files unless needed
* private seller/buyer information unrelated to repair coordination

## 9.9 Solo Founder Security Checklist

Before pilot launch:

* Supabase Auth enabled
* RLS enabled on all tables
* anon key only in frontend
* service role key never exposed to browser
* private storage buckets used
* signed URLs working
* admin role created through secure method
* hardcoded PIN removed
* file access logged
* contractor links scoped and expiring
* no public bucket for private property documents
* environment variables set in Vercel
* no secrets committed to GitHub
* npm audit reviewed
* test user roles created
* test contractor cannot see unrelated property
* test agent cannot see unrelated property
* test seller cannot see draft/internal notes
* admin can revoke access

---

# 10. Recommended Supabase Tables

Build these in phases. Do not build all UI at once.

## 10.1 profiles

Purpose: attach app roles to Supabase users.

Fields:

* id uuid primary key references auth.users(id)
* email text
* full_name text
* role text check in owner/admin/agent/property_manager/contractor/seller_owner/viewer
* company_name text
* phone text
* created_at timestamptz
* updated_at timestamptz
* active boolean default true

## 10.2 properties

Fields:

* id uuid primary key
* created_at timestamptz
* created_by uuid
* address_line1 text
* address_line2 text
* city text
* state text
* zip text
* property_type text
* owner_name text
* agent_id uuid
* property_manager_id uuid
* status text
* notes text

## 10.3 property_access

Purpose: explicit access grants.

Fields:

* id uuid primary key
* property_id uuid
* user_id uuid
* role_on_property text
* access_level text
* created_by uuid
* created_at timestamptz
* revoked_at timestamptz

## 10.4 work_requests

Fields:

* id uuid primary key
* property_id uuid
* created_by uuid
* requester_name text
* requester_email text
* requester_phone text
* request_type text
* urgency text
* occupancy text
* description text
* status text
* secondary_flags text[]
* budget_concern text
* review_owner_type text
* created_at timestamptz
* updated_at timestamptz

## 10.5 files

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* uploaded_by uuid
* bucket text
* storage_path text
* original_filename text
* mime_type text
* file_type text
* size_bytes bigint
* visibility_scope text
* upload_source text
* related_assignment_id uuid
* related_repair_item_id uuid
* created_at timestamptz
* deleted_at timestamptz

## 10.6 file_access_events

Fields:

* id uuid primary key
* file_id uuid
* user_id uuid
* access_type text
* created_at timestamptz
* metadata jsonb

## 10.7 inspection_reports

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* file_id uuid
* uploaded_by uuid
* report_date date
* inspector_name text
* inspection_company text
* extraction_status text
* review_status text
* created_at timestamptz

## 10.8 evidence_items

Purpose: no source, no claim.

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* source_type text
* source_file_id uuid
* source_excerpt text
* observation text
* claim_type text
* confidence text
* requires_field_verification boolean
* created_by_agent text
* created_at timestamptz

## 10.9 repair_items

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* inspection_report_id uuid
* title text
* plain_language_issue text
* trade_category text
* severity text
* urgency text
* safety_concern boolean
* moisture_concern boolean
* likely_hidden_damage text
* missing_info_questions text[]
* recommended_next_action text
* repair_vs_credit_recommendation text
* review_status text
* contractor_review_needed boolean
* evidence_ids uuid[]
* created_at timestamptz
* updated_at timestamptz

## 10.10 operational_bundles

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* title text
* bundle_type text
* related_repair_item_ids uuid[]
* operational_interpretation text
* transaction_concern_level text
* likely_trade_needed text
* next_verification_step text
* contractor_review_needed boolean
* review_status text
* created_at timestamptz

## 10.11 contractor_assignments

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* contractor_id uuid nullable
* contractor_name text
* contractor_email text
* contractor_phone text
* assignment_status text
* access_token_hash text
* token_expires_at timestamptz
* assigned_by uuid
* assigned_at timestamptz
* revoked_at timestamptz

## 10.12 contractor_review_sessions

Fields:

* id uuid primary key
* contractor_assignment_id uuid
* opened_at timestamptz
* contractor_contact_email text
* status text
* can_upload_scope boolean default true
* can_review_draft boolean default true
* phase2_confirmation_placeholder_visible boolean default true
* created_at timestamptz

## 10.13 contractor_responses

Fields:

* id uuid primary key
* contractor_assignment_id uuid
* repair_item_id uuid nullable
* response_type text check in looks_right/needs_correction/need_walkthrough/cannot_determine/uploaded_scope
* notes text
* created_at timestamptz
* submitted_by_name text
* submitted_by_email text

## 10.14 contractor_uploaded_sources

Purpose: contractor-authored estimate/scope source evidence.

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* contractor_assignment_id uuid
* contractor_id uuid nullable
* source_file_id uuid nullable
* source_text text nullable
* source_type text
* source_uploaded_by text
* source_uploaded_at timestamptz
* contractor_uploaded_source boolean default true
* contractor_verified_ai_summary boolean default false
* created_at timestamptz

## 10.15 structured_contractor_summaries

Purpose: AI-structured contractor upload.

Fields:

* id uuid primary key
* contractor_uploaded_source_id uuid
* property_id uuid
* work_request_id uuid
* ai_structured_from_contractor_source boolean default true
* original_ai_summary jsonb
* structured_line_items jsonb
* labor_assumptions jsonb
* material_assumptions jsonb
* exclusions text[]
* notes text
* admin_review_required boolean default true
* admin_verified_structured_summary boolean default false
* contractor_verified_structured_summary boolean default false
* agent_visible boolean default false
* review_status text default 'needs_admin_review'
* created_at timestamptz
* updated_at timestamptz

## 10.16 admin_review_events

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* reviewed_object_type text
* reviewed_object_id uuid
* reviewer_id uuid
* review_action text
* previous_value jsonb
* new_value jsonb
* reason text
* created_at timestamptz

## 10.17 job_execution_steps

Fields:

* id uuid primary key
* repair_item_id uuid
* property_id uuid
* work_request_id uuid
* step_number integer
* title text
* labor_scope text
* trade text
* estimated_hours_low numeric
* estimated_hours_high numeric
* materials_tools text[]
* equipment text[]
* safety_notes text
* access_notes text
* cleanup_notes text
* disposal_needed boolean
* confidence text
* review_status text
* created_at timestamptz

## 10.18 estimate_items

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* repair_item_id uuid
* source_type text
* source_id uuid
* description text
* labor_hours_low numeric
* labor_hours_likely numeric
* labor_hours_high numeric
* material_cost_low numeric
* material_cost_high numeric
* total_low numeric
* total_high numeric
* review_owner_type text
* review_status text
* approved_by uuid
* approved_at timestamptz
* created_at timestamptz

## 10.19 reports

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* report_type text
* report_status text
* generated_from_verified_only boolean
* content jsonb
* created_by uuid
* created_at timestamptz

## 10.20 memory_candidates

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* contractor_id uuid nullable
* source_document_id uuid
* source_document_type text
* source_uploaded_by text
* source_uploaded_at timestamptz
* ai_structured_output_id uuid
* original_ai_summary jsonb
* admin_reviewed_summary jsonb
* admin_reviewer_id uuid
* admin_review_status text
* admin_edit_history jsonb
* approval_timestamp timestamptz
* related_repair_item_ids uuid[]
* related_evidence_ids uuid[]
* confidence_level text
* memory_scope_recommendation text
* memory_status text default 'needs_review'
* created_at timestamptz

## 10.21 memory_records

Fields:

* id uuid primary key
* memory_candidate_id uuid
* title text
* lesson text
* applies_when text
* does_not_apply_when text
* memory_scope text
* authority_level text
* verified_by uuid
* verified_at timestamptz
* active boolean default true
* created_at timestamptz

## 10.22 workflow_events

Immutable event log.

Fields:

* id uuid primary key
* property_id uuid
* work_request_id uuid
* actor_id uuid nullable
* actor_type text
* event_type text
* event_title text
* event_body text
* object_type text
* object_id uuid
* metadata jsonb
* created_at timestamptz

---

# 11. Agent Architecture

Agents are not autonomous employees.

Agents are controlled functions that create draft outputs.

Every consequential output requires human review.

Do not build agent chaos.

Build explicit, button-triggered agent runs.

## 11.1 Agent Run Rules

No always-on agents.

No background agent debate.

No agents approving each other.

No agent writes directly to verified tables.

No automatic memory commitment.

No model output becomes agent-visible or seller-visible without review gate.

Agent output must include:

* source inputs
* evidence_ids
* assumptions
* confidence
* missing information
* review_required
* review_owner
* draft status
* created_at
* prompt_version

## 11.2 Core Agent States

Use a shared lifecycle:

* idle
* queued
* running
* failed
* draft_created
* needs_review
* admin_reviewing
* edited
* approved
* rejected
* superseded
* archived

Never skip needs_review for consequential outputs.

## 11.3 Review Statuses

Use these review statuses:

* ai_draft
* needs_review
* human_reviewed
* human_verified
* contractor_uploaded_source
* ai_structured_from_contractor_source
* admin_verified_structured_summary
* contractor_verified_structured_summary
* agent_visible
* memory_candidate
* memory_verified
* rejected
* deprecated

## 11.4 Intake Agent

Purpose:

Turns messy input into structured property/work-request data.

Inputs:

* property address
* request description
* inspection report
* photos
* files
* agent notes
* PM notes

Outputs:

* property summary
* work request summary
* missing information
* recommended next action
* likely workflow type
* review_required = true

Questions:

* What is the property?
* Who submitted this?
* What is being requested?
* Is this inspection-driven, maintenance-driven, seller-prep, turnover, or emergency?
* What files are attached?
* What information is missing?
* What is the next safest action?

## 11.5 Inspection Intelligence Agent

Purpose:

Interpret inspection reports proficiently, not merely summarize them.

Inputs:

* inspection PDF/text
* property record
* uploaded photos/files
* admin notes

Outputs:

1. Property summary
2. Inspection metadata
3. Extracted findings
4. Operational bundles
5. Priority repair roadmap
6. Missing information list
7. Contractor review recommendations
8. Evidence-linked observations

For each extracted finding:

* original report excerpt
* plain-language issue
* trade category
* severity
* urgency
* safety concern true/false
* moisture concern true/false
* likely hidden damage
* missing information questions
* recommended next action
* repair vs credit recommendation
* confidence
* evidence_ids
* review_status = needs_review

Operational bundle examples:

* Roof / water intrusion
* Exterior envelope / moisture
* Electrical safety
* Plumbing risk
* HVAC / ventilation
* Structural / framing
* Drainage / grading
* Safety / habitability
* Cosmetic / deferred maintenance

Priority roadmap:

* Must Address
* Needs Contractor Review
* Negotiation / Credit Candidate
* Maintenance / Monitor
* Cosmetic / Optional

Key question:

What does this inspection item mean operationally, and who needs to verify it?

## 11.6 Photo Interpreter Agent

Purpose:

Read photos as field evidence, not just images.

Inputs:

* uploaded photos
* property context
* repair items
* admin notes

Outputs:

* what photo shows
* trade category
* equipment seen
* visible damage
* access constraints
* possible hidden labor
* field consequence
* estimate impact
* required follow-up photos
* confidence
* evidence_ids
* review_status = needs_review

Questions:

* What is visible?
* What is not visible?
* What field consequence might this imply?
* What line items could be missing?
* What should a contractor verify?
* What should never be claimed from this photo alone?

## 11.7 Scope Drafting Agent

Purpose:

Turn reviewed findings into draft repair scopes.

Inputs:

* repair items
* evidence items
* photo observations
* inspection findings
* contractor notes if available

Outputs:

* draft scope by repair item
* included work
* excluded work
* assumptions
* missing info
* trade needed
* contractor review needed
* review_status = needs_review

Questions:

* What work appears required?
* What assumptions are being made?
* What must be excluded until verified?
* What should the contractor confirm?
* What should the agent tell the seller?

## 11.8 Job Execution Scope Agent

Purpose:

Create step-by-step job execution logic.

Outputs per repair item:

* step number
* title
* labor scope
* trade/skill
* estimated labor hours low/high
* materials/tools
* equipment
* safety notes
* access notes
* cleanup/disposal
* confidence
* review status

Questions:

* What has to happen before the visible repair?
* What protection/setup is needed?
* What sequence matters?
* What cleanup is usually forgotten?
* What access constraint changes labor?
* What could cause rework?

## 11.9 Gap Detection Agent

Purpose:

Find missing information that blocks reliable scope.

Outputs:

* missing photos
* missing measurements
* missing access notes
* missing contractor confirmation
* missing permit/code questions
* missing seller decision
* missing budget context

Questions:

* What do we need to know before pricing?
* What do we need before contractor review?
* What do we need before seller report?
* What do we need before work starts?
* What unknown could create cost drift?

## 11.10 Contractor Input Structuring Agent

Purpose:

Convert contractor-authored source into structured data.

Inputs:

* contractor-uploaded PDF/image/text
* contractor notes
* related repair items
* related inspection excerpts
* property context

Outputs:

* structured line items
* labor assumptions
* material assumptions
* exclusions
* warranty notes
* walkthrough requirements
* missing information
* price range if present
* source references
* review_status = needs_admin_review

Critical rule:

Do not mark as contractor verified unless contractor explicitly confirms structured summary.

In Phase 1, admin verification is required before agent-facing use.

Questions:

* What did the contractor actually include?
* What did the contractor exclude?
* What labor is implied?
* What materials are specified?
* What is ambiguous?
* What needs admin review?
* What should the agent see only after verification?

## 11.11 Seller Prep Agent

Purpose:

Turn verified repair data into seller-ready decision support.

Inputs:

* reviewed repair items
* contractor-informed scope
* estimate ranges if approved
* agent notes
* seller budget concern

Outputs:

* must-fix list
* repair-vs-credit candidates
* optional items
* monitor/defer items
* seller explanation
* risks if ignored
* contractor review status
* missing info
* report draft

Questions:

* What matters most to the transaction?
* What can likely be deferred?
* What should become a credit?
* What needs contractor verification?
* What should the seller understand without panic?
* What should the agent not overpromise?

## 11.12 Report Drafting Agent

Purpose:

Generate reports only from approved or clearly labeled draft data.

Report types:

* seller summary
* contractor scope packet
* inspection response summary
* completed work report

Rules:

* show status labels
* separate known vs unknown
* cite evidence
* show review status
* do not imply AI certainty
* do not include rejected items
* do not use unverified memory as fact

## 11.13 Memory Candidate Agent

Purpose:

Prepare memory candidates only after approval.

Inputs:

* approved repair item
* contractor correction
* admin-reviewed summary
* outcome data
* estimate adjustment
* evidence_ids

Outputs:

* proposed memory lesson
* applies_when
* does_not_apply_when
* source provenance
* confidence level
* memory_scope recommendation
* memory_status = needs_review

Questions:

* What did we learn?
* Where does it apply?
* Where does it not apply?
* Who verified it?
* What evidence supports it?
* What future agent should retrieve it?
* Is this project-specific or reusable?

---

# 12. Source Research Rules

External research is allowed only as admin-directed research.

Flow:

1. Admin asks a specific question.
2. Admin selects source categories.
3. Agent researches only inside selected scope.
4. Agent returns source-backed draft.
5. Admin reviews.
6. Only approved conclusions become memory.

Source priority:

1. Uploaded evidence
2. Extracted report text
3. Property facts
4. Admin notes
5. Prior verified findings
6. Shelter Prep memory
7. Official jurisdiction/code sources
8. Manufacturer documentation
9. Supplier pages
10. General web only if explicitly allowed

Rules:

* Do not claim code requirement unless source is official or clearly labeled.
* Do not treat supplier prices as final pricing.
* Do not treat web results as verified.
* Do not save internet lessons as memory without human approval.
* All research output remains needs_review until approved.

Product phrase:

Admin-directed intelligence. Human-verified memory.

---

# 13. Workflow Status Model

Keep visible statuses simple.

Primary visible statuses:

* New
* In Progress
* Ready
* Done

Secondary flags:

* Needs Info
* Needs Review
* Contractor Assigned
* Contractor Requested Walkthrough
* Contractor Uploaded Scope
* AI Structured Contractor Upload
* Admin Review Required
* Admin Verified
* Agent Visible
* Estimate Drafted
* Seller Report Ready
* Blocked
* Memory Candidate

This keeps the app calm while preserving operational detail underneath.

---

# 14. Phase 1 Build Order

Do not build flashy AI first.

Build in this order.

## Stage 0 — Repo Canon

Create:

* AGENTS.md
* docs/master-plan.md
* docs/phase-1-executable-spec.md
* docs/security-model.md
* docs/agent-architecture.md
* docs/schema-plan.md

## Stage 1 — App Stabilization

Goal:

* App.tsx under 300 lines
* screens moved to pages
* components extracted
* Supabase client isolated
* no behavior changes
* build passes
* typecheck passes

## Stage 2 — Supabase Auth and Profiles

Build:

* Supabase Auth
* profiles table
* role assignment
* current user helper
* no hardcoded admin PIN

Acceptance:

* admin can log in
* agent can log in
* contractor can access assigned link later
* role appears in profile

## Stage 3 — Properties and Work Requests

Build:

* properties table
* work_requests table
* property_access table
* basic create/view/update

Acceptance:

* agent/admin can create property
* work request attaches to property
* unauthorized user cannot view unrelated property

## Stage 4 — Private File Upload

Build:

* private buckets
* files table
* upload component
* signed URL retrieval
* file_access_events

Acceptance:

* upload inspection PDF
* upload photos
* admin opens files
* unauthorized user cannot open files
* access logged

## Stage 5 — Inspection Intelligence Draft

Build:

* inspection_reports table
* evidence_items table
* repair_items table
* explicit Generate Repair Items button
* save output as draft
* admin review screen

Acceptance:

* admin triggers AI
* AI creates draft findings
* every claim has evidence/source link
* outputs are needs_review
* admin can approve/edit/reject

## Stage 6 — Operational Bundles and Missing Info

Build:

* operational_bundles table
* gap detection output
* missing questions
* contractor review needed flag

Acceptance:

* inspection findings grouped
* missing info visible
* contractor review candidates selected

## Stage 7 — Contractor Assignment and No-Login Review Link

Build:

* contractor_assignments table
* secure token system
* token hash storage
* token expiration
* scoped review page

Acceptance:

* admin/agent sends selected items to contractor
* contractor opens link
* contractor sees only assigned items
* contractor cannot browse app
* contractor action logged

## Stage 8 — Contractor Review and Upload

Build:

* contractor_responses
* contractor_uploaded_sources
* contractor upload UI
* review draft and upload own estimate in same session
* Phase 2 placeholder text

Acceptance:

* contractor can mark Looks Right
* contractor can request walkthrough
* contractor can upload own estimate/scope
* upload stored as source evidence
* contractor_uploaded_source true
* contractor_verified_ai_summary false by default

## Stage 9 — AI Structures Contractor Upload

Build:

* structured_contractor_summaries table
* explicit admin-triggered structuring
* status = needs_admin_review

Acceptance:

* AI structures contractor upload
* output is draft
* admin review required
* agent cannot see until verified

## Stage 10 — Admin Verification Gate

Build:

* admin review screen
* edit summary
* approve summary
* reject summary
* event logging
* agent_visible server-side update only

Acceptance:

* admin verifies structured summary
* previous and edited values logged
* agent sees only approved version
* browser cannot set approval fields directly

## Stage 11 — Seller Summary

Build:

* reports table
* generate seller summary from approved data
* label known/unknown/review status

Acceptance:

* report uses approved/visible data
* draft data labeled clearly
* no rejected items included
* report can be viewed/exported

## Stage 12 — Memory Candidate

Build:

* memory_candidates table
* candidate generation from approved outcome
* provenance required
* no automatic memory commitment

Acceptance:

* memory candidate cannot be created without source, admin reviewer, approval timestamp, evidence IDs
* candidate status = needs_review
* admin can later approve memory

---

# 15. RLS Policy Requirements

Every table must have RLS enabled.

General rules:

* owner/admin can manage all
* agent can view own properties and granted properties
* PM can view assigned/owned portfolio
* contractor can only access assigned review/session data
* seller_owner can only view approved report-level data
* viewer has no protected access unless granted

Example policy logic, expressed in plain language:

profiles:

* user can read own profile
* admin can read all
* only admin/owner can update roles

properties:

* admin/owner can select all
* creator can select own
* users in property_access can select
* only admin/owner/assigned manager can update

work_requests:

* same as property access
* insert allowed for authenticated agent/PM/admin
* update limited by role and assignment

files:

* admin can select all
* property-access users can select allowed files
* contractors can select files linked to their assignment
* signed URL generation must check permission first

contractor_assignments:

* admin can manage
* assigned contractor token can read only relevant assignment through controlled function
* agent can view assignments linked to their property if allowed

structured_contractor_summaries:

* admin can see drafts
* agent can see only agent_visible = true
* contractor can see summary only if linked and permitted
* browser cannot set admin_verified fields

memory_candidates:

* admin can create/review
* agents/contractors cannot create verified memory
* no public access

workflow_events:

* insert through server function
* select limited by property access
* no update/delete by normal users

---

# 16. Edge Functions / Server Functions

Use server-side functions for sensitive actions.

Required functions:

## create_property_with_request

Validates user and creates property/work request.

## upload_file_record

Creates file metadata after storage upload and logs event.

## get_signed_file_url

Checks access and returns short-lived signed URL.

## generate_inspection_findings

Runs inspection agent and stores draft outputs.

## approve_repair_item

Admin review function.

## create_contractor_assignment

Creates assignment and secure token.

## contractor_submit_response

Validates token and submits contractor response.

## contractor_upload_source

Validates token, stores upload record, marks source evidence.

## structure_contractor_upload

Runs AI on contractor source, creates draft structured summary.

## admin_verify_structured_summary

Only admin can approve/edit structured contractor summary.

## make_summary_agent_visible

Only after admin or contractor verification.

## create_memory_candidate

Requires approved source and full provenance.

## log_workflow_event

Immutable event logging helper.

---

# 17. Environment Variables

Use .env locally and Vercel env vars in deployment.

Required:

* VITE_SUPABASE_URL
* VITE_SUPABASE_ANON_KEY
* SUPABASE_SERVICE_ROLE_KEY server only
* OPENAI_API_KEY server only
* APP_BASE_URL
* SIGNED_URL_EXPIRY_SECONDS
* CONTRACTOR_LINK_EXPIRY_HOURS

Never expose:

* service role key
* OpenAI key
* private webhook secrets
* admin secrets

Frontend may only use:

* Supabase URL
* Supabase anon key

---

# 18. Solo Founder Security Learning Path

The founder must understand these mechanisms before public launch.

## Week 1 — Auth and Roles

Learn:

* what authentication means
* Supabase Auth
* profiles table
* role-based access
* why app role is separate from login identity

Build:

* login
* logout
* profile fetch
* admin role check

Test:

* admin sees admin screen
* agent does not

## Week 2 — RLS

Learn:

* what Row Level Security is
* why frontend checks are not enough
* how policies control database access
* why anon key is safe only with RLS

Build:

* RLS on properties
* RLS on work_requests
* property_access table

Test:

* agent A cannot see agent B property
* contractor cannot query unrelated data

## Week 3 — Storage Security

Learn:

* public vs private buckets
* signed URLs
* file metadata table
* access logging

Build:

* private upload
* signed URL retrieval
* file_access_events

Test:

* direct public URL does not work
* signed URL expires
* unauthorized user cannot generate signed URL

## Week 4 — Server Authority

Learn:

* why the browser is untrusted
* what Edge Functions do
* service role key danger
* server-side validation

Build:

* function for approving repair item
* function for contractor assignment
* function for signed URL retrieval

Test:

* browser cannot update admin_verified directly
* malicious request rejected

## Week 5 — Audit Logs and Immutability

Learn:

* workflow_events
* audit trails
* soft deletion
* why memory needs provenance

Build:

* workflow_events insert helper
* admin review events
* memory candidate provenance check

Test:

* every major action creates event
* edits store previous and new values

## Week 6 — Secure Contractor Links

Learn:

* token hashing
* token expiration
* scoped access
* revocation

Build:

* contractor_assignment token
* no-login review link
* token expiration
* token revocation

Test:

* expired link fails
* contractor sees only assigned repair items
* revoked link fails

---

# 19. Non-Negotiable Security Acceptance Tests

Before real pilot:

1. Admin can create property.
2. Agent can create property.
3. Agent cannot see another agent’s property.
4. Contractor cannot log in and browse properties.
5. Contractor review link only shows assigned items.
6. Contractor upload is stored as source evidence.
7. AI-structured contractor summary is draft.
8. Agent cannot see unverified contractor summary.
9. Browser cannot set agent_visible directly.
10. Browser cannot set admin_verified_structured_summary directly.
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

---

# 20. UX Requirements

## 20.1 Navigation

Use minimal navigation:

* Properties
* Requests
* Reports
* Settings

Inside property, use progressive reveal:

* Property Summary
* Media
* Inspection Findings
* Repair Items
* Missing Info
* Contractor Input
* Scope Summary
* Seller Report
* History / Advanced

Do not use heavy tabs if stacked reveal cards are better.

## 20.2 Property Timeline

Every property should have timeline events:

* property created
* inspection uploaded
* repair items generated
* admin reviewed
* contractor assigned
* contractor opened link
* contractor uploaded scope
* AI structured upload
* admin verified summary
* seller report generated
* memory candidate created

The user should see what happened and what comes next.

## 20.3 Contractor Review Page

The contractor page must be mobile-first.

It should show:

* property context
* limited assigned repair items
* photos/files relevant to assignment
* inspection excerpts
* requested turnaround
* response buttons
* upload option
* notes field
* Phase 2 placeholder

Text:

Today:
Upload your estimate or scope. Shelter Prep will structure it and admin will verify before it is shared.

Coming later:
Contractors will be able to confirm the structured summary directly before it is shared or saved to memory.

## 20.4 Admin Review Screen

Admin must see side-by-side:

Left:

* contractor source document
* inspection excerpt
* original evidence
* uploaded file link

Right:

* AI structured summary
* line items
* labor assumptions
* materials
* exclusions
* missing info
* confidence

Actions:

* Approve
* Edit and Approve
* Reject
* Request Contractor Clarification
* Mark Needs Walkthrough
* Save as Memory Candidate later

---

# 21. Reports

Seller-facing reports should include:

* property summary
* top repair concerns
* must-address items
* contractor-informed direction
* repair-vs-credit candidates
* unknowns
* recommended next steps
* status labels
* disclaimers that AI outputs are reviewed/draft as applicable

Reports must not include:

* unverified AI drafts as fact
* contractor private notes unless approved
* unsupported claims
* rejected repair items
* internal admin comments
* unrelated property data

Report language must be calm, not alarmist.

---

# 22. Memory Rules

Memory is expensive.

Do not pollute it.

Memory sources:

* human corrections
* contractor feedback tied to assignment
* admin-verified contractor-uploaded scopes
* approved estimates
* actual job outcomes
* photo labels
* job session notes
* material usage logs
* admin-approved external lessons
* completed work reports

Memory rules:

* AI suggestions are drafts.
* Human approval is required.
* Contractor feedback requires scoped assignment.
* Unverified internet research does not become memory.
* Memory must include applies_when and does_not_apply_when.
* Conflicts must be surfaced, not silently resolved.
* Memory cannot be created without provenance.
* Predictions and suggestions are not memory.
* Verified outcomes create memory.

Memory authority levels:

* personal preference
* project-specific
* company standard
* field best practice
* code/compliance

Only human-verified operational rules and company standards should influence outputs automatically.

---

# 23. Build Restraint Rules

Do not build these in Phase 1:

* full contractor portal
* public contractor marketplace
* contractor subscription billing
* homeowner app
* predictive maintenance
* LiDAR
* full mobile native app
* automated purchasing
* automated emails to clients without approval
* autonomous estimator
* complex scheduling engine
* AI agent debate system
* always-on background agents
* unreviewed memory learning
* public file buckets for private data

Phase 1 is:

* property intake
* inspection/file upload
* repair organization
* contractor input
* admin verification
* seller-ready direction
* memory candidate foundation
* secure solo-operated backend

---

# 24. Success Metrics

Do not focus on vanity metrics.

Track:

* properties created
* inspections uploaded
* photos/files uploaded
* repair items generated
* repair items reviewed
* contractor assignments sent
* contractor links opened
* contractor responses submitted
* contractor uploads submitted
* AI structured contractor uploads created
* admin-verified summaries
* seller reports generated
* repeat users
* repeat properties
* repeat contractor participation
* memory candidates created
* memory candidates approved later

Best adoption framework:

Input → Organized → Reviewed → Routed → Contractor Input → Verified → Reported → Remembered → Repeated

The product is working when users repeat the loop.

---

# 25. Final Product Constitution

Article 1: Human Authority
AI may draft. Humans approve. AI never performs irreversible actions without human authorization.

Article 2: Verified Truth
Observed reality outranks model confidence.

Article 3: Property First
The property is the primary object. Inspections, repairs, outcomes, contractors, reports, and memory attach to the property.

Article 4: Contractors Are Knowledge Sources
Contractors are not inventory. They are field intelligence partners.

Article 5: Contractor Upload Is Evidence
Contractor-uploaded scope is source evidence. AI-structured summaries require verification.

Article 6: Outcome Before Memory
Predictions and suggestions are not memory. Verified outcomes and approved corrections create memory.

Article 7: No Source, No Claim
Every important claim must trace to evidence, source, reviewer, or outcome.

Article 8: Scoped Access
People only see what their role and assignment allow.

Article 9: Friction Is a Cost
Every click, field, login, and workflow step must justify itself.

Article 10: Calm Wins
Shelter Prep must reduce operational stress, not add software noise.

---

# 26. Codex Operating Instructions

When editing code:

1. Read this document first.
2. Do not expand scope without explicit instruction.
3. Preserve security rules.
4. Preserve human review.
5. Preserve contractor-upload vs contractor-verified distinction.
6. Keep Phase 1 narrow.
7. Build backend trust before AI features.
8. Use server-side functions for protected actions.
9. Ensure RLS exists before relying on frontend role checks.
10. Add tests or manual acceptance steps with every major change.
11. Never expose service keys.
12. Never commit secrets.
13. Never create public buckets for private property data.
14. Never let AI output become memory automatically.
15. Never let contractor uploads become agent-visible without verification.

If there is a conflict between speed and trust, choose trust.

If there is a conflict between AI convenience and human approval, choose human approval.

If there is a conflict between feature expansion and Phase 1 focus, choose Phase 1 focus.

End of master prompt.
