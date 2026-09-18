-- Permit the existing server-only outbox to record one reviewed-result delivery.

begin;

alter table public.phase1_notifications
  drop constraint if exists phase1_notifications_event_type_check;

alter table public.phase1_notifications
  add constraint phase1_notifications_event_type_check
  check (event_type in ('needs_review', 'processing_failed', 'reviewed_result_ready'));

commit;

-- Manual rollback:
-- delete from public.phase1_notifications where event_type = 'reviewed_result_ready';
-- alter table public.phase1_notifications drop constraint if exists phase1_notifications_event_type_check;
-- alter table public.phase1_notifications add constraint phase1_notifications_event_type_check
--   check (event_type in ('needs_review', 'processing_failed'));
