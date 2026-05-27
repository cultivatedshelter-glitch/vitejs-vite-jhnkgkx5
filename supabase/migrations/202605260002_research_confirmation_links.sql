-- Admin Research Confirmation Links for Source Research Agent.
-- Adds admin-facing source review metadata to agent_research_sources.
-- Does not drop tables/functions and does not disable RLS.

alter table if exists public.agent_research_sources
  add column if not exists admin_confirmation_status text not null default 'not_reviewed',
  add column if not exists report_visibility text not null default 'internal_only',
  add column if not exists consumer_summary text,
  add column if not exists admin_notes text,
  add column if not exists checked_at timestamptz,
  add column if not exists checked_by uuid references auth.users(id) on delete set null;

alter table if exists public.agent_research_sources
  drop constraint if exists agent_research_sources_admin_confirmation_status_check;

alter table if exists public.agent_research_sources
  add constraint agent_research_sources_admin_confirmation_status_check
  check (admin_confirmation_status in (
    'not_reviewed',
    'confirms',
    'partially_supports',
    'does_not_support',
    'needs_more_research'
  ));

alter table if exists public.agent_research_sources
  drop constraint if exists agent_research_sources_report_visibility_check;

alter table if exists public.agent_research_sources
  add constraint agent_research_sources_report_visibility_check
  check (report_visibility in (
    'internal_only',
    'report_candidate',
    'report_approved',
    'report_hidden',
    'rejected'
  ));

create index if not exists agent_research_sources_confirmation_idx
  on public.agent_research_sources(admin_confirmation_status);

create index if not exists agent_research_sources_report_visibility_idx
  on public.agent_research_sources(report_visibility);
