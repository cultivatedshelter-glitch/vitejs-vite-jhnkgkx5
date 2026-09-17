-- Explicit Phase 1 server grants for projects without automatic Data API exposure.

begin;

grant select, insert, update, delete on table
  public.profiles,
  public.properties,
  public.property_access,
  public.work_requests,
  public.model_runs,
  public.inspection_pipeline_runs,
  public.inspection_reports,
  public.inspection_report_pages,
  public.evidence_items,
  public.inspection_findings,
  public.inspection_images,
  public.photo_interpretations,
  public.repair_bundles,
  public.verification_questions,
  public.review_events,
  public.workflow_events,
  public.contractor_inputs,
  public.contractor_scope_packets,
  public.agent_reports
to service_role;

-- Supabase creates this event-trigger helper on clean projects. It is not a
-- browser RPC and should not retain PostgreSQL's default PUBLIC execute grant.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

commit;
