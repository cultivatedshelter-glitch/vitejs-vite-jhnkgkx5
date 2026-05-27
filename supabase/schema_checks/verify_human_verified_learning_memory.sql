-- Human-verified learning memory schema verification.
-- Run these in the Supabase SQL editor after applying migrations.

select table_name
from information_schema.tables
where table_schema = 'public'
  and (
    table_name ilike '%memory%'
    or table_name ilike '%learning%'
    or table_name ilike '%pricing%'
  )
order by table_name;

select count(*) from public.human_pricing_memory;
select count(*) from public.photo_field_memory;
select count(*) from public.job_execution_step_learning;
