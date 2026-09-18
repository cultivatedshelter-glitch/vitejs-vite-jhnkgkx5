-- Server-owned Phase 1 review and processing-failure email outbox.

begin;

create table if not exists public.phase1_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  work_request_id uuid references public.work_requests(id) on delete set null,
  processing_request_id uuid not null references public.inspection_pipeline_runs(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  recipient text not null,
  channel text not null default 'email',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivery_status text not null default 'pending',
  provider text,
  provider_message_id text,
  failure_reason text,
  attempt_count integer not null default 0,
  last_attempt_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint phase1_notifications_event_type_check
    check (event_type in ('needs_review', 'processing_failed')),
  constraint phase1_notifications_channel_check
    check (channel = 'email'),
  constraint phase1_notifications_delivery_status_check
    check (delivery_status in ('pending', 'sending', 'sent', 'failed')),
  constraint phase1_notifications_attempt_count_check
    check (attempt_count >= 0),
  constraint phase1_notifications_recipient_check
    check (position('@' in recipient) > 1)
);

create unique index if not exists phase1_notifications_event_dedupe_idx
  on public.phase1_notifications(event_type, processing_request_id, recipient, channel);
create index if not exists phase1_notifications_property_created_idx
  on public.phase1_notifications(property_id, created_at desc);
create index if not exists phase1_notifications_delivery_idx
  on public.phase1_notifications(delivery_status, created_at);

alter table public.phase1_notifications enable row level security;

revoke all on public.phase1_notifications from anon, authenticated;
grant select, insert, update on public.phase1_notifications to service_role;

comment on table public.phase1_notifications is
  'Server-owned idempotent operational notification outbox. Browser roles have no access.';

commit;
