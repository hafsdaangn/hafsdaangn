create table private.app_settings (
  singleton boolean primary key default true check(singleton),
  environment text not null default 'production' check(environment in ('production','development'))
);
insert into private.app_settings default values;
alter table private.app_settings enable row level security;
revoke all on private.app_settings from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, update on private.app_settings to service_role;
create function public.set_app_environment(environment text) returns void
language sql security invoker set search_path = '' as $$
  update private.app_settings set environment = $1 where singleton;
$$;
revoke all on function public.set_app_environment(text) from public, anon, authenticated;
grant execute on function public.set_app_environment(text) to service_role;
create or replace function private.is_member() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join private.members m on m.id=u.id
    where u.id=auth.uid() and m.active and u.email_confirmed_at is not null
    and ((select environment from private.app_settings where singleton) = 'development'
      or lower(u.email) ~ '^[^[:space:]@]+@hafs[.]hs[.]kr$')
    and u.raw_app_meta_data->>'provider' = 'google');
$$;
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'provider' is distinct from 'google' or
    ((select environment from private.app_settings where singleton) is distinct from 'development'
      and lower(coalesce(new.email,'')) !~ '^[^[:space:]@]+@hafs[.]hs[.]kr$') then
    raise exception '학교 Google 계정만 가입할 수 있어요.';
  end if;
  insert into public.profiles(id) values(new.id);
  insert into private.members(id) values(new.id);
  return new;
end; $$;
