begin;

create or replace function private.phase1_guard_profile_trusted_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' and (new.role <> 'viewer' or new.active is distinct from true) then
      raise exception 'Authenticated clients cannot assign trusted profile fields';
    end if;

    if tg_op = 'UPDATE' and (
      new.role is distinct from old.role
      or new.active is distinct from old.active
    ) then
      raise exception 'Authenticated clients cannot change trusted profile fields';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.phase1_guard_profile_trusted_fields() from public;
revoke all on function private.phase1_guard_profile_trusted_fields() from anon;
revoke all on function private.phase1_guard_profile_trusted_fields() from authenticated;

drop trigger if exists phase1_profiles_guard_trusted_fields on public.profiles;
create trigger phase1_profiles_guard_trusted_fields
before insert or update on public.profiles
for each row execute function private.phase1_guard_profile_trusted_fields();

commit;

-- Manual rollback:
-- drop trigger if exists phase1_profiles_guard_trusted_fields on public.profiles;
-- drop function if exists private.phase1_guard_profile_trusted_fields();
