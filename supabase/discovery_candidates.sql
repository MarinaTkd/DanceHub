create table if not exists public.discovery_candidates (
  id           uuid        primary key default gen_random_uuid(),
  facebook_url text        not null unique,
  title        text,
  description  text,
  found_at     timestamptz not null default now(),
  reviewed     boolean     not null default false
);

alter table public.discovery_candidates enable row level security;

create policy "authenticated full access on discovery_candidates"
  on public.discovery_candidates
  for all
  to authenticated
  using (true)
  with check (true);
