-- =============================================================
-- Dance Prague — Supabase schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- =============================================================

-- -----------------------------------------------------------
-- 1. events table
-- -----------------------------------------------------------
create table if not exists public.events (
  id                uuid        primary key default gen_random_uuid(),
  facebook_event_id text        not null unique,
  title             text        not null,
  description       text,
  start_at          timestamptz not null,
  end_at            timestamptz,
  location_name     text,
  location_address  text,
  cover_image_url   text,
  facebook_url      text        not null,
  dance_styles      text[]      not null default '{}',
  is_visible        boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------
-- 2. source_pages table
-- -----------------------------------------------------------
create table if not exists public.source_pages (
  id                uuid    primary key default gen_random_uuid(),
  facebook_url      text    not null unique,
  label             text    not null,
  dance_style_hint  text,
  is_active         boolean not null default true
);

-- -----------------------------------------------------------
-- 3. updated_at auto-update trigger on events
-- -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
  before update on public.events
  for each row
  execute function public.set_updated_at();

-- -----------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------
alter table public.events      enable row level security;
alter table public.source_pages enable row level security;

-- -----------------------------------------------------------
-- 5. RLS policies
-- -----------------------------------------------------------

-- Public (anon) can read visible events only
create policy "anon can read visible events"
  on public.events
  for select
  to anon
  using (is_visible = true);

-- Authenticated users (used by server-side API routes) can do anything
create policy "authenticated full access on events"
  on public.events
  for all
  to authenticated
  using (true)
  with check (true);

create policy "authenticated full access on source_pages"
  on public.source_pages
  for all
  to authenticated
  using (true)
  with check (true);

-- -----------------------------------------------------------
-- 6. Indexes
-- -----------------------------------------------------------

-- Efficient ascending sort for upcoming events
create index if not exists events_start_at_idx
  on public.events (start_at);

-- Efficient array containment queries on dance_styles
create index if not exists events_dance_styles_gin_idx
  on public.events using gin (dance_styles);
