-- Push endpoints contain device credentials. Only the server may access them.
create table public.push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 2048),
  device_id uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  keys jsonb not null check (jsonb_typeof(keys) = 'object' and keys ? 'p256dh' and keys ? 'auth'),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

create table public.push_deliveries (
  message_id uuid not null references public.messages(id) on delete cascade,
  device_id uuid not null references public.push_subscriptions(device_id) on delete cascade on update cascade,
  created_at timestamptz not null default now(),
  primary key(message_id, device_id)
);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public, anon, authenticated;
grant select, insert, delete on public.push_deliveries to service_role;

-- Account deletion is soft deletion in this app. Detach every device atomically.
create function private.clear_member_push() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not new.active then
    delete from public.push_subscriptions where user_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.clear_member_push() from public, anon, authenticated;
create trigger clear_member_push after update of active on private.members
for each row execute function private.clear_member_push();
