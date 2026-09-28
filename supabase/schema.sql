-- ASC Business: database schema for Supabase.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to run again: everything is create-if-missing or create-or-replace.
--
-- How access works
--   Owners (signed in) read and write their own app, enquiries and subscriber list, through RLS.
--   Customers (not signed in) never touch the tables. They call the functions at the bottom,
--   which are the only way in: read a published app, send a form, turn notifications on or off.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One app per owner. `data` holds everything the owner edits:
-- { business, posts, events, notices, forms, links }.
create table if not exists public.apps (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null unique references auth.users (id) on delete cascade,
  slug       text not null unique
             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 70),
  data       jsonb not null default '{}'::jsonb
             check (octet_length(data::text) < 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Answers customers send from a form. Written only by submit_form().
create table if not exists public.submissions (
  id         uuid primary key default gen_random_uuid(),
  app_id     uuid not null references public.apps (id) on delete cascade,
  form_id    text not null,
  form_name  text not null,
  answers    jsonb not null,            -- [{ "label": "...", "value": "..." }]
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists submissions_app_created_idx
  on public.submissions (app_id, created_at desc);

-- One row per customer device that turned notifications on. Written only by subscribe_device().
create table if not exists public.subscribers (
  id         uuid primary key default gen_random_uuid(),
  app_id     uuid not null references public.apps (id) on delete cascade,
  device_id  text not null check (length(device_id) between 8 and 64),
  created_at timestamptz not null default now(),
  unique (app_id, device_id)
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists apps_touch_updated_at on public.apps;
create trigger apps_touch_updated_at
  before update on public.apps
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.apps        enable row level security;
alter table public.submissions enable row level security;
alter table public.subscribers enable row level security;

-- Signed-out visitors get nothing from the tables directly.
revoke all on public.apps, public.submissions, public.subscribers from anon;

-- Signed-in owners: tighten to exactly what the dashboard does.
revoke all on public.apps, public.submissions, public.subscribers from authenticated;
grant select, insert, delete on public.apps to authenticated;
grant update (data)          on public.apps to authenticated;   -- slug and owner never change
grant select, delete         on public.submissions to authenticated;
grant update (read)          on public.submissions to authenticated;
grant select                 on public.subscribers to authenticated;

drop policy if exists apps_owner on public.apps;
create policy apps_owner on public.apps
  for all to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists submissions_owner on public.submissions;
create policy submissions_owner on public.submissions
  for all to authenticated
  using (exists (
    select 1 from public.apps a
    where a.id = submissions.app_id and a.owner_id = (select auth.uid())
  ));

drop policy if exists subscribers_owner on public.subscribers;
create policy subscribers_owner on public.subscribers
  for select to authenticated
  using (exists (
    select 1 from public.apps a
    where a.id = subscribers.app_id and a.owner_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- Customer-facing functions (security definer: they run with the owner's rights,
-- so they validate everything themselves)
-- ---------------------------------------------------------------------------

-- The published app for a slug, or null. Scheduled notifications stay hidden until their time,
-- then appear as sent, even if the owner's browser is closed.
create or replace function public.get_public_app(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select a.data || jsonb_build_object('notices', coalesce((
    select jsonb_agg(
             case when n->>'status' = 'sent' then n
                  else n || jsonb_build_object('status', 'sent', 'sentAt', n->>'scheduledFor')
             end)
    from jsonb_array_elements(coalesce(a.data->'notices', '[]'::jsonb)) n
    where case
            when n->>'status' = 'sent' then true
            when nullif(n->>'scheduledFor', '') is null then false
            else (n->>'scheduledFor')::timestamptz <= now()
          end
  ), '[]'::jsonb))
  from public.apps a
  where a.slug = p_slug
$$;

-- A customer sends a form. The form must exist in the app; the name comes from the app, not the caller.
create or replace function public.submit_form(p_slug text, p_form_id text, p_answers jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_app  public.apps;
  v_form jsonb;
begin
  select * into v_app from public.apps where slug = p_slug;
  if not found then
    raise exception 'App not found';
  end if;

  select f into v_form
  from jsonb_array_elements(coalesce(v_app.data->'forms', '[]'::jsonb)) f
  where f->>'id' = p_form_id
  limit 1;
  if v_form is null then
    raise exception 'Form not found';
  end if;

  if jsonb_typeof(p_answers) <> 'array'
     or jsonb_array_length(p_answers) > 30
     or octet_length(p_answers::text) > 20000 then
    raise exception 'Invalid answers';
  end if;

  -- Flood guard: an app can take at most 200 enquiries an hour.
  if (select count(*) from public.submissions
      where app_id = v_app.id and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Too many enquiries, try again later';
  end if;

  insert into public.submissions (app_id, form_id, form_name, answers)
  values (v_app.id, p_form_id, coalesce(v_form->>'name', 'Form'), p_answers);
end $$;

create or replace function public.subscribe_device(p_slug text, p_device_id text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_app_id uuid;
begin
  select id into v_app_id from public.apps where slug = p_slug;
  if v_app_id is null then
    raise exception 'App not found';
  end if;
  insert into public.subscribers (app_id, device_id)
  values (v_app_id, p_device_id)
  on conflict (app_id, device_id) do nothing;
end $$;

create or replace function public.unsubscribe_device(p_slug text, p_device_id text)
returns void
language sql security definer set search_path = ''
as $$
  delete from public.subscribers s
  using public.apps a
  where a.slug = p_slug and s.app_id = a.id and s.device_id = p_device_id
$$;

revoke all on function public.get_public_app(text)               from public;
revoke all on function public.submit_form(text, text, jsonb)      from public;
revoke all on function public.subscribe_device(text, text)        from public;
revoke all on function public.unsubscribe_device(text, text)      from public;
grant execute on function public.get_public_app(text)             to anon, authenticated;
grant execute on function public.submit_form(text, text, jsonb)    to anon, authenticated;
grant execute on function public.subscribe_device(text, text)      to anon, authenticated;
grant execute on function public.unsubscribe_device(text, text)    to anon, authenticated;
