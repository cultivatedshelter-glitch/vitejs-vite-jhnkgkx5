create extension if not exists pgcrypto;

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  event_title text not null,
  event_body text,
  property_id bigint references public.properties(id) on delete set null,
  file_id uuid,
  repair_item_id uuid,
  severity text not null default 'normal'
    check (severity in ('normal', 'high', 'urgent')),
  status text not null default 'unread'
    check (status in ('unread', 'read', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists notification_events_created_at_idx on public.notification_events(created_at desc);
create index if not exists notification_events_status_idx on public.notification_events(status);
create index if not exists notification_events_property_id_idx on public.notification_events(property_id);

-- Phase 1 is in-app notifications only.
-- Email/SMS/push delivery is intentionally excluded in this phase.
-- Notification creation should eventually move server-side or through admin-scoped RPC.

alter table public.notification_events enable row level security;

drop policy if exists notification_events_authenticated_select on public.notification_events;
create policy notification_events_authenticated_select
  on public.notification_events
  for select
  to authenticated
  using (auth.uid() is not null);

drop policy if exists notification_events_authenticated_insert on public.notification_events;
create policy notification_events_authenticated_insert
  on public.notification_events
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists notification_events_authenticated_update_status on public.notification_events;
create policy notification_events_authenticated_update_status
  on public.notification_events
  for update
  to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Keep anon exposure closed in Phase 1.
revoke all on public.notification_events from anon;

-- Limit client-side updates to status only.
revoke update on public.notification_events from authenticated;
grant select, insert on public.notification_events to authenticated;
grant update(status) on public.notification_events to authenticated;
