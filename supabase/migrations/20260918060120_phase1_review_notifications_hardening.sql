begin;

create index if not exists phase1_notifications_processing_request_idx
  on public.phase1_notifications(processing_request_id);
create index if not exists phase1_notifications_work_request_idx
  on public.phase1_notifications(work_request_id)
  where work_request_id is not null;

drop policy if exists phase1_notifications_deny_browser_access on public.phase1_notifications;
create policy phase1_notifications_deny_browser_access
on public.phase1_notifications
for all
to anon, authenticated
using (false)
with check (false);

commit;
